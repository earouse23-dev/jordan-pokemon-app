import { releaseHold } from "./release-hold.js";
import { withNativeCors } from "./native-cors.js";

export const heldRoutes = Object.freeze({
  vision: ["POST"],
  "graded-valuation": ["POST"],
  sales: ["GET"],
  offers: ["GET"],
  sealed: ["GET"],
  "price-sync": ["GET", "POST"],
  maintenance: ["GET"],
  "alert-delivery": ["GET"],
});

// Build Output routes set the observed request path; query/header values cannot select a route.
export default function heldRouteHandler(request, response) {
  const path = new URL(request.url || "/", "https://local.invalid").pathname;
  const name = /^\/api\/([a-z-]+)$/.exec(path)?.[1];
  if (!Object.hasOwn(heldRoutes, name)) {
    response.setHeader("Cache-Control", "private, no-store");
    return response.status(404).json({ error: "Not found" });
  }
  return withNativeCors(releaseHold, heldRoutes[name])(request, response);
}
