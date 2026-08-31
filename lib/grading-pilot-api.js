import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { serverEnvironment } from "./env.js";

const REVIEW_ROLES = new Set(["reviewer", "adjudicator", "admin"]);
const PARTITIONS = new Set([
  "train",
  "validation",
  "calibration",
  "test",
  "external_holdout",
]);
const requestWindows = new Map();
const FINISHES = new Set([
  "non_holo",
  "traditional_holo",
  "reverse_holo",
  "full_art",
  "textured_full_art",
  "rainbow_hyper_rare",
  "radiant",
  "etched",
  "vintage_foil",
  "other_documented",
]);
const DEFECT_CATEGORIES = new Set([
  "centering",
  "corner_whitening",
  "corner_rounding",
  "corner_compression",
  "edge_whitening",
  "edge_chipping",
  "rough_cut",
  "peeling",
  "scratch",
  "holo_scratch",
  "print_line",
  "scuff",
  "stain",
  "residue",
  "dent",
  "indentation",
  "crease",
  "wrinkle",
  "bend",
  "warping",
  "delamination",
  "trimming",
  "cleaning",
  "recoloring",
  "restoration",
  "other",
]);
const NO_GRADE_SIGNALS = new Set([
  "trimming",
  "alteration",
  "cleaning",
  "recoloring",
  "restoration",
  "minimum_size",
  "authenticity",
  "other",
]);

function send(response, status, body) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Vary", "Authorization");
  return response.status(status).json(body);
}

export function gradingReviewerRole(user) {
  const role = String(user?.app_metadata?.grading_review_role || "")
    .trim()
    .toLowerCase();
  return REVIEW_ROLES.has(role) ? role : "";
}

export function normalizeAnnotationLabels(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const finish = String(value.finish || "");
  if (!FINISHES.has(finish) || typeof value.identityConfirmed !== "boolean")
    return null;
  const evidence = {};
  for (const key of [
    "front",
    "back",
    "alternateFront",
    "alternateBack",
    "centering",
    "corners",
    "edges",
    "surface",
    "structure",
    "sufficient",
  ]) {
    if (typeof value.evidence?.[key] !== "boolean") return null;
    evidence[key] = value.evidence[key];
  }
  const condition = {};
  for (const key of [
    "centering",
    "corners",
    "edges",
    "surface",
    "structure",
    "eyeAppeal",
  ]) {
    const grade = Number(value.condition?.[key]);
    if (
      !Number.isFinite(grade) ||
      grade < 1 ||
      grade > 10 ||
      Math.round(grade * 2) !== grade * 2
    )
      return null;
    condition[key] = grade;
  }
  const noGradeSignals = [
    ...new Set(
      (Array.isArray(value.noGradeSignals) ? value.noGradeSignals : []).map(
        String,
      ),
    ),
  ];
  if (noGradeSignals.some((signal) => !NO_GRADE_SIGNALS.has(signal)))
    return null;
  const rawDefects = Array.isArray(value.defects) ? value.defects : [];
  if (rawDefects.length > 50) return null;
  const defects = [];
  for (const raw of rawDefects) {
    const side = String(raw?.side || "");
    const category = String(raw?.category || "");
    const severity = String(raw?.severity || "");
    const confidence = Number(raw?.confidence);
    const x = Number(raw?.region?.x);
    const y = Number(raw?.region?.y);
    const width = Number(raw?.region?.width);
    const height = Number(raw?.region?.height);
    if (
      !["front", "back"].includes(side) ||
      !DEFECT_CATEGORIES.has(category) ||
      !["minor", "moderate", "major", "critical"].includes(severity) ||
      !Number.isFinite(confidence) ||
      confidence < 0 ||
      confidence > 1 ||
      typeof raw?.persistentAcrossLight !== "boolean" ||
      ![x, y, width, height].every(Number.isFinite) ||
      x < 0 ||
      y < 0 ||
      width <= 0 ||
      height <= 0 ||
      x + width > 1 ||
      y + height > 1
    )
      return null;
    const region = { x, y, width, height };
    defects.push({
      side,
      category,
      severity,
      confidence,
      persistentAcrossLight: raw.persistentAcrossLight,
      region,
      mask: [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ],
    });
  }
  const notes = String(value.notes || "").trim();
  if (notes.length > 1_000) return null;
  return {
    protocolVersion: "mica-psa-label-protocol-v1",
    identityConfirmed: value.identityConfirmed,
    finish,
    evidence,
    condition,
    noGradeSignals,
    defects,
    notes,
  };
}

function reviewerKey(userId) {
  return `reviewer:${createHash("sha256").update(String(userId)).digest("hex")}`;
}

function bearerToken(request) {
  const authorization = String(request.headers.authorization || "");
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

function bodyValue(request) {
  if (!request.body) return {};
  if (typeof request.body === "object") return request.body;
  try {
    return JSON.parse(request.body);
  } catch {
    return null;
  }
}

function consumeReviewerLimit(key, limit = 60) {
  const now = Date.now();
  const current = requestWindows.get(key);
  if (!current || now - current.startedAt >= 60 * 60 * 1_000) {
    requestWindows.set(key, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

function databaseClient(config) {
  return createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signPath(database, bucketName, path) {
  if (!path) return null;
  const { data, error } = await database.storage
    .from(bucketName)
    .createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}

async function signedQueue(database, queue, role) {
  return Promise.all(
    (Array.isArray(queue) ? queue : []).map(async (entry) => {
      const { proofStoragePath, captures = [], ...safeEntry } = entry;
      if (safeEntry.kind === "annotation") {
        const reviewCount = Number(
          safeEntry.reviewCount || safeEntry.reviews?.length || 0,
        );
        const mayAdjudicate = ["adjudicator", "admin"].includes(role);
        safeEntry.reviewCount = reviewCount;
        safeEntry.reviews =
          mayAdjudicate && reviewCount >= 2 ? safeEntry.reviews || [] : [];
        delete safeEntry.label;
        delete safeEntry.exclusionReasons;
      }
      const [proofUrl, signedCaptures] = await Promise.all([
        signPath(database, "grading-outcome-proofs", proofStoragePath),
        Promise.all(
          captures.map(async ({ storagePath, ...capture }) => ({
            ...capture,
            imageUrl: await signPath(database, "grading-research", storagePath),
          })),
        ),
      ]);
      return { ...safeEntry, proofUrl, captures: signedCaptures };
    }),
  );
}

async function processDeletionJobs(database, workerKey, limit = 10) {
  const { data: jobs, error: claimError } = await database.rpc(
    "grading_pilot_claim_deletion_jobs_service",
    { p_worker_key: workerKey, p_limit: limit },
  );
  if (claimError) throw claimError;
  const results = [];
  for (const job of Array.isArray(jobs) ? jobs : []) {
    const paths = Array.isArray(job.storagePaths) ? job.storagePaths : [];
    try {
      for (let index = 0; index < paths.length; index += 100) {
        const batch = paths.slice(index, index + 100);
        const { error } = await database.storage
          .from("grading-research")
          .remove(batch);
        if (error) throw error;
        const { error: metadataError } = await database
          .from("grading_captures")
          .update({
            private_storage_path: null,
            retained_for_research: false,
          })
          .in("private_storage_path", batch);
        if (metadataError) throw metadataError;
      }
      const { error } = await database.rpc(
        "grading_pilot_complete_deletion_job_service",
        {
          p_job_id: job.jobId,
          p_succeeded: true,
          p_error: null,
          p_worker_key: workerKey,
        },
      );
      if (error) throw error;
      results.push({ jobId: job.jobId, status: "complete" });
    } catch (error) {
      const message = String(error?.message || "Storage erasure failed").slice(
        0,
        1000,
      );
      await database.rpc("grading_pilot_complete_deletion_job_service", {
        p_job_id: job.jobId,
        p_succeeded: false,
        p_error: message,
        p_worker_key: workerKey,
      });
      results.push({ jobId: job.jobId, status: "failed" });
    }
  }
  return results;
}

export async function gradingDeletionCronHandler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return send(response, 405, { error: "Method not allowed" });
  }
  let config;
  try {
    config = serverEnvironment();
  } catch {
    return send(response, 500, { error: "Server configuration is invalid" });
  }
  const authorization = String(request.headers.authorization || "");
  if (!config.cronSecret || authorization !== `Bearer ${config.cronSecret}`)
    return send(response, 401, { error: "Unauthorized" });
  if (!config.supabaseUrl || !config.supabaseSecretKey)
    return send(response, 503, { error: "Deletion worker is not configured" });
  try {
    const results = await processDeletionJobs(
      databaseClient(config),
      "worker:vercel-deletion-cron",
      10,
    );
    return send(response, 200, {
      ok: true,
      processed: results.length,
      completed: results.filter((result) => result.status === "complete")
        .length,
      failed: results.filter((result) => result.status === "failed").length,
    });
  } catch {
    return send(response, 500, { error: "Deletion worker failed" });
  }
}

function rpcFailure(error) {
  const message = String(error?.message || "Pilot operation failed");
  const known = [
    "invalid_review_decision",
    "reviewer_must_be_independent",
    "outcome_not_found",
    "proof_and_certification_required",
    "training_example_not_found",
    "invalid_review_round",
    "round_three_requires_adjudication",
    "invalid_dataset_partition",
    "partition_missing_or_already_frozen",
    "invalid_annotation_labels",
    "approval_requires_sufficient_evidence",
    "invalid_v3_manifest_version",
    "manifest_contains_incomplete_v3_example",
    "manifest_contains_deleted_source",
    "manifest_contains_duplicate_example_ids",
    "manifest_contains_duplicate_physical_card",
  ].find((code) => message.includes(code));
  return known ? known.replaceAll("_", " ") : "Pilot operation failed";
}

export default async function handler(request, response) {
  if (!["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return send(response, 405, { error: "Method not allowed" });
  }
  if (Number(request.headers["content-length"] || 0) > 32_768)
    return send(response, 413, { error: "Request is too large" });

  let config;
  try {
    config = serverEnvironment();
  } catch {
    return send(response, 500, { error: "Server configuration is invalid" });
  }
  if (!config.supabaseUrl || !config.supabaseSecretKey)
    return send(response, 503, { error: "Pilot review is not configured" });

  const token = bearerToken(request);
  if (!token) return send(response, 401, { error: "Authentication required" });
  const database = databaseClient(config);
  const { data: identity, error: identityError } =
    await database.auth.getUser(token);
  if (identityError || !identity.user)
    return send(response, 401, { error: "Authentication required" });
  const role = gradingReviewerRole(identity.user);
  if (!role) return send(response, 403, { error: "Reviewer access required" });

  try {
    const actorKey = reviewerKey(identity.user.id);
    if (request.method === "GET") {
      const view = String(request.query?.view || "dashboard");
      if (view === "dashboard") {
        const { data, error } = await database.rpc(
          "grading_pilot_dashboard_service",
        );
        if (error) throw error;
        return send(response, 200, { dashboard: data, role });
      }
      if (view === "dataset") {
        if (role !== "admin")
          return send(response, 403, {
            error: "Pilot administrator access required",
          });
        const { data, error } = await database.rpc(
          "grading_v3_dataset_candidates_service",
          { p_limit: 500 },
        );
        if (error) throw error;
        return send(response, 200, { dataset: data, role });
      }
      if (view !== "queue")
        return send(response, 400, { error: "Unknown pilot view" });
      const kind = String(request.query?.kind || "outcome");
      if (!["outcome", "annotation"].includes(kind))
        return send(response, 400, { error: "Unknown review queue" });
      const limit = Math.min(
        100,
        Math.max(1, Math.trunc(Number(request.query?.limit) || 25)),
      );
      const { data, error } = await database.rpc(
        "grading_pilot_review_queue_service",
        { p_kind: kind, p_limit: limit, p_reviewer_key: actorKey },
      );
      if (error) throw error;
      return send(response, 200, {
        kind,
        role,
        queue: await signedQueue(database, data, role),
      });
    }

    const body = bodyValue(request);
    if (!body) return send(response, 400, { error: "Invalid JSON body" });
    if (!consumeReviewerLimit(actorKey))
      return send(response, 429, { error: "Review limit reached; try later" });
    const action = String(body.action || "");

    if (action === "outcome_review") {
      const outcomeId = String(body.outcomeId || "");
      const decision = String(body.decision || "");
      const notes = String(body.notes || "").trim();
      if (!/^[0-9a-f-]{36}$/i.test(outcomeId))
        return send(response, 400, { error: "Valid outcome is required" });
      if (!["approve", "reject"].includes(decision) || notes.length > 2_000)
        return send(response, 400, { error: "Valid review is required" });
      const { data, error } = await database.rpc(
        "grading_pilot_record_outcome_review_service",
        {
          p_outcome_id: outcomeId,
          p_reviewer_key: actorKey,
          p_decision: decision,
          p_notes: notes || null,
        },
      );
      if (error) throw error;
      return send(response, 200, { ok: true, status: data });
    }

    if (action === "annotation_review") {
      const exampleId = String(body.exampleId || "");
      const round = Math.trunc(Number(body.round));
      const decision = String(body.decision || "");
      const labels = normalizeAnnotationLabels(body.labels);
      if (!/^[0-9a-f-]{36}$/i.test(exampleId) || ![1, 2, 3].includes(round))
        return send(response, 400, {
          error: "Valid annotation target is required",
        });
      if (round === 3 && !["adjudicator", "admin"].includes(role))
        return send(response, 403, { error: "Adjudicator access required" });
      const allowedDecision = round === 3 ? "adjudicate" : decision;
      if (
        !labels ||
        (round < 3 && !["approve", "reject"].includes(allowedDecision))
      )
        return send(response, 400, {
          error: "Complete valid labels are required",
        });
      const { data, error } = await database.rpc(
        "grading_pilot_record_annotation_review_service",
        {
          p_example_id: exampleId,
          p_reviewer_key: actorKey,
          p_review_round: round,
          p_decision: allowedDecision,
          p_labels: labels,
        },
      );
      if (error) throw error;
      return send(response, 200, { ok: true, status: data });
    }

    if (action === "assign_partition") {
      if (role !== "admin")
        return send(response, 403, {
          error: "Pilot administrator access required",
        });
      const physicalCardId = String(body.physicalCardId || "");
      const partition = String(body.partition || "");
      if (
        !/^[0-9a-f-]{36}$/i.test(physicalCardId) ||
        !PARTITIONS.has(partition)
      )
        return send(response, 400, {
          error: "Valid partition assignment is required",
        });
      const { data, error } = await database.rpc(
        "grading_pilot_assign_partition_service",
        {
          p_physical_card_id: physicalCardId,
          p_partition: partition,
          p_actor_key: actorKey,
        },
      );
      if (error) throw error;
      return send(response, 200, { ok: true, partition: data });
    }
    if (action === "freeze_v3_dataset") {
      if (role !== "admin")
        return send(response, 403, {
          error: "Pilot administrator access required",
        });
      const version = String(body.version || "");
      const exampleIds = [
        ...new Set(
          (Array.isArray(body.exampleIds) ? body.exampleIds : []).map(String),
        ),
      ];
      if (
        !/^mica-grading-v3-[a-z0-9._-]{3,96}$/.test(version) ||
        !exampleIds.length ||
        exampleIds.length > 500 ||
        exampleIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id))
      )
        return send(response, 400, {
          error: "Complete valid V3 manifest inputs are required",
        });
      const { data, error } = await database.rpc(
        "grading_v3_freeze_dataset_service",
        {
          p_version: version,
          p_example_ids: exampleIds,
          p_actor_key: actorKey,
        },
      );
      if (error) throw error;
      return send(response, 200, { ok: true, manifestId: data, version });
    }
    if (action === "process_deletions") {
      if (role !== "admin")
        return send(response, 403, {
          error: "Pilot administrator access required",
        });
      const results = await processDeletionJobs(database, actorKey, 10);
      return send(response, 200, {
        ok: true,
        processed: results.length,
        completed: results.filter((result) => result.status === "complete")
          .length,
        failed: results.filter((result) => result.status === "failed").length,
      });
    }
    return send(response, 400, { error: "Unknown pilot action" });
  } catch (error) {
    return send(response, 400, { error: rpcFailure(error) });
  }
}
