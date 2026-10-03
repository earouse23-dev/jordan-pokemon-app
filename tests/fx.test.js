import test from "node:test";
import assert from "node:assert/strict";
import {
  ECB_SOURCE_ID,
  ECB_SOURCE_URL,
  convertIndicative,
  fxAgeDays,
  parseEcbDailyXml,
  usableFxRate,
} from "../lib/fx.js";

const NOW = Date.parse("2026-09-29T00:30:00Z");
const HASH = "a".repeat(64);
const record = (date = "2026-09-25", rate = 1.25) => ({
  sourceId: ECB_SOURCE_ID,
  sourceUrl: ECB_SOURCE_URL,
  base: "EUR",
  quote: "USD",
  units: "USD per EUR",
  rate,
  effectiveDate: date,
  fetchedAt: "2026-09-28T12:00:00.000Z",
  contentSha256: HASH,
  rateRef: `${ECB_SOURCE_ID}:${date}:${HASH}`,
});
const xml = (
  date = "2026-09-25",
  rates = "<Cube currency='USD' rate='1.25'/><Cube currency='JPY' rate='150.3'/>",
) =>
  `<?xml version="1.0" encoding="UTF-8"?><gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref"><gesmes:subject>Reference rates</gesmes:subject><gesmes:Sender><gesmes:name>European Central Bank</gesmes:name></gesmes:Sender><Cube><Cube time='${date}'>${rates}</Cube></Cube></gesmes:Envelope>`;

test("ECB structure, direction, identity and unrounded arithmetic", () => {
  assert.deepEqual(parseEcbDailyXml(xml(), NOW), {
    effectiveDate: "2026-09-25",
    rate: 1.25,
  });
  assert.deepEqual(
    parseEcbDailyXml(
      xml().replace("currency='USD' rate='1.25'", 'rate="1.25" currency="USD"'),
      NOW,
    ),
    { effectiveDate: "2026-09-25", rate: 1.25 },
  );
  assert.equal(convertIndicative(125, "USD", "EUR", record(), NOW), 100);
  assert.equal(convertIndicative(100, "EUR", "USD", record(), NOW), 125);
  assert.equal(convertIndicative(125, "USD", "USD", null, NOW), 125);
  assert.equal(convertIndicative(0, "USD", "USD", null, NOW), 0);
  assert.equal(convertIndicative(null, "USD", "EUR", record(), NOW), null);
  assert.equal(convertIndicative(NaN, "USD", "EUR", record(), NOW), null);
  const unrounded = convertIndicative(
    100.01,
    "USD",
    "EUR",
    record("2026-09-25", 1.2),
    NOW,
  );
  assert.equal(
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(unrounded),
    "€83.34",
  );
  assert.equal(convertIndicative(100.01, "USD", "USD", null, NOW), 100.01);
});

test("UTC calendar age is independent of viewer timezone and fetchedAt", () => {
  assert.equal(fxAgeDays("2026-09-25", NOW), 4);
  assert.equal(usableFxRate(record(), NOW), true);
  assert.equal(
    usableFxRate(record(), Date.parse("2026-09-30T00:00:00Z")),
    false,
  );
  assert.equal(fxAgeDays("2026-09-25", Date.parse("2026-09-28T12:00:00Z")), 3);
  assert.equal(fxAgeDays("2026-09-25", Date.parse("2026-09-30T12:00:00Z")), 5);
  assert.equal(usableFxRate(record("2026-09-30"), NOW), false);
  assert.equal(fxAgeDays("2026-02-30", NOW), null);
  assert.equal(
    usableFxRate({ ...record(), fetchedAt: "2026-09-30T00:00:00.000Z" }, NOW),
    false,
  );
});

test("complete feed validation rejects ambiguity and hostile structures", () => {
  const invalid = [
    xml().replace("rate='1.25'", "rate='0'"),
    xml().replace("rate='1.25'", "rate='-1'"),
    xml().replace("rate='1.25'", "rate='Infinity'"),
    xml().replace("rate='1.25'", "rate='NaN'"),
    xml().replace("<Cube currency='USD' rate='1.25'/>", ""),
    xml().replace(
      "<Cube currency='USD' rate='1.25'/>",
      "<Cube currency='USD' rate='1.25'/><Cube currency='USD' rate='1.3'/>",
    ),
    xml().replace(
      "<Cube time='2026-09-25'>",
      "<Cube time='2026-09-25'><Cube time='2026-09-24'>",
    ),
    xml("2026-02-30"),
    xml("2026-09-30"),
    xml().replace("currency='USD'", "currency='USD' currency='EUR'"),
    xml().replace("<Cube currency='USD'", "<Cube surprise='x' currency='USD'"),
    `<!DOCTYPE a [<!ENTITY x SYSTEM 'file:///etc/passwd'>]>${xml()}`,
    xml().replace("Reference rates", "&amp; Reference rates"),
    `${xml()}<Cube currency='USD' rate='1.5'/>`,
    xml().replace("</gesmes:Envelope>", ""),
    `${xml()}<`,
  ];
  for (const input of invalid)
    assert.throws(() => parseEcbDailyXml(input, NOW), input.slice(0, 80));
  assert.equal(usableFxRate({ ...record(), rate: 0 }, NOW), false);
  assert.equal(usableFxRate({ ...record(), contentSha256: "bad" }, NOW), false);
  assert.equal(
    convertIndicative(
      125,
      "USD",
      "EUR",
      record("2026-09-24"),
      Date.parse("2026-09-30T00:00:00Z"),
    ),
    null,
  );
});
