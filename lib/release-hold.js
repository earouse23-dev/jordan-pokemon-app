// Reviewed release hold: no environment flag can enable provider spending.
export function releaseHold(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  return response.status(503).json({
    error: "This service is unavailable in this release.",
    code: "release_hold",
  });
}
