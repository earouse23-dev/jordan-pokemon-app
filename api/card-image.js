import { normalizeCardImageSource } from "../lib/image-source.js";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_IMAGE_BYTES = 5_000_000;

export function normalizeImageSource(value) {
  return normalizeCardImageSource(value);
}

export function cardImageProxyPath(value) {
  const source = normalizeImageSource(value);
  return source
    ? `/api/card-image?url=${encodeURIComponent(source.href)}`
    : null;
}

export default async function handler(request, response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const rawUrl = Array.isArray(request.query?.url)
    ? request.query.url[0]
    : request.query?.url;
  const source = normalizeImageSource(rawUrl);
  if (!source)
    return response.status(400).json({ error: "Unsupported image source" });

  try {
    const upstream = await fetch(source, {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg",
        "User-Agent": "MicaCardImage/1.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    if (!upstream.ok)
      return response
        .status(502)
        .json({ error: "Image source is temporarily unavailable" });

    const contentType = String(
      upstream.headers.get("content-type") || "",
    ).toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(contentType))
      return response
        .status(415)
        .json({ error: "Image source returned an unsupported format" });

    const declaredLength = Number(upstream.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES)
      return response.status(413).json({ error: "Image is too large" });

    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES)
      return response.status(413).json({ error: "Image is too large" });

    response.setHeader("Content-Type", contentType);
    response.setHeader(
      "Cache-Control",
      "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
    );
    response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    return response.status(200).send(bytes);
  } catch {
    return response
      .status(502)
      .json({ error: "Image source is temporarily unavailable" });
  }
}
