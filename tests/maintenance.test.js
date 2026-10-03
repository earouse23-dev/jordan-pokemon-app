import assert from "node:assert/strict";
import test from "node:test";
import {
  retainedHandler as maintenanceHandler,
  processActionCenterMaintenance,
} from "../api/maintenance.js";
import { notificationDestinationUrl } from "../lib/notification-delivery.js";

function responseDouble() {
  let body;
  return {
    response: {
      setHeader() {},
      status(status) {
        this.statusCode = status;
        return this;
      },
      json(value) {
        body = value;
        return value;
      },
    },
    body: () => body,
  };
}

test("notification destinations stay on the configured Mica origin", () => {
  assert.equal(
    notificationDestinationUrl("https://mica.example", {
      route: "watchlist",
      id: "watch-1",
    }),
    "https://mica.example/?actionRoute=watchlist&actionId=watch-1#collection",
  );
  assert.equal(
    notificationDestinationUrl("https://mica.example", { route: "settings" }),
    "https://mica.example/profile",
  );
  assert.equal(notificationDestinationUrl("javascript:alert(1)", {}), "");
});

test("maintenance completes every claimed delivery through its lease owner", async () => {
  const calls = [];
  const database = {
    async rpc(name, input) {
      calls.push({ name, input });
      if (name === "materialize_action_center_service")
        return { data: { generated: 2 }, error: null };
      if (name === "claim_action_deliveries_service")
        return {
          data: [
            {
              deliveryId: "delivery-1",
              recipientUserId: "user-1",
              recipientEmail: "collector@example.com",
              channel: "email",
              idempotencyKey: "action-1:email",
              action: {
                title: "Target reached",
                reason: "Verified evidence crossed the target.",
                suggestedAction: "Review it.",
                destination: { route: "watchlist", id: "watch-1" },
              },
            },
          ],
          error: null,
        };
      if (name === "complete_action_delivery_service")
        return { data: "sent", error: null };
      throw new Error(`Unexpected RPC ${name}`);
    },
  };
  const result = await processActionCenterMaintenance(
    database,
    { appBaseUrl: "https://mica.example" },
    {
      workerKey: "worker:test-maintenance",
      deliver: async (delivery) => {
        assert.equal(
          delivery.action.destinationUrl,
          "https://mica.example/?actionRoute=watchlist&actionId=watch-1#collection",
        );
        return { status: "sent", providerMessageId: "provider-1" };
      },
    },
  );
  assert.equal(result.sent, 1);
  assert.equal(
    calls.filter((call) => call.name === "complete_action_delivery_service")
      .length,
    1,
  );
  assert.equal(calls.at(-1).input.p_worker_key, "worker:test-maintenance");
});

test("maintenance endpoint fails closed without the cron credential", async () => {
  const original = { ...process.env };
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "server-secret",
    CRON_SECRET: "cron-secret-value",
  });
  const result = responseDouble();
  try {
    await maintenanceHandler({ method: "GET", headers: {} }, result.response);
    assert.equal(result.response.statusCode, 401);
    assert.equal(result.body().error, "Unauthorized");
  } finally {
    process.env = original;
  }
});
