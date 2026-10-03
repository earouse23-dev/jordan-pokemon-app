// Isolated, two-request transport gate for CLIENT-05B. It does not alter the app.
const cardUrl = "https://api.pkmnprices.com/v1/cards/10195?currency=usd";
const salesUrl =
  "https://api.pkmnprices.com/v1/cards/10195/listings/ebay?limit=10&sort=date_desc&graded=true&variant=Holofoil&grader=PSA&grade=10";

function stopped() {
  const error = new Error("CLIENT-05B request guard stopped the probe");
  error.status = 409; // Non-retryable in the existing provider adapter.
  return error;
}

function fixedCardMatches(card) {
  const compact = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const printed = String(card?.number || "").split("/");
  const number = Number(printed[0]);
  const total = Number(printed[1] || card?.total_set_number);
  const language = compact(card?.language);
  return (
    String(card?.id) === "10195" &&
    compact(card?.name) === "pikachu" &&
    number === 6 &&
    total === 15 &&
    compact(card?.set?.name) === "mcdonaldspromos2023" &&
    (!language || language === "english" || language === "en")
  );
}

export function createClient05bGuard(transport, { enabled = false } = {}) {
  let phase = 0;
  let reserved = 0;
  const observed = [];
  return {
    get ledger() {
      return { outbound: phase, reserved, observed: [...observed] };
    },
    async fetch(input, options = {}) {
      if (!enabled) throw stopped();
      const url = String(input);
      const expected = phase === 0 ? cardUrl : phase === 1 ? salesUrl : null;
      if (
        !expected ||
        url !== expected ||
        (options.method || "GET").toUpperCase() !== "GET" ||
        options.body != null
      )
        throw stopped();
      phase += 1;
      reserved += phase === 1 ? 1 : 10;
      // Node fetch rejects redirects before following them to another origin.
      const response = await transport(input, {
        ...options,
        redirect: "error",
      });
      observed.push({
        status: response.status,
        charge: /^\d+$/.test(response.headers.get("x-credits-charged") || "")
          ? Number(response.headers.get("x-credits-charged"))
          : null,
      });
      if (!response.ok) return response;
      const body = await response
        .clone()
        .json()
        .catch(() => null);
      if (
        (phase === 1 && !fixedCardMatches(body)) ||
        (phase === 2 && (!Array.isArray(body?.data) || body.data.length > 10))
      )
        throw stopped();
      return response;
    },
  };
}
