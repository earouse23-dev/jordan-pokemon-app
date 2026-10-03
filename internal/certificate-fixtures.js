// Mica-owned normalized examples. These are invented records, never provider responses.
const identity = {
  name: "Pikachu",
  set: "Synthetic Violet",
  number: "025/165",
  variant: "Normal",
  finish: "non_holo",
  language: "en",
};

const population = {
  source: "Internal sample",
  asOf: "2026-09-24",
  coverage: "Synthetic PSA example; no real-world coverage implied",
  total: 125,
  grades: [
    { grade: "10", count: 50 },
    { grade: "9", count: 60 },
    { grade: "8", count: 15 },
  ],
  history: null,
};

const records = {
  "PSA:00012345": {
    identity,
    grade: "10",
    qualifier: null,
    subgrades: null,
    images: [
      { url: "./certificate-sample.svg", alt: "Synthetic slab drawing" },
    ],
    population,
  },
  "BGS:00054321": {
    identity: {
      ...identity,
      language: "ja",
      set: "Synthetic Japanese Set",
      number: "025/100",
      finish: "non_holo",
    },
    grade: "9.5",
    qualifier: "Gold label",
    subgrades: { centering: "9.5", corners: "9", edges: "9.5", surface: "10" },
    images: null,
    population: {
      source: "Internal sample",
      asOf: "2026-09-24",
      coverage: "Synthetic BGS Japanese example; half grades represented",
      total: 12,
      grades: [
        { grade: "10", count: 1 },
        { grade: "9.5", count: 4 },
        { grade: "9", count: 7 },
      ],
      history: [
        { asOf: "2026-08-24", total: 10 },
        { asOf: "2026-09-24", total: 12 },
      ],
    },
  },
  "PSA:PARTIAL": {
    identity: {
      name: "Pikachu",
      set: null,
      number: null,
      variant: null,
      language: "de",
    },
    grade: null,
    qualifier: null,
    subgrades: null,
    images: null,
    population: null,
  },
};

export async function lookupCertificateFixture({
  grader,
  certificate,
  signal,
}) {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, certificate === "SLOW" ? 700 : 80);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Canceled", "AbortError"));
      },
      { once: true },
    );
  });
  if (globalThis.navigator?.onLine === false || certificate === "OFFLINE")
    throw new Error("offline");
  if (certificate === "RATE") throw new Error("rate_limit");
  if (certificate === "ENTITLEMENT") throw new Error("entitlement");
  if (certificate === "ERROR") throw new Error("unavailable");
  if (certificate === "MALFORMED")
    return { status: "match", record: { grader, certificate } };
  if (!["PSA", "BGS"].includes(grader)) return { status: "unsupported" };
  if (certificate === "AMBIGUOUS") return { status: "ambiguous" };
  if (certificate === "UNSUPPORTED-LANGUAGE") return { status: "unsupported" };
  const data = records[`${grader}:${certificate}`];
  if (!data) return { status: "not_found" };
  return {
    status: "match",
    record: {
      grader,
      certificate,
      ...data,
      source: "Internal sample",
      observedAt: "2026-09-24T12:00:00Z",
    },
  };
}
