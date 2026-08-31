const ALLOWED_CARD_IMAGE_HOSTS = new Set([
  "assets.tcgdex.net",
  "images.pokemontcg.io",
  "product-images.tcgplayer.com",
  "tcgplayer-cdn.tcgplayer.com",
]);

function allowedCardImageHost(hostname) {
  return (
    ALLOWED_CARD_IMAGE_HOSTS.has(hostname) ||
    hostname.endsWith(".ssl.cf1.rackcdn.com")
  );
}

export function normalizeCardImageSource(value) {
  if (typeof value !== "string" || value.length > 1_000) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !allowedCardImageHost(url.hostname)
    )
      return null;
    if (!/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/.test(url.pathname)) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}
