import { normalizeCardImageSource } from "../lib/image-source.js";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_IMAGE_BYTES = 5_000_000;
const IMAGE_TOO_LARGE = "image_too_large";

export async function readBoundedImageBody(
  response,
  maximum = MAX_IMAGE_BYTES,
) {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximum) {
        await reader.cancel();
        throw new Error(IMAGE_TOO_LARGE);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

export function matchesImageSignature(contentType, bytes) {
  if (contentType === "image/jpeg")
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  if (contentType === "image/png")
    return (
      bytes.length >= 8 &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    );
  if (contentType === "image/webp")
    return (
      bytes.length >= 12 &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  if (contentType === "image/avif")
    return (
      bytes.length >= 16 &&
      bytes.subarray(4, 8).toString("ascii") === "ftyp" &&
      /avif|avis/.test(bytes.subarray(8, 32).toString("ascii"))
    );
  return false;
}

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

    const contentType = String(upstream.headers.get("content-type") || "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(contentType))
      return response
        .status(415)
        .json({ error: "Image source returned an unsupported format" });

    const declaredLength = Number(upstream.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES)
      return response.status(413).json({ error: "Image is too large" });

    const bytes = await readBoundedImageBody(upstream);
    if (!bytes.length)
      return response.status(413).json({ error: "Image is too large" });
    if (!matchesImageSignature(contentType, bytes))
      return response
        .status(415)
        .json({ error: "Image source returned invalid image bytes" });

    response.setHeader("Content-Type", contentType);
    response.setHeader(
      "Cache-Control",
      "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
    );
    response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    return response.status(200).send(bytes);
  } catch (error) {
    if (error?.message === IMAGE_TOO_LARGE)
      return response.status(413).json({ error: "Image is too large" });
    return response
      .status(502)
      .json({ error: "Image source is temporarily unavailable" });
  }
}
