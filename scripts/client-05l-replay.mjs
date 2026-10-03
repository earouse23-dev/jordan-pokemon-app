import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { privateDir } from "./client-05l-proof.mjs";

const path = join(privateDir, "attempt.json");
const ledger = JSON.parse(readFileSync(path, "utf8"));
assert.equal(statSync(path).mode & 0o077, 0, "ledger must be owner-only");
assert.equal(ledger.packet, "CLIENT-05L");
assert.equal(ledger.ruleVersion, "mica-exact-sold-v1");
assert.equal(ledger.candidate.sourceCard, "base2-1");
assert.equal(
  ledger.candidate.sourceVariant,
  "tcgdex:en:base2-1:variant:3a83wf50ts0izj268xwv3crwi",
);
assert.equal(ledger.candidate.providerId, "20618");
assert.ok(ledger.requests.length <= 2);
assert.ok(ledger.reservedCredits <= 11);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const hashAgreement = Object.entries(ledger.fileHashes).every(
  ([file, expected]) => hash(readFileSync(file)) === expected,
);
const d = ledger.direct;
const independent = {
  id: String(d?.id) === "20618",
  name: d?.name === "Clefable (1)",
  set: d?.set === "Jungle",
  number: String(d?.number) === "01",
  total: String(d?.total_set_number) === "64",
  explicitEnglish: d?.language === "English",
  firstEditionHoloUsd:
    Array.isArray(d?.prices) &&
    d.prices.some(
      (row) => row.variant === "1st Edition Holofoil" && row.currency === "USD",
    ),
};
const directPass = Object.values(independent).every(Boolean);
assert.equal(ledger.directGate, directPass ? "pass" : "fail");
if (!directPass) {
  assert.equal(
    ledger.requests.length,
    1,
    "failed identity must stop before sales",
  );
  assert.equal(ledger.requests[0].stage, "direct");
  assert.equal(
    ledger.requests[0].url,
    "https://api.pkmnprices.com/v1/cards/20618?currency=usd",
  );
  assert.equal(ledger.reservedCredits, 1);
  assert.equal(ledger.rows, null);
  assert.equal(ledger.api, null);
  assert.equal(ledger.production, undefined);
} else {
  assert.fail(
    "This replay is deliberately limited to the observed direct-identity stop; do not invent sales arithmetic.",
  );
}
const result = {
  outcome: ledger.outcome,
  hashAgreement,
  directGateAgreement: true,
  independent,
  outbound: ledger.requests.length,
  reservedCredits: ledger.reservedCredits,
  reportedCharge: ledger.requests[0].charge,
  salesRequested: false,
  arithmetic: "not_applicable_no_sales_request",
};
console.log(JSON.stringify(result));
