import { withNativeCors } from "../lib/native-cors.js";
import { releaseHold } from "../lib/release-hold.js";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { serverEnvironment } from "../lib/env.js";
import { processActionCenterMaintenance } from "./maintenance.js";

async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  if (request.method !== "GET") { response.setHeader("Allow", "GET"); return response.status(405).json({ error: "Method not allowed" }); }
  let config;
  try { config = serverEnvironment(); } catch { return response.status(500).json({ error: "Invalid configuration" }); }
  const supplied = Buffer.from(String(request.headers.authorization || ""));
  const expected = Buffer.from(`Bearer ${config.alertDispatchToken}`);
  if (!config.alertDispatchToken || supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
    return response.status(401).json({ error: "Unauthorized" });
  if (!config.supabaseUrl || !config.supabaseSecretKey) return response.status(503).json({ error: "Delivery unavailable" });
  try {
    const database = createClient(config.supabaseUrl, config.supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const result = await processActionCenterMaintenance(database, config, { materialize: false });
    return response.status(200).json(result);
  } catch { return response.status(503).json({ error: "Delivery could not finish" }); }
}

export default withNativeCors(releaseHold, ["GET"]);
