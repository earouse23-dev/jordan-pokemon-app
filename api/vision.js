import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getVercelOidcToken } from "@vercel/oidc";
import { serverEnvironment } from "../lib/env.js";
import {
  buildGatewayVisionRequest,
  applyPregradeContract,
  combineIndependentGradeAnalyses,
  extractGatewayOutput,
  normalizeVisionOutput,
  parseVisionRequest,
  requireHighGradeVerification,
} from "../lib/vision.js";
import {
  calibratePsaProbabilities,
  calculateMicaConditionScore,
  gradingModelBundle,
} from "../lib/grading.js";
import {
  applyGradingV3Contract,
  selectGradingReference,
} from "../lib/grading-v3.js";
import { predictPsaCalibration } from "../lib/psa-calibration.js";
import {
  availableGatewayVisionModels,
  selectGatewayVisionModels,
} from "../lib/gateway-models.js";
import {
  parseCatalogQuery,
  searchTcgdexCards,
} from "../lib/providers/tcgdex.js";
import {
  searchInternalCatalog,
  summarizeCatalogResolution,
} from "../lib/catalog-db.js";
import {
  buildGatewayAdvisorRequest,
  extractAdvisorOutput,
  normalizeAdvisorOutput,
  parseAdvisorRequest,
} from "../lib/advisor.js";

function send(response, status, body, headers = {}) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Vary", "Authorization");
  for (const [key, value] of Object.entries(headers))
    response.setHeader(key, value);
  return response.status(status).json(body);
}

const MAX_VISION_REQUEST_BYTES = 12_000_000;

function requestError(error) {
  return {
    invalid_mode: "Choose a supported AI analysis.",
    invalid_image_count: "Add every required image before analyzing.",
    invalid_capture_descriptors:
      "The precision photos no longer match this grading session. Start the capture again.",
    invalid_capture_measurements:
      "The camera measurement could not be verified. Retake the card inside the guide.",
    invalid_image_type: "Use a JPEG, PNG, or WebP image.",
    invalid_candidates: "Choose two to four verified catalog candidates.",
    invalid_idempotency_key: "Start a new scan and try again.",
    invalid_scan_session: "Start a new grading scan and try again.",
    image_too_large:
      "The prepared image is too large. Retake it closer to the card.",
  }[error?.message];
}

function calibrationCohort(analysis = {}) {
  const finish = [analysis.identity?.finish, analysis.identity?.variant]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const finishClass = /rainbow|hyper rare/.test(finish)
    ? "rainbow_hyper_rare"
    : /etched/.test(finish)
      ? "etched"
      : /radiant/.test(finish)
        ? "radiant"
        : /texture/.test(finish)
          ? "textured_full_art"
          : /full art/.test(finish)
            ? "full_art"
            : /reverse/.test(finish)
              ? "reverse_holo"
              : /holo|foil/.test(finish)
                ? "traditional_holo"
                : finish
                  ? "non_holo"
                  : "unknown";
  const language = String(analysis.identity?.language || "unknown")
    .trim()
    .toLowerCase();
  return {
    finishClass,
    language: language === "japanese" ? "ja" : language,
    manufacturingEra: "unknown",
  };
}

async function applyActivePsaCalibration(database, analysis) {
  const cohort = calibrationCohort(analysis);
  const { data: artifact, error } = await database.rpc(
    "grading_active_calibration_service",
    { p_cohort: cohort },
  );
  if (error || !artifact) return analysis;
  const calibration = predictPsaCalibration(analysis, artifact, cohort);
  if (!calibration) return analysis;
  return applyPregradeContract({
    ...analysis,
    psaPrediction: calibratePsaProbabilities({
      quality: analysis.quality,
      condition: analysis.condition,
      defects: analysis.condition?.defects,
      calibration,
    }),
    modelBundle: {
      ...(analysis.modelBundle || {}),
      calibrationModel: calibration.version,
      validated: true,
    },
  });
}

async function loadPersistedGradingResponse(database, userId, scanSessionId) {
  const { data: session, error: sessionError } = await database
    .from("grading_scan_sessions")
    .select(
      "id,identity_snapshot,workflow_status,model_bundle_version,rubric_version,completed_at",
    )
    .eq("id", scanSessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (
    sessionError ||
    !session ||
    !["completed", "abstained"].includes(session.workflow_status)
  )
    return null;
  const [{ data: prediction }, { data: evidence }] = await Promise.all([
    database
      .from("grading_predictions")
      .select("*")
      .eq("scan_session_id", scanSessionId)
      .eq("user_id", userId)
      .maybeSingle()
      .then((result) => (result.error ? { data: null } : result)),
    database
      .from("grading_evidence")
      .select(
        "side,defect_category,region,severity,confidence,description,verification_status",
      )
      .eq("scan_session_id", scanSessionId)
      .eq("user_id", userId)
      .order("created_at")
      .then((result) => (result.error ? { data: [] } : result)),
  ]);
  if (!prediction) return null;
  const defects = (evidence || []).map((finding) => ({
    side: finding.side,
    category: finding.defect_category,
    area: finding.defect_category,
    region: finding.region,
    severity: finding.severity,
    confidence: Number(finding.confidence),
    evidence: finding.description,
    verificationStatus: finding.verification_status,
  }));
  const restoredCondition = {
    estimatedGradeLow:
      prediction.condition_low == null
        ? null
        : Number(prediction.condition_low),
    estimatedGradeHigh:
      prediction.condition_high == null
        ? null
        : Number(prediction.condition_high),
    rawCondition: "unknown",
    subscores: prediction.subscores || [],
    centering: prediction.centering_measurements || {},
    defects,
    captureRequests: [],
    confidence: Number(prediction.confidence),
  };
  return {
    analysis: {
      quality: {
        usable: true,
        confidence: Number(prediction.confidence || 0),
        issues: [],
        overallConfidence: 1,
      },
      identity: session.identity_snapshot || {},
      condition: restoredCondition,
      consensus:
        prediction.review_consensus &&
        Object.keys(prediction.review_consensus).length
          ? prediction.review_consensus
          : null,
      micaConditionScore: calculateMicaConditionScore({
        quality: { usable: true, confidence: Number(prediction.confidence) },
        condition: restoredCondition,
      }),
      psaPrediction: {
        status:
          prediction.estimate_status === "abstained" ? "abstained" : "estimate",
        mostLikelyGrade:
          prediction.most_likely_grade == null
            ? null
            : Number(prediction.most_likely_grade),
        probabilities: prediction.grade_probabilities || [],
        confidence: Number(prediction.confidence),
        reasons: prediction.abstention_reason
          ? [prediction.abstention_reason]
          : [],
        calibrationVersion: prediction.calibration_version,
        outcomeRisks: prediction.outcome_risks || {
          status: "unavailable",
          validated: false,
        },
        validated: prediction.professional_prediction_status === "validated",
      },
      micaPregrade:
        prediction.pregrade_score == null
          ? null
          : {
              status: "estimate",
              score: Number(prediction.pregrade_score),
              basis:
                prediction.pregrade_basis || "visible_condition_measurement",
              targetGrader: "PSA",
              mostLikelyGrade:
                prediction.most_likely_grade == null
                  ? null
                  : Number(prediction.most_likely_grade),
              validatedPsaProbabilities:
                prediction.professional_prediction_status === "validated",
              rubricVersion:
                prediction.evidence_profile?.version ===
                "mica-evidence-profile-v3"
                  ? "mica-pregrade-v3"
                  : "mica-pregrade-v2",
            },
      evidenceProfile: prediction.evidence_profile || {},
      gradingWorkflow: prediction.evidence_profile?.workflow || null,
      referenceComparison:
        prediction.evidence_profile?.referenceComparison || null,
      model: prediction.model_bundle_version,
      modelBundle: {
        version: prediction.model_bundle_version,
        rubricVersion: prediction.rubric_version,
      },
      requiresConfirmation: true,
    },
    catalogResolution: null,
    mode: "grade",
    provider: "saved-report",
    model: prediction.model_bundle_version,
    modelCatalogVerified: false,
    processedAt: session.completed_at,
    privacy: { imagePersisted: false, resultPersisted: true },
    metrics: {
      latencyMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      reused: true,
    },
  };
}

export async function visionHandler(
  request,
  response,
  { createClient: createClientImpl = createClient } = {},
) {
  const startedAt = Date.now();
  const advisorMode = request.body?.mode === "advisor";
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return send(response, 405, { error: "Method not allowed" });
  }
  const declaredRequestBytes = Number(request.headers["content-length"] || 0);
  if (
    Number.isFinite(declaredRequestBytes) &&
    declaredRequestBytes > MAX_VISION_REQUEST_BYTES
  )
    return send(response, 413, {
      error:
        "The prepared grading request is too large. Retake the card closer.",
      code: "vision_request_too_large",
    });
  let config;
  try {
    config = serverEnvironment();
  } catch {
    return send(response, 500, { error: "Server configuration is invalid" });
  }
  const supabaseAuthKey = config.supabasePublishableKey;
  if (!config.supabaseUrl || !supabaseAuthKey)
    return send(response, 503, {
      error: "Secure AI analysis is not configured.",
    });
  const authorization = String(request.headers.authorization || "");
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  if (!token) return send(response, 401, { error: "Authentication required" });

  const database = createClientImpl(config.supabaseUrl, supabaseAuthKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: identity, error: identityError } =
    await database.auth.getUser(token);
  if (identityError || !identity.user)
    return send(response, 401, { error: "Authentication required" });

  let gatewayToken = config.aiGatewayApiKey || config.vercelOidcToken;
  if (!gatewayToken) {
    try {
      gatewayToken = await getVercelOidcToken();
    } catch (error) {
      console.error("[api/vision] OIDC token unavailable", {
        name: error?.name || "Error",
      });
    }
  }
  if (!gatewayToken)
    return send(response, 503, {
      error: advisorMode
        ? "AI portfolio briefs are ready but the Vercel AI Gateway is not connected."
        : "AI analysis is ready but the Vercel AI Gateway is not connected.",
      code: advisorMode ? "advisor_not_configured" : "vision_not_configured",
    });

  let input;
  try {
    input = advisorMode
      ? { ...parseAdvisorRequest(request.body), mode: "advisor" }
      : parseVisionRequest(request.body);
  } catch (error) {
    return send(response, 400, {
      error: advisorMode
        ? "The portfolio brief request is invalid."
        : requestError(error) || "Invalid analysis request.",
    });
  }

  if (!config.supabaseSecretKey)
    return send(response, 503, {
      error: "Secure AI usage controls are not configured.",
      code: "vision_rate_limit_unavailable",
    });
  const serviceDatabase = createClientImpl(
    config.supabaseUrl,
    config.supabaseSecretKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: usage, error: usageError } = await serviceDatabase.rpc(
    "claim_ai_usage",
    {
      p_user_id: identity.user.id,
      p_event_type: advisorMode ? "portfolio_advisor" : "vision_analysis",
      p_maximum: advisorMode
        ? config.advisorMaxPerHour
        : config.visionMaxPerHour,
      p_window_seconds: 3600,
      p_idempotency_key:
        input.requestId ||
        input.scanSessionId ||
        String(request.headers["idempotency-key"] || "") ||
        null,
    },
  );
  if (usageError)
    return send(response, 503, {
      error: "Secure AI usage controls are not ready.",
      code: "vision_rate_limit_unavailable",
    });
  if (!usage?.allowed)
    return send(
      response,
      429,
      {
        error: advisorMode
          ? "AI portfolio brief limit reached. Try again later."
          : "AI analysis limit reached. Try again later.",
      },
      { "Retry-After": String(Math.max(1, Number(usage?.retryAfter) || 3600)) },
    );
  if (usage?.reused) {
    if (input.mode === "grade" && input.scanSessionId) {
      const saved = await loadPersistedGradingResponse(
        serviceDatabase,
        identity.user.id,
        input.scanSessionId,
      );
      if (saved) return send(response, 200, saved);
    }
    return send(response, 409, {
      error:
        "This analysis request is already in progress or has already been used. Start a new analysis and try again.",
      code: "vision_request_reused",
    });
  }

  const safetyIdentifier = createHash("sha256")
    .update(`${advisorMode ? "mica-advisor" : "mica"}:${identity.user.id}`)
    .digest("hex");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 50_000);
  const fetchGateway = (options) =>
    fetch("https://ai-gateway.vercel.sh/v1/responses", options);
  try {
    let modelCatalogVerified = false;
    let modelPlan = advisorMode
      ? [config.advisorModel]
      : [config.visionModel, ...config.visionFallbackModels];
    if (!advisorMode) {
      try {
        const available = await availableGatewayVisionModels({
          token: gatewayToken,
        });
        const verified = selectGatewayVisionModels(
          available,
          [config.visionModel, ...config.visionFallbackModels],
          {
            uniqueProviders: input.mode === "grade",
            maximum: input.mode === "grade" ? 5 : 1,
          },
        );
        if (verified.length) {
          modelPlan = verified;
          modelCatalogVerified = true;
        }
      } catch (error) {
        console.warn("[api/vision] model catalog verification unavailable", {
          name: error?.name || "Error",
        });
      }
    }
    const successfulResponses = [];
    const failedResponses = [];
    const precisionMode = !advisorMode && input.mode === "grade";
    const desiredResponseCount = precisionMode
      ? Math.min(3, modelPlan.length)
      : 1;
    const minimumResponseCount = precisionMode ? 2 : 1;
    const runModel = async (candidateModel, gradingReference = null) => {
      try {
        const upstream = await fetchGateway({
          method: "POST",
          headers: {
            Authorization: `Bearer ${gatewayToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            advisorMode
              ? buildGatewayAdvisorRequest({
                  input,
                  model: candidateModel,
                  safetyIdentifier,
                })
              : buildGatewayVisionRequest({
                  ...input,
                  gradingReference,
                  model: candidateModel,
                  safetyIdentifier,
                  metadata: {
                    feature:
                      input.mode === "grade"
                        ? "digital_grading"
                        : `vision_${input.mode}`,
                    environment:
                      process.env.VERCEL_ENV || process.env.NODE_ENV || "local",
                    scan_id: input.scanSessionId || "none",
                    model_bundle:
                      input.mode === "grade"
                        ? "mica-registered-reference-consensus-v3"
                        : "mica-psa-pregrade-v2",
                  },
                }),
          ),
          signal: controller.signal,
        });
        return {
          model: candidateModel,
          status: upstream.status,
          ok: upstream.ok,
          payload: await upstream.json().catch(() => null),
        };
      } catch (error) {
        return {
          model: candidateModel,
          status: error?.name === "AbortError" ? 504 : 502,
          ok: false,
          payload: null,
          error,
        };
      }
    };
    const firstModels = modelPlan.slice(0, desiredResponseCount);
    const firstResults = await Promise.all(firstModels.map(runModel));
    firstResults.forEach((result) => {
      if (result.ok)
        successfulResponses.push({
          model: result.model,
          payload: result.payload,
        });
      else
        failedResponses.push({
          model: result.model,
          status: result.status,
          payload: result.payload,
        });
    });
    for (
      let index = desiredResponseCount;
      index < modelPlan.length &&
      successfulResponses.length < minimumResponseCount;
      index += 1
    ) {
      const result = await runModel(modelPlan[index]);
      if (result.ok)
        successfulResponses.push({
          model: result.model,
          payload: result.payload,
        });
      else
        failedResponses.push({
          model: result.model,
          status: result.status,
          payload: result.payload,
        });
    }
    if (failedResponses.length)
      console.warn(
        "[api/vision] one or more verified models were unavailable",
        {
          attemptedModels: firstModels.length,
          failedModels: failedResponses.length,
          successfulModels: successfulResponses.length,
        },
      );
    if (successfulResponses.length < minimumResponseCount) {
      const failed = failedResponses.at(-1) || {
        status: 503,
        payload: null,
      };
      console.error("[api/vision] gateway request failed", {
        status: failed.status,
        successfulModels: successfulResponses.length,
        requiredModels: minimumResponseCount,
      });
      const billingRequired =
        failed.status === 402 ||
        (failed.status === 403 &&
          failed.payload?.error?.type === "customer_verification_required");
      const status = failed.status === 429 ? 429 : billingRequired ? 503 : 502;
      return send(response, status, {
        error:
          failed.status === 429
            ? advisorMode
              ? "AI guidance is busy. Try again shortly."
              : "AI analysis is busy. Try again shortly."
            : billingRequired
              ? advisorMode
                ? "AI guidance is waiting for the project owner to finish billing verification."
                : "AI analysis is waiting for the project owner to finish billing verification."
              : advisorMode
                ? "The AI guidance service could not prepare this brief."
                : input.mode === "grade"
                  ? "Precision grading needs at least two independent image reviews. Mica did not produce a one-model grade; try again shortly."
                  : "The AI analysis service could not process this image.",
        ...(billingRequired
          ? {
              code: advisorMode
                ? "advisor_billing_required"
                : "vision_billing_required",
            }
          : input.mode === "grade"
            ? { code: "vision_consensus_unavailable" }
            : {}),
      });
    }
    const primaryResponse = successfulResponses[0];
    const payload = primaryResponse.payload;
    let modelUsed = primaryResponse.model;
    if (advisorMode) {
      const brief = normalizeAdvisorOutput(
        extractAdvisorOutput(payload),
        input,
      );
      return send(response, 200, {
        brief,
        provider: "openai",
        model: modelUsed,
        processedAt: new Date().toISOString(),
        privacy: {
          portfolioDetailsSent: false,
          resultPersisted: false,
        },
        metrics: {
          latencyMs: Date.now() - startedAt,
          inputTokens: Number.isFinite(Number(payload?.usage?.input_tokens))
            ? Number(payload.usage.input_tokens)
            : null,
          outputTokens: Number.isFinite(Number(payload?.usage?.output_tokens))
            ? Number(payload.usage.output_tokens)
            : null,
        },
      });
    }
    const normalizedAnalyses = successfulResponses.map((entry) => {
      const result = normalizeVisionOutput(
        input.mode,
        extractGatewayOutput(entry.payload),
        input.candidates,
        input.captureDescriptors,
      );
      result.model = entry.model;
      result.modelBundle = gradingModelBundle({ visionModel: entry.model });
      return result;
    });
    let analysis =
      input.mode === "grade"
        ? combineIndependentGradeAnalyses(normalizedAnalyses)
        : normalizedAnalyses[0];
    modelUsed = successfulResponses.map((entry) => entry.model).join("+");
    let catalogResolution = null;
    if (
      ["identify", "grade"].includes(input.mode) &&
      analysis.quality?.usable &&
      analysis.searchQuery?.length >= 2
    ) {
      try {
        const language = ["en", "ja"].includes(
          String(analysis.identity?.language || "").toLowerCase(),
        )
          ? String(analysis.identity.language).toLowerCase()
          : "en";
        const internal = await searchInternalCatalog(
          database,
          analysis.searchQuery,
          language,
          12,
        );
        if (internal.cards.length) {
          catalogResolution = {
            ...internal,
            language,
            retrievedAt: new Date().toISOString(),
          };
        } else {
          const cards = await searchTcgdexCards(
            analysis.searchQuery,
            language,
            12,
            controller.signal,
          );
          const parsedQuery = parseCatalogQuery(analysis.searchQuery);
          catalogResolution = {
            cards,
            parsedQuery,
            resolution: summarizeCatalogResolution(cards, parsedQuery),
            source: "tcgdex_fallback",
            language,
            retrievedAt: new Date().toISOString(),
          };
        }
      } catch (error) {
        console.warn("[api/vision] catalog resolution unavailable", {
          name: error?.name || "Error",
        });
      }
    }
    let referenceSelection = null;
    let comparisonResponses = [];
    if (input.mode === "grade") {
      referenceSelection = selectGradingReference(catalogResolution || {});
      if (referenceSelection.status === "ready") {
        const comparisonModels = successfulResponses
          .slice(0, minimumResponseCount)
          .map((entry) => entry.model);
        const comparisonResults = await Promise.all(
          comparisonModels.map((candidateModel) =>
            runModel(candidateModel, referenceSelection.reference),
          ),
        );
        comparisonResponses = comparisonResults
          .filter((result) => result.ok)
          .map((result) => ({
            model: result.model,
            payload: result.payload,
          }));
        if (comparisonResponses.length >= minimumResponseCount) {
          const comparedAnalyses = comparisonResponses.map((entry) => {
            const compared = normalizeVisionOutput(
              "grade",
              extractGatewayOutput(entry.payload),
              [],
              input.captureDescriptors,
              referenceSelection.reference,
            );
            compared.model = entry.model;
            compared.gradingReference = referenceSelection.reference;
            compared.modelBundle = gradingModelBundle({
              visionModel: entry.model,
              evidenceVerifier: "registered-reference-review-v3",
              geometryModel: "client-card-isolation-v3",
            });
            return compared;
          });
          analysis = combineIndependentGradeAnalyses(comparedAnalyses);
        } else {
          console.warn("[api/vision] reference comparison unavailable", {
            expectedReviews: minimumResponseCount,
            completedReviews: comparisonResponses.length,
          });
        }
      }
      analysis = await applyActivePsaCalibration(serviceDatabase, analysis);
      analysis = requireHighGradeVerification(
        analysis,
        input.captureDescriptors,
      );
      analysis = applyGradingV3Contract(analysis, {
        catalogResolution,
        referenceSelection,
        captureGeometry: input.captureGeometry,
      });
    }
    const meteredResponses = [...successfulResponses, ...comparisonResponses];
    const inputTokenValues = meteredResponses
      .map((entry) => Number(entry.payload?.usage?.input_tokens))
      .filter(Number.isFinite);
    const outputTokenValues = meteredResponses
      .map((entry) => Number(entry.payload?.usage?.output_tokens))
      .filter(Number.isFinite);
    const metrics = {
      latencyMs: Date.now() - startedAt,
      inputTokens: inputTokenValues.length
        ? inputTokenValues.reduce((sum, value) => sum + value, 0)
        : null,
      outputTokens: outputTokenValues.length
        ? outputTokenValues.reduce((sum, value) => sum + value, 0)
        : null,
      independentReviews: successfulResponses.length,
      referenceReviews: comparisonResponses.length,
      referenceCompared: analysis.referenceComparison?.status === "compared",
    };
    console.info("[api/vision] analysis completed", {
      mode: input.mode,
      model: modelUsed,
      ...metrics,
    });
    return send(response, 200, {
      analysis,
      catalogResolution,
      mode: input.mode,
      provider:
        input.mode === "grade" ? "gateway-consensus" : modelUsed.split("/")[0],
      model: modelUsed,
      modelCatalogVerified,
      processedAt: new Date().toISOString(),
      privacy: { imagePersisted: false, resultPersisted: false },
      metrics,
    });
  } catch (error) {
    console.error("[api/vision] analysis errored", {
      name: error?.name || "Error",
    });
    return send(response, error?.name === "AbortError" ? 504 : 502, {
      error:
        error?.name === "AbortError"
          ? advisorMode
            ? "AI guidance took too long. Try again."
            : "AI analysis took too long. Try a smaller, clearer image."
          : advisorMode
            ? "The AI guidance result could not be verified."
            : "The AI analysis result could not be verified.",
    });
  } finally {
    clearTimeout(timeout);
  }
}

export default function handler(request, response) {
  return visionHandler(request, response);
}
