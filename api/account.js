import { createClient } from "@supabase/supabase-js";
import { serverEnvironment } from "../lib/env.js";

function send(response, status, body) {
  response.setHeader("Cache-Control", "no-store");
  return response.status(status).json(body);
}

export default async function handler(request, response) {
  if (request.method !== "DELETE") {
    response.setHeader("Allow", "DELETE");
    return send(response, 405, { error: "Method not allowed" });
  }
  let config;
  try {
    config = serverEnvironment();
  } catch {
    return send(response, 500, { error: "Server configuration is invalid" });
  }
  if (!config.supabaseUrl || !config.supabaseSecretKey)
    return send(response, 503, { error: "Account deletion is not configured" });
  const authorization = String(request.headers.authorization || "");
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  if (!bearerToken)
    return send(response, 401, { error: "Authentication required" });
  const database = createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: identity, error: identityError } =
    await database.auth.getUser(bearerToken);
  if (identityError || !identity.user)
    return send(response, 401, { error: "Authentication required" });
  const confirmation = String(request.body?.confirmation || "")
    .trim()
    .toLowerCase();
  if (
    !identity.user.email ||
    confirmation !== identity.user.email.toLowerCase()
  )
    return send(response, 400, { error: "Email confirmation does not match" });
  const { error } = await database.auth.admin.deleteUser(identity.user.id);
  if (error)
    return send(response, 500, { error: "Account could not be deleted" });
  return send(response, 200, { ok: true });
}
