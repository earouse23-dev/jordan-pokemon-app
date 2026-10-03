import assert from "node:assert/strict";
import test from "node:test";
import {
  deliverActionNotification,
  normalizeDeliveryClaim,
  notificationDeliveryCapabilities,
} from "../lib/notification-delivery.js";

const claim = {
  deliveryId: "delivery-1",
  channel: "email",
  idempotencyKey: "action-1:email",
  recipientUserId: "user-1",
  recipientEmail: "Collector@example.com",
  action: {
    title: "Target reached",
    reason: "A verified price crossed the target.",
    suggestedAction: "Review the evidence.",
    destinationUrl: "https://mica.example/#watchlist",
  },
};

test("delivery claims expose only bounded action and recipient fields", () => {
  assert.deepEqual(normalizeDeliveryClaim(claim), {
    ...claim,
    recipientEmail: "collector@example.com",
  });
  assert.throws(
    () => normalizeDeliveryClaim({ ...claim, channel: "sms" }),
    /Unsupported/,
  );
});

test("unconfigured optional adapters fail permanently without a network call", async () => {
  let called = false;
  const result = await deliverActionNotification(
    claim,
    {},
    {
      fetchImpl: async () => {
        called = true;
      },
    },
  );
  assert.equal(called, false);
  assert.deepEqual(result, {
    status: "unconfigured",
    permanent: true,
    errorCode: "email_not_configured",
  });
  assert.equal(
    (await deliverActionNotification({ ...claim, channel: "web_push" }, {}))
      .errorCode,
    "web_push_adapter_not_configured",
  );
});

test("email delivery uses the action key as the provider idempotency key", async () => {
  let request;
  const result = await deliverActionNotification(
    { ...claim, action: { ...claim.action, title: "Target <reached>" } },
    {
      resendApiKey: "secret",
      alertEmailFrom: "Mica <alerts@mica.example>",
    },
    {
      fetchImpl: async (url, options) => {
        request = { url, options };
        return {
          ok: true,
          status: 200,
          async json() {
            return { id: "provider-1" };
          },
        };
      },
    },
  );
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.options.headers["Idempotency-Key"], "action-1:email");
  assert.match(request.options.body, /Target &lt;reached&gt;/);
  assert.equal(result.providerMessageId, "provider-1");
});

test("delivery capabilities are honest before optional services are configured", () => {
  assert.deepEqual(notificationDeliveryCapabilities({}), {
    inApp: "active",
    email: "available_after_configuration",
    webPush: "adapter_ready_requires_configuration",
  });
});
