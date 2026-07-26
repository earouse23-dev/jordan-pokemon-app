const ALLOWED_CARD_IMAGE_HOSTS = new Set([
  "assets.tcgdex.net",
  "images.pokemontcg.io",
]);

export function normalizeCardImageSource(value) {
  if (typeof value !== "string" || value.length > 1_000) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !ALLOWED_CARD_IMAGE_HOSTS.has(url.hostname)
    )
      return null;
    if (!/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/.test(url.pathname)) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}
