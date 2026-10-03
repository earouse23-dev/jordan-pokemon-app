// The bundled iOS WebView has a fixed origin. CORS never replaces route auth.
const NATIVE_ORIGIN = "capacitor://localhost";
const REQUEST_HEADERS = new Set(["authorization", "content-type"]);

export function withNativeCors(handler, methods) {
  return function nativeCorsHandler(request, response) {
    const origin = request.headers?.origin;
    const host = request.headers?.host;
    const sameOrigin =
      host &&
      (origin === `https://${host}` ||
        (/^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(host) &&
          origin === `http://${host}`));
    response.setHeader("Vary", "Origin");
    if (origin && origin !== NATIVE_ORIGIN && !sameOrigin)
      return response.status(403).json({ error: "Origin not allowed" });

    if (origin === NATIVE_ORIGIN) {
      response.setHeader("Access-Control-Allow-Origin", NATIVE_ORIGIN);
    }
    if (request.method !== "OPTIONS") return handler(request, response);

    const method = request.headers?.["access-control-request-method"];
    const headers = String(
      request.headers?.["access-control-request-headers"] || "",
    )
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    if (
      origin !== NATIVE_ORIGIN ||
      !methods.includes(method) ||
      headers.some((value) => !REQUEST_HEADERS.has(value))
    )
      return response.status(403).json({ error: "Preflight not allowed" });
    response.setHeader("Access-Control-Allow-Methods", methods.join(", "));
    response.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type",
    );
    response.setHeader(
      "Vary",
      "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
    );
    response.setHeader("Access-Control-Max-Age", "600");
    response.status(204).end();
  };
}
