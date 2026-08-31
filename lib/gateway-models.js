const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedModels = null;
let cachedAt = 0;

function modelSupportsVision(model) {
  const inputs = Array.isArray(model?.modalities?.input)
    ? model.modalities.input
    : [];
  const tags = Array.isArray(model?.tags) ? model.tags : [];
  return (
    model?.type === "language" &&
    (inputs.includes("image") || tags.includes("vision"))
  );
}

export async function availableGatewayVisionModels({
  token,
  fetcher = fetch,
  now = Date.now(),
} = {}) {
  if (cachedModels && now - cachedAt < MODEL_CACHE_TTL_MS) return cachedModels;
  const response = await fetcher("https://ai-gateway.vercel.sh/v1/models", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("gateway_model_catalog_unavailable");
  const payload = await response.json();
  cachedModels = (Array.isArray(payload?.data) ? payload.data : [])
    .filter(modelSupportsVision)
    .map((model) => ({
      id: model.id,
      provider: model.owned_by || String(model.id).split("/")[0],
      name: model.name || model.id,
      inputModalities: model.modalities?.input || [],
      pricing: model.pricing || null,
    }));
  cachedAt = now;
  return cachedModels;
}

export function selectGatewayVisionModels(
  available,
  preferred = [],
  { uniqueProviders = false, maximum = Number.POSITIVE_INFINITY } = {},
) {
  const supported = new Map(
    (Array.isArray(available) ? available : []).map((model) => [
      model.id,
      model,
    ]),
  );
  const selected = [];
  const providers = new Set();
  for (const modelId of [...new Set(preferred)]) {
    if (!/^[a-z0-9-]+\/[A-Za-z0-9._-]+$/.test(modelId)) continue;
    const model = supported.get(modelId);
    if (!model) continue;
    const provider = String(model.provider || modelId.split("/")[0]);
    if (uniqueProviders && providers.has(provider)) continue;
    selected.push(modelId);
    providers.add(provider);
    if (selected.length >= maximum) break;
  }
  return selected;
}

export function resetGatewayModelCache() {
  cachedModels = null;
  cachedAt = 0;
}
