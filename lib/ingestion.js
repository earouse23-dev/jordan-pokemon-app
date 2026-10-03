import {
  collectibleIdentitySnapshot,
  normalizeVariantOption,
} from "./identity.js";

export const INGESTION_CONTRACT_VERSION = "mica-ingestion-v1";
export const INGESTION_CHANNELS = Object.freeze([
  "camera",
  "upload",
  "search",
  "manual",
  "csv",
]);

function text(value, maximum = 10_000) {
  return String(value ?? "")
    .trim()
    .slice(0, maximum);
}

function normalized(value) {
  return text(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function confidence(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : null;
}

export function createIngestionEnvelope({
  channel,
  item = {},
  variant = "",
  candidateStatus = "",
  matchConfidence = null,
  confirmed = false,
  source = "",
  sessionId = "",
} = {}) {
  const normalizedChannel = INGESTION_CHANNELS.includes(channel)
    ? channel
    : "manual";
  const option = normalizeVariantOption(variant || item.variant, {
    language: item.language,
    id: item.variantId,
  });
  const identity = collectibleIdentitySnapshot(item, option);
  const score = confidence(matchConfidence);
  const status =
    candidateStatus || item.identityStatus || option.status || "needs_review";
  const reasons = [];
  if (!identity.name) reasons.push("name_missing");
  if (!identity.number) reasons.push("collector_number_missing");
  if (!identity.language || identity.language === "unknown")
    reasons.push("language_missing");
  if (!identity.collectibleId && status !== "exact")
    reasons.push("variant_not_canonical");
  if (["camera", "upload"].includes(normalizedChannel) && score !== null) {
    if (score < 0.85) reasons.push("low_confidence_match");
  }
  if (["camera", "upload"].includes(normalizedChannel) && score === null)
    reasons.push("confidence_missing");
  const requiresConfirmation = reasons.length > 0 || !confirmed;
  return {
    version: INGESTION_CONTRACT_VERSION,
    sessionId: sessionId || globalThis.crypto.randomUUID(),
    channel: normalizedChannel,
    source: text(
      source || item.imageProvider || item.provider || "unknown",
      80,
    ),
    identity,
    candidateStatus: status,
    matchConfidence: score,
    requiresConfirmation,
    confirmationReasons: [...new Set(reasons)],
    confirmedAt: confirmed ? new Date().toISOString() : null,
  };
}

export function confirmIngestionEnvelope(envelope, confirmedAt) {
  if (!envelope || envelope.version !== INGESTION_CONTRACT_VERSION)
    throw new Error("Unsupported ingestion contract");
  return {
    ...envelope,
    requiresConfirmation: false,
    confirmedAt: confirmedAt || new Date().toISOString(),
  };
}

function importIdentityKey(record) {
  return [
    record.id,
    record.name,
    record.set,
    record.number,
    record.language || "en",
    record.variant,
    record.cardState,
    record.rawCondition || record.condition,
    record.gradingCompany,
    record.grade,
    record.certificationNumber,
  ]
    .map(normalized)
    .join("|");
}

function importFactKey(record) {
  return [
    importIdentityKey(record),
    record.totalAcquisitionCost,
    record.cost,
    record.purchaseDate,
    record.currency || "USD",
    record.location,
    record.folder,
    JSON.stringify(
      Object.fromEntries(
        Object.entries(record.customFields || {}).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    ),
    [...(record.tags || [])]
      .map(text)
      .sort((left, right) => left.localeCompare(right))
      .join("|"),
    record.notes,
  ]
    .map((value) => String(value ?? ""))
    .join("|");
}

export function buildCollectionImportPreview(
  records = [],
  parseErrors = [],
  { duplicatePolicy = "combine" } = {},
) {
  const rows = [];
  const byFacts = new Map();
  const byIdentity = new Map();
  const exactDuplicates = [];
  const identityDuplicates = [];
  const errors = [...parseErrors];
  records.forEach((record, index) => {
    const rowNumber = index + 2;
    const facts = importFactKey(record);
    const identity = importIdentityKey(record);
    const priorFact = byFacts.get(facts);
    if (priorFact) {
      exactDuplicates.push({ rowNumber, matchesRow: priorFact.sourceRows[0] });
      if (duplicatePolicy === "combine") {
        const combined = Number(priorFact.quantity) + Number(record.quantity);
        if (!Number.isInteger(combined) || combined > 99_999)
          errors.push(
            `Rows ${priorFact.sourceRows[0]} and ${rowNumber}: combined quantity exceeds 99,999`,
          );
        else priorFact.quantity = combined;
        priorFact.sourceRows.push(rowNumber);
        return;
      }
    }
    const priorIdentity = byIdentity.get(identity);
    if (priorIdentity && priorIdentity !== priorFact)
      identityDuplicates.push({
        rowNumber,
        matchesRow: priorIdentity.sourceRows[0],
        reason: "same_identity_different_facts",
      });
    const planned = { ...record, sourceRows: [rowNumber] };
    rows.push(planned);
    if (!priorFact) byFacts.set(facts, planned);
    if (!priorIdentity) byIdentity.set(identity, planned);
  });
  return {
    rows,
    errors,
    exactDuplicates,
    identityDuplicates,
    canCommit: rows.length > 0 && errors.length === 0,
    summary: {
      inputRows: records.length + parseErrors.length,
      validRows: records.length,
      stagedRows: rows.length,
      invalidRows: parseErrors.length,
      exactDuplicates: exactDuplicates.length,
      possibleIdentityDuplicates: identityDuplicates.length,
      totalQuantity: rows.reduce(
        (sum, record) => sum + (Number(record.quantity) || 0),
        0,
      ),
    },
  };
}

export async function sha256Text(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function chunkImportRows(rows = [], size = 200) {
  const chunkSize = Math.min(500, Math.max(1, Math.floor(Number(size) || 200)));
  const chunks = [];
  for (let index = 0; index < rows.length; index += chunkSize)
    chunks.push(rows.slice(index, index + chunkSize));
  return chunks;
}
