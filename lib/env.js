function boolean(value, fallback = false) {
  if (value === undefined || value === "") return fallback;
  if (["true", "1", "yes"].includes(String(value).toLowerCase())) return true;
  if (["false", "0", "no"].includes(String(value).toLowerCase())) return false;
  throw new Error("Invalid boolean environment value");
}
function positiveNumber(value, fallback) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new Error("Invalid positive numeric environment value");
  return parsed;
}

export function serverEnvironment(source = process.env) {
  const pkmnpricesPlan = String(source.PKMNPRICES_PLAN || "free").toLowerCase();
  if (!["free", "pro", "business"].includes(pkmnpricesPlan))
    throw new Error("Invalid PKMNPRICES_PLAN");
  return {
    supabaseUrl: source.NEXT_PUBLIC_SUPABASE_URL || "",
    supabasePublishableKey:
      source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      source.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      source.SUPABASE_ANON_KEY ||
      "",
    supabaseSecretKey: source.SUPABASE_SECRET_KEY || "",
    pkmnpricesApiKey: source.PKMNPRICES_API_KEY || "",
    pkmnpricesPlan,
    tcgdexBaseUrl: source.TCGDEX_BASE_URL || "https://api.tcgdex.net/v2",
    altEnabled: boolean(source.ALT_PROVIDER_ENABLED, false),
    altApiKey: source.ALT_API_KEY || "",
    cardLadderEnabled: boolean(source.CARD_LADDER_PROVIDER_ENABLED, false),
    cardLadderApiKey: source.CARD_LADDER_API_KEY || "",
    syncSecret: source.PRICE_SYNC_SECRET || source.CRON_SECRET || "",
    staleAfterHours: positiveNumber(source.PRICE_STALE_AFTER_HOURS, 72),
    anomalyThresholdPercent: positiveNumber(
      source.PRICE_ANOMALY_THRESHOLD_PERCENT,
      40,
    ),
    aiGatewayApiKey: source.AI_GATEWAY_API_KEY || "",
    vercelOidcToken: source.VERCEL_OIDC_TOKEN || "",
    visionModel: /^openai\/[A-Za-z0-9._-]+$/.test(
      String(source.VISION_MODEL || "openai/gpt-5.6-luna"),
    )
      ? String(source.VISION_MODEL || "openai/gpt-5.6-luna")
      : "openai/gpt-5.6-luna",
    visionMaxPerHour: Math.min(
      100,
      Math.max(1, Math.trunc(positiveNumber(source.VISION_MAX_PER_HOUR, 20))),
    ),
  };
}

export function validateServerEnvironment(
  config,
  { pricing = false, sync = false } = {},
) {
  const missing = [];
  if (pricing && !config.pkmnpricesApiKey) missing.push("PKMNPRICES_API_KEY");
  if (sync) {
    if (!config.supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!config.supabaseSecretKey) missing.push("SUPABASE_SECRET_KEY");
    if (!config.syncSecret) missing.push("PRICE_SYNC_SECRET or CRON_SECRET");
  }
  if (config.altEnabled && !config.altApiKey) missing.push("ALT_API_KEY");
  if (config.cardLadderEnabled && !config.cardLadderApiKey)
    missing.push("CARD_LADDER_API_KEY");
  return { valid: missing.length === 0, missing };
}
