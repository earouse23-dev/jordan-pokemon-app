// These are PSA's printed set names and their catalog equivalents.
const legacySets = [
  {
    year: "2004",
    series: "JAPANESE",
    label: "MOVIE COMM. VS PACK",
    catalog: "Movie Commemoration VS Pack: Sky-Splitting Deoxys",
    language: "ja",
    plainTitle: true,
  },
  {
    year: "2008",
    series: "JAPANESE",
    label: "STORMFRONT",
    catalog: "Intense Fight in the Destroyed Sky",
    language: "ja",
  },
  {
    year: "2006",
    series: "EX",
    label: "DRAGON FRONTIERS",
    catalog: "Dragon Frontiers",
    language: "en",
  },
];

export function parseLegacyPsaLabel(text) {
  if (typeof text !== "string" || text.length > 320) return null;
  const lines = text
    .toUpperCase()
    .trim()
    .split(/\n+/)
    .map((line) => line.trim());
  if (lines.length !== 4) return null;
  const header = /^(\d{4}) POK[EÉ]MON (JAPANESE|EX)\s+#(\d{1,3})$/.exec(
    lines[0],
  );
  const title = /^([A-Z][A-Z '.-]+?)\s+(GEM MT|MINT)$/.exec(lines[1]);
  const issue = /^([A-Z .]+?)(-1ST ED\.?)?\s+(10|9)$/.exec(lines[2]);
  const cert = /^(?:[^A-Z0-9]*|[TIF |0-9=-]{0,14}\s+)(\d{8,10})$/.exec(
    lines[3],
  );
  if (
    !header ||
    !title ||
    !issue ||
    !cert ||
    (title[2] === "GEM MT" ? issue[3] !== "10" : issue[3] !== "9")
  )
    return null;
  const set = legacySets.find(
    (row) =>
      row.year === header[1] &&
      row.series === header[2] &&
      row.label === issue[1],
  );
  if (!set || (issue[2] && set.language !== "ja")) return null;
  const holo = title[1].endsWith("-HOLO");
  if (set.plainTitle ? holo : !holo) return null;
  const name = holo ? title[1].slice(0, -5) : title[1];
  if (!name || /(?:^|[- ])(?:REVERSE|REV|AUTO|OC|MC|ST|PD|OF|MK)(?:[- ]|$)/.test(name)) return null;
  return {
    name,
    labelName: title[1],
    setName: set.label,
    catalogSet: set.catalog,
    collectorNumber: header[3],
    language: set.language,
    cardState: "graded",
    grader: "PSA",
    grade: Number(issue[3]),
    gradeQualifier: "",
    certificationNumber: cert[1],
    finish: holo ? "holofoil" : null,
    edition: issue[2] ? "first_edition" : null,
    promoType: null,
  };
}

export function legacyCatalogIdentity(identity) {
  const setName = String(identity.setName || "")
    .toUpperCase()
    .replace(/\s*-\s*1ST ED\.?$/, "");
  const set = legacySets.find(
    (row) => row.language === identity.language && row.label === setName,
  );
  const title = String(identity.labelName || "")
    .toUpperCase()
    .replace(/^(?:19|20)\d{2} POK[EÉ]MON (?:JAPANESE|EX)\s+/, "");
  if (
    !set ||
    identity.grader !== "PSA" ||
    identity.cardState !== "graded" ||
    !/^[A-Z][A-Z '.-]+-HOLO$/.test(title)
  )
    return null;
  return {
    ...identity,
    catalogSet: set.catalog,
    name: title.slice(0, -5),
    collectorNumber: String(identity.collectorNumber || ""),
  };
}

export function matchesLegacyPsaCard(identity, card) {
  const printed = String(identity.collectorNumber || "")
    .replace(/^#/, "")
    .split("/");
  const number = String(card.number || "").split("/");
  return (
    card.language === identity.language &&
    card.set?.toLowerCase() === identity.catalogSet.toLowerCase() &&
    card.name?.replace(/’/g, "'").replace(/\s*δ$/u, "").toUpperCase() === identity.name &&
    printed.length <= 2 &&
    printed.every(
      (part, i) => /^\d+$/.test(part) && Number(part) === Number(number[i]),
    )
  );
}

// Match the standard Japanese issue only when the slab names a supported set,
// the exact holo title and numbered printing, with no special designation.
export function standardLegacyHolo(identity, card) {
  const set = legacySets.find(
    (row) => row.language === "ja" && !row.plainTitle && row.catalog === card.set,
  );
  const title = String(identity.labelName || "")
    .toUpperCase()
    .replace(/^2008 POK[EÉ]MON JAPANESE\s+/, "");
  const setName = String(identity.setName || "")
    .toUpperCase()
    .replace(/\s*-\s*1ST ED\.?$/, "");
  const number = String(identity.collectorNumber || "")
    .replace(/^#/, "")
    .split("/");
  const catalogNumber = String(card.number || "").split("/");
  return Boolean(
    set &&
    setName === set.label &&
    identity.language === set.language &&
    card.language === set.language &&
    identity.grader === "PSA" &&
    identity.cardState === "graded" &&
    title === card.name.toUpperCase() + "-HOLO" &&
    number.every(
      (part, i) =>
        /^\d+$/.test(part) && Number(part) === Number(catalogNumber[i]),
    ) &&
    !identity.promoInfo &&
    !(identity.printingHints || []).some((hint) =>
      /promo|stamp|staff|prerelease|reverse/i.test(hint),
    ),
  );
}
