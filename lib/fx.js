export const ECB_SOURCE_URL =
  "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
export const ECB_SOURCE_ID = "ecb-eurofxref-daily";
const DAY = 86_400_000;

function calendarDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === value
    ? time
    : null;
}

export function fxAgeDays(effectiveDate, now = Date.now()) {
  const day = calendarDay(effectiveDate);
  const clock = Number(now);
  if (day === null || !Number.isFinite(clock)) return null;
  return (
    (Date.parse(new Date(clock).toISOString().slice(0, 10) + "T00:00:00Z") -
      day) /
    DAY
  );
}

export function usableFxRate(record, now = Date.now()) {
  const age = fxAgeDays(record?.effectiveDate, now);
  return (
    record?.sourceId === ECB_SOURCE_ID &&
    record?.sourceUrl === ECB_SOURCE_URL &&
    record?.base === "EUR" &&
    record?.quote === "USD" &&
    record?.units === "USD per EUR" &&
    typeof record.rate === "number" &&
    Number.isFinite(record.rate) &&
    record.rate > 0 &&
    typeof record.contentSha256 === "string" &&
    /^[a-f0-9]{64}$/.test(record.contentSha256) &&
    record.rateRef ===
      `${ECB_SOURCE_ID}:${record.effectiveDate}:${record.contentSha256}` &&
    typeof record.fetchedAt === "string" &&
    Number.isFinite(Date.parse(record.fetchedAt)) &&
    new Date(record.fetchedAt).toISOString() === record.fetchedAt &&
    Date.parse(record.fetchedAt) <= Number(now) &&
    age !== null &&
    age >= 0 &&
    age <= 4
  );
}

export function convertIndicative(amount, from, to, record, now = Date.now()) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0)
    return null;
  if (!["USD", "EUR"].includes(from) || !["USD", "EUR"].includes(to))
    return null;
  if (from === to) return amount;
  if (!usableFxRate(record, now)) return null;
  const converted =
    from === "USD" ? amount / record.rate : amount * record.rate;
  return Number.isFinite(converted) ? converted : null;
}

// Deliberately accepts only the observed, tiny ECB daily-feed structure.
// Unknown XML fails closed rather than searching arbitrary text for a USD quote.
export function parseEcbDailyXml(xml, now = Date.now()) {
  if (typeof xml !== "string" || xml.length > 16_384 || /<!|&|\]\]>/.test(xml))
    throw new Error("invalid_xml");
  const source = xml.replace(
    /^\s*<\?xml\s+version=["']1\.0["']\s+encoding=["']UTF-8["']\s*\?>/,
    "",
  );
  const tokens = /<([^<>]+)>|([^<>]+)/g;
  const stack = [];
  const seen = {
    envelope: 0,
    subject: 0,
    sender: 0,
    name: 0,
    root: 0,
    date: 0,
    usd: 0,
  };
  let offset = 0;
  let effectiveDate = "";
  let rate = null;
  const currencies = new Set();
  const attributes = (raw) => {
    const values = {};
    let rest = raw;
    const pattern = /^\s+([A-Za-z][\w:-]*)\s*=\s*(['"])([^'"<>]*)\2/;
    while (rest.trim()) {
      const match = rest.match(pattern);
      if (!match || Object.hasOwn(values, match[1]))
        throw new Error("invalid_xml");
      values[match[1]] = match[3];
      rest = rest.slice(match[0].length);
    }
    return values;
  };
  for (const token of source.matchAll(tokens)) {
    if (token.index !== offset) throw new Error("invalid_xml");
    offset = token.index + token[0].length;
    if (token[2] !== undefined) {
      if (!/^\s*$/.test(token[2])) {
        const parent = stack.at(-1);
        if (
          parent === "gesmes:subject" &&
          token[2].trim() === "Reference rates"
        )
          seen.subject += 1;
        else if (
          parent === "gesmes:name" &&
          token[2].trim() === "European Central Bank"
        )
          seen.name += 1;
        else throw new Error("invalid_xml");
      }
      continue;
    }
    const tag = token[1];
    if (tag.startsWith("/")) {
      if (tag.slice(1).trim() !== stack.pop()) throw new Error("invalid_xml");
      continue;
    }
    const selfClosing = /\/\s*$/.test(tag);
    const match = tag
      .replace(/\/\s*$/, "")
      .match(/^([A-Za-z][\w:-]*)([\s\S]*)$/);
    if (!match) throw new Error("invalid_xml");
    const [, name, rawAttributes] = match;
    const attrs = attributes(rawAttributes);
    const parent = stack.at(-1) || "";
    const keys = Object.keys(attrs).sort().join(",");
    if (
      name === "gesmes:Envelope" &&
      !parent &&
      !selfClosing &&
      keys === "xmlns,xmlns:gesmes" &&
      attrs.xmlns === "http://www.ecb.int/vocabulary/2002-08-01/eurofxref" &&
      attrs["xmlns:gesmes"] === "http://www.gesmes.org/xml/2002-08-01"
    )
      seen.envelope += 1;
    else if (
      name === "gesmes:subject" &&
      parent === "gesmes:Envelope" &&
      !selfClosing &&
      !keys
    ) {
    } else if (
      name === "gesmes:Sender" &&
      parent === "gesmes:Envelope" &&
      !selfClosing &&
      !keys
    )
      seen.sender += 1;
    else if (
      name === "gesmes:name" &&
      parent === "gesmes:Sender" &&
      !selfClosing &&
      !keys
    ) {
    } else if (
      name === "Cube" &&
      parent === "gesmes:Envelope" &&
      !selfClosing &&
      !keys
    )
      seen.root += 1;
    else if (
      name === "Cube" &&
      parent === "Cube" &&
      stack.length === 2 &&
      !selfClosing &&
      keys === "time"
    ) {
      seen.date += 1;
      effectiveDate = attrs.time;
    } else if (
      name === "Cube" &&
      parent === "Cube" &&
      stack.length === 3 &&
      selfClosing &&
      keys === "currency,rate"
    ) {
      if (
        !/^[A-Z]{3}$/.test(attrs.currency) ||
        !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(attrs.rate) ||
        !Number.isFinite(Number(attrs.rate)) ||
        Number(attrs.rate) <= 0
      )
        throw new Error("invalid_rate");
      if (currencies.has(attrs.currency)) throw new Error("invalid_xml");
      currencies.add(attrs.currency);
      if (attrs.currency === "USD") {
        seen.usd += 1;
        rate = Number(attrs.rate);
      }
    } else throw new Error("invalid_xml");
    if (!selfClosing) stack.push(name);
  }
  if (
    offset !== source.length ||
    stack.length ||
    Object.values(seen).some((count) => count !== 1) ||
    fxAgeDays(effectiveDate, now) === null ||
    fxAgeDays(effectiveDate, now) < 0
  )
    throw new Error("invalid_xml");
  return { effectiveDate, rate };
}
