import assert from "node:assert/strict";
import test from "node:test";
import { compareCertificate } from "../internal/certificates.js";
import { lookupCertificateFixture } from "../internal/certificate-fixtures.js";

test("normalized fixture retains cert zeros, half grade, and source-limited population history", async () => {
  const psa = await lookupCertificateFixture({
    grader: "PSA",
    certificate: "00012345",
  });
  assert.equal(psa.status, "match");
  assert.equal(psa.record.certificate, "00012345");
  assert.equal(psa.record.population.total, 125);
  assert.equal(psa.record.population.history, null);
  const bgs = await lookupCertificateFixture({
    grader: "BGS",
    certificate: "00054321",
  });
  assert.equal(bgs.record.grade, "9.5");
  assert.equal(bgs.record.identity.language, "ja");
  assert.equal(bgs.record.population.grades[1].grade, "9.5");
  assert.equal(bgs.record.population.history.length, 2);
});

test("comparison names conflicts without mutating existing copy facts", () => {
  const current = {
    name: "Pikachu",
    language: "en",
    variant: { label: "Normal" },
    gradingCompany: "PSA",
    grade: "9",
    certificationNumber: "00011111",
    transactions: [{ id: "purchase" }],
  };
  const before = structuredClone(current);
  const conflicts = compareCertificate(
    {
      identity: { name: "Pikachu", language: "ja", variant: "Normal" },
      grader: "PSA",
      grade: "10",
      certificate: "00012345",
    },
    current,
  );
  assert.deepEqual(conflicts, ["Language", "Grade", "Certificate"]);
  assert.deepEqual(current, before);
});

test("printing comparison distinguishes a holofoil from the normal fixture", () => {
  const record = { identity: { variant: "Normal" } };
  assert.deepEqual(
    compareCertificate(record, { variant: "Normal · Non-holo" }),
    [],
  );
  assert.deepEqual(
    compareCertificate(record, { variant: "Normal · Holofoil" }),
    ["Version"],
  );
  assert.deepEqual(
    compareCertificate(
      { identity: { variant: "Normal", finish: "non_holo" } },
      { variant: "Normal", finish: "holofoil" },
    ),
    ["Finish"],
  );
});
