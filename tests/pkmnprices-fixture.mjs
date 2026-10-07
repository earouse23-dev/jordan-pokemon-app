import { beforeEach } from "node:test";
import { pkmnPricesRequests } from "../lib/pkmnprices-requests.js";
// These tests stub the provider HTTP responses. Budget concurrency has its own
// runnable tests; no production environment flag bypasses the shared guard.
beforeEach((t) => {
  pkmnPricesRequests.cache.clear();
  pkmnPricesRequests.pending.clear();
  t.mock.method(pkmnPricesRequests, "claim", async () => {});
  t.mock.method(pkmnPricesRequests, "authenticate", async () => true);
});
