import { releaseHold } from "./release-hold.js";
import { withNativeCors } from "./native-cors.js";
import sales from "../api/sales.js";
import offers from "../api/offers.js";
import sealed from "../api/sealed.js";
import gradedValuation from "../api/graded-valuation.js";

export const heldRoutes = Object.freeze({
  vision: ["POST"],
  "price-sync": ["GET", "POST"],
  maintenance: ["GET"],
  "alert-delivery": ["GET"],
});
export const proRoutes = Object.freeze({
  sales: ["GET"], offers: ["GET"], sealed: ["GET"], "graded-valuation": ["POST"],
});
export const routedRoutes = Object.freeze({ ...heldRoutes, ...proRoutes });
const proHandlers = { sales, offers, sealed, "graded-valuation": gradedValuation };

// Build Output routes set the observed request path; query/header values cannot select a route.
export default function heldRouteHandler(request, response) {
  const path = new URL(request.url || "/", "https://local.invalid").pathname;
  const name = /^\/api\/([a-z-]+)$/.exec(path)?.[1];
  if (!Object.hasOwn(routedRoutes, name)) {
    response.setHeader("Cache-Control", "private, no-store");
    return response.status(404).json({ error: "Not found" });
  }
  if (Object.hasOwn(proHandlers, name)) return proHandlers[name](request, response);
  return withNativeCors(releaseHold, heldRoutes[name])(request, response);
}
