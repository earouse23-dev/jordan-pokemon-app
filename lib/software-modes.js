export const SOFTWARE_MODE_VERSION = "mica-software-modes-v1";

export const SOFTWARE_MODES = Object.freeze({
  collector: Object.freeze({
    id: "collector",
    label: "Collector",
    homeLabel: "Collector home",
    eyebrow: "Your collection",
    title: "Welcome back",
    description: "Your cards, at a glance.",
    primaryAction: "collection",
    navigationTarget: "collection",
    defaultView: Object.freeze({ ledgerView: "all", sort: "name" }),
    actions: Object.freeze([
      Object.freeze({ target: "collection", label: "Organize collection" }),
      Object.freeze({ target: "sets", label: "Review set progress" }),
      Object.freeze({ target: "graded", label: "Review graded cards" }),
      Object.freeze({ target: "add", label: "Add cards" }),
    ]),
  }),
  investor: Object.freeze({
    id: "investor",
    label: "Investor",
    homeLabel: "Investor home",
    eyebrow: "Your portfolio",
    title: "Portfolio overview",
    description: "Follow your collection’s value.",
    primaryAction: "portfolio",
    navigationTarget: "dashboard",
    defaultView: Object.freeze({ ledgerView: "all", sort: "value-desc" }),
    actions: Object.freeze([
      Object.freeze({ target: "portfolio", label: "Review price history" }),
      Object.freeze({ target: "analytics", label: "Review exposure" }),
      Object.freeze({ target: "watchlist", label: "Review watchlist" }),
      Object.freeze({ target: "alerts", label: "Review alerts" }),
    ]),
  }),
  seller: Object.freeze({
    id: "seller",
    label: "Seller",
    homeLabel: "Seller home",
    eyebrow: "Your inventory",
    title: "Seller workspace",
    description: "Keep up with inventory and sales.",
    primaryAction: "seller",
    navigationTarget: "collection",
    defaultView: Object.freeze({ ledgerView: "for-sale", sort: "value-desc" }),
    actions: Object.freeze([
      Object.freeze({ target: "seller", label: "Review inventory" }),
      Object.freeze({ target: "sales", label: "Review sales" }),
      Object.freeze({ target: "purchases", label: "Review purchases" }),
      Object.freeze({ target: "settings", label: "Update fee defaults" }),
    ]),
  }),
});

export function normalizeSoftwareMode(value, legacyPreferences = {}) {
  const candidate = String(value || "")
    .trim()
    .toLowerCase();
  if (Object.hasOwn(SOFTWARE_MODES, candidate)) return candidate;
  if (
    legacyPreferences?.collectorGoal === "selling" ||
    legacyPreferences?.experienceLevel === "professional"
  )
    return "seller";
  if (legacyPreferences?.collectorGoal === "trading") return "investor";
  return "collector";
}

export function softwareModeConfig(value, legacyPreferences = {}) {
  return SOFTWARE_MODES[normalizeSoftwareMode(value, legacyPreferences)];
}

export function softwareModePreference(preferences = {}) {
  return normalizeSoftwareMode(preferences.softwareMode, preferences);
}

export function modeCollectionDefault(value) {
  const config = softwareModeConfig(value);
  return { ...config.defaultView };
}

export function modeNavigationTargets(value) {
  return softwareModeConfig(value).actions.map((action) => action.target);
}

export function modeChangeEvent(input = {}) {
  const fromMode = normalizeSoftwareMode(input.fromMode);
  const toMode = normalizeSoftwareMode(input.toMode);
  const source = ["header", "settings", "onboarding", "migration"].includes(
    input.source,
  )
    ? input.source
    : "settings";
  return {
    contractVersion: SOFTWARE_MODE_VERSION,
    fromMode,
    toMode,
    source,
    changed: fromMode !== toMode,
  };
}
