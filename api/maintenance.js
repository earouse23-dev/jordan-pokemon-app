import { withNativeCors } from "../lib/native-cors.js";
import { releaseHold } from "../lib/release-hold.js";
import { randomUUID } from "node:crypto";
import { deliverPushToDevices } from "../lib/web-push.js";
import { createClient } from "@supabase/supabase-js";
import { serverEnvironment } from "../lib/env.js";
import { processDeletionJobs } from "../lib/grading-pilot-api.js";
import {
  deliverActionNotification,
  notificationDestinationUrl,
} from "../lib/notification-delivery.js";

function send(response, status, body) {
  response.setHeader("Cache-Control", "private, no-store");
  return response.status(status).json(body);
}

export async function processActionCenterMaintenance(
  database,
  config,
  {
    workerKey = `worker:maintenance:${randomUUID()}`,
    actionLimit = 100,
    deliveryLimit = 5,
    deliver = (claim, settings) =>
      deliverActionNotification(claim, settings, {
        webPushAdapter: (pushClaim, pushConfig) =>
          deliverPushToDevices(database, pushClaim, pushConfig),
      }),
    materialize = true,
  } = {},
) {
  const materialized = materialize
    ? await database.rpc("materialize_action_center_service", {
        p_worker_key: workerKey,
        p_limit: actionLimit,
      })
    : { data: { generated: 0 }, error: null };
  if (materialized.error) throw materialized.error;
  const claimed = await database.rpc("claim_action_deliveries_service", {
    p_worker_key: workerKey,
    p_limit: deliveryLimit,
  });
  if (claimed.error) throw claimed.error;
  const results = [];
  const deadline = Date.now() + 35_000;
  for (const raw of Array.isArray(claimed.data) ? claimed.data : []) {
    if (Date.now() >= deadline) break;
    const destinationUrl = notificationDestinationUrl(
      config.appBaseUrl,
      raw.action?.destination,
    );
    let result;
    try {
      result = await deliver(
        {
          ...raw,
          action: { ...raw.action, destinationUrl },
        },
        config,
      );
    } catch (error) {
      result = {
        status: "failed",
        permanent: false,
        errorCode: String(error?.message || "delivery_failed").slice(0, 200),
      };
    }
    const succeeded = result.status === "sent";
    const completed = await database.rpc("complete_action_delivery_service", {
      p_delivery_id: raw.deliveryId,
      p_succeeded: succeeded,
      p_permanent: result.permanent === true,
      p_provider_message_id: result.providerMessageId || null,
      p_error_code: succeeded ? null : result.errorCode || result.status,
      p_worker_key: workerKey,
    });
    if (completed.error) throw completed.error;
    results.push({
      channel: raw.channel,
      status: completed.data,
    });
  }
  return {
    materialized: materialized.data || { generated: 0 },
    claimed: Array.isArray(claimed.data) ? claimed.data.length : 0,
    sent: results.filter((result) => result.status === "sent").length,
    pending: results.filter((result) => result.status === "pending").length,
    failed: results.filter((result) => result.status === "failed").length,
  };
}

export async function runMaintenance(database, config) {
  const workerKey = `worker:maintenance:${randomUUID()}`;
  const [deletions, actions] = await Promise.all([
    processDeletionJobs(database, workerKey, 10),
    processActionCenterMaintenance(database, config, { workerKey }),
  ]);
  return {
    deletions: {
      processed: deletions.length,
      completed: deletions.filter((result) => result.status === "complete")
        .length,
      failed: deletions.filter((result) => result.status === "failed").length,
    },
    actions,
  };
}

async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return send(response, 405, { error: "Method not allowed" });
  }
  let config;
  try {
    config = serverEnvironment();
  } catch {
    return send(response, 500, { error: "Server configuration is invalid" });
  }
  const authorization = String(request.headers.authorization || "");
  if (!config.cronSecret || authorization !== `Bearer ${config.cronSecret}`)
    return send(response, 401, { error: "Unauthorized" });
  if (!config.supabaseUrl || !config.supabaseSecretKey)
    return send(response, 503, {
      error: "Maintenance worker is not configured",
    });
  const database = createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const result = await runMaintenance(database, config);
    return send(response, 200, { ok: true, ...result });
  } catch {
    return send(response, 500, { error: "Maintenance worker failed" });
  }
}

// Retained implementation is exercised offline; the shipping export stays held.
export { handler as retainedHandler };
export default withNativeCors(releaseHold, ["GET"]);
