import assert from "node:assert/strict";
import test from "node:test";
import {
  SOFTWARE_MODES,
  modeChangeEvent,
  modeCollectionDefault,
  modeNavigationTargets,
  normalizeSoftwareMode,
  softwareModeConfig,
  softwareModePreference,
} from "../lib/software-modes.js";

test("software modes have distinct homes and shared-data workflow defaults", () => {
  assert.deepEqual(Object.keys(SOFTWARE_MODES), [
    "collector",
    "investor",
    "seller",
  ]);
  assert.equal(softwareModeConfig("collector").homeLabel, "Collector home");
  assert.equal(softwareModeConfig("investor").primaryAction, "portfolio");
  assert.equal(softwareModeConfig("seller").primaryAction, "seller");
  assert.notDeepEqual(
    modeCollectionDefault("collector"),
    modeCollectionDefault("seller"),
  );
});

test("invalid and legacy preferences migrate to a safe reversible mode", () => {
  assert.equal(normalizeSoftwareMode("unknown"), "collector");
  assert.equal(
    softwareModePreference({ collectorGoal: "trading" }),
    "investor",
  );
  assert.equal(
    softwareModePreference({ experienceLevel: "professional" }),
    "seller",
  );
  assert.equal(
    softwareModePreference({
      softwareMode: "collector",
      experienceLevel: "professional",
    }),
    "collector",
  );
});

test("every mode exposes four focused actions without becoming permissions", () => {
  for (const mode of Object.keys(SOFTWARE_MODES)) {
    const targets = modeNavigationTargets(mode);
    assert.equal(targets.length, 4);
    assert.equal(new Set(targets).size, 4);
    assert.ok(targets.every(Boolean));
  }
  assert.equal("permissions" in SOFTWARE_MODES.collector, false);
  assert.equal("permissions" in SOFTWARE_MODES.investor, false);
  assert.equal("permissions" in SOFTWARE_MODES.seller, false);
});

test("mode telemetry contains only contract, transition, and bounded source", () => {
  assert.deepEqual(
    modeChangeEvent({
      fromMode: "collector",
      toMode: "seller",
      source: "header",
      cardName: "must not survive",
    }),
    {
      contractVersion: "mica-software-modes-v1",
      fromMode: "collector",
      toMode: "seller",
      source: "header",
      changed: true,
    },
  );
  assert.equal(
    modeChangeEvent({ fromMode: "seller", toMode: "seller" }).changed,
    false,
  );
});
