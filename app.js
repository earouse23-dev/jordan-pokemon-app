import {
  money,
  calculateTotals,
  collectionToCsv,
  collectionWindow,
  accountBackupJson,
  importRecordKey,
  parseCollectionCsv,
  portfolioSnapshot,
  runBoundedTasks,
  transactionReportCsv,
  missingSetChecklist,
  isStale,
  localIsoDate,
  matchesSearch,
  ownedCardSummary,
  sameCatalogCard,
} from "./lib/core.js";
import {
  finishForVariant,
  gradedPriceLadder,
  mergePriceHistory,
  priceEvidence,
  priceMovement,
  selectCardmarketReference,
  selectReferenceQuote,
} from "./lib/pricing.js";
import {
  acquisitionFromTotal,
  allocateFifo,
  batchAcquisitionPlan,
  blendedPosition,
  businessSummary,
  buyOfferPlan,
  gradingBatchPlan,
  gradingDecision,
  gradingEstimate,
  holdingDays,
  insuranceDocumentation,
  inventoryHealth,
  liquidationPlan,
  listingReadiness,
  portfolioActions,
  portfolioReview,
  positionPerformance,
  purchaseEntryPoints,
  salePlan,
  targetAlertChanges,
  tradeAnalysis,
  tradeSummary,
  validateAcquisition,
  watchPerformance,
} from "./lib/portfolio.js";
import {
  normalizeGrade,
  normalizeGrader,
  normalizeRawCondition,
} from "./lib/domain.js";
import {
  bulkOrganizePositions,
  completeUnknownPurchaseLot,
  createAppSupabase,
  createImportedPosition,
  createPosition,
  createWatchlistEntry,
  deletePosition,
  deleteWatchlistEntry,
  loadDiagnostics,
  loadPortfolio,
  loadWatchlist,
  recordGradingResult,
  recordGradingSubmission,
  recordPurchaseLot,
  recordSale,
  remapCollectionPosition,
  sendMagicLink,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  updateGradingSubmission,
  updatePosition,
  updateWatchlistEntry,
} from "./lib/supabase-data.js";

const supabase = createAppSupabase();
let chartInstance = null;
let chartMountVersion = 0;
let deferredInstallPrompt = null;
let motionPreference = "auto";
let targetAlertsEnabled = false;
let workspaceMode = "growth";
let uiTheme = "clean";
try {
  const savedMotion = localStorage.getItem("mica-motion-preference");
  if (["auto", "reduce", "full"].includes(savedMotion))
    motionPreference = savedMotion;
} catch {}
try {
  targetAlertsEnabled = localStorage.getItem("mica-target-alerts") === "on";
} catch {}
try {
  const savedWorkspace = localStorage.getItem("mica-workspace-mode");
  if (["guided", "growth", "pro"].includes(savedWorkspace))
    workspaceMode = savedWorkspace;
} catch {}
try {
  const savedTheme = localStorage.getItem("mica-ui-theme");
  if (["clean", "analytics"].includes(savedTheme)) uiTheme = savedTheme;
} catch {}
let catalog = [
  {
    id: "sv3pt5-199",
    name: "Charizard ex",
    set: "151",
    number: "199/165",
    rarity: "Special Illustration Rare",
    variant: "Holofoil",
    image: "https://images.pokemontcg.io/sv3pt5/199_hires.png",
    thumb: "https://images.pokemontcg.io/sv3pt5/199.png",
    price: null,
    move: null,
    artist: "miki kudo",
    release: "2023",
  },
  {
    id: "swsh7-215",
    name: "Umbreon VMAX",
    set: "Evolving Skies",
    number: "215/203",
    rarity: "Alternate Art Secret",
    variant: "Holofoil",
    image: "https://images.pokemontcg.io/swsh7/215_hires.png",
    thumb: "https://images.pokemontcg.io/swsh7/215.png",
    price: null,
    move: null,
    artist: "KEIICHIRO ITO",
    release: "2021",
  },
  {
    id: "base1-4",
    name: "Charizard",
    set: "Base Set",
    number: "4/102",
    rarity: "Rare Holo",
    variant: "Unlimited Holofoil",
    image: "https://images.pokemontcg.io/base1/4_hires.png",
    thumb: "https://images.pokemontcg.io/base1/4.png",
    price: null,
    move: null,
    artist: "Mitsuhiro Arita",
    release: "1999",
  },
  {
    id: "swsh12pt5gg-GG44",
    name: "Mewtwo VSTAR",
    set: "Crown Zenith: Galarian Gallery",
    number: "GG44/GG70",
    rarity: "Rare Holo VSTAR",
    variant: "Holofoil",
    image: "https://images.pokemontcg.io/swsh12pt5gg/GG44_hires.png",
    thumb: "https://images.pokemontcg.io/swsh12pt5gg/GG44.png",
    price: null,
    move: null,
    artist: "GOSSAN",
    release: "2023",
  },
  {
    id: "sv3pt5-151",
    name: "Mew ex",
    set: "151",
    number: "151/165",
    rarity: "Double Rare",
    variant: "Holofoil",
    image: "https://images.pokemontcg.io/sv3pt5/151_hires.png",
    thumb: "https://images.pokemontcg.io/sv3pt5/151.png",
    price: null,
    move: null,
    artist: "5ban Graphics",
    release: "2023",
  },
  {
    id: "neo4-17",
    name: "Espeon",
    set: "Neo Discovery",
    number: "1/75",
    rarity: "Rare Holo",
    variant: "Unlimited Holofoil",
    image: "https://images.pokemontcg.io/neo2/1_hires.png",
    thumb: "https://images.pokemontcg.io/neo2/1.png",
    price: null,
    move: null,
    artist: "Ken Sugimori",
    release: "2001",
  },
  {
    id: "sv6-211",
    name: "Greninja ex",
    set: "Twilight Masquerade",
    number: "214/167",
    rarity: "Special Illustration Rare",
    variant: "Holofoil",
    image: "https://images.pokemontcg.io/sv6/214_hires.png",
    thumb: "https://images.pokemontcg.io/sv6/214.png",
    price: null,
    move: null,
    artist: "Teeziro",
    release: "2024",
  },
  {
    id: "sm115-28",
    name: "Pikachu",
    set: "Detective Pikachu",
    number: "10/18",
    rarity: "Common",
    variant: "Holofoil",
    image: "https://images.pokemontcg.io/sm115/10_hires.png",
    thumb: "https://images.pokemontcg.io/sm115/10.png",
    price: null,
    move: null,
    artist: "MPC Film",
    release: "2019",
  },
];

const state = {
  items: [],
  watchlist: [],
  intakeQueue: [],
  setCatalogs: new Map(),
  setCatalogLoading: new Set(),
  session: null,
  route: "collection",
  ledgerView: "all",
  query: "",
  sort: "value-desc",
  setFilter: "",
  conditionFilter: "",
  labelFilter: "",
  bulkMode: false,
  bulkSelected: new Set(),
  visiblePositionIds: [],
  visibleLimit: 100,
  visibleKey: "",
  detailId: null,
  detailCard: null,
  detailReturnRoute: "scan",
  detailCanPop: false,
  lastFocus: null,
  sheetHistory: false,
  pricingStatus: "idle",
  pricingRetrievedAt: null,
  movementStatus: "idle",
  storageStatus: "cloud",
  accountLoading: false,
  accountLoadError: "",
  chartRange: "all",
  businessRange: "90d",
  trade: {
    give: [],
    receive: [],
    giveCash: "0.00",
    receiveCash: "0.00",
    addingTo: "give",
    searchResults: [],
  },
};
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const languageName = (code) =>
  ({
    en: "English",
    ja: "Japanese",
    fr: "French",
    de: "German",
    es: "Spanish",
    it: "Italian",
    pt: "Portuguese",
    "zh-tw": "Traditional Chinese",
    id: "Indonesian",
    th: "Thai",
  })[String(code || "").toLowerCase()] || String(code || "English");
const normalizeIdentity = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const gradingServices = {
  PSA: [
    { name: "Value", fee: 32.99, note: "No membership required" },
    { name: "Value Plus", fee: 49.99 },
    { name: "Value Max", fee: 64.99 },
    { name: "Regular", fee: 79.99 },
    {
      name: "Value Bulk",
      fee: 24.99,
      minimum: 20,
      note: "Collectors Club · 20-card minimum",
    },
  ],
  CGC: [
    { name: "Economy", fee: 20 },
    { name: "Standard", fee: 55 },
    { name: "Express", fee: 100 },
    { name: "Bulk", fee: 17, minimum: 25, note: "25-card minimum" },
  ],
  BGS: [
    { name: "Base · no subgrades", fee: 14.95 },
    { name: "Base · with subgrades", fee: 17.95 },
    { name: "Standard", fee: 34.95 },
    { name: "Express", fee: 79.95 },
  ],
  TAG: [{ name: "Basic", fee: 22, minimum: 10, note: "10-card minimum" }],
};

function historyKey(item) {
  return [
    item.id,
    item.variant,
    item.condition,
    item.gradingCompany,
    item.grade,
  ]
    .map((value) => String(value || ""))
    .join("|");
}

function recordPriceObservation(item, quote, providerHistory = []) {
  const observation = quote
    ? {
        provider: quote.provider,
        providerVariantId: quote.providerVariantId || quote.providerProductId,
        currency: quote.currency,
        condition: quote.condition,
        finish: quote.finish,
        gradingCompany: quote.gradingCompany,
        grade: quote.grade,
        amount: quote.amount,
        recordedAt: quote.observedAt || quote.retrievedAt,
        granularity: "observation",
      }
    : null;
  return mergePriceHistory(
    providerHistory,
    observation ? [observation] : [],
  ).slice(-1000);
}
function itemValue(item) {
  return item.price == null
    ? null
    : Number(item.price) * Number(item.quantity || 0);
}

function priceStatusText(item) {
  if (item.price == null) return "Pricing unavailable";
  if (item.pricingStatus === "live")
    return `Updated ${item.pricingUpdatedAt || "recently"}`;
  if (item.pricingStatus === "stale")
    return `Stale · observed ${item.pricingUpdatedAt || "date unknown"}`;
  return "Preview fixture";
}

function applyWorkspaceMode(mode, { announce = false } = {}) {
  if (!["guided", "growth", "pro"].includes(mode)) return;
  workspaceMode = mode;
  document.body.dataset.workspace = mode;
  try {
    localStorage.setItem("mica-workspace-mode", mode);
  } catch {}
  $$("[data-workspace-mode]").forEach((button) => {
    const active = button.dataset.workspaceMode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const copy = {
    guided: {
      title: "Guided workspace",
      intro:
        "See what your collection may be worth, what you could realistically take home, and the clearest next step.",
      help: "Guided keeps essential collection decisions visible and tucks away seller reporting.",
    },
    growth: {
      title: "Growing seller workspace",
      intro:
        "See what needs attention, how your inventory is performing, and where prices come from.",
      help: "Growing seller shows grading, inventory health, cash flow, and profit tools.",
    },
    pro: {
      title: "Pro desk",
      intro:
        "Run valuation, inventory, grading, sales, and cash-flow decisions from one dense workspace.",
      help: "Pro desk keeps every tool visible and fits more inventory into each screen.",
    },
  }[mode];
  if ($("#insightsIntro")) $("#insightsIntro").textContent = copy.intro;
  if ($("#workspaceModeHelp"))
    $("#workspaceModeHelp").textContent =
      `${copy.help} Your data and calculations do not change.`;
  if (mode === "guided" && ["graded", "unpriced"].includes(state.ledgerView)) {
    state.ledgerView = "all";
    syncTabs();
    renderCollection();
  }
  if (announce) toast(`${copy.title} selected`);
}

function applyUiTheme(theme, { announce = false } = {}) {
  if (!["clean", "analytics"].includes(theme)) return;
  uiTheme = theme;
  document.body.dataset.uiTheme = theme;
  document.documentElement.style.colorScheme =
    theme === "analytics" ? "dark" : "light";
  try {
    localStorage.setItem("mica-ui-theme", theme);
  } catch {}
  const dark = theme === "analytics";
  const label = dark ? "Analytics" : "Clean";
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = dark ? "#0b0d0e" : "#f4f7fb";
  $$("[data-ui-theme-option]").forEach((button) => {
    const active = button.dataset.uiThemeOption === theme;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if ($("#themeQuickLabel")) $("#themeQuickLabel").textContent = label;
  if ($("#themeQuickSwitch"))
    $("#themeQuickSwitch").setAttribute(
      "aria-label",
      dark
        ? "Switch to clean modern interface"
        : "Switch to analytics dark interface",
    );
  if ($("#uiThemeHelp"))
    $("#uiThemeHelp").textContent = dark
      ? "Analytics focused uses the Concept 5 dark workspace with compact data panels. Your data does not change."
      : "Clean modern uses the Concept 2 bright workspace with airy cards and blue actions. Your data does not change.";
  if (announce)
    toast(
      `${dark ? "Analytics focused · Concept 5" : "Clean modern · Concept 2"} selected`,
    );
}

function quoteStatus(quote) {
  if (!quote) return "unavailable";
  return isStale(quote.observedAt || quote.retrievedAt) ? "stale" : "live";
}

function renderQuoteRow(quote, label) {
  if (!quote) return "";
  const source = quote.providerUrl
    ? `<a href="${esc(quote.providerUrl)}" target="_blank" rel="noreferrer">${esc(label)}</a>`
    : `<strong>${esc(label)}</strong>`;
  return `<div class="price-source"><div>${source}<span>${esc(quote.priceType)} · ${esc(quote.finish)} · ${esc(quote.condition || "Condition-neutral")} · ${esc(quote.currency)}</span><span>Observed ${esc(quote.observedAt || "date unavailable")} · retrieved ${esc(quote.retrievedAt?.slice?.(0, 10) || "date unavailable")}</span></div><div class="source-value"><b>${money(quote.amount, quote.currency)}</b><small>${esc(quote.attribution)}</small></div></div>`;
}

function renderPriceEvidence(item, context) {
  const report = priceEvidence(
    item.quotes,
    item.variant,
    item.currency || "USD",
    context,
  );
  const contextLabel =
    item.cardState === "sealed"
      ? "Sealed product"
      : context.gradingCompany
        ? `${String(context.gradingCompany).toUpperCase()} ${context.grade}`
        : `Raw · ${context.condition || "Near Mint"}`;
  const agreement =
    report.sourceCount === 0
      ? "No matching source"
      : report.spreadPercent === null
        ? "One-source reference"
        : `${report.spreadPercent.toFixed(1)}% source spread`;
  const freshness = report.freshestAt
    ? `Newest ${String(report.freshestAt).slice(0, 10)}`
    : "No dated evidence";
  return `<section class="price-confidence ${report.level}" aria-label="Price confidence"><div class="price-confidence-head"><div><span>Price confidence</span><strong>${esc(report.label)}</strong></div><b>${report.sourceCount} compatible source${report.sourceCount === 1 ? "" : "s"}</b></div><p>${esc(report.summary)}</p><div class="price-confidence-facts"><span>${esc(contextLabel)}</span><span>${esc(agreement)}</span><span>${esc(freshness)}</span></div></section>`;
}

function renderGradedPriceLadder(item) {
  if (item.cardState === "sealed") return "";
  const rows = gradedPriceLadder(item.quotes, item.variant, "USD");
  const ownedGrade = item.gradingCompany
    ? `${String(item.gradingCompany).toUpperCase()}:${item.grade}`
    : "";
  const content = rows.length
    ? `<div class="grade-ladder">${rows.map((row) => `<div class="grade-ladder-row${ownedGrade === `${row.grader}:${row.grade}` ? " current" : ""}"><div><strong>${esc(row.grader)} ${esc(row.grade)}</strong><span>${esc(row.priceType)} · ${esc(row.provider)}${row.observedAt ? ` · ${esc(String(row.observedAt).slice(0, 10))}` : ""}</span></div><b>${money(row.amount, row.currency)}</b></div>`).join("")}</div>`
    : `<div class="pro-data-empty"><strong>Ready for graded pricing</strong><p>When PkmnPrices returns matching graded quotes, PSA, BGS, and CGC grades will appear here automatically. Mica will never substitute a different printing or invent a grade value.</p></div>`;
  return `<section class="detail-section"><div class="detail-section-head"><h2>Graded value ladder</h2><span>${rows.length ? `${rows.length} exact grade reference${rows.length === 1 ? "" : "s"}` : "PkmnPrices-ready"}</span></div>${content}</section>`;
}

function renderCardMetadata(item) {
  const data = item.metadata || {};
  const facts = [
    ["HP", data.hp],
    ["Stage", data.stage],
    ["Type", data.cardType],
    ["Weakness", data.weakness],
    ["Resistance", data.resistance],
    ["Retreat", data.retreatCost],
    ["Energy", (data.energyTypes || []).join(", ")],
    ["Ability", data.ability],
  ].filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );
  if (!facts.length && !(data.attacks || []).length && !data.flavorText)
    return "";
  return `<section class="detail-section"><div class="detail-section-head"><h2>Card details</h2><span>PkmnPrices card record</span></div><div class="card-facts">${facts.map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("")}</div>${(data.attacks || []).length ? `<p class="card-fact-copy"><strong>Attacks</strong> · ${esc(data.attacks.join(" · "))}</p>` : ""}${data.flavorText ? `<p class="card-flavor">${esc(data.flavorText)}</p>` : ""}</section>`;
}

function renderMarketplaceOffers(item) {
  if (item.cardState === "sealed") return "";
  const offers = item.offers || [];
  const statuses = item.offerStatuses || {};
  const statusCopy = (marketplace) =>
    statuses[marketplace] === "plan_required"
      ? "Current key lacks access"
      : statuses[marketplace] === "rate_limited"
        ? "Rate limited"
        : statuses[marketplace] === "unavailable"
          ? "Unavailable"
          : "No matching asks";
  const groups = ["tcgplayer", "cardmarket"]
    .map((marketplace) => {
      const rows = offers.filter((offer) => offer.marketplace === marketplace);
      const label = marketplace === "tcgplayer" ? "TCGplayer" : "Cardmarket";
      return `<div class="offer-market"><div class="offer-market-head"><strong>${label}</strong><span>${rows.length ? `${rows.length} lowest matching ask${rows.length === 1 ? "" : "s"}` : statusCopy(marketplace)}</span></div>${
        rows.length
          ? rows
              .slice(0, 5)
              .map((offer) => {
                const badges = [
                  offer.badges?.direct ? "Direct" : "",
                  offer.badges?.gold ? "Gold" : "",
                  offer.badges?.verified ? "Verified" : "",
                ].filter(Boolean);
                const seller = [
                  offer.sellerRating !== null &&
                  offer.sellerRating !== undefined
                    ? `${offer.sellerRating}% rating`
                    : "",
                  offer.sellerSales ? `${offer.sellerSales} sales` : "",
                ]
                  .filter(Boolean)
                  .join(" · ");
                const context = [
                  offer.printing,
                  offer.condition,
                  offer.language,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return `<div class="offer-row"><div><strong>${esc(offer.seller || "Marketplace seller")}</strong><span>${esc(context || "Listing context unavailable")}</span>${seller ? `<small>${esc(seller)}</small>` : ""}${badges.length ? `<small>${esc(badges.join(" · "))}</small>` : ""}${offer.note ? `<small>${esc(offer.note)}</small>` : ""}</div><div class="offer-price"><b>${money(offer.total, offer.currency)}</b><span>${offer.shipping === null ? "Listed price" : offer.shipping ? `${money(offer.amount, offer.currency)} + ${money(offer.shipping, offer.currency)} ship` : "Shipping included"}</span>${offer.quantity ? `<small>${offer.quantity} available</small>` : ""}</div></div>`;
              })
              .join("")
          : `<div class="offer-empty">${statusCopy(marketplace)}</div>`
      }</div>`;
    })
    .join("");
  const context = item.gradingCompany
    ? "These are raw-card asking prices, not slab comparables. Use the graded ladder and completed sales for this copy."
    : "These are active seller asks, not completed sales or guaranteed value.";
  return `<section class="detail-section"><div class="detail-section-head"><h2>Live marketplace offers</h2><span>Active asks · lowest first</span></div>${item.offersStatus === "loading" ? '<div class="unavailable-panel">Loading exact-printing seller offers…</div>' : item.offersStatus === "unconfigured" ? '<div class="pro-data-empty"><strong>Ready for live offers</strong><p>Connect PkmnPrices to populate TCGplayer and Cardmarket seller asks here.</p></div>' : item.offersStatus === "error" ? '<div class="unavailable-panel">Live offers are temporarily unavailable.<br><button class="inline-retry" id="retryOffersButton" type="button">Try offers again</button></div>' : `<div class="offer-grid">${groups}</div>`}<p class="offer-disclaimer">${context}</p></section>`;
}

function historySeriesForItem(item) {
  const finish = finishForVariant(item.variant);
  const exact = (item.priceHistory || []).filter((point) => {
    if (point.finish !== finish) return false;
    if (point.currency && point.currency !== (item.currency || "USD"))
      return false;
    if (item.gradingCompany)
      return (
        String(point.gradingCompany || "").toUpperCase() ===
          item.gradingCompany.toUpperCase() &&
        String(point.grade ?? "") === String(item.grade)
      );
    return (
      !point.gradingCompany &&
      (!point.condition || point.condition === item.condition)
    );
  });
  const reference = selectReferenceQuote(
    item.quotes || [],
    item.variant,
    item.currency || "USD",
    item,
  );
  const referenceKey = reference
    ? [
        reference.provider,
        reference.providerVariantId || "",
        reference.currency,
      ].join("|")
    : null;
  const groups = new Map();
  for (const point of exact) {
    const key = [
      point.provider || "unknown",
      point.providerVariantId || "",
      point.currency || item.currency || "USD",
    ].join("|");
    if (!groups.has(key))
      groups.set(key, {
        key,
        provider: point.provider || "unknown",
        currency: point.currency || item.currency || "USD",
        points: [],
        isReference: key === referenceKey,
      });
    groups.get(key).points.push(point);
  }
  return [...groups.values()]
    .map((series) => ({
      ...series,
      points: series.points.sort(
        (left, right) => new Date(left.recordedAt) - new Date(right.recordedAt),
      ),
    }))
    .sort(
      (left, right) =>
        Number(right.isReference) - Number(left.isReference) ||
        right.points.length - left.points.length ||
        new Date(right.points.at(-1)?.recordedAt || 0) -
          new Date(left.points.at(-1)?.recordedAt || 0),
    );
}

function movementForItem(item, days = 30) {
  const reference = selectReferenceQuote(
    item.quotes || [],
    item.variant,
    item.currency || "USD",
    item,
  );
  for (const series of historySeriesForItem(item)) {
    const movement = priceMovement(series.points, {
      days,
      asOf: series.isReference
        ? item.pricingUpdatedAt ||
          reference?.observedAt ||
          reference?.retrievedAt
        : series.points.at(-1)?.recordedAt,
      currentAmount: series.isReference ? item.price : null,
    });
    if (movement)
      return {
        ...movement,
        provider: series.provider,
        currency: series.currency,
        isReference: series.isReference,
      };
  }
  return null;
}

function historyForItem(item) {
  const series = historySeriesForItem(item);
  const movementSeries = series.find((candidate) =>
    priceMovement(candidate.points, {
      days: 30,
      asOf: candidate.points.at(-1)?.recordedAt,
    }),
  );
  return (
    (
      movementSeries ||
      series.find((candidate) => candidate.points.length >= 2) ||
      series[0]
    )?.points || []
  );
}

function renderHistory(item) {
  const history = historyForItem(item);
  if (item.historyStatus === "plan_required" && history.length < 2)
    return `<div class="unavailable-panel"><strong>Price history is plan-limited.</strong><br>The connected PkmnPrices key can return current prices, but historical observations require a higher provider plan. Mica does not invent a trend.</div>`;
  if (history.length < 2)
    return `<div class="unavailable-panel">Not enough comparable observations exist for a price chart yet. Daily source data is never expanded into artificial minute-by-minute points.</div>`;
  const values = history.map((point) => point.amount);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const points = history
    .map(
      (point, index) =>
        `${(index / (history.length - 1)) * 100},${38 - ((point.amount - min) / spread) * 34}`,
    )
    .join(" ");
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const first = history[0];
  const last = history.at(-1);
  return `<div class="history-summary"><div><span>Observed average</span><strong>${money(average, last.currency)}</strong></div><div><span>Observed range</span><strong>${money(min, last.currency)}–${money(max, last.currency)}</strong></div><div><span>Samples</span><strong>${history.length} observations</strong></div></div>
    <svg class="price-chart" viewBox="0 0 100 42" role="img" aria-label="Price history from ${esc(first.recordedAt.slice(0, 10))} to ${esc(last.recordedAt.slice(0, 10))}"><path d="M0 40H100"/><polyline points="${points}"/></svg>
    <div class="chart-dates"><span>${esc(first.recordedAt.slice(0, 10))}</span><span>${esc(last.recordedAt.slice(0, 10))}</span></div>`;
}

function renderEntryPoints(item, currentPrice = item.price) {
  const entries = purchaseEntryPoints(item.transactions || [], currentPrice);
  if (!entries.length) return "";
  const currency = item.currency || "USD";
  const current =
    currentPrice === null || currentPrice === undefined
      ? null
      : Number(currentPrice);
  const noun = item.cardState === "sealed" ? "product" : "card";
  return `<section class="entry-points" aria-label="Your purchase entry points"><div class="entry-points-head"><div><span>Your entry points</span><strong>${entries.length} purchase${entries.length === 1 ? "" : "s"} recorded</strong></div><div><span>Current exact reference</span><strong>${current === null ? "Unavailable" : `${money(current, currency)} each`}</strong></div></div><div class="entry-point-list">${entries.map((entry) => `<div class="entry-point-row"><div><strong>${esc(entry.date || "Date not recorded")}</strong><span>${entry.quantity} ${noun}${entry.quantity === 1 ? "" : "s"} · ${money(entry.totalCostMinor / 100, currency)} total</span></div><div><span>Entry · each</span><strong>${money(entry.unitCostMinor / 100, currency)}</strong></div><div><span>Change · each</span><strong>${entry.changeMinor === null ? "Unavailable" : `${entry.changeMinor >= 0 ? "+" : ""}${money(entry.changeMinor / 100, currency)}`}</strong><small>${entry.returnPercent === null ? "" : `${entry.returnPercent >= 0 ? "+" : ""}${entry.returnPercent.toFixed(1)}%`}</small></div></div>`).join("")}</div></section>`;
}

function renderInteractiveHistory(item, currentPrice = item.price) {
  const history = historyForItem(item);
  const entryPoints = renderEntryPoints(item, currentPrice);
  if (item.historyStatus === "plan_required" && history.length < 2)
    return `${entryPoints}<div class="unavailable-panel"><strong>Price history is plan-limited.</strong><br>The connected PkmnPrices key can return current prices, but historical observations require a higher provider plan. Your recorded entry points remain visible without Pro.</div>`;
  if (history.length < 2)
    return `${entryPoints}<div class="unavailable-panel">Not enough exact ${item.gradingCompany ? `${esc(item.gradingCompany)} ${esc(item.grade)}` : esc(item.condition)} observations exist for a chart. Your real purchase entries remain visible; a raw or different-grade series is never substituted.</div>`;
  const values = history.map((point) => point.amount);
  const lows = history
    .map((point) => Number(point.low))
    .filter((value) => Number.isFinite(value) && value > 0);
  const highs = history
    .map((point) => Number(point.high))
    .filter((value) => Number.isFinite(value) && value > 0);
  const min = Math.min(...values, ...lows);
  const max = Math.max(...values, ...highs);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const last = history.at(-1);
  const saleCount = history.reduce(
    (sum, point) =>
      sum + (Number(point.saleCount) || Number(point.quality?.saleCount) || 0),
    0,
  );
  const context = item.gradingCompany
    ? `${item.gradingCompany} ${item.grade}`
    : item.condition;
  return `${entryPoints}<div class="history-summary"><div><span>Observed average</span><strong>${money(average, last.currency)}</strong></div><div><span>Observed range</span><strong>${money(min, last.currency)}–${money(max, last.currency)}</strong></div><div><span>Daily samples</span><strong>${history.length} observations</strong></div>${saleCount ? `<div><span>Reported sales</span><strong>${saleCount}</strong></div>` : ""}</div>
    <div class="history-controls" role="group" aria-label="Price history range">${[
      ["1m", "1 month"],
      ["3m", "3 months"],
      ["6m", "6 months"],
      ["1y", "1 year"],
      ["all", "All"],
    ]
      .map(
        ([value, label]) =>
          `<button type="button" data-chart-range="${value}" aria-pressed="${String(state.chartRange === value)}">${label}</button>`,
      )
      .join("")}</div>
    <p class="chart-context">Exact series: ${esc(item.variant)} · ${esc(context)} · ${esc(last.currency)}. Provider observations remain separate.</p>
    <div class="chart-wrap"><canvas id="positionChart" role="img" aria-label="Historical ${esc(context)} prices with purchase entry markers"></canvas></div>`;
}

async function mountPriceChart(item) {
  const version = ++chartMountVersion;
  chartInstance?.destroy();
  chartInstance = null;
  const canvas = $("#positionChart");
  if (!canvas) return;
  const days = { "1m": 31, "3m": 93, "6m": 186, "1y": 366 }[state.chartRange];
  const cutoff = days ? Date.now() - days * 86_400_000 : 0;
  const history = historyForItem(item).filter(
    (point) => new Date(point.recordedAt).getTime() >= cutoff,
  );
  const providers = [...new Set(history.map((point) => point.provider))];
  const colors = ["#1f4f43", "#9a6b2f", "#315f86", "#744f79"];
  const datasets = providers.map((provider, index) => ({
    label: provider,
    data: history
      .filter((point) => point.provider === provider)
      .map((point) => ({
        x: point.recordedAt.slice(0, 10),
        y: point.amount,
        point,
      })),
    borderColor: colors[index % colors.length],
    backgroundColor: colors[index % colors.length],
    pointRadius: 2,
    tension: 0.18,
    spanGaps: true,
  }));
  const purchases = (item.transactions || []).filter(
    (transaction) => transaction.type === "purchase",
  );
  if (purchases.length)
    datasets.push({
      label: "Your entry points",
      type: "scatter",
      data: purchases.map((transaction) => ({
        x: transaction.date,
        y: transaction.quantity
          ? transaction.totalCost / transaction.quantity
          : transaction.unitPrice,
        transaction,
      })),
      pointRadius: 7,
      pointStyle: "triangle",
      backgroundColor: "#b14e43",
      borderColor: "#fff",
      borderWidth: 1,
    });
  if (item.costBasis && item.quantity) {
    const labels = [
      ...new Set([
        ...history.map((point) => point.recordedAt.slice(0, 10)),
        ...purchases.map((point) => point.date),
      ]),
    ].sort();
    datasets.push({
      label: "Remaining cost basis / card",
      data: labels.map((date) => ({
        x: date,
        y: item.costBasis / item.quantity,
      })),
      borderColor: "#7a746a",
      borderDash: [5, 5],
      pointRadius: 0,
      borderWidth: 1,
    });
  }
  const { default: Chart } = await import("chart.js/auto");
  if (version !== chartMountVersion || !canvas.isConnected) return;
  chartInstance = new Chart(canvas, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      interaction: { mode: "nearest", intersect: false },
      plugins: {
        legend: { display: true, labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: {
          callbacks: {
            label(context) {
              const transaction = context.raw?.transaction;
              if (transaction) {
                const noun = item.cardState === "sealed" ? "product" : "card";
                return `Bought ${transaction.date}: ${money(transaction.totalCost, transaction.currency)} total · ${transaction.quantity} ${noun}${transaction.quantity === 1 ? "" : "s"}`;
              }
              const point = context.raw?.point;
              const lines = [
                `${context.dataset.label}: ${money(context.parsed.y, item.currency || "USD")}`,
              ];
              if (point?.low && point?.high)
                lines.push(
                  `Range ${money(point.low, point.currency)}–${money(point.high, point.currency)}`,
                );
              const count =
                Number(point?.saleCount) ||
                Number(point?.quality?.saleCount) ||
                0;
              if (count)
                lines.push(`${count} reported sale${count === 1 ? "" : "s"}`);
              return lines;
            },
          },
        },
      },
      scales: {
        x: {
          type: "category",
          grid: { display: false },
          ticks: { maxTicksLimit: 6 },
        },
        y: {
          ticks: { callback: (value) => money(value, item.currency || "USD") },
          grid: { color: "rgba(60,70,65,.08)" },
        },
      },
    },
  });
  $$("[data-chart-range]").forEach((button) =>
    button.addEventListener("click", () => {
      state.chartRange = button.dataset.chartRange;
      renderDetail();
    }),
  );
}

function comparableSales(item) {
  return (item.sales || []).filter((sale) =>
    item.gradingCompany
      ? sale.sourceUrl &&
        sale.gradingCompany === item.gradingCompany &&
        String(sale.grade) === String(item.grade)
      : sale.sourceUrl && !sale.gradingCompany,
  );
}

function renderSales(item) {
  if (item.salesStatus === "loading")
    return `<div class="unavailable-panel">Loading licensed sold-listing evidence…</div>`;
  const sales = comparableSales(item);
  if (!sales.length) {
    const copy =
      item.salesStatus === "unconfigured"
        ? "No licensed sold-listing provider is connected. Active listings are not presented as completed sales."
        : item.salesStatus === "plan_required"
          ? "The connected PkmnPrices key is valid, but its current plan does not allow linked sold evidence for this request."
          : item.salesStatus === "error"
            ? "The sold-data provider could not be reached. This is not evidence that the card has no sales."
            : "No verified sales matched this exact raw/graded context. A broader card sale is not substituted.";
    return `<div class="unavailable-panel">${copy}${item.salesStatus === "error" ? '<br><button class="inline-retry" id="retrySalesButton" type="button">Try sales again</button>' : ""}</div>`;
  }
  return `<div class="sales-list">${sales
    .slice(0, 5)
    .map(
      (sale) =>
        `<a class="sale-row" href="${esc(sale.sourceUrl)}" target="_blank" rel="noreferrer"><div><strong>${esc(sale.title)}</strong><span>${esc(sale.soldAt)} · ${esc(sale.gradingCompany ? `${sale.gradingCompany} ${sale.grade}` : "Raw")}</span></div><b>${money(sale.amount, sale.currency)}</b></a>`,
    )
    .join("")}</div>`;
}

function gradingQuote(item, grader, grade) {
  return selectReferenceQuote(item.quotes, item.variant, "USD", {
    gradingCompany: grader,
    grade: String(grade),
  });
}

function renderGradingEstimator(item) {
  const defaultService = gradingServices.PSA[0];
  const rawContext = item.gradingCompany
    ? { condition: "Near Mint" }
    : { condition: item.condition || "Near Mint" };
  const rawQuote = selectReferenceQuote(
    item.quotes,
    item.variant,
    "USD",
    rawContext,
  );
  const gradedQuote = gradingQuote(item, "PSA", "10");
  return `<section class="detail-section grading-estimator" aria-labelledby="gradingEstimatorTitle">
    <div class="detail-section-head"><h2 id="gradingEstimatorTitle">Grading cost estimator</h2><span>Plan a submission</span></div>
    <p class="estimator-intro">See an estimated all-in grading cost before you submit this card.</p>
    <div class="estimator-grid">
      <div class="field"><label for="estimateGrader">Grading company</label><select id="estimateGrader">${Object.keys(
        gradingServices,
      )
        .map((value) => `<option>${value}</option>`)
        .join("")}</select></div>
      <div class="field"><label for="estimateService">Service tier</label><select id="estimateService">${gradingServices.PSA.map((service, index) => `<option value="${index}">${esc(service.name)} · ${money(service.fee)}</option>`).join("")}</select></div>
      <div class="field"><label for="estimateQuantity">Cards in submission</label><input id="estimateQuantity" type="number" inputmode="numeric" min="1" max="999" step="1" value="1"></div>
    </div>
    <details class="estimate-trip-costs"><summary>Add shipping, insurance, or selling costs</summary><div class="estimator-grid"><div class="field"><label for="estimateShipping">Round-trip shipping</label><input id="estimateShipping" type="number" inputmode="decimal" min="0" step="0.01" value="0.00"></div><div class="field"><label for="estimateInsurance">Insurance</label><input id="estimateInsurance" type="number" inputmode="decimal" min="0" step="0.01" value="0.00"></div><div class="field"><label for="estimateSellingCosts">Expected selling costs</label><input id="estimateSellingCosts" type="number" inputmode="decimal" min="0" step="0.01" value="0.00"></div></div></details>
    <div class="estimate-result" aria-live="polite"><div><span>Estimated all-in total</span><strong id="estimateTotal">${money(defaultService.fee)}</strong></div><div><span>Estimated per card</span><strong id="estimatePerCard">${money(defaultService.fee)}</strong></div></div>
    <p class="estimate-note" id="estimateNote">${esc(defaultService.note || "No listed submission minimum")}</p>
    <div class="grading-decision">
      <div class="decision-heading"><div><span>Decision tool</span><h3>Should I grade it?</h3></div><p>Compare selling raw with the value you expect after grading.</p></div>
      <div class="estimator-grid decision-inputs">
        <div class="field"><label for="estimateRawValue">Raw value today</label><div class="money-input"><span>$</span><input id="estimateRawValue" type="number" inputmode="decimal" min="0" step="0.01" value="${rawQuote?.amount ?? ""}" placeholder="Enter raw value"></div></div>
        <div class="field"><label for="estimateTargetGrade">Expected grade</label><select id="estimateTargetGrade">${["10", "9.5", "9", "8.5", "8", "7", "6"].map((value) => `<option ${value === "10" ? "selected" : ""}>${value}</option>`).join("")}</select></div>
        <div class="field"><label for="estimateGradedValue">Expected graded value</label><div class="money-input"><span>$</span><input id="estimateGradedValue" type="number" inputmode="decimal" min="0" step="0.01" value="${gradedQuote?.amount ?? ""}" placeholder="Enter expected value"></div></div>
      </div>
      <p class="decision-source" id="decisionSource">${gradedQuote ? `Using a matching ${esc(gradedQuote.gradingCompany)} ${esc(gradedQuote.grade)} market reference. Raw and graded values remain editable.` : "No matching PSA 10 reference is available. Enter the result you realistically expect."}</p>
      <div class="decision-verdict neutral" id="decisionVerdict" aria-live="polite"><span>Complete the values above</span><strong>Then Mica will compare both paths.</strong></div>
      <div class="decision-metrics"><div><span>Break-even graded value</span><strong id="decisionBreakEven">—</strong></div><div><span>Value added vs raw</span><strong id="decisionValueAdded">—</strong></div><div><span>Potential profit vs your cost</span><strong id="decisionProfit">—</strong></div></div>
    </div>
    <p class="estimate-disclaimer">Planning estimate only. Service availability, declared-value limits, memberships, taxes, shipping, and insurance can change. Fees last checked July 2026; confirm with the grader before submitting.</p>
  </section>`;
}

function bindGradingEstimator(item) {
  const grader = $("#estimateGrader");
  const service = $("#estimateService");
  const quantity = $("#estimateQuantity");
  const shipping = $("#estimateShipping");
  const insurance = $("#estimateInsurance");
  const selling = $("#estimateSellingCosts");
  const rawValue = $("#estimateRawValue");
  const targetGrade = $("#estimateTargetGrade");
  const gradedValue = $("#estimateGradedValue");
  if (
    !grader ||
    !service ||
    !quantity ||
    !shipping ||
    !insurance ||
    !selling ||
    !rawValue ||
    !targetGrade ||
    !gradedValue
  )
    return;
  const acquisitionPerCard =
    item.uid && item.quantity && item.costBasis != null
      ? Number(item.costBasis) / Number(item.quantity)
      : null;
  const update = () => {
    const entry = gradingServices[grader.value][Number(service.value) || 0];
    const count = Number(quantity.value);
    const total = gradingEstimate({
      serviceFee: entry.fee,
      quantity: count,
      shipping: shipping.value,
      insurance: insurance.value,
    });
    const perCard =
      total === null || !Number.isInteger(count) || count < 1
        ? null
        : total / count;
    $("#estimateTotal").textContent =
      total === null ? "Check amounts" : money(total / 100);
    $("#estimatePerCard").textContent =
      perCard === null ? "—" : money(perCard / 100);
    const minimum =
      entry.minimum && count < entry.minimum
        ? `This tier requires at least ${entry.minimum} cards. Add ${entry.minimum - count} more or choose another tier.`
        : entry.note || "No listed submission minimum.";
    $("#estimateNote").textContent = minimum;
    $("#estimateNote").classList.toggle(
      "estimate-warning",
      Boolean(entry.minimum && count < entry.minimum),
    );
    const decision =
      total === null
        ? null
        : gradingDecision({
            rawValue: rawValue.value,
            expectedGradedValue: gradedValue.value,
            quantity: count,
            gradingCost: total,
            sellingCosts: selling.value,
            acquisitionCostPerCard: acquisitionPerCard,
          });
    const verdict = $("#decisionVerdict");
    if (!decision) {
      verdict.className = "decision-verdict neutral";
      verdict.innerHTML =
        "<span>Add realistic raw and graded values</span><strong>Then Mica will compare both paths.</strong>";
      $("#decisionBreakEven").textContent = "—";
      $("#decisionValueAdded").textContent = "—";
      $("#decisionProfit").textContent = "—";
      return;
    }
    const favorable = decision.valueAddedMinor >= 0;
    verdict.className = `decision-verdict ${favorable ? "positive" : "negative"}`;
    verdict.innerHTML = favorable
      ? `<span>Grading may add value</span><strong>About ${money(decision.valueAddedMinor / 100)} more than selling raw.</strong>`
      : `<span>Raw may be the stronger path</span><strong>Grading is about ${money(Math.abs(decision.valueAddedMinor) / 100)} behind.</strong>`;
    $("#decisionBreakEven").textContent = money(
      decision.breakEvenGradedValuePerCardMinor / 100,
    );
    $("#decisionValueAdded").textContent =
      `${decision.valueAddedMinor >= 0 ? "+" : ""}${money(decision.valueAddedMinor / 100)}`;
    $("#decisionProfit").textContent =
      decision.potentialProfitMinor === null
        ? "Add card to library"
        : `${decision.potentialProfitMinor >= 0 ? "+" : ""}${money(decision.potentialProfitMinor / 100)}`;
  };
  const syncExpectedQuote = () => {
    const quote = gradingQuote(item, grader.value, targetGrade.value);
    gradedValue.value = quote?.amount ?? "";
    $("#decisionSource").textContent = quote
      ? `Using a matching ${quote.gradingCompany} ${quote.grade} market reference. Raw and graded values remain editable.`
      : `No matching ${grader.value} ${targetGrade.value} reference is available. Enter the result you realistically expect.`;
    update();
  };
  const fillServices = () => {
    service.innerHTML = gradingServices[grader.value]
      .map(
        (entry, index) =>
          `<option value="${index}">${esc(entry.name)} · ${money(entry.fee)}</option>`,
      )
      .join("");
    syncExpectedQuote();
  };
  grader.addEventListener("change", fillServices);
  targetGrade.addEventListener("change", syncExpectedQuote);
  gradedValue.addEventListener("input", () => {
    $("#decisionSource").textContent =
      "Using your expected graded value. Keep it conservative and account for selling costs.";
    update();
  });
  [service, quantity, shipping, insurance, selling, rawValue].forEach((input) =>
    input.addEventListener("input", update),
  );
  update();
}

function openBatchGradingPlanner() {
  if (!requireAccountData()) return;
  const rawItems = state.items.filter(
    (item) =>
      item.cardState !== "sealed" &&
      !item.gradingCompany &&
      Number(item.quantity) > 0,
  );
  if (!rawItems.length) {
    openSheet(
      `<div class="sheet-heading"><div><h2 id="sheetTitle">Batch grading planner</h2><p>Build one submission from raw cards you already own.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="find-empty"><strong>No raw cards in your library</strong><span>Add a raw card first, then Mica can compare a grading batch with selling those cards raw.</span></div><div class="sheet-actions"><button class="primary" id="batchAddRawCard" type="button">Add a raw card</button></div>`,
    );
    $("#batchAddRawCard").addEventListener("click", () => {
      closeSheet({ discardHistory: true });
      routeTo("scan");
    });
    return;
  }
  const initialGrader = "PSA";
  const initialGrade = "10";
  const preselected = new Set(
    rawItems
      .map((item, index) =>
        item.price != null && gradingQuote(item, initialGrader, initialGrade)
          ? index
          : null,
      )
      .filter((index) => index !== null),
  );
  if (!preselected.size) preselected.add(0);
  const rows = rawItems
    .map((item, index) => {
      const graded = gradingQuote(item, initialGrader, initialGrade);
      return `<article class="batch-grade-row${preselected.has(index) ? " selected" : ""}" data-batch-index="${index}"><label class="batch-grade-select"><input data-batch-selected type="checkbox" ${preselected.has(index) ? "checked" : ""}><img src="${esc(item.thumb || "./icons/icon.svg")}" alt=""><span><strong>${esc(item.name)}</strong><small>${esc(item.set)} · ${esc(item.number)} · ${esc(item.condition || "Raw")}</small></span></label><div class="batch-grade-values"><label>Qty<input data-batch-quantity type="number" inputmode="numeric" min="1" max="${Number(item.quantity)}" step="1" value="1"></label><label>Raw now<div class="money-input"><span>$</span><input data-batch-raw type="number" inputmode="decimal" min="0" step="0.01" value="${item.price ?? ""}" placeholder="0.00"></div></label><label>Expected graded<div class="money-input"><span>$</span><input data-batch-expected type="number" inputmode="decimal" min="0" step="0.01" value="${graded?.amount ?? ""}" placeholder="Enter value"></div></label></div></article>`;
    })
    .join("");
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Batch grading planner</h2><p>Compare one submission with selling the same cards raw.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="batch-grade-controls"><div class="field"><label for="batchGrader">Grading company</label><select id="batchGrader">${Object.keys(
      gradingServices,
    )
      .map((value) => `<option>${value}</option>`)
      .join(
        "",
      )}</select></div><div class="field"><label for="batchService">Service tier</label><select id="batchService"></select></div><div class="field"><label for="batchTargetGrade">Expected grade</label><select id="batchTargetGrade">${["10", "9.5", "9", "8.5", "8", "7", "6"].map((value) => `<option>${value}</option>`).join("")}</select></div></div><details class="estimate-trip-costs"><summary>Add shared shipping, insurance, or selling costs</summary><div class="batch-grade-controls"><div class="field"><label for="batchShipping">Round-trip shipping</label><input id="batchShipping" type="number" inputmode="decimal" min="0" step="0.01" value="0.00"></div><div class="field"><label for="batchInsurance">Insurance</label><input id="batchInsurance" type="number" inputmode="decimal" min="0" step="0.01" value="0.00"></div><div class="field"><label for="batchSelling">Expected selling costs</label><input id="batchSelling" type="number" inputmode="decimal" min="0" step="0.01" value="0.00"></div></div></details><div class="batch-grade-head"><strong>Choose raw cards</strong><span id="batchSelectedCount">0 cards selected</span></div><div class="batch-grade-list">${rows}</div><p class="estimate-note" id="batchServiceNote"></p><div id="batchGradeOutput" aria-live="polite"></div><p class="estimate-disclaimer">Planning estimate only. Expected grades and prices are uncertain. Fees last checked July 2026; confirm service availability, declared-value limits, membership rules, shipping, insurance, and current pricing with the grader before submitting.</p>`,
  );
  const grader = $("#batchGrader");
  const service = $("#batchService");
  const targetGrade = $("#batchTargetGrade");
  const selectedRows = () =>
    $$(".batch-grade-row").filter(
      (row) => $("[data-batch-selected]", row).checked,
    );
  const syncExpected = () => {
    $$(".batch-grade-row").forEach((row) => {
      const item = rawItems[Number(row.dataset.batchIndex)];
      $("[data-batch-expected]", row).value =
        gradingQuote(item, grader.value, targetGrade.value)?.amount ?? "";
    });
    update();
  };
  const update = () => {
    const entry = gradingServices[grader.value][Number(service.value) || 0];
    const selected = selectedRows();
    const items = selected.map((row) => {
      const item = rawItems[Number(row.dataset.batchIndex)];
      const owned = Number(item.quantity) || 1;
      const costBasis =
        item.costBasis === null || item.costBasis === undefined
          ? item.cost
          : Number(item.costBasis) / owned;
      return {
        quantity: $("[data-batch-quantity]", row).value,
        availableQuantity: owned,
        rawValue: $("[data-batch-raw]", row).value,
        expectedGradedValue: $("[data-batch-expected]", row).value,
        acquisitionCost: costBasis ?? null,
      };
    });
    const count = items.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0,
    );
    $("#batchSelectedCount").textContent =
      `${count} card${count === 1 ? "" : "s"} selected`;
    $$(".batch-grade-row").forEach((row) =>
      row.classList.toggle("selected", $("[data-batch-selected]", row).checked),
    );
    const note =
      entry.minimum && count < entry.minimum
        ? `This tier requires at least ${entry.minimum} cards. Add ${entry.minimum - count} more or choose another tier.`
        : entry.note || "No listed submission minimum.";
    $("#batchServiceNote").textContent = note;
    $("#batchServiceNote").classList.toggle(
      "estimate-warning",
      Boolean(entry.minimum && count < entry.minimum),
    );
    const plan = gradingBatchPlan({
      items,
      serviceFee: entry.fee,
      shipping: $("#batchShipping").value,
      insurance: $("#batchInsurance").value,
      sellingCosts: $("#batchSelling").value,
    });
    if (!plan) {
      $("#batchGradeOutput").innerHTML =
        '<div class="unavailable-panel"><strong>Complete the selected cards.</strong><br>Use no more than you own, and add the current raw value plus a realistic expected graded value for each selected row.</div>';
      return;
    }
    const favorable = plan.valueAddedMinor >= 0;
    $("#batchGradeOutput").innerHTML =
      `<div class="decision-verdict ${favorable ? "positive" : "negative"}"><span>${favorable ? "Batch may add value" : "Selling raw may be stronger"}</span><strong>${favorable ? `${money(plan.valueAddedMinor / 100)} projected value added after costs.` : `Grading is ${money(Math.abs(plan.valueAddedMinor) / 100)} behind selling raw.`}</strong></div><div class="batch-grade-summary"><div><span>Raw value today</span><strong>${money(plan.rawValueTotalMinor / 100)}</strong></div><div><span>Expected graded value</span><strong>${money(plan.expectedGradedValueTotalMinor / 100)}</strong></div><div><span>All-in grading cost</span><strong>${money(plan.gradingCostMinor / 100)}</strong></div><div><span>Break-even average</span><strong>${money(plan.breakEvenAverageMinor / 100)}</strong></div><div><span>Value added vs raw</span><strong>${plan.valueAddedMinor >= 0 ? "+" : ""}${money(plan.valueAddedMinor / 100)}</strong></div><div><span>Potential profit vs basis</span><strong>${plan.potentialProfitMinor === null ? "Basis incomplete" : `${plan.potentialProfitMinor >= 0 ? "+" : ""}${money(plan.potentialProfitMinor / 100)}`}</strong></div></div>`;
  };
  const fillServices = () => {
    service.innerHTML = gradingServices[grader.value]
      .map(
        (entry, index) =>
          `<option value="${index}">${esc(entry.name)} · ${money(entry.fee)}</option>`,
      )
      .join("");
    syncExpected();
  };
  grader.addEventListener("change", fillServices);
  targetGrade.addEventListener("change", syncExpected);
  service.addEventListener("change", update);
  $$(".batch-grade-row input").forEach((input) =>
    input.addEventListener("input", update),
  );
  [$("#batchShipping"), $("#batchInsurance"), $("#batchSelling")].forEach(
    (input) => input.addEventListener("input", update),
  );
  fillServices();
}

async function loadSales(item, force = false) {
  if (item.salesStatus && !force) return;
  item.salesStatus = "loading";
  if (
    state.route === "detail" &&
    (state.detailId === item.uid || state.detailId === item.id)
  )
    renderDetail();
  const lookup = {
    clientId: item.id,
    pkmnpricesId: item.externalIds?.pkmnprices || "",
    name: item.name,
    set: item.set,
    number: item.number,
    language: item.language || "en",
    grader: item.gradingCompany || "",
    grade: item.grade || "",
  };
  try {
    const response = await fetch(
      `/api/sales?lookup=${encodeURIComponent(JSON.stringify(lookup))}`,
      { headers: { Accept: "application/json" } },
    );
    const payload = await response.json().catch(() => ({}));
    if (response.status === 503) {
      item.salesStatus = "unconfigured";
      item.sales = [];
    } else if (
      response.status === 403 &&
      payload.code === "provider_plan_required"
    ) {
      item.salesStatus = "plan_required";
      item.sales = [];
    } else if (!response.ok) {
      item.salesStatus = "error";
      item.sales = [];
    } else {
      item.salesStatus = "live";
      item.sales = payload.sales || [];
    }
  } catch {
    item.salesStatus = "error";
    item.sales = [];
  }
  if (
    state.route === "detail" &&
    (state.detailId === item.uid || state.detailId === item.id)
  )
    renderDetail();
}

async function loadOffers(item, force = false) {
  if (item.offersStatus && !force) return;
  item.offersStatus = "loading";
  if (
    state.route === "detail" &&
    (state.detailId === item.uid || state.detailId === item.id)
  )
    renderDetail();
  const lookup = {
    clientId: item.id,
    pkmnpricesId: item.externalIds?.pkmnprices || "",
    tcgplayerId: item.externalIds?.tcgplayer || "",
    name: item.name,
    set: item.set,
    number: item.number,
    language: item.language || "en",
    condition: item.gradingCompany ? "" : item.condition || "Near Mint",
    variant: item.variant || "Normal",
  };
  try {
    const response = await fetch(
      `/api/offers?lookup=${encodeURIComponent(JSON.stringify(lookup))}`,
      { headers: { Accept: "application/json" } },
    );
    const payload = await response.json().catch(() => ({}));
    if (response.status === 503) {
      item.offersStatus = "unconfigured";
      item.offers = [];
      item.offerStatuses = {};
    } else if (!response.ok) {
      item.offersStatus = "error";
      item.offers = [];
      item.offerStatuses = {};
    } else {
      item.offersStatus = "live";
      item.offers = payload.offers || [];
      item.offerStatuses = payload.statuses || {};
    }
  } catch {
    item.offersStatus = "error";
    item.offers = [];
    item.offerStatuses = {};
  }
  if (
    state.route === "detail" &&
    (state.detailId === item.uid || state.detailId === item.id)
  )
    renderDetail();
}

function routeTo(route, options = {}) {
  const changed = state.route !== route;
  state.route = route;
  $$(".view").forEach((view) => {
    const active = view.id === `view-${route}`;
    view.classList.toggle("active", active);
    view.hidden = !active;
    view.setAttribute("aria-hidden", String(!active));
  });
  $$(".nav-item").forEach((button) => {
    const active = button.dataset.route === route;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  $(".bottom-nav").classList.toggle("hidden", route === "detail");
  const headerCopy = {
    collection: ["Dashboard", "Your collection at a glance"],
    scan: ["Add items", "Find exact cards and sealed products"],
    insights: ["Market analytics", "Performance, profit, and pricing signals"],
    trade: ["Trade check", "Compare both sides before you agree"],
    profile: ["Settings", "Account, workspace, and appearance"],
    detail: ["Card details", "Exact identity, evidence, and decisions"],
  }[route] || ["Mica", "Your collection workspace"];
  if ($("#headerSection")) $("#headerSection").textContent = headerCopy[0];
  if ($("#headerSubtitle")) $("#headerSubtitle").textContent = headerCopy[1];
  if (route === "detail") renderDetail();
  window.scrollTo({ top: 0, behavior: options.instant ? "auto" : "smooth" });
  if (changed && options.focus !== false)
    requestAnimationFrame(() => $("#main").focus({ preventScroll: true }));
  const url =
    route === "collection"
      ? `${location.pathname}${location.search}`
      : `#${route}`;
  const historyMode = options.history || (options.instant ? "replace" : "push");
  if (historyMode === "push" && changed) history.pushState({ route }, "", url);
  else if (historyMode === "replace") history.replaceState({ route }, "", url);
}

function watchContextLabel(item) {
  return item.cardState === "sealed"
    ? "Sealed product"
    : item.cardState === "graded"
      ? `${item.gradingCompany} ${item.grade}`
      : item.condition || "Raw card";
}

function matchingWatchEntry(card) {
  if (!card) return null;
  if (card.watchlistId)
    return (
      state.watchlist.find((item) => item.watchlistId === card.watchlistId) ||
      card
    );
  return (
    state.watchlist.find(
      (item) =>
        item.id === card.id && (!card.variant || item.variant === card.variant),
    ) || null
  );
}

function openWatchlistDetail(item) {
  if (!item) return;
  state.detailReturnRoute = "collection";
  state.detailCanPop = state.route !== "detail";
  state.detailId = `watch-${item.watchlistId}`;
  state.detailCard = {
    ...item,
    price: item.currentPrice,
    quotes: item.quotes || [],
    pricingUpdatedAt: item.pricingUpdatedAt,
  };
  routeTo("detail");
}

function renderWatchlistRows() {
  let visible = state.watchlist.filter((item) =>
    matchesSearch(item, state.query),
  );
  if (state.setFilter)
    visible = visible.filter((item) => item.set === state.setFilter);
  if (state.conditionFilter === "Raw")
    visible = visible.filter((item) => item.cardState === "raw");
  else if (state.conditionFilter === "Graded")
    visible = visible.filter((item) => item.cardState === "graded");
  else if (state.conditionFilter === "Sealed")
    visible = visible.filter((item) => item.cardState === "sealed");
  else if (state.conditionFilter)
    visible = visible.filter(
      (item) => item.condition === state.conditionFilter,
    );
  visible.sort((a, b) =>
    state.sort === "name"
      ? a.name.localeCompare(b.name)
      : Number(b.currentPrice ?? -1) - Number(a.currentPrice ?? -1),
  );
  $("#resultCount").textContent =
    `${visible.length} watched item${visible.length === 1 ? "" : "s"}`;
  $("#sortButton").firstChild.textContent =
    state.sort === "value-desc" ? "Value, high to low " : "Name, A to Z ";
  $("#cardLedger").innerHTML = visible
    .map((item) => {
      const hasTarget = item.targetPrice !== null;
      const targetReached =
        hasTarget &&
        item.currentPrice !== null &&
        Number(item.currentPrice) <= Number(item.targetPrice);
      const performance = watchPerformance({
        startingPrice: item.startingMarketPrice,
        currentPrice: item.currentPrice,
      });
      const movement = performance
        ? `${performance.changeMinor >= 0 ? "+" : "−"}${money(Math.abs(performance.changeMinor) / 100, item.currency)} (${performance.changePercent >= 0 ? "+" : ""}${performance.changePercent.toFixed(1)}%) since watch`
        : null;
      const targetStatus =
        item.pricingStatus === "loading"
          ? "Checking current price…"
          : item.currentPrice === null
            ? "Exact price unavailable"
            : targetReached
              ? "Target reached"
              : hasTarget
                ? `${money(Number(item.currentPrice) - Number(item.targetPrice), item.currency)} above target`
                : "Current matching reference";
      return `<article class="ledger-row watch-row" tabindex="0" role="button" aria-label="Open watched ${esc(item.name)}" data-watch-id="${esc(item.watchlistId)}">
      <img class="card-thumb" src="${esc(item.thumb)}" alt="${esc(item.name)} from ${esc(item.set)}" loading="lazy">
      <div class="card-main"><div class="card-name-line"><span class="card-name">${esc(item.name)}</span>${targetReached ? '<span class="target-hit">Buy target</span>' : ""}</div><span class="card-set">${esc(item.set)} · ${esc(item.number)}</span><div class="card-tags"><span class="micro-tag ${item.cardState === "graded" ? "graded" : ""}">${esc(watchContextLabel(item))}</span><span class="micro-tag">${esc(item.variant)}</span></div></div>
      <div class="price-cell"><span class="row-value">${item.currentPrice === null ? "—" : money(item.currentPrice, item.currency)}</span><span class="row-unit">${hasTarget ? `Buy at ${money(item.targetPrice, item.currency)}` : "No target set"}</span><span class="row-move ${performance ? (performance.changeMinor > 0 ? "up" : performance.changeMinor < 0 ? "down" : "none") : targetReached ? "up" : "none"}">${esc(movement || targetStatus)}</span></div>
    </article>`;
    })
    .join("");
  const trulyEmpty = state.watchlist.length === 0;
  $("#collectionEmpty").classList.toggle("hidden", visible.length > 0);
  $("#collectionEmptyTitle").textContent = trulyEmpty
    ? "Your watchlist is empty"
    : "No watched items match";
  $("#collectionEmptyCopy").textContent = trulyEmpty
    ? "Find a card or sealed product and choose Watch to save a price target."
    : "Try clearing the search or changing your filters.";
  $("#firstCardGuide").classList.add("hidden");
  $("#emptyAddCard").classList.toggle("hidden", !trulyEmpty);
  $("#emptyAddCard").textContent = trulyEmpty
    ? "Find an item to watch"
    : "Add your first item";
  $("#clearFilters").classList.toggle("hidden", trulyEmpty);
  $("#filterLabel").textContent =
    state.setFilter || state.conditionFilter ? "Filter · active" : "Filter";
  $$(".watch-row").forEach((row) => {
    const open = () =>
      openWatchlistDetail(
        state.watchlist.find(
          (item) => item.watchlistId === row.dataset.watchId,
        ),
      );
    row.addEventListener("click", open);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
}

function collectorKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/^([A-Z]*?)0+(\d)/, "$1$2");
}

function setIdFor(item) {
  if (item.setId) return item.setId;
  let external = String(item.externalIds?.tcgdex || item.id || "");
  external = external.replace(/^tcgdex:[a-z-]+:/i, "");
  const split = external.lastIndexOf("-");
  return split > 0 ? external.slice(0, split) : "";
}

function collectionSetGroups() {
  const groups = new Map();
  for (const item of state.items.filter(
    (item) => item.cardState !== "sealed" && Number(item.quantity) > 0,
  )) {
    const language = item.language || "en";
    const setId = setIdFor(item);
    const key = `${language}:${setId || normalizeIdentity(item.set)}`;
    if (!groups.has(key))
      groups.set(key, {
        key,
        setId,
        language,
        name: item.set || "Unknown set",
        items: [],
      });
    groups.get(key).items.push(item);
  }
  return [...groups.values()]
    .map((group) => {
      const catalog = state.setCatalogs.get(group.key);
      const owned = new Set(
        group.items
          .map((item) =>
            collectorKey(
              item.localId || String(item.number || "").split("/")[0],
            ),
          )
          .filter(Boolean),
      );
      const denominator = Math.max(
        0,
        ...group.items.map(
          (item) => Number(String(item.number || "").split("/")[1]) || 0,
        ),
      );
      const total = catalog?.totalCount || denominator || null;
      const ownedInCatalog = catalog
        ? catalog.cards.filter((card) => owned.has(collectorKey(card.localId)))
            .length
        : owned.size;
      return {
        ...group,
        catalog,
        ownedIds: owned,
        ownedCount: ownedInCatalog,
        totalCount: total,
        percent: total ? Math.min(100, (ownedInCatalog / total) * 100) : null,
      };
    })
    .sort((a, b) =>
      state.sort === "name"
        ? a.name.localeCompare(b.name)
        : (b.percent ?? -1) - (a.percent ?? -1) || a.name.localeCompare(b.name),
    );
}

async function loadSetCatalog(group) {
  if (!group?.setId || state.setCatalogs.has(group.key))
    return state.setCatalogs.get(group?.key) || null;
  if (state.setCatalogLoading.has(group.key)) return null;
  state.setCatalogLoading.add(group.key);
  try {
    const response = await fetch(
      `/api/set?setId=${encodeURIComponent(group.setId)}&language=${encodeURIComponent(group.language)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) throw new Error("Set catalog unavailable");
    const payload = await response.json();
    state.setCatalogs.set(group.key, payload.set || null);
    return payload.set || null;
  } catch {
    state.setCatalogs.set(group.key, null);
    return null;
  } finally {
    state.setCatalogLoading.delete(group.key);
    if (state.ledgerView === "sets") renderCollection();
  }
}

async function refreshSetCatalogs() {
  const pending = collectionSetGroups()
    .filter((group) => group.setId && !state.setCatalogs.has(group.key))
    .slice(0, 12);
  if (!pending.length) return;
  await Promise.all(pending.map(loadSetCatalog));
}

function renderSetRows() {
  let groups = collectionSetGroups().filter((group) =>
    matchesSearch(
      { name: group.name, set: group.name, number: group.setId },
      state.query,
    ),
  );
  $("#resultCount").textContent =
    `${groups.length} set${groups.length === 1 ? "" : "s"} in progress`;
  $("#sortButton").firstChild.textContent =
    state.sort === "value-desc" ? "Completion, high to low " : "Name, A to Z ";
  $("#cardLedger").innerHTML = groups
    .map((group) => {
      const loading = state.setCatalogLoading.has(group.key);
      const catalogKnown = state.setCatalogs.has(group.key);
      const progress =
        group.percent === null
          ? "0"
          : group.percent.toFixed(group.percent < 10 ? 1 : 0);
      const status = loading
        ? "Loading exact checklist…"
        : catalogKnown && !group.catalog
          ? "Checklist temporarily unavailable"
          : group.totalCount
            ? `${group.ownedCount} of ${group.totalCount} unique cards`
            : `${group.ownedCount} unique card${group.ownedCount === 1 ? "" : "s"} recorded`;
      return `<button class="set-progress-row" type="button" data-set-key="${esc(group.key)}"><div class="set-progress-icon">${group.catalog?.logo ? `<img src="${esc(group.catalog.logo)}" alt="">` : '<span aria-hidden="true">◆</span>'}</div><div class="set-progress-main"><strong>${esc(group.name)}</strong><span>${esc(status)}</span><div class="set-progress-track" aria-label="${esc(group.name)} ${progress}% complete"><i style="width:${progress}%"></i></div></div><div class="set-progress-value"><strong>${group.percent === null ? "—" : `${progress}%`}</strong><span>View set</span></div></button>`;
    })
    .join("");
  const trulyEmpty = collectionSetGroups().length === 0;
  $("#collectionEmpty").classList.toggle("hidden", groups.length > 0);
  $("#collectionEmptyTitle").textContent = trulyEmpty
    ? "No sets started yet"
    : "No sets match this search";
  $("#collectionEmptyCopy").textContent = trulyEmpty
    ? "Add any card and Mica will automatically start its set progress."
    : "Try a different set name or clear the search.";
  $("#firstCardGuide").classList.toggle("hidden", !trulyEmpty);
  $("#emptyAddCard").classList.toggle("hidden", !trulyEmpty);
  $("#emptyAddCard").textContent = "Add a card to start";
  $("#clearFilters").classList.toggle("hidden", trulyEmpty);
  $("#filterButton").classList.add("hidden");
  $("#filterLabel").textContent = "Filter";
  $$("[data-set-key]").forEach((button) =>
    button.addEventListener("click", () =>
      openSetProgressSheet(
        collectionSetGroups().find(
          (group) => group.key === button.dataset.setKey,
        ),
      ),
    ),
  );
}

function setSheetMarkup(group) {
  const catalog = group.catalog;
  if (!catalog)
    return `<div class="sheet-heading"><div><h2 id="sheetTitle">${esc(group.name)}</h2><p>Set checklist</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="unavailable-panel"><strong>The exact checklist is temporarily unavailable.</strong><br>Your owned cards remain safe. Try this set again after the public catalog refreshes.</div>`;
  return `<div class="sheet-heading"><div><h2 id="sheetTitle">${esc(catalog.name)}</h2><p>${group.ownedCount} of ${catalog.totalCount} unique cards · ${group.percent?.toFixed(1) || 0}% complete</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="set-sheet-progress"><span>Set progress</span><strong>${catalog.totalCount - group.ownedCount} missing</strong><div class="set-progress-track"><i style="width:${group.percent || 0}%"></i></div></div><div class="set-share-action"><div><strong>Missing-card list</strong><span>Copy collector numbers and names without sharing private collection data.</span></div><button id="copyMissingList" type="button" ${catalog.totalCount === group.ownedCount ? "disabled" : ""}>${catalog.totalCount === group.ownedCount ? "Set complete" : "Copy list"}</button></div><div class="set-check-tools"><label class="search-field"><span class="sr-only">Search this set</span><input id="setChecklistSearch" type="search" placeholder="Search this set"></label><label class="missing-toggle"><input id="missingOnly" type="checkbox" checked> Missing only</label></div><div class="set-checklist" id="setChecklist" aria-live="polite"></div>`;
}

function bindSetSheet(group) {
  $$(".sheet-close", $("#sheetContent")).forEach((button) =>
    button.addEventListener("click", closeSheet),
  );
  if (!group.catalog) return;
  const render = () => {
    const query = $("#setChecklistSearch").value;
    const missingOnly = $("#missingOnly").checked;
    const cards = group.catalog.cards.filter(
      (card) =>
        (!missingOnly || !group.ownedIds.has(collectorKey(card.localId))) &&
        matchesSearch(card, query),
    );
    $("#setChecklist").innerHTML = cards.length
      ? cards
          .map((card) => {
            const owned = group.ownedIds.has(collectorKey(card.localId));
            return `<button type="button" data-set-card="${esc(card.externalIds.tcgdex)}"><img src="${esc(card.thumb || "./icons/icon.svg")}" alt="" loading="lazy"><span><strong>${esc(card.name)}</strong><small>#${esc(card.localId)} · ${owned ? "In your library" : "Missing"}</small></span><b>${owned ? "View" : "Find"}</b></button>`;
          })
          .join("")
      : '<div class="find-empty"><strong>No cards in this view</strong><span>Clear the search or show owned cards too.</span></div>';
    $$("[data-set-card]", $("#setChecklist")).forEach((button) =>
      button.addEventListener("click", async () => {
        const card = group.catalog.cards.find(
          (item) => item.externalIds.tcgdex === button.dataset.setCard,
        );
        button.disabled = true;
        button.querySelector("b").textContent = "Opening…";
        try {
          const result = await searchCatalog(
            card.externalIds.tcgdex,
            group.language,
            1,
          );
          const detailed = result.items[0];
          if (!detailed) throw new Error("Card unavailable");
          closeSheet({ discardHistory: true });
          openCardDetail(detailed);
        } catch {
          button.disabled = false;
          button.querySelector("b").textContent = "Retry";
          toast("That card could not be opened right now");
        }
      }),
    );
  };
  $("#setChecklistSearch").addEventListener("input", render);
  $("#missingOnly").addEventListener("change", render);
  render();
  $("#copyMissingList").addEventListener("click", async () => {
    const text = missingSetChecklist(group.catalog, group.ownedIds);
    try {
      await navigator.clipboard.writeText(text);
      toast("Missing-card list copied");
    } catch {
      toast("Copy is unavailable in this browser");
    }
  });
}

async function openSetProgressSheet(group) {
  if (!group) return;
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">${esc(group.name)}</h2><p>Loading exact set checklist…</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="searching-cards"><i></i><span>Checking every collector number…</span></div>`,
  );
  await loadSetCatalog(group);
  const refreshed =
    collectionSetGroups().find((item) => item.key === group.key) || group;
  if ($("#bottomSheet").hidden) return;
  $("#sheetContent").innerHTML = setSheetMarkup(refreshed);
  bindSetSheet(refreshed);
}

function syncBulkControls() {
  const selectedCount = state.bulkSelected.size;
  const shown = state.visiblePositionIds;
  const supported =
    !["watchlist", "sets"].includes(state.ledgerView) &&
    state.items.length > 0 &&
    !accountDataUnavailable();
  $("#selectPositionsButton").hidden = !supported;
  $("#selectPositionsButton").setAttribute(
    "aria-pressed",
    String(state.bulkMode),
  );
  $("#selectPositionsButton").textContent = state.bulkMode
    ? "Cancel"
    : "Select";
  $("#bulkOrganizeBar").hidden = !state.bulkMode || !supported;
  document.body.classList.toggle("bulk-selecting", state.bulkMode && supported);
  $("#bulkSelectedCount").textContent = `${selectedCount} selected`;
  $("#bulkOrganizeButton").disabled = selectedCount === 0;
  const allShown =
    shown.length > 0 && shown.every((id) => state.bulkSelected.has(id));
  $("#bulkSelectShown").textContent = allShown ? "Clear shown" : "Select shown";
  $("#bulkSelectShown").disabled = shown.length === 0;
}

function setBulkMode(enabled) {
  state.bulkMode = Boolean(enabled);
  if (!state.bulkMode) state.bulkSelected.clear();
  renderCollection();
}

function toggleBulkPosition(id) {
  if (state.bulkSelected.has(id)) state.bulkSelected.delete(id);
  else state.bulkSelected.add(id);
  renderCollection();
}

function openBulkOrganizeSheet() {
  const selected = state.items.filter((item) =>
    state.bulkSelected.has(item.uid),
  );
  if (!selected.length) {
    toast("Select at least one position");
    return;
  }
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Organize ${selected.length} position${selected.length === 1 ? "" : "s"}</h2><p>Apply only the changes you choose. Card identity, grade, cost, and transactions stay untouched.</p></div><button class="sheet-close" aria-label="Close">×</button></div><form id="bulkOrganizeForm"><div class="form-grid"><div class="field"><label for="bulkLabelMode">Label</label><select id="bulkLabelMode" name="labelMode"><option value="keep">No label change</option><option value="add">Add a label</option><option value="remove">Remove a label</option></select></div><div class="field" id="bulkLabelField" hidden><label for="bulkLabel">Label name</label><input id="bulkLabel" name="label" maxlength="40" placeholder="Trade binder"></div><div class="field"><label for="bulkLocationMode">Storage location</label><select id="bulkLocationMode" name="locationMode"><option value="keep">No location change</option><option value="set">Set one location</option><option value="clear">Clear location</option></select></div><div class="field" id="bulkLocationField" hidden><label for="bulkLocation">Location</label><input id="bulkLocation" name="location" maxlength="250" placeholder="Binder 2 · Shelf A"></div><div class="field full"><label for="bulkStatus">Collection status</label><select id="bulkStatus" name="status"><option value="keep">No status change</option><option value="owned">Keeping</option><option value="archived">Archived</option></select><small>Listing cards stays a one-at-a-time review so Mica never guesses an asking price or sales venue.</small></div><p class="form-error" id="bulkOrganizeError" role="alert"></p></div><div class="sheet-actions"><button class="secondary" type="button" id="bulkOrganizeCancel">Cancel</button><button class="primary" type="submit">Apply changes</button></div></form>`,
  );
  const labelMode = $("#bulkLabelMode");
  const locationMode = $("#bulkLocationMode");
  const syncFields = () => {
    $("#bulkLabelField").hidden = labelMode.value === "keep";
    $("#bulkLocationField").hidden = locationMode.value !== "set";
  };
  labelMode.addEventListener("change", syncFields);
  locationMode.addEventListener("change", syncFields);
  syncFields();
  $("#bulkOrganizeCancel").addEventListener("click", closeSheet);
  $("#bulkOrganizeForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.currentTarget.querySelector('[type="submit"]');
    const data = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    submit.disabled = true;
    $("#bulkOrganizeError").textContent = "Saving securely…";
    try {
      await bulkOrganizePositions(supabase, {
        ids: selected.map((item) => item.uid),
        ...data,
      });
      closeSheet({ discardHistory: true });
      await reloadPortfolio();
      state.bulkSelected = new Set(
        [...state.bulkSelected].filter((id) =>
          state.items.some((item) => item.uid === id),
        ),
      );
      renderCollection();
      toast(
        `${selected.length} position${selected.length === 1 ? "" : "s"} organized`,
      );
    } catch (error) {
      submit.disabled = false;
      $("#bulkOrganizeError").textContent =
        `Could not organize these positions: ${error.message || "Unknown error"}`;
    }
  });
}

function renderCollection() {
  $("#filterButton").classList.remove("hidden");
  const sellerDesk = $("#sellerDesk");
  sellerDesk.classList.toggle("hidden", state.ledgerView !== "for-sale");
  const accountUnavailable = accountDataUnavailable();
  $$('[data-route="scan"]').forEach((button) => {
    button.disabled = accountUnavailable;
  });
  [
    "#moreButton",
    "#sharePortfolioButton",
    "#importButton",
    "#exportButton",
    "#exportCsvButton",
    "#insuranceReportButton",
    "#batchGradingButton",
  ].forEach((selector) => {
    const button = $(selector);
    if (button) button.disabled = accountUnavailable;
  });
  if (accountUnavailable) {
    state.bulkMode = false;
    state.bulkSelected.clear();
    syncBulkControls();
    $("#view-collection").classList.add("empty-library");
    $("#cardLedger").innerHTML = "";
    $("#loadMorePositions").hidden = true;
    $("#resultCount").textContent = state.accountLoading
      ? "Reconnecting…"
      : "Cloud data unavailable";
    $("#collectionEmpty").classList.remove("hidden");
    $("#collectionEmptyTitle").textContent = state.accountLoading
      ? "Reconnecting to your library…"
      : "Your library couldn't load";
    $("#collectionEmptyCopy").textContent = state.accountLoading
      ? "Mica is securely checking your account again."
      : "Your saved data was not changed. Check your connection and try again.";
    $("#firstCardGuide").classList.add("hidden");
    $("#emptyAddCard").classList.remove("hidden");
    $("#emptyAddCard").disabled = state.accountLoading;
    $("#emptyAddCard").textContent = state.accountLoading
      ? "Reconnecting…"
      : "Try again";
    $("#clearFilters").classList.add("hidden");
    $("#syncState span:last-child").textContent = state.accountLoading
      ? "Reconnecting…"
      : "Cloud unavailable";
    $("#syncState").setAttribute(
      "aria-label",
      state.accountLoading
        ? "Reconnecting to your cloud portfolio."
        : "Cloud portfolio could not load. Select to try again.",
    );
    return;
  }
  $("#emptyAddCard").disabled = false;
  $("#view-collection").classList.toggle(
    "empty-library",
    state.items.length === 0 && state.ledgerView === "all",
  );
  const totals = calculateTotals(state.items);
  const gain = totals.comparableValue - totals.comparableCost;
  const soldPositions = state.items.filter((item) =>
    (item.transactions || []).some(
      (transaction) => transaction.type === "sale",
    ),
  );
  const knownRealized = soldPositions.filter(
    (item) => item.realizedGain != null,
  );
  const realized = knownRealized.reduce(
    (sum, item) => sum + Number(item.realizedGain),
    0,
  );
  const rawCount = state.items
    .filter((item) => item.cardState !== "sealed" && !item.gradingCompany)
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const gradedCount = state.items
    .filter((item) => item.gradingCompany)
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const sealedCount = state.items
    .filter((item) => item.cardState === "sealed")
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const portfolioReturn =
    totals.comparableCost > 0 ? (gain / totals.comparableCost) * 100 : null;
  $("#portfolioValue").textContent = money(totals.value);
  $("#costBasis").textContent = totals.costKnown ? money(totals.cost) : "—";
  $("#unrealized").textContent = totals.gainCoverage
    ? `${gain >= 0 ? "+" : ""}${money(gain)}`
    : "—";
  $("#gainLabel").textContent =
    totals.gainCoverage === totals.quantity
      ? "Gain / loss"
      : "Known gain / loss";
  $("#ownedCount").textContent =
    `${totals.quantity} item${totals.quantity === 1 ? "" : "s"}`;
  $("#portfolioReturn").textContent =
    portfolioReturn === null
      ? "—"
      : `${portfolioReturn >= 0 ? "+" : ""}${portfolioReturn.toFixed(1)}%`;
  $("#realizedGain").textContent = knownRealized.length
    ? `${realized >= 0 ? "+" : ""}${money(realized)}`
    : "—";
  $("#realizedGain").title =
    soldPositions.length - knownRealized.length
      ? `${soldPositions.length - knownRealized.length} sold position${soldPositions.length - knownRealized.length === 1 ? " has" : "s have"} unknown acquisition cost`
      : "Realized gain from FIFO-covered sales";
  $("#allocationSummary").textContent =
    `${rawCount} / ${gradedCount} / ${sealedCount}`;
  $("#freshCoverage").textContent = `${totals.priced} of ${totals.quantity}`;
  const partial = totals.unpriced
    ? ` · ${totals.unpriced} unpriced item${totals.unpriced === 1 ? "" : "s"} excluded`
    : "";
  const costCoverage = totals.unknownCost
    ? ` · ${totals.unknownCost} missing purchase cost`
    : "";
  const hasProviderPricing = ["live", "partial"].includes(state.pricingStatus);
  $("#portfolioChange").textContent = hasProviderPricing
    ? `Current matching provider snapshots${partial}${costCoverage}`
    : `Preview pricing${partial}${costCoverage}`;
  $("#valuationNote").firstChild.textContent =
    totals.gainCoverage === totals.quantity
      ? "Based on matching market prices. "
      : `Gain/loss uses ${totals.gainCoverage} of ${totals.quantity} copies with both price and cost. `;
  $("#allCount").textContent = state.items.length;
  $("#forSaleCount").textContent = state.items.filter(
    (item) => item.status === "listed",
  ).length;
  $("#watchlistCount").textContent = state.watchlist.length;
  $("#setCount").textContent = collectionSetGroups().length;
  const pricedCount = state.items.filter((item) => item.price != null).length;
  const pricingLabel =
    state.pricingStatus === "loading"
      ? "Updating live prices…"
      : state.pricingStatus === "live"
        ? `${pricedCount} of ${state.items.length} live prices`
        : state.pricingStatus === "partial"
          ? `${pricedCount} live · ${state.items.length - pricedCount} need review`
          : state.pricingStatus === "error"
            ? "Provider unavailable · preview prices"
            : `${pricedCount} of ${state.items.length} preview prices`;
  $(".status-label").innerHTML = `<i></i> ${pricingLabel}`;
  const syncLabels = {
    loading: "Prices updating",
    live: "Prices current",
    partial: "Some prices missing",
    error: "Pricing unavailable",
    demo: "Preview prices",
  };
  const syncLabel =
    state.storageStatus === "error"
      ? "Session only"
      : `Cloud saved · ${syncLabels[state.pricingStatus] || "Prices ready"}`;
  $("#syncState span:last-child").textContent = syncLabel;
  $("#syncState").setAttribute(
    "aria-label",
    state.storageStatus === "error"
      ? "Session only. Changes may be lost when this page closes."
      : `Portfolio saved to your account. ${syncLabels[state.pricingStatus] || "Pricing ready"}. Select to refresh prices.`,
  );
  if (state.ledgerView === "watchlist") {
    state.bulkMode = false;
    state.bulkSelected.clear();
    state.visiblePositionIds = [];
    syncBulkControls();
    $("#loadMorePositions").hidden = true;
    renderWatchlistRows();
    return;
  }
  if (state.ledgerView === "sets") {
    state.bulkMode = false;
    state.bulkSelected.clear();
    state.visiblePositionIds = [];
    syncBulkControls();
    $("#loadMorePositions").hidden = true;
    renderSetRows();
    void refreshSetCatalogs();
    return;
  }
  if (state.ledgerView === "for-sale") {
    const readiness = listingReadiness(state.items);
    const gap = readiness.askingValueMinor - readiness.marketValueMinor;
    sellerDesk.innerHTML = `<div class="seller-desk-head"><div><span>Seller desk</span><strong>${readiness.units} unit${readiness.units === 1 ? "" : "s"} actively listed</strong></div><b>${readiness.needsReview ? `${readiness.needsReview} need review` : "Listings ready"}</b></div><div class="seller-desk-grid"><div><span>Total asking value</span><strong>${money(readiness.askingValueMinor / 100)}</strong></div><div><span>Matching market value</span><strong>${readiness.pricedPositions ? money(readiness.marketValueMinor / 100) : "Unavailable"}</strong></div><div><span>Ask vs market</span><strong>${readiness.pricedPositions ? `${gap >= 0 ? "+" : ""}${money(gap / 100)}` : "—"}</strong></div><div><span>Missing details</span><strong>${readiness.missingAsk} price · ${readiness.missingVenue} venue</strong></div></div><p>Review flags appear when the ask differs from market by 10% or more, required listing details are missing, or pricing has not been reviewed in 7 days.</p>`;
  }
  let visible = state.items.filter((item) => matchesSearch(item, state.query));
  if (state.ledgerView === "favorites")
    visible = visible.filter((item) =>
      (item.tags || []).some(
        (tag) => String(tag).toLowerCase() === "favorites",
      ),
    );
  if (state.ledgerView === "graded")
    visible = visible.filter((item) => item.gradingCompany || item.grade);
  if (state.ledgerView === "unpriced")
    visible = visible.filter((item) => item.price == null);
  if (state.ledgerView === "for-sale")
    visible = visible.filter((item) => item.status === "listed");
  if (state.setFilter)
    visible = visible.filter((item) => item.set === state.setFilter);
  if (state.labelFilter)
    visible = visible.filter((item) =>
      (item.tags || []).some(
        (tag) => String(tag).toLowerCase() === state.labelFilter.toLowerCase(),
      ),
    );
  if (state.conditionFilter === "Raw")
    visible = visible.filter(
      (item) =>
        item.cardState !== "sealed" &&
        !item.gradingCompany &&
        item.condition !== "Graded",
    );
  else if (state.conditionFilter === "Graded")
    visible = visible.filter(
      (item) => item.gradingCompany || item.condition === "Graded",
    );
  else if (state.conditionFilter === "Sealed")
    visible = visible.filter((item) => item.cardState === "sealed");
  else if (state.conditionFilter)
    visible = visible.filter(
      (item) => item.condition === state.conditionFilter,
    );
  visible.sort((a, b) =>
    state.sort === "value-desc"
      ? (itemValue(b) ?? -1) - (itemValue(a) ?? -1)
      : a.name.localeCompare(b.name),
  );
  const visibleKey = JSON.stringify([
    state.ledgerView,
    state.query,
    state.sort,
    state.setFilter,
    state.conditionFilter,
    state.labelFilter,
  ]);
  if (state.visibleKey !== visibleKey) {
    state.visibleKey = visibleKey;
    state.visibleLimit = 100;
  }
  const windowed = collectionWindow(visible, state.visibleLimit);
  const displayed = windowed.displayed;
  state.visiblePositionIds = displayed.map((item) => item.uid);
  $("#resultCount").textContent = windowed.remaining
    ? `Showing ${displayed.length} of ${windowed.total} items`
    : `${windowed.total} item${windowed.total === 1 ? "" : "s"}`;
  const remaining = windowed.remaining;
  $("#loadMorePositions").hidden = remaining <= 0;
  $("#loadMorePositions").textContent =
    `Show ${Math.min(100, remaining)} more · ${remaining} remaining`;
  $("#sortButton").firstChild.textContent =
    state.sort === "value-desc" ? "Value, high to low " : "Name, A to Z ";
  $("#cardLedger").innerHTML = displayed
    .map((item) => {
      const total = itemValue(item);
      const moveClass =
        item.move == null ? "none" : item.move >= 0 ? "up" : "down";
      const hasMovement = Number.isFinite(Number(item.move));
      const movementLabel =
        item.price != null && hasMovement
          ? `${item.move >= 0 ? "↑" : "↓"} ${Math.abs(item.move).toFixed(1)}% · 30 days`
          : priceStatusText(item);
      const listing = listingReadiness([item]);
      const listingTag =
        item.status === "listed"
          ? listing.needsReview
            ? "Listing review"
            : item.askingPrice === null
              ? "Listed"
              : `Listed · ${money(item.askingPrice)}`
          : null;
      const statusTag = item.activeGradingSubmission
        ? `At ${item.activeGradingSubmission.grader}`
        : item.status === "archived"
          ? "Archived"
          : null;
      const tags = [
        item.cardState === "sealed"
          ? "Sealed"
          : item.gradingCompany
            ? `${item.gradingCompany} ${item.grade}`
            : item.condition,
        listingTag || statusTag,
        ...(item.tags || []).slice(0, listingTag || statusTag ? 0 : 1),
      ].filter(Boolean);
      const selected = state.bulkSelected.has(item.uid);
      return `<article class="ledger-row${state.bulkMode ? " bulk-mode" : ""}${selected ? " selected" : ""}" tabindex="0" role="${state.bulkMode ? "checkbox" : "button"}" ${state.bulkMode ? `aria-checked="${selected}"` : ""} aria-label="${state.bulkMode ? (selected ? "Deselect" : "Select") : "Open"} ${esc(item.name)}, ${total == null ? "price unavailable" : money(total)}" data-id="${esc(item.uid)}">
      ${state.bulkMode ? `<span class="bulk-select-indicator" aria-hidden="true">${selected ? "✓" : ""}</span>` : ""}
      <img class="card-thumb" src="${esc(item.thumb)}" alt="${esc(item.name)} from ${esc(item.set)}" loading="lazy">
      <div class="card-main"><div class="card-name-line"><span class="card-name">${esc(item.name)}</span><span class="quantity">×${Number(item.quantity) || 0}</span></div><span class="card-set">${esc(item.set)} · ${esc(item.number)}</span>${item.location ? `<span class="card-location" title="Storage location">${esc(item.location)}</span>` : ""}<div class="card-tags">${tags.map((tag, i) => `<span class="micro-tag ${i === 0 && item.gradingCompany ? "graded" : ""} ${item.price == null ? "warn" : ""}">${esc(tag)}</span>`).join("")}</div></div>
      <div class="price-cell"><span class="row-value">${total == null ? "—" : money(total)}</span><span class="row-unit">${item.price == null ? "pricing unavailable" : `${money(item.price)} each`}</span><span class="row-move ${moveClass}">${esc(movementLabel)}</span></div>
    </article>`;
    })
    .join("");
  $("#collectionEmpty").classList.toggle("hidden", visible.length > 0);
  const trulyEmpty = state.items.length === 0;
  $("#collectionEmptyTitle").textContent = trulyEmpty
    ? "Your library is empty"
    : "No items match this view";
  $("#collectionEmptyCopy").textContent = trulyEmpty
    ? "Start with one card or sealed product. Mica only asks for the details that apply."
    : "Try clearing the search or changing your filters.";
  $("#firstCardGuide").classList.toggle("hidden", !trulyEmpty);
  $("#emptyAddCard").classList.toggle("hidden", !trulyEmpty);
  $("#emptyAddCard").textContent = "Add your first item";
  $("#clearFilters").classList.toggle("hidden", trulyEmpty);
  const activeFilterCount =
    (state.ledgerView !== "all" ? 1 : 0) +
    (state.setFilter ? 1 : 0) +
    (state.conditionFilter ? 1 : 0) +
    (state.labelFilter ? 1 : 0);
  $("#filterLabel").textContent = activeFilterCount
    ? `Filter · ${activeFilterCount}`
    : "Filter";
  syncBulkControls();
  $$(".ledger-row").forEach((row) => {
    const open = () =>
      state.bulkMode
        ? toggleBulkPosition(row.dataset.id)
        : openCardDetail(
            state.items.find((item) => item.uid === row.dataset.id),
            true,
          );
    row.addEventListener("click", open);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
}

function openCardDetail(card, preferOwned = false) {
  if (!card) return;
  const owned = preferOwned
    ? card
    : state.items.find((item) => sameCatalogCard(item, card));
  if (state.route !== "detail") state.detailReturnRoute = state.route;
  state.detailCanPop = state.route !== "detail";
  state.detailId = owned?.uid || card.id;
  state.detailCard = owned || card;
  routeTo("detail");
  if ((owned || card).cardState === "sealed")
    void loadSealedDetailPricing(owned || card);
  else if (owned) void loadOwnedDetailPricing(owned);
  else void loadCardPreviewPricing(card);
}

async function loadSealedDetailPricing(item) {
  const id =
    item.externalIds?.pkmnpricesSealed ||
    String(item.id || "").replace(/^sealed:/, "");
  if (!/^\d{1,12}$/.test(String(id))) return;
  try {
    const response = await fetch(`/api/sealed?id=${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return;
    const payload = await response.json();
    const product = payload.product;
    if (!product) return;
    const quote = selectReferenceQuote(
      product.quotes,
      "Sealed product",
      item.currency || "USD",
      {},
    );
    const updated = {
      ...item,
      ...product,
      uid: item.uid,
      quantity: item.quantity,
      costBasis: item.costBasis,
      cost: item.cost,
      currency: item.currency || "USD",
      transactions: item.transactions,
      lots: item.lots,
      location: item.location,
      notes: item.notes,
      tags: item.tags,
      status: item.status,
      price: quote?.amount ?? null,
      pricingStatus: quote ? quoteStatus(quote) : "unavailable",
      pricingUpdatedAt:
        quote?.observedAt || quote?.retrievedAt?.slice?.(0, 10) || null,
    };
    if (item.uid)
      state.items = state.items.map((candidate) =>
        candidate.uid === item.uid ? updated : candidate,
      );
    if (state.detailId === item.uid || state.detailId === item.id)
      state.detailCard = updated;
    renderCollection();
    if (state.route === "detail") renderDetail();
  } catch {}
}

async function loadCardPreviewPricing(card) {
  const lookup = [
    {
      clientId: card.id,
      pkmnpricesId: card.externalIds?.pkmnprices || "",
      tcgdexId: card.externalIds?.tcgdex || "",
      name: card.name,
      set: card.set,
      number: card.number,
      language: card.language || "en",
    },
  ];
  try {
    const response = await fetch(
      `/api/cards?history=full&lookups=${encodeURIComponent(JSON.stringify(lookup))}`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) {
      if (state.detailId !== card.id) return;
      state.detailCard = {
        ...card,
        pricingStatus:
          card.price == null
            ? response.status === 429
              ? "rate_limited"
              : "error"
            : card.pricingStatus,
        historyStatus: card.historyStatus || "unavailable",
      };
      renderDetail();
      return;
    }
    const payload = await response.json();
    const priced = payload.cards?.[0];
    if (!priced || state.detailId !== card.id) return;
    const quote = selectReferenceQuote(priced.quotes, card.variant, "USD", {
      condition: "Near Mint",
    });
    const updated = {
      ...card,
      externalIds: {
        ...(card.externalIds || {}),
        ...(priced.externalIds || {}),
      },
      metadata: priced.metadata || card.metadata || null,
      priceCapabilities: payload.capabilities || null,
      price: quote?.amount ?? null,
      quotes: priced.quotes || [],
      priceHistory: recordPriceObservation(card, quote, priced.history || []),
      historyStatus: priced.historyStatus || null,
      pricingStatus: quote ? quoteStatus(quote) : "unavailable",
      pricingUpdatedAt:
        quote?.observedAt || quote?.retrievedAt?.slice(0, 10) || null,
    };
    catalog = catalog.map((item) => (item.id === card.id ? updated : item));
    state.detailCard = updated;
    renderDetail();
  } catch {
    if (state.detailId !== card.id) return;
    state.detailCard = {
      ...card,
      pricingStatus: card.price == null ? "error" : card.pricingStatus,
      historyStatus: card.historyStatus || "unavailable",
    };
    renderDetail();
  }
}

async function loadOwnedDetailPricing(item) {
  const lookup = [
    {
      clientId: item.id,
      pkmnpricesId: item.externalIds?.pkmnprices || "",
      justtcgId: item.externalIds?.justtcg || "",
      tcgplayerId: item.externalIds?.tcgplayer || "",
      tcgdexId: item.externalIds?.tcgdex || "",
      name: item.name,
      set: item.set,
      number: item.number,
      language: item.language || "en",
    },
  ];
  try {
    const response = await fetch(
      `/api/cards?history=full&lookups=${encodeURIComponent(JSON.stringify(lookup))}`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) return;
    const payload = await response.json();
    const priced = payload.cards?.[0];
    if (!priced || state.detailId !== item.uid) return;
    const quote = selectReferenceQuote(
      priced.quotes,
      item.variant,
      item.currency || "USD",
      item,
    );
    const pricedItem = {
      ...item,
      externalIds: {
        ...(item.externalIds || {}),
        ...(priced.externalIds || {}),
      },
      metadata: priced.metadata || item.metadata || null,
      priceCapabilities: payload.capabilities || null,
      price: quote?.amount ?? null,
      quotes: priced.quotes || [],
      historyStatus: priced.historyStatus || null,
      priceHistory: recordPriceObservation(
        item,
        quote,
        mergePriceHistory(item.priceHistory || [], priced.history || []),
      ),
      pricingStatus: quote ? quoteStatus(quote) : "unavailable",
      pricingUpdatedAt:
        quote?.observedAt || quote?.retrievedAt?.slice?.(0, 10) || null,
    };
    const movement = movementForItem(pricedItem);
    const updated = {
      ...pricedItem,
      move: movement?.changePercent ?? null,
      movement,
    };
    state.items = state.items.map((candidate) =>
      candidate.uid === item.uid ? updated : candidate,
    );
    state.detailCard = updated;
    renderCollection();
    renderInsights();
    renderDetail();
  } catch {}
}

function plannedSaleBasis(item, quantity) {
  const count = Number(quantity);
  if (!Number.isInteger(count) || count < 1 || count > Number(item.quantity))
    return null;
  if (item.lots?.length) {
    const allocation = allocateFifo(
      item.lots.map((lot) => ({
        id: lot.id,
        acquiredAt: lot.fifoDate || lot.acquiredAt,
        quantityAcquired: lot.quantityAcquired,
        quantityRemaining: lot.quantityRemaining,
        totalCostMinor:
          lot.totalCost == null
            ? null
            : Math.round(Number(lot.totalCost) * 100),
        costBasisKnown: lot.costBasisKnown,
      })),
      count,
    );
    if (allocation.unallocatedQuantity === 0) return allocation.allocatedCost;
  }
  return item.costBasis == null
    ? null
    : Math.round(
        ((Number(item.costBasis) * count) / Number(item.quantity || 1)) * 100,
      );
}

function renderSalePlanner(item, displayPrice) {
  if (!item) return "";
  const noun = item.cardState === "sealed" ? "Products" : "Cards";
  return `<section class="detail-section sale-planner" aria-labelledby="salePlannerTitle"><div class="detail-section-head"><h2 id="salePlannerTitle">Plan a sale</h2><span>Preview before recording</span></div><p class="planner-intro">See what you could keep after fees and costs. Nothing is saved until you choose Record this sale.</p><div class="sale-planner-inputs">
    <div class="field"><label for="planSaleQuantity">${noun} to sell</label><input id="planSaleQuantity" type="number" inputmode="numeric" min="1" max="${item.quantity}" step="1" value="1"></div>
    <div class="field"><label for="planSalePrice">Expected price · each</label><div class="money-input"><span>$</span><input id="planSalePrice" type="number" inputmode="decimal" min="0" step="0.01" value="${displayPrice == null ? "" : Number(displayPrice).toFixed(2)}" placeholder="0.00"></div></div>
    <div class="field"><label for="planFeePercent">Marketplace fee %</label><input id="planFeePercent" type="number" inputmode="decimal" min="0" max="99.99" step="0.01" value="0" placeholder="Enter current venue fee"></div>
    <div class="field"><label for="planShipping">Shipping you pay</label><div class="money-input"><span>$</span><input id="planShipping" type="number" inputmode="decimal" min="0" step="0.01" value="0.00"></div></div>
    <div class="field"><label for="planOtherCosts">Other selling costs</label><div class="money-input"><span>$</span><input id="planOtherCosts" type="number" inputmode="decimal" min="0" step="0.01" value="0.00"></div></div>
    <div class="field"><label for="planTargetProfit">Target profit · total <span class="optional-label">Optional</span></label><div class="money-input"><span>$</span><input id="planTargetProfit" type="number" inputmode="decimal" min="0" step="0.01" placeholder="50.00"></div></div>
  </div><p class="planner-fee-note">Enter the marketplace's current fee. Mica does not assume a venue or hard-code a rate.</p><div class="sale-plan-output" id="salePlanOutput" aria-live="polite"><div class="unavailable-panel">Enter an expected selling price to calculate the plan.</div></div><button class="planner-record" id="planRecordSaleButton" type="button" disabled>Use this plan to record a sale</button></section>`;
}

function bindSalePlanner(item) {
  const root = $(".sale-planner");
  if (!root) return;
  let latest = null;
  const values = () => ({
    quantity: $("#planSaleQuantity").value,
    salePriceEach: $("#planSalePrice").value,
    feePercent: $("#planFeePercent").value,
    shipping: $("#planShipping").value,
    otherCosts: $("#planOtherCosts").value,
    targetProfit: $("#planTargetProfit").value,
  });
  const update = () => {
    const input = values();
    const basis = plannedSaleBasis(item, input.quantity);
    latest =
      basis === null ? null : salePlan({ ...input, costBasisMinor: basis });
    const button = $("#planRecordSaleButton");
    button.disabled = !latest;
    if (!latest) {
      $("#salePlanOutput").innerHTML =
        '<div class="unavailable-panel">Enter valid quantities, prices, fees, and costs to calculate this sale.</div>';
      return;
    }
    const profitClass = latest.profitMinor >= 0 ? "positive" : "negative";
    $("#salePlanOutput").innerHTML =
      `<div><span>Gross sale</span><strong>${money(latest.grossMinor / 100, item.currency)}</strong></div><div><span>Marketplace fees</span><strong>${latest.marketplaceFeesMinor ? `−${money(latest.marketplaceFeesMinor / 100, item.currency)}` : money(0, item.currency)}</strong></div><div><span>Estimated net</span><strong>${money(latest.netProceedsMinor / 100, item.currency)}</strong></div><div><span>FIFO cost basis</span><strong>${money(latest.costBasisMinor / 100, item.currency)}</strong></div><div class="${profitClass}"><span>Estimated profit</span><strong>${latest.profitMinor >= 0 ? "+" : ""}${money(latest.profitMinor / 100, item.currency)}</strong></div><div><span>ROI on cost</span><strong>${latest.roiPercent === null ? "—" : `${latest.roiPercent >= 0 ? "+" : ""}${latest.roiPercent.toFixed(1)}%`}</strong></div><div><span>Break-even price · each</span><strong>${money(latest.breakEvenPriceEachMinor / 100, item.currency)}</strong></div>${latest.targetPriceEachMinor === null ? "" : `<div class="target"><span>List for target profit · each</span><strong>${money(latest.targetPriceEachMinor / 100, item.currency)}</strong></div>`}`;
  };
  $$(
    "#planSaleQuantity,#planSalePrice,#planFeePercent,#planShipping,#planOtherCosts,#planTargetProfit",
    root,
  ).forEach((input) => input.addEventListener("input", update));
  $("#planRecordSaleButton").addEventListener("click", () => {
    if (!latest) return;
    const input = values();
    openSaleSheet(item, {
      quantity: input.quantity,
      unitPrice: input.salePriceEach,
      marketplaceFees: (latest.marketplaceFeesMinor / 100).toFixed(2),
      shipping: input.shipping,
      otherCosts: input.otherCosts,
    });
  });
  update();
}

function renderBuyPlanner(item, displayPrice) {
  if (displayPrice == null)
    return `<section class="detail-section deal-planner"><div class="detail-section-head"><h2>What should I pay?</h2><span>Exact price required</span></div><div class="unavailable-panel">Mica needs a matching market reference before it can calculate a responsible buy ceiling.</div></section>`;
  return `<section class="detail-section sale-planner deal-planner" aria-labelledby="buyPlannerTitle"><div class="detail-section-head"><h2 id="buyPlannerTitle">What should I pay?</h2><span>Deal guardrail</span></div><p class="planner-intro">Start with this exact market reference, subtract selling costs, then protect the return you want. This is a planning ceiling—not an appraisal.</p><div class="sale-planner-inputs">
    <div class="field"><label for="buyPlanQuantity">Quantity</label><input id="buyPlanQuantity" type="number" inputmode="numeric" min="1" max="99999" step="1" value="1"></div>
    <div class="field"><label for="buyPlanResale">Expected resale · each</label><div class="money-input"><span>$</span><input id="buyPlanResale" type="number" inputmode="decimal" min="0" step="0.01" value="${Number(displayPrice).toFixed(2)}"></div></div>
    <div class="field"><label for="buyPlanFees">Selling fee %</label><input id="buyPlanFees" type="number" inputmode="decimal" min="0" max="99.99" step="0.01" value="0" placeholder="Enter current venue fee"></div>
    <div class="field"><label for="buyPlanCosts">Other selling costs · total</label><div class="money-input"><span>$</span><input id="buyPlanCosts" type="number" inputmode="decimal" min="0" step="0.01" value="0.00"></div></div>
    <div class="field"><label for="buyPlanRoi">Return you want %</label><input id="buyPlanRoi" type="number" inputmode="decimal" min="0" step="0.1" value="20"></div>
    <div class="field"><label for="buyPlanOffer">Seller's ask · each <span class="optional-label">Optional</span></label><div class="money-input"><span>$</span><input id="buyPlanOffer" type="number" inputmode="decimal" min="0" step="0.01" placeholder="Compare an offer"></div></div>
  </div><p class="planner-fee-note">For a personal-collection purchase, set the desired return to 0%. Enter a venue's current fee only when you expect to resell.</p><div class="sale-plan-output" id="buyPlanOutput" aria-live="polite"></div><button class="planner-record" id="buyPlanWatchButton" type="button">Save max price as buy target</button></section>`;
}

function bindBuyPlanner(item) {
  const root = $(".deal-planner");
  if (!root || !$("#buyPlanResale")) return;
  let latest = null;
  const values = () => ({
    quantity: $("#buyPlanQuantity").value,
    expectedResaleEach: $("#buyPlanResale").value,
    feePercent: $("#buyPlanFees").value,
    otherSellingCosts: $("#buyPlanCosts").value,
    targetRoiPercent: $("#buyPlanRoi").value,
    plannedOfferEach: $("#buyPlanOffer").value,
  });
  const update = () => {
    latest = buyOfferPlan(values());
    const button = $("#buyPlanWatchButton");
    button.disabled = !latest;
    if (!latest) {
      $("#buyPlanOutput").innerHTML =
        '<div class="unavailable-panel">Enter valid prices, costs, quantity, and target return.</div>';
      return;
    }
    const offerClass =
      latest.projectedProfitMinor === null
        ? ""
        : latest.projectedProfitMinor >= 0
          ? "positive"
          : "negative";
    const offerRows =
      latest.plannedOfferTotalMinor === null
        ? ""
        : `<div><span>Seller ask · total</span><strong>${money(latest.plannedOfferTotalMinor / 100, item.currency || "USD")}</strong></div><div class="${offerClass}"><span>Profit at that ask</span><strong>${latest.projectedProfitMinor >= 0 ? "+" : ""}${money(latest.projectedProfitMinor / 100, item.currency || "USD")}</strong></div><div class="${offerClass}"><span>ROI at that ask</span><strong>${latest.projectedRoiPercent === null ? "—" : `${latest.projectedRoiPercent >= 0 ? "+" : ""}${latest.projectedRoiPercent.toFixed(1)}%`}</strong></div>`;
    $("#buyPlanOutput").innerHTML =
      `<div><span>Expected gross resale</span><strong>${money(latest.grossMinor / 100, item.currency || "USD")}</strong></div><div><span>Fees + other costs</span><strong>−${money((latest.marketplaceFeesMinor + latest.otherSellingCostsMinor) / 100, item.currency || "USD")}</strong></div><div class="target"><span>Maximum offer · each</span><strong>${money(latest.maxOfferEachMinor / 100, item.currency || "USD")}</strong></div><div class="target"><span>Maximum offer · total</span><strong>${money(latest.maxAcquisitionMinor / 100, item.currency || "USD")}</strong></div>${offerRows}`;
  };
  $$(
    "#buyPlanQuantity,#buyPlanResale,#buyPlanFees,#buyPlanCosts,#buyPlanRoi,#buyPlanOffer",
    root,
  ).forEach((input) => input.addEventListener("input", update));
  $("#buyPlanWatchButton").addEventListener("click", () => {
    if (!latest) return;
    openWatchlistSheet(item, matchingWatchEntry(item), {
      targetPrice: (latest.maxOfferEachMinor / 100).toFixed(2),
    });
  });
  update();
}

function renderOwnedDetailLegacy() {
  const item = state.items.find(
    (candidate) => candidate.uid === state.detailId,
  );
  if (!item) return routeTo("collection");
  const total = itemValue(item);
  const tcgQuote = selectReferenceQuote(item.quotes, item.variant, "USD", item);
  const cardmarketQuote = selectCardmarketReference(item.quotes, item.variant);
  const sourceRows =
    item.price == null
      ? `<div class="unavailable-panel"><strong>Pricing unavailable for this printing.</strong><br>The collection record is preserved and excluded from estimated totals. Mica will not substitute a different variant or condition.</div>`
      : item.pricingStatus === "live"
        ? `${renderQuoteRow(tcgQuote, tcgQuote?.provider === "justtcg" ? "JustTCG market estimate" : "TCGplayer reference")}${renderQuoteRow(cardmarketQuote, "Cardmarket reference")}`
        : `<div class="price-source"><div><strong>Preview reference</strong><span>Fixture · ${esc(item.variant)} · USD</span><span>Live provider refresh has not completed.</span></div><div class="source-value"><b>${money(item.price)}</b><small>Clearly labeled demo data</small></div></div>`;
  $("#detailContent").innerHTML =
    `<button class="detail-back" id="detailBack" type="button"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>Collection</button>
    <div class="detail-identity"><img src="${esc(item.image)}" alt="${esc(item.name)} from ${esc(item.set)}"><div><p class="eyebrow">${esc(item.rarity)}</p><h1 id="detailTitle">${esc(item.name)}</h1><p class="detail-set">${esc(item.set)} · ${esc(item.number)}</p><div class="detail-meta"><div><span>Printing</span><strong>${esc(item.variant)}</strong></div><div><span>Language</span><strong>English</strong></div><div><span>Released</span><strong>${esc(item.release)}</strong></div><div><span>Artist</span><strong>${esc(item.artist)}</strong></div></div></div></div>
    <div class="owned-banner"><div><span>Your position</span><strong>${item.quantity} owned · ${total == null ? "Unpriced" : money(total)}</strong></div><button id="editCopyButton" type="button">Edit record</button></div>
    <section class="detail-section"><div class="detail-section-head"><h2>Market references</h2><span>${item.price == null ? "No supported quote" : item.pricingStatus === "live" ? "Live provider data" : "Preview data · not live"}</span></div>${sourceRows}<p class="legal-copy">These values are market references, not guaranteed value or an appraisal. Condition and venue can materially affect realized price.</p></section>
    <section class="detail-section"><div class="detail-section-head"><h2>Owned copy</h2><span>${esc(item.location)}</span></div><div class="copy-row"><div><strong>${item.gradingCompany ? `${esc(item.gradingCompany)} ${esc(item.grade)}` : esc(item.condition)}</strong><span>Purchased ${esc(item.purchaseDate || "date not recorded")} · ${money(item.cost)} each</span></div><b>×${item.quantity}</b></div>${item.notes ? `<div class="unavailable-panel">${esc(item.notes)}</div>` : ""}</section>
    <section class="detail-section"><div class="detail-section-head"><h2>Price history</h2><span>Provider observations · no synthetic ticks</span></div>${renderInteractiveHistory(item)}</section>
    <section class="detail-section"><div class="detail-section-head"><h2>Recent sold evidence</h2><span>${item.salesStatus === "live" ? "Linked completed sales" : "Licensed source required"}</span></div>${renderSales(item)}</section>`;
  $("#detailBack").addEventListener("click", () => routeTo("collection"));
  $("#editCopyButton").addEventListener("click", () =>
    openPositionEditSheet(item),
  );
  void loadSales(item);
}

function positionTransactionRow(transaction, unitNoun) {
  if (transaction.type === "purchase")
    return `<div class="transaction-row"><div><strong>Purchased ${esc(transaction.date || "date not recorded")}</strong><span>${transaction.quantity} ${unitNoun}${transaction.quantity === 1 ? "" : "s"} · total acquisition${transaction.marketplace ? ` · ${esc(transaction.marketplace)}` : ""}</span></div><b>${transaction.totalCost == null ? "Not recorded" : money(transaction.totalCost, transaction.currency)}</b></div>`;
  if (transaction.type === "sale")
    return `<div class="transaction-row"><div><strong>Sold ${esc(transaction.date || "date not recorded")}</strong><span>${transaction.quantity} at ${money(transaction.unitPrice, transaction.currency)}${transaction.marketplace ? ` · ${esc(transaction.marketplace)}` : ""}</span></div><b>${money(transaction.netProceeds, transaction.currency)}</b></div>`;
  if (transaction.type === "grading_submission")
    return `<div class="transaction-row"><div><strong>Sent to grading ${esc(transaction.date || "date not recorded")}</strong><span>${transaction.quantity} ${unitNoun}${transaction.quantity === 1 ? "" : "s"} · ${esc(transaction.gradingCompany || transaction.marketplace || "grader")} · estimated costs excluded from basis</span></div><b>Tracking</b></div>`;
  if (transaction.type === "grading_return") {
    const prior = String(transaction.previousRawCondition || "raw")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
    return `<div class="transaction-row"><div><strong>Returned graded ${esc(transaction.date || "date not recorded")}</strong><span>${transaction.quantity} ${unitNoun}${transaction.quantity === 1 ? "" : "s"} · ${esc(transaction.gradingCompany)} ${esc(transaction.grade)} · previously ${esc(prior)}${transaction.certificationNumber ? ` · cert ${esc(transaction.certificationNumber)}` : ""}</span></div><b>+${money(transaction.gradingFees, transaction.currency)} basis</b></div>`;
  }
  const label = String(transaction.type || "adjustment")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return `<div class="transaction-row"><div><strong>${esc(label)} ${esc(transaction.date || "date not recorded")}</strong><span>${transaction.quantity} ${unitNoun}${transaction.quantity === 1 ? "" : "s"}${transaction.notes ? ` · ${esc(transaction.notes)}` : ""}</span></div><b>${transaction.totalCost ? money(transaction.totalCost, transaction.currency) : "Recorded"}</b></div>`;
}

function renderDetail() {
  const owned =
    state.items.find((candidate) => candidate.uid === state.detailId) || null;
  const item =
    owned ||
    state.detailCard ||
    catalog.find((candidate) => candidate.id === state.detailId);
  if (!item) return routeTo("scan");
  const sealed = item.cardState === "sealed" || Boolean(item.productType);
  const watched = matchingWatchEntry(item);
  const conditionContext = sealed
    ? {}
    : owned ||
      watched || { condition: "Near Mint", gradingCompany: "", grade: "" };
  const tcgQuote = selectReferenceQuote(
    item.quotes,
    item.variant,
    "USD",
    conditionContext,
  );
  const cardmarketQuote = selectCardmarketReference(item.quotes, item.variant);
  const pricingStatus =
    item.pricingStatus ||
    (state.pricingStatus === "error"
      ? "error"
      : item.price != null
        ? "preview"
        : "loading");
  const livePrice = ["live", "stale"].includes(pricingStatus)
    ? (tcgQuote?.amount ?? null)
    : null;
  const previewPrice = ["preview", "error"].includes(pricingStatus)
    ? (item.demoPrice ?? item.price ?? null)
    : null;
  const displayPrice = livePrice ?? previewPrice;
  const marketLabel =
    pricingStatus === "live"
      ? "Current market"
      : pricingStatus === "stale"
        ? "Stale market reference"
        : previewPrice != null
          ? "Preview fixture"
          : "Current market";
  const statusCopy =
    pricingStatus === "live"
      ? `Updated ${esc(item.pricingUpdatedAt || "recently")}`
      : pricingStatus === "stale"
        ? `Last observed ${esc(item.pricingUpdatedAt || "date unknown")} · refresh needed`
        : pricingStatus === "preview"
          ? "Demo data · not a live quote"
          : pricingStatus === "error"
            ? "Provider refresh failed · preview only"
            : pricingStatus === "rate_limited"
              ? "Provider rate limit reached · retry shortly"
              : pricingStatus === "unavailable"
                ? "No exact-printing quote available"
                : "Checking this exact printing";
  const sourceRows = ["live", "stale"].includes(pricingStatus)
    ? `${renderQuoteRow(tcgQuote, sealed ? "TCGplayer sealed market" : tcgQuote?.provider === "justtcg" ? "JustTCG market" : "TCGplayer market")}${renderQuoteRow(cardmarketQuote, sealed ? "Cardmarket sealed market" : "Cardmarket")}`
    : pricingStatus === "preview" ||
        (pricingStatus === "error" && previewPrice != null)
      ? `<div class="price-source"><div><strong>Preview fixture</strong><span>${esc(item.variant || "Printing unknown")} · USD</span><span>${pricingStatus === "error" ? "The live provider could not be reached." : "Live refresh has not completed."}</span></div><div class="source-value"><b>${money(previewPrice)}</b><small>Demo data · not live</small></div></div>`
      : `<div class="unavailable-panel">${pricingStatus === "unavailable" ? "No matching market price is available for this printing, finish, and condition yet. Mica did not substitute another card." : pricingStatus === "rate_limited" ? "The pricing provider asked Mica to slow down. No value is being guessed." : pricingStatus === "error" ? "The pricing provider could not be reached. No value is being guessed." : "Loading the latest matching market price…"}${["error", "rate_limited"].includes(pricingStatus) ? '<br><button class="inline-retry" id="retryPricingButton" type="button">Try pricing again</button>' : ""}</div>`;
  const backLabel =
    {
      collection: "My library",
      insights: "Market",
      trade: "Trade check",
      profile: "Profile",
    }[state.detailReturnRoute] || "Find cards";
  const activeSubmission = owned?.activeGradingSubmission || null;
  const gradingStatusLabel = activeSubmission
    ? {
        submitted: "Sent to grader",
        received: "Received by grader",
        grading: "Grading in progress",
        assembly: "Slab assembly",
        shipped: "Return shipped",
      }[activeSubmission.status] || "At grader"
    : "";
  const gradingSubmissionSection = activeSubmission
    ? `<section class="detail-section grading-submission-status"><div class="detail-section-head"><h2>Grading submission</h2><span>${esc(activeSubmission.grader)} · ${esc(gradingStatusLabel)}</span></div><div class="position-summary"><div><span>Cards away</span><strong>${activeSubmission.quantity}</strong></div><div><span>Sent</span><strong>${esc(activeSubmission.submittedAt)}</strong></div><div><span>Status updated</span><strong>${esc(activeSubmission.statusUpdatedAt)}</strong></div><div><span>Expected back</span><strong>${esc(activeSubmission.expectedReturnDate || "Not estimated")}</strong></div><div><span>Reference</span><strong>${esc(activeSubmission.submissionReference || "Not added")}</strong></div><div><span>Estimated cost</span><strong>${activeSubmission.estimatedTotalCost === null ? "Not estimated" : money(activeSubmission.estimatedTotalCost, item.currency)}</strong></div></div><p class="legal-copy">Status is your private manual record, not a live feed from ${esc(activeSubmission.grader)}. Estimated cost does not enter profit until you record the actual returned total.</p><div class="sheet-actions"><button class="secondary" id="updateGradingSubmissionButton" type="button">Update status</button><button class="primary" id="recordGradingResultButton" type="button">Record returned grade</button></div></section>`
    : "";
  const ownedSection = owned
    ? `<section class="detail-section"><div class="detail-section-head"><h2>Your copy</h2><span>${esc(item.location || "Location not set")}</span></div><div class="copy-row"><div><strong>${item.gradingCompany ? `${esc(item.gradingCompany)} ${esc(item.grade)}` : esc(item.condition)}</strong><span>${item.purchaseDate ? `Bought ${esc(item.purchaseDate)}` : "Purchase date not added"}${item.cost !== null && item.cost !== undefined ? ` · ${money(item.cost)} each` : " · Cost not recorded"}</span></div><b>×${item.quantity}</b></div>${item.notes ? `<div class="unavailable-panel">${esc(item.notes)}</div>` : ""}${!sealed && !item.gradingCompany && item.status === "owned" && !activeSubmission ? '<button class="position-new-state" id="startGradingSubmissionButton" type="button">Send to grading</button><button class="position-new-state" id="recordGradingResultButton" type="button">Record a grade already returned</button>' : ""}${sealed ? "" : '<button class="position-new-state" id="correctPositionMatchButton" type="button">Correct card or printing</button>'}<button class="record-remove" id="removeCopyButton" type="button">Remove this owned record</button></section>`
    : "";
  const performance = owned
    ? positionPerformance({
        quantityOwned: item.quantity,
        remainingCostBasisMinor:
          item.costBasis == null
            ? null
            : Math.round(Number(item.costBasis) * 100),
        currentUnitPrice: displayPrice,
        netSaleProceedsMinor:
          item.netSaleProceeds == null
            ? null
            : Math.round(Number(item.netSaleProceeds) * 100),
        allocatedSoldCostMinor:
          item.allocatedSoldCost == null
            ? null
            : Math.round(Number(item.allocatedSoldCost) * 100),
      })
    : null;
  const unitNoun = sealed ? "product" : "card";
  const incompleteLot =
    owned?.lots?.find(
      (lot) => !lot.costBasisKnown || !lot.acquisitionDateKnown,
    ) || null;
  const positionSection = owned
    ? `<section class="detail-section"><div class="detail-section-head"><h2>Current position</h2><span>${item.lots?.length || 0} purchase lot${item.lots?.length === 1 ? "" : "s"} · FIFO cost basis</span></div><div class="position-summary"><div><span>${item.gradingCompany ? "Total cost basis" : "Total acquisition cost"}</span><strong>${item.costBasis == null ? "Not recorded" : money(item.costBasis, item.currency)}</strong></div><div><span>Value today</span><strong>${performance.currentValueMinor === null ? "Unavailable" : money(performance.currentValueMinor / 100, item.currency)}</strong></div><div><span>Gain / loss today</span><strong>${performance.unrealizedGainMinor === null ? "Needs acquisition cost" : money(performance.unrealizedGainMinor / 100, item.currency)}</strong></div><div><span>Return since purchase</span><strong>${performance.returnPercent === null ? "Unavailable" : `${performance.returnPercent >= 0 ? "+" : ""}${performance.returnPercent.toFixed(1)}%`}</strong></div><div><span>First purchased</span><strong>${esc(item.purchaseDate || "Not recorded")}</strong></div><div><span>Valuation source</span><strong>${esc(tcgQuote?.provider || "Unavailable")}</strong></div></div>${incompleteLot ? `<div class="warning-panel"><strong>Complete this purchase history</strong><p>Add the total cost or original date you know. Until then, Mica keeps profit and return unavailable instead of treating missing cost as $0.</p><button class="inline-retry" id="completePurchaseHistoryButton" type="button">Add missing details</button></div>` : ""}<div class="transaction-list">${(item.transactions || []).map((transaction) => positionTransactionRow(transaction, unitNoun)).join("")}</div>${activeSubmission ? '<div class="simple-note" id="gradingInventoryLock"><strong>This position is at the grader.</strong><br>Record the returned grade or cancel the submission before adding copies or recording a sale.</div>' : ""}<div class="sheet-actions"><button class="secondary" id="recordPurchaseButton" type="button" ${activeSubmission ? 'disabled aria-describedby="gradingInventoryLock"' : ""}>Add another purchase</button><button class="secondary" id="recordSaleButton" type="button" ${activeSubmission ? 'disabled aria-describedby="gradingInventoryLock"' : ""}>Record sale</button></div><button class="position-new-state" id="addDifferentPositionButton" type="button">${sealed ? "Add as a separate sealed position" : "Add this card with a different condition or grade"}</button></section>`
    : "";
  const favorite =
    owned &&
    (item.tags || []).some((tag) => String(tag).toLowerCase() === "favorites");
  const action = owned
    ? `<div class="owned-banner"><div><span>${item.status === "listed" ? "Listed for sale" : "In your library"}</span><strong>${item.quantity} owned · ${item.status === "listed" && item.askingPrice !== null ? `${money(item.askingPrice)} ask each` : displayPrice == null ? "Price unavailable" : `${money(displayPrice)} each`}</strong></div><div class="owned-actions"><button id="favoriteCopyButton" type="button" aria-pressed="${String(favorite)}">${favorite ? "Favorited" : "Favorite"}</button><button id="duplicateCopyButton" type="button">Add copy</button><button id="editCopyButton" type="button">${item.status === "listed" ? "Manage listing" : "Edit / list"}</button></div></div>`
    : `<div class="detail-sticky-action split"><button class="secondary" id="watchCardButton" type="button">${watched ? "Edit Watch" : sealed ? "Watch product" : "Watch card"}</button><button id="addLibraryButton" type="button">Add to Library</button></div>`;
  const watchedPerformance = watched
    ? watchPerformance({
        startingPrice: watched.startingMarketPrice,
        currentPrice: watched.currentPrice,
      })
    : null;
  const watchedMovement = watchedPerformance
    ? ` · ${watchedPerformance.changeMinor >= 0 ? "+" : "−"}${money(Math.abs(watchedPerformance.changeMinor) / 100, watched.currency)} (${watchedPerformance.changePercent >= 0 ? "+" : ""}${watchedPerformance.changePercent.toFixed(1)}%) since watch`
    : "";
  const watchedSection =
    watched && !owned
      ? `<section class="watch-banner"><div><span>On your watchlist · ${esc(watchContextLabel(watched))}</span><strong>${watched.targetPrice === null ? "No buy target set" : `Buy at ${money(watched.targetPrice, watched.currency)}`}</strong><small>${watched.currentPrice === null ? "Current exact price unavailable" : `Current exact reference ${money(watched.currentPrice, watched.currency)}${esc(watchedMovement)}`}</small></div><button id="editWatchButton" type="button">Edit target</button></section>`
      : "";
  const listingSection =
    owned && item.status === "listed"
      ? `<section class="detail-section listing-status"><div class="detail-section-head"><h2>Active listing</h2><span>Reviewed ${esc(item.priceReviewedAt || "not yet")}</span></div><div class="position-summary"><div><span>Asking price · each</span><strong>${item.askingPrice === null ? "Missing" : money(item.askingPrice, item.currency)}</strong></div><div><span>Current market · each</span><strong>${displayPrice === null ? "Unavailable" : money(displayPrice, item.currency)}</strong></div><div><span>Venue</span><strong>${esc(item.listingVenue || "Missing")}</strong></div><div><span>Listed</span><strong>${esc(item.listedAt || "Not recorded")}</strong></div></div><button class="planner-record" id="manageListingButton" type="button">Review or update listing</button></section>`
      : "";
  const matchDetails =
    !owned && item.match?.reasons?.length
      ? `<section class="match-explanation" aria-label="Why this card matched"><strong>${esc(item.match.confidence || "Possible match")}</strong><span>${esc(item.match.reasons.join(" · "))}</span><small>TCGdex ID ${esc(item.externalIds?.tcgdex || item.id)}</small></section>`
      : "";
  const productType = String(item.productType || "sealed product")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const detailMeta = sealed
    ? `<div><span>Type</span><strong>${esc(productType)}</strong></div><div><span>Language</span><strong>${esc(languageName(item.language))}</strong></div><div><span>Provider ID</span><strong>${esc(item.externalIds?.pkmnpricesSealed || "—")}</strong></div><div><span>Package state</span><strong>Sealed</strong></div>`
    : `<div><span>Printing</span><strong>${esc(item.variant || "Unknown")}</strong></div><div><span>Language</span><strong>${esc(languageName(item.language))}</strong></div><div><span>Released</span><strong>${esc(item.release || "—")}</strong></div><div><span>Artist</span><strong>${esc(item.artist || "—")}</strong></div>`;
  $("#detailContent").innerHTML =
    `<button class="detail-back" id="detailBack" type="button"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>${backLabel}</button>
    <div class="detail-identity"><img src="${esc(item.image || item.thumb)}" alt="${esc(item.name)} from ${esc(item.set)}"><div><p class="eyebrow">${esc(sealed ? "Sealed product" : item.rarity || "Pokémon card")}</p><h1 id="detailTitle">${esc(item.name)}</h1><p class="detail-set">${esc(item.set)}${item.number ? ` · ${esc(item.number)}` : ""}</p><div class="detail-meta">${detailMeta}</div></div></div>
    ${matchDetails}
    <section class="market-hero" role="status"><span>${marketLabel}</span><strong>${displayPrice == null ? (pricingStatus === "loading" ? "Checking…" : "Price unavailable") : money(displayPrice)}</strong><small>${statusCopy}</small></section>
    ${renderPriceEvidence(item, conditionContext)}
    ${watchedSection}
    ${action}
    ${listingSection}
    ${gradingSubmissionSection}
    <section class="detail-section"><div class="detail-section-head"><h2>Market prices</h2><span>Matching printing only</span></div>${sourceRows}</section>
    ${renderMarketplaceOffers(item)}
    ${renderGradedPriceLadder(item)}
    ${renderCardMetadata(item)}
    ${renderBuyPlanner(item, displayPrice)}
    ${sealed ? "" : renderGradingEstimator(item)}
    ${owned ? renderSalePlanner(item, displayPrice) : ""}
    <section class="detail-section"><div class="detail-section-head"><h2>Price trend</h2><span>Real observations</span></div>${renderInteractiveHistory(item, displayPrice)}</section>
    ${sealed ? '<section class="detail-section"><div class="detail-section-head"><h2>Recent sales</h2><span>Not supplied for sealed products</span></div><div class="unavailable-panel">PkmnPrices currently exposes a sealed market reference, but its documented sold-listing endpoint is card-specific. Mica does not substitute card sales or active asks.</div></section>' : `<section class="detail-section"><div class="detail-section-head"><h2>Recent sales</h2><span>${item.salesStatus === "live" ? "Completed listings" : "Verified links when available"}</span></div>${renderSales(item)}</section>`}
    ${positionSection}
    ${ownedSection}
    <p class="legal-copy">Prices are market references, not guaranteed sale values. ${sealed ? "Packaging and seal condition" : "Card condition"} can materially change realized value.</p>`;
  $("#detailBack").addEventListener("click", () =>
    state.detailCanPop
      ? history.back()
      : routeTo(state.detailReturnRoute || (owned ? "collection" : "scan")),
  );
  $("#editCopyButton")?.addEventListener("click", () =>
    openPositionEditSheet(item),
  );
  $("#manageListingButton")?.addEventListener("click", () =>
    openPositionEditSheet(item),
  );
  $("#duplicateCopyButton")?.addEventListener("click", () =>
    openPurchaseLotSheet(item),
  );
  $("#addLibraryButton")?.addEventListener("click", () =>
    openPositionSheet(item),
  );
  $("#watchCardButton")?.addEventListener("click", () =>
    openWatchlistSheet(item, watched),
  );
  $("#editWatchButton")?.addEventListener("click", () =>
    openWatchlistSheet(item, watched),
  );
  $("#favoriteCopyButton")?.addEventListener(
    "click",
    () => void toggleFavorite(item),
  );
  $("#removeCopyButton")?.addEventListener("click", () =>
    openDeleteCopySheet(item),
  );
  $("#startGradingSubmissionButton")?.addEventListener("click", () =>
    openGradingSubmissionSheet(item),
  );
  $("#updateGradingSubmissionButton")?.addEventListener("click", () =>
    openGradingSubmissionSheet(item, activeSubmission),
  );
  $("#recordGradingResultButton")?.addEventListener("click", () =>
    openGradingResultSheet(item),
  );
  $("#correctPositionMatchButton")?.addEventListener("click", () =>
    openRemapPositionSheet(item),
  );
  $("#recordSaleButton")?.addEventListener("click", () => openSaleSheet(item));
  $("#recordPurchaseButton")?.addEventListener("click", () =>
    openPurchaseLotSheet(item),
  );
  $("#completePurchaseHistoryButton")?.addEventListener("click", () =>
    openCompletePurchaseHistorySheet(item, incompleteLot),
  );
  $("#addDifferentPositionButton")?.addEventListener("click", () =>
    openPositionSheet(item),
  );
  $("#retryPricingButton")?.addEventListener("click", () => {
    if (owned) void refreshLivePricing();
    else {
      state.detailCard = { ...item, pricingStatus: "loading", price: null };
      renderDetail();
      void loadCardPreviewPricing(item);
    }
  });
  $("#retrySalesButton")?.addEventListener(
    "click",
    () => void loadSales(item, true),
  );
  $("#retryOffersButton")?.addEventListener(
    "click",
    () => void loadOffers(item, true),
  );
  if (!sealed) bindGradingEstimator(item);
  bindBuyPlanner(item);
  bindSalePlanner(owned);
  mountPriceChart(item);
  if (!sealed) {
    void loadSales(item);
    void loadOffers(item);
  }
}

function identitySnapshot(card, variant) {
  return {
    providerCardId: card.id,
    name: card.name,
    set: card.set,
    setId: card.setId || null,
    number: card.number,
    language: card.language || "en",
    rarity: card.rarity || null,
    variant,
    release: card.release || null,
    artist: card.artist || null,
    image: card.image || card.thumb || null,
    thumb: card.thumb || card.image || null,
    productType: card.productType || null,
    cardState: card.cardState || null,
    externalIds: card.externalIds || { tcgdex: card.id },
  };
}

function openSealedSearch() {
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Find sealed products</h2><p>Search official PkmnPrices product records.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="form-grid"><label class="search-field full"><span class="sr-only">Search sealed products</span><input id="sealedQuery" type="search" placeholder="Crown Zenith Elite Trainer Box" autocomplete="off"></label><div class="field"><label for="sealedLanguage">Language</label><select id="sealedLanguage"><option value="en">English</option><option value="ja">Japanese</option></select></div></div><div class="manual-results" id="sealedResults" aria-live="polite"><div class="find-empty"><strong>Search sealed inventory</strong><span>Try a set name plus booster box, ETB, tin, bundle, or collection.</span></div></div><p class="legal-copy">Product records and current prices come from PkmnPrices. Confirm the exact product and language before adding it.</p>`,
  );
  const input = $("#sealedQuery");
  const language = $("#sealedLanguage");
  const results = $("#sealedResults");
  let timer;
  let requestId = 0;
  let products = [];
  const search = async () => {
    const query = input.value.trim();
    const current = ++requestId;
    if (query.length < 2) {
      results.innerHTML =
        '<div class="find-empty"><strong>Search sealed inventory</strong><span>Type at least two characters.</span></div>';
      return;
    }
    results.innerHTML =
      '<div class="searching-cards"><i></i><span>Finding sealed products…</span></div>';
    try {
      const response = await fetch(
        `/api/sealed?q=${encodeURIComponent(query)}&language=${encodeURIComponent(language.value)}`,
        { headers: { Accept: "application/json" } },
      );
      const payload = await response.json().catch(() => ({}));
      if (current !== requestId) return;
      if (response.status === 403) {
        results.innerHTML =
          '<div class="pro-data-empty"><strong>Sealed housing is ready</strong><p>The current PkmnPrices key cannot search sealed products. After the plan upgrade, results will appear here without another app change.</p></div>';
        return;
      }
      if (!response.ok) throw new Error(payload.error || "Search unavailable");
      products = payload.products || [];
      results.innerHTML = products.length
        ? products
            .map(
              (product) =>
                `<button class="quick-card-result" type="button" data-sealed-id="${esc(product.externalIds?.pkmnpricesSealed)}"><img src="${esc(product.thumb || "./icons/icon.svg")}" alt="${esc(product.name)}"><span><strong>${esc(product.name)}</strong><small>${esc(product.set)}</small><em>${esc(languageName(product.language))} · Sealed product</em></span><b>View</b></button>`,
            )
            .join("")
        : '<div class="find-empty"><strong>No sealed matches</strong><span>Try the set name or a simpler product description.</span></div>';
      $$("[data-sealed-id]", results).forEach((button) =>
        button.addEventListener("click", async () => {
          button.disabled = true;
          button.querySelector("b").textContent = "Opening…";
          try {
            const response = await fetch(
              `/api/sealed?id=${encodeURIComponent(button.dataset.sealedId)}`,
              { headers: { Accept: "application/json" } },
            );
            const payload = await response.json();
            if (!response.ok || !payload.product)
              throw new Error(payload.error || "Product unavailable");
            const product = payload.product;
            const quote = selectReferenceQuote(
              product.quotes,
              product.variant,
              "USD",
              {},
            );
            const detailed = {
              ...product,
              price: quote?.amount ?? null,
              pricingStatus: quote ? quoteStatus(quote) : "unavailable",
              pricingUpdatedAt:
                quote?.observedAt || quote?.retrievedAt?.slice?.(0, 10) || null,
            };
            closeSheet({ discardHistory: true });
            openCardDetail(detailed);
          } catch (error) {
            button.disabled = false;
            button.querySelector("b").textContent = "Retry";
            toast(error.message || "This product could not be opened");
          }
        }),
      );
    } catch (error) {
      if (current === requestId)
        results.innerHTML = `<div class="unavailable-panel">${esc(error.message || "Sealed search is temporarily unavailable.")}</div>`;
    }
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(search, 250);
  };
  input.addEventListener("input", schedule);
  language.addEventListener("change", search);
  input.focus();
}

function openSealedPositionSheet(product) {
  const today = localIsoDate();
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Add sealed product</h2><p>${esc(product.name)} · ${esc(product.set)}</p></div><button class="sheet-close" aria-label="Close">×</button></div><form id="sealedPositionForm"><div class="form-grid"><div class="field"><label for="sealedQuantity">How many?</label><input id="sealedQuantity" name="quantity" type="number" inputmode="numeric" min="1" max="99999" step="1" value="1" required></div><div class="field"><label for="sealedPurchaseDate">When did you buy it?</label><input id="sealedPurchaseDate" name="transactionDate" type="date" max="${today}" value="${today}" required></div><div class="field full acquisition-field"><label for="sealedTotalCost">Total acquisition cost</label><div class="money-input"><span>$</span><input id="sealedTotalCost" name="totalAcquisitionCost" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" required></div><small>One total: everything paid to acquire this purchase.</small></div><div class="field full"><label for="sealedLocation">Storage location <span class="optional-label">Optional</span></label><input id="sealedLocation" name="location" maxlength="250" placeholder="Closet shelf · Bin 2"></div><div class="field full"><label for="sealedNotes">Notes <span class="optional-label">Optional</span></label><textarea id="sealedNotes" name="notes" maxlength="10000" placeholder="Case condition, seal notes, source…"></textarea></div><p class="form-error" id="sealedPositionError" role="alert"></p></div><div class="position-total"><span id="sealedCostSummary">Total for 1 product</span><strong id="sealedPositionTotal">$0.00</strong></div><div class="sheet-actions rapid-intake-actions"><button class="secondary" type="button" id="sealedPositionCancel">Cancel</button><button class="secondary" type="submit" name="saveMode" value="continue">Save + add another</button><button class="primary" type="submit" name="saveMode" value="view">Save & view</button></div></form>`,
  );
  const form = $("#sealedPositionForm");
  const values = () => Object.fromEntries(new FormData(form).entries());
  const update = () => {
    const input = values();
    const breakdown = acquisitionFromTotal(
      input.totalAcquisitionCost,
      input.quantity,
    );
    const count = Number(input.quantity) || 0;
    $("#sealedPositionTotal").textContent =
      breakdown === null
        ? "Enter an amount"
        : money(breakdown.totalMinor / 100);
    $("#sealedCostSummary").textContent =
      `Total for ${count || 0} product${count === 1 ? "" : "s"}`;
  };
  form.addEventListener("input", update);
  $("#sealedPositionCancel").addEventListener("click", closeSheet);
  update();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const continueAdding = event.submitter?.value === "continue";
    const data = values();
    const breakdown = acquisitionFromTotal(
      data.totalAcquisitionCost,
      data.quantity,
    );
    if (!breakdown) {
      $("#sealedPositionError").textContent =
        "Enter a valid total acquisition cost.";
      return;
    }
    if (data.transactionDate > today) {
      $("#sealedPositionError").textContent =
        "Acquisition dates cannot be later than today.";
      return;
    }
    const submits = $$('button[type="submit"]', form);
    submits.forEach((button) => (button.disabled = true));
    $("#sealedPositionError").textContent = "Saving securely…";
    let itemId;
    try {
      itemId = await createPosition(supabase, {
        ...breakdown,
        identity: identitySnapshot(product, "Sealed product"),
        cardId: null,
        variantId: null,
        cardState: "sealed",
        rawCondition: null,
        grader: null,
        grade: null,
        certificationNumber: null,
        quantity: Number(data.quantity),
        transactionDate: data.transactionDate,
        currency: "USD",
        notes: data.notes || null,
        idempotencyKey: crypto.randomUUID(),
      });
      if (data.location)
        await updatePosition(supabase, itemId, { location: data.location });
    } catch (error) {
      submits.forEach((button) => (button.disabled = false));
      $("#sealedPositionError").textContent =
        `Could not add this product: ${error.message || "Unknown error"}`;
      return;
    }
    closeSheet({ discardHistory: true });
    if (continueAdding) {
      openSealedSearch();
      toast("Saved · find the next sealed product");
      try {
        await reloadPortfolio();
      } catch {
        toast("Saved · library refresh will retry automatically");
      }
    } else {
      toast("Sealed product added to your library");
      try {
        await reloadPortfolio(itemId);
      } catch {
        routeTo("collection");
        toast("Saved · library refresh will retry automatically");
      }
    }
  });
}

function openWatchlistSheet(card, existing = null, defaults = {}) {
  const sealed = card.cardState === "sealed" || Boolean(card.productType);
  const variants =
    Array.isArray(card.variants) && card.variants.length
      ? card.variants
      : [card.variant || "Unknown"];
  const context = existing
    ? `<div class="simple-note"><strong>${esc(existing.variant)} · ${esc(watchContextLabel(existing))}</strong><br>The exact context stays fixed so target comparisons remain consistent.</div>`
    : sealed
      ? `<input type="hidden" name="cardState" value="sealed"><input type="hidden" name="variant" value="${esc(card.variant || "Sealed product")}"><div class="simple-note"><strong>Exact sealed product · ${esc(languageName(card.language || "en"))}</strong><br>Mica will track this provider product ID without substituting a card or another sealed product.</div>`
      : `<div class="form-grid">
      <div class="field full"><label for="watchVariant">Exact variant</label><select id="watchVariant" name="variant" required>${variants.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}</select></div>
      <div class="field"><label for="watchState">Is the card graded?</label><select id="watchState" name="cardState"><option value="raw">No · raw card</option><option value="graded">Yes · professionally graded</option></select></div>
      <div class="field raw-watch"><label for="watchCondition">Condition</label><select id="watchCondition" name="rawCondition"><option value="near_mint">Near Mint</option><option value="lightly_played">Lightly Played</option><option value="moderately_played">Moderately Played</option><option value="heavily_played">Heavily Played</option><option value="damaged">Damaged</option></select></div>
      <div class="field graded-watch" hidden><label for="watchGrader">Grading company</label><select id="watchGrader" name="grader"><option value="">Choose grader</option>${["PSA", "BGS", "CGC", "TAG", "SGC"].map((value) => `<option>${value}</option>`).join("")}</select></div>
      <div class="field graded-watch" hidden><label for="watchGrade">Grade</label><input id="watchGrade" name="grade" type="number" inputmode="decimal" min="1" max="10" step="0.5" placeholder="10"></div>
    </div>`;
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">${existing ? "Edit watch target" : sealed ? "Watch this product" : "Watch this card"}</h2><p>${esc(card.name)} · ${esc(card.set)}${card.number ? ` ${esc(card.number)}` : ""}</p></div><button class="sheet-close" aria-label="Close">×</button></div>
    <form id="watchlistForm">${context}<div class="field acquisition-field"><label for="watchTarget">Buy at price <span class="optional-label">Optional</span></label><div class="money-input"><span>$</span><input id="watchTarget" name="targetPrice" type="number" inputmode="decimal" min="0" step="0.01" value="${defaults.targetPrice ?? existing?.targetPrice ?? ""}" placeholder="Leave blank to just follow it"></div><small>Mica will flag this exact ${sealed ? "product" : "card"} when its matching market reference is at or below this amount.</small></div><div class="field"><label for="watchNotes">Notes <span class="optional-label">Optional</span></label><textarea id="watchNotes" name="notes" maxlength="2000" placeholder="Why you want it, preferred seller, trade idea…">${esc(existing?.notes || "")}</textarea></div><p class="form-error" id="watchError" role="alert"></p><div class="sheet-actions">${existing ? '<button class="danger-action" id="deleteWatchButton" type="button">Remove</button>' : '<button class="secondary" id="watchCancel" type="button">Cancel</button>'}<button class="primary" type="submit">${existing ? "Save target" : "Add to Watchlist"}</button></div></form>`);
  const form = $("#watchlistForm");
  const syncState = () => {
    if (existing || sealed) return;
    const graded = $("#watchState").value === "graded";
    $$(".graded-watch", form).forEach((node) => (node.hidden = !graded));
    $$(".raw-watch", form).forEach((node) => (node.hidden = graded));
    $("#watchGrader").required = graded;
    $("#watchGrade").required = graded;
    $("#watchCondition").required = !graded;
  };
  $("#watchState")?.addEventListener("change", syncState);
  $("#watchCancel")?.addEventListener("click", closeSheet);
  syncState();
  $("#deleteWatchButton")?.addEventListener("click", async () => {
    const button = $("#deleteWatchButton");
    button.disabled = true;
    $("#watchError").textContent = "Removing…";
    try {
      await deleteWatchlistEntry(supabase, existing.watchlistId);
      state.watchlist = state.watchlist.filter(
        (item) => item.watchlistId !== existing.watchlistId,
      );
      closeSheet({ discardHistory: true });
      state.detailId = null;
      state.detailCard = null;
      state.detailCanPop = false;
      state.ledgerView = "watchlist";
      syncTabs();
      routeTo("collection");
      renderCollection();
      toast("Removed from Watchlist");
    } catch (error) {
      button.disabled = false;
      $("#watchError").textContent =
        `Could not remove this watch: ${error.message || "Unknown error"}`;
    }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const targetPrice =
      data.targetPrice === "" ? null : Number(data.targetPrice);
    if (
      targetPrice !== null &&
      (!Number.isFinite(targetPrice) || targetPrice < 0)
    ) {
      $("#watchError").textContent =
        "Enter a valid target price or leave it blank.";
      return;
    }
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    $("#watchError").textContent = "Saving securely…";
    try {
      if (existing) {
        const updated = await updateWatchlistEntry(
          supabase,
          existing.watchlistId,
          { targetPrice, notes: data.notes },
        );
        state.watchlist = state.watchlist.map((item) =>
          item.watchlistId === existing.watchlistId
            ? {
                ...updated,
                currentPrice: item.currentPrice,
                quotes: item.quotes,
                pricingStatus: item.pricingStatus,
                pricingUpdatedAt: item.pricingUpdatedAt,
              }
            : item,
        );
      } else {
        const cardState = data.cardState;
        const rawCondition =
          cardState === "raw"
            ? normalizeRawCondition(data.rawCondition).normalized
            : null;
        const grader =
          cardState === "graded"
            ? normalizeGrader(data.grader).normalized
            : null;
        const grade =
          cardState === "graded" ? normalizeGrade(data.grade) : null;
        if (cardState === "graded" && (!grader || !grade)) {
          throw new Error("Choose a grading company and a grade from 1 to 10.");
        }
        const condition =
          cardState === "raw"
            ? String(data.rawCondition)
                .split("_")
                .map((part) => part[0].toUpperCase() + part.slice(1))
                .join(" ")
            : cardState === "graded"
              ? "Graded"
              : null;
        const quote = selectReferenceQuote(
          card.quotes,
          data.variant,
          "USD",
          condition
            ? { condition, gradingCompany: grader || "", grade: grade || "" }
            : {},
        );
        const added = await createWatchlistEntry(supabase, {
          userId: state.session.user.id,
          cardId: cardState === "sealed" ? null : card.cardId || null,
          identity: identitySnapshot(card, data.variant),
          cardState,
          rawCondition,
          grader,
          grade,
          targetPrice,
          startingMarketPrice: quote?.amount ?? null,
          currency: "USD",
          notes: data.notes,
        });
        state.watchlist.unshift({
          ...added,
          currentPrice: quote?.amount ?? null,
          quotes: card.quotes || [],
          pricingStatus: quote ? quoteStatus(quote) : "loading",
          pricingUpdatedAt: quote?.observedAt || null,
        });
      }
      closeSheet({ discardHistory: true });
      state.ledgerView = "watchlist";
      state.query = "";
      $("#collectionSearch").value = "";
      syncTabs();
      routeTo("collection");
      renderCollection();
      toast(existing ? "Watch target updated" : "Added to Watchlist");
      if (!existing) void refreshWatchlistPricing();
    } catch (error) {
      submit.disabled = false;
      $("#watchError").textContent =
        error.message?.includes("duplicate") || error.code === "23505"
          ? "This exact item is already on your Watchlist."
          : `Could not save this watch: ${error.message || "Unknown error"}`;
    }
  });
}

function openPositionSheet(card, options = {}) {
  if (card.cardState === "sealed" || card.productType) {
    openSealedPositionSheet(card);
    return;
  }
  const today = localIsoDate();
  const variants =
    Array.isArray(card.variants) && card.variants.length
      ? card.variants
      : [card.variant || "Unknown"];
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">Add to your library</h2><p>${esc(card.name)} · ${esc(card.set)} ${esc(card.number)} · ${esc(languageName(card.language || "en"))}</p></div><button class="sheet-close" aria-label="Close">×</button></div>
    <form id="positionForm"><div class="form-grid">
      <div class="field full"><label for="positionVariant">Exact variant</label><select id="positionVariant" name="variant" required>${variants.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}</select></div>
      <div class="field"><label for="positionState">Is it graded?</label><select id="positionState" name="cardState"><option value="raw">No · raw card</option><option value="graded">Yes · professionally graded</option></select></div>
      <div class="field raw-position"><label for="positionCondition">Condition</label><select id="positionCondition" name="rawCondition"><option value="near_mint">Near Mint</option><option value="lightly_played">Lightly Played</option><option value="moderately_played">Moderately Played</option><option value="heavily_played">Heavily Played</option><option value="damaged">Damaged</option></select></div>
      <div class="field graded-position" hidden><label for="positionGrader">Grading company</label><select id="positionGrader" name="grader"><option value="">Choose grader</option>${["PSA", "BGS", "CGC", "TAG", "SGC"].map((value) => `<option>${value}</option>`).join("")}</select></div>
      <div class="field graded-position" hidden><label for="positionGrade">Grade</label><input id="positionGrade" name="grade" type="number" inputmode="decimal" min="1" max="10" step="0.5" placeholder="10"></div>
      <div class="field"><label for="positionQuantity">How many cards?</label><input id="positionQuantity" name="quantity" type="number" inputmode="numeric" min="1" max="99999" step="1" value="1" required></div>
      <div class="field"><label for="positionDate">When did you buy it?</label><input id="positionDate" name="transactionDate" type="date" max="${today}" value="${today}" required></div>
      <div class="field full acquisition-field"><label for="positionTotalCost">Total acquisition cost</label><div class="money-input"><span>$</span><input id="positionTotalCost" name="totalAcquisitionCost" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" required></div><small>Enter the full amount you paid to acquire this purchase. No tax or fee breakdown needed.</small></div>
      <p class="form-error" id="positionError" role="alert"></p>
    </div><div class="position-total"><span id="positionCostSummary">Total for 1 card</span><strong id="positionTotal">$0.00</strong></div>
    <div class="sheet-actions rapid-intake-actions"><button class="secondary" type="button" id="positionCancel">Cancel</button><button class="secondary" type="submit" name="saveMode" value="continue">Save + add another</button><button class="primary" type="submit" name="saveMode" value="view">Save & view</button></div></form>`);
  const form = $("#positionForm");
  const syncState = () => {
    const graded = $("#positionState").value === "graded";
    $$(".graded-position", form).forEach((node) => (node.hidden = !graded));
    $$(".raw-position", form).forEach((node) => (node.hidden = graded));
    $("#positionGrader").required = graded;
    $("#positionGrade").required = graded;
    $("#positionCondition").required = !graded;
    if (graded) $("#positionCondition").value = "";
    else {
      $("#positionGrader").value = "";
      $("#positionGrade").value = "";
    }
  };
  const values = () => {
    const data = new FormData(form);
    return Object.fromEntries(data.entries());
  };
  const updateTotal = () => {
    const input = values();
    const breakdown = acquisitionFromTotal(
      input.totalAcquisitionCost,
      input.quantity,
    );
    const count = Number(input.quantity) || 0;
    $("#positionTotal").textContent =
      breakdown === null
        ? "Enter an amount"
        : money(breakdown.totalMinor / 100);
    $("#positionCostSummary").textContent =
      `Total for ${count || 0} card${count === 1 ? "" : "s"}`;
  };
  $("#positionState").addEventListener("change", () => {
    syncState();
    updateTotal();
  });
  form.addEventListener("input", updateTotal);
  $("#positionCancel").addEventListener("click", closeSheet);
  syncState();
  updateTotal();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const continueAdding = event.submitter?.value === "continue";
    const formInput = values();
    const breakdown = acquisitionFromTotal(
      formInput.totalAcquisitionCost,
      formInput.quantity,
    );
    if (!breakdown) {
      $("#positionError").textContent = "Enter a valid total acquisition cost.";
      return;
    }
    const input = {
      ...formInput,
      ...breakdown,
      quantity: Number(formInput.quantity),
    };
    delete input.saveMode;
    input.grade =
      input.cardState === "graded" ? normalizeGrade(input.grade) : null;
    input.grader =
      input.cardState === "graded"
        ? normalizeGrader(input.grader).normalized
        : null;
    const validation = validateAcquisition(input, today);
    if (!validation.valid) {
      $("#positionError").textContent = Object.values(validation.errors)[0];
      return;
    }
    const submits = $$('button[type="submit"]', form);
    submits.forEach((button) => (button.disabled = true));
    $("#positionError").textContent = "Saving securely…";
    let itemId;
    try {
      itemId = await createPosition(supabase, {
        ...input,
        identity: identitySnapshot(card, input.variant),
        cardId: card.cardId || null,
        variantId: card.variantId || null,
        idempotencyKey: crypto.randomUUID(),
        currency: "USD",
      });
    } catch (error) {
      $("#positionError").textContent = error.message?.includes("future")
        ? "Acquisition dates cannot be later than today."
        : `Could not add this card: ${error.message || "Unknown error"}`;
      submits.forEach((button) => (button.disabled = false));
      return;
    }
    if (options.queueEntryId) {
      state.intakeQueue = state.intakeQueue.filter(
        (entry) => entry.queueEntryId !== options.queueEntryId,
      );
      renderIntakeQueueBar();
    }
    closeSheet({ discardHistory: true });
    if (continueAdding) {
      try {
        await reloadPortfolio();
      } catch {
        toast("Saved · library refresh will retry automatically");
      }
      if (options.queueEntryId && state.intakeQueue.length) {
        openIntakeQueueSheet();
        toast("Saved · choose the next queued card");
      } else {
        routeTo("scan");
        const search = $("#quickCardSearch");
        search.focus();
        search.select();
        toast(
          options.queueEntryId
            ? "Queue complete · search for more"
            : "Saved · search for the next card",
        );
      }
    } else {
      toast("Added to your library");
      try {
        await reloadPortfolio(itemId);
      } catch {
        routeTo("collection");
        toast("Saved · library refresh will retry automatically");
      }
    }
  });
}

function openPurchaseLotSheet(item) {
  const today = localIsoDate();
  const sealed = item.cardState === "sealed";
  const noun = sealed ? "product" : "card";
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">Add purchase lot</h2><p>${esc(item.name)} · ${esc(item.gradingCompany ? `${item.gradingCompany} ${item.grade}` : item.condition)} · each purchase remains separate</p></div><button class="sheet-close" aria-label="Close">×</button></div>
    <form id="purchaseLotForm"><div class="form-grid">
      <div class="field"><label for="lotQuantity">How many ${noun}s?</label><input id="lotQuantity" name="quantity" type="number" inputmode="numeric" min="1" max="99999" step="1" value="1" required></div>
      <div class="field"><label for="lotDate">When did you buy them?</label><input id="lotDate" name="transactionDate" type="date" max="${today}" value="${today}" required></div>
      <div class="field full acquisition-field"><label for="lotTotalCost">Total acquisition cost</label><div class="money-input"><span>$</span><input id="lotTotalCost" name="totalAcquisitionCost" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" required></div><small>Enter everything you paid for this purchase as one total.</small></div>
      <p class="form-error" id="purchaseLotError" role="alert"></p>
    </div><div class="position-total"><span id="purchaseLotSummary">Total for 1 card</span><strong id="purchaseLotTotal">$0.00</strong></div>
    <section class="blended-purchase" aria-labelledby="blendedPurchaseTitle"><div class="blended-purchase-head"><span>Position preview</span><strong id="blendedPurchaseTitle">After this purchase</strong></div><div class="blended-purchase-grid" id="blendedPurchaseGrid" aria-live="polite"></div><small>Uses your remaining FIFO basis and the current exact market reference. This purchase still stays as its own lot.</small></section>
    <div class="sheet-actions"><button class="secondary" type="button" id="purchaseLotCancel">Cancel</button><button class="primary" type="submit">Save purchase</button></div></form>`);
  const form = $("#purchaseLotForm");
  const values = () => Object.fromEntries(new FormData(form).entries());
  const updateTotal = () => {
    const input = values();
    const breakdown = acquisitionFromTotal(
      input.totalAcquisitionCost,
      input.quantity,
    );
    const count = Number(input.quantity) || 0;
    const currency = item.currency || "USD";
    $("#purchaseLotTotal").textContent =
      breakdown === null
        ? "Enter an amount"
        : money(breakdown.totalMinor / 100, currency);
    $("#purchaseLotSummary").textContent =
      `Total for ${count || 0} ${noun}${count === 1 ? "" : "s"}`;
    const preview = breakdown
      ? blendedPosition({
          currentQuantity: item.quantity,
          currentCostBasis: item.costBasis,
          newQuantity: count,
          newTotalCost: breakdown.totalMinor / 100,
          currentUnitPrice: item.price,
        })
      : null;
    $("#blendedPurchaseGrid").innerHTML = preview
      ? `<div><span>${sealed ? "Products" : "Cards"} owned</span><strong>${preview.quantity}</strong><small>was ${Number(item.quantity)}</small></div><div><span>Total basis</span><strong>${money(preview.costBasisMinor / 100, currency)}</strong><small>includes this purchase</small></div><div><span>Average cost</span><strong>${money(preview.averageCostMinor / 100, currency)}</strong><small>${preview.averageChangeMinor === 0 ? "unchanged" : `${preview.averageChangeMinor < 0 ? "down" : "up"} ${money(Math.abs(preview.averageChangeMinor) / 100, currency)} per ${noun}`}</small></div><div><span>Gain / loss now</span><strong>${preview.unrealizedGainMinor === null ? "Price unavailable" : `${preview.unrealizedGainMinor >= 0 ? "+" : ""}${money(preview.unrealizedGainMinor / 100, currency)}`}</strong><small>${preview.marketValueMinor === null ? "needs an exact market price" : `${money(preview.marketValueMinor / 100, currency)} current value`}</small></div>`
      : `<div class="blended-purchase-empty">${item.costBasis === null || item.costBasis === undefined ? "Current cost basis is incomplete, so Mica cannot calculate a blended average yet." : "Enter the purchase quantity and total cost to preview the new position."}</div>`;
  };
  form.addEventListener("input", updateTotal);
  $("#purchaseLotCancel").addEventListener("click", closeSheet);
  updateTotal();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formInput = values();
    const breakdown = acquisitionFromTotal(
      formInput.totalAcquisitionCost,
      formInput.quantity,
    );
    if (!breakdown) {
      $("#purchaseLotError").textContent =
        "Enter a valid total acquisition cost.";
      return;
    }
    const input = {
      ...formInput,
      ...breakdown,
      cardState: item.cardState,
      rawCondition: item.cardState === "raw" ? item.rawCondition : null,
      grader: item.cardState === "graded" ? item.gradingCompany : null,
      grade: item.cardState === "graded" ? item.grade : null,
      quantity: Number(formInput.quantity),
    };
    const validation = validateAcquisition(input, today);
    if (!validation.valid) {
      $("#purchaseLotError").textContent = Object.values(validation.errors)[0];
      return;
    }
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    $("#purchaseLotError").textContent = "Saving purchase…";
    try {
      await recordPurchaseLot(supabase, {
        ...input,
        collectionItemId: item.uid,
        idempotencyKey: crypto.randomUUID(),
        currency: item.currency || "USD",
      });
      closeSheet({ discardHistory: true });
      await reloadPortfolio(item.uid);
      toast("Purchase saved");
    } catch (error) {
      $("#purchaseLotError").textContent = error.message?.includes("future")
        ? "Acquisition dates cannot be later than today."
        : `Could not save this purchase: ${error.message || "Unknown error"}`;
      submit.disabled = false;
    }
  });
}

function openCompletePurchaseHistorySheet(item, lot) {
  if (!lot) return;
  const today = localIsoDate();
  const needsCost = !lot.costBasisKnown;
  const needsDate = !lot.acquisitionDateKnown;
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Complete purchase history</h2><p>${esc(item.name)} · ${lot.quantityAcquired} originally acquired</p></div><button class="sheet-close" aria-label="Close">×</button></div><form id="completePurchaseHistoryForm"><div class="form-grid">${needsCost ? `<div class="field full acquisition-field"><label for="missingAcquisitionCost">Total acquisition cost <span class="optional-label">Add if known</span></label><div class="money-input"><span>$</span><input id="missingAcquisitionCost" name="totalAcquisitionCost" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00"></div><small>Enter everything paid for all ${lot.quantityAcquired} in this purchase. Mica will update remaining and already-sold FIFO basis.</small></div>` : ""}${needsDate ? `<div class="field full"><label for="missingAcquisitionDate">Original purchase date <span class="optional-label">Add if known</span></label><input id="missingAcquisitionDate" name="acquiredAt" type="date" max="${today}"><small>The import fallback date is used only for FIFO order until you add the real date.</small></div>` : ""}<p class="form-error" id="completePurchaseHistoryError" role="alert"></p></div><div class="info-copy"><p>Add only facts you know. You can save one field now and return for the other later.</p></div><div class="sheet-actions"><button class="secondary" type="button" id="completePurchaseHistoryCancel">Cancel</button><button class="primary" type="submit">Save known details</button></div></form>`,
  );
  $("#completePurchaseHistoryCancel").addEventListener("click", closeSheet);
  $("#completePurchaseHistoryForm").addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(
        new FormData(event.currentTarget).entries(),
      );
      const totalAcquisitionCost =
        needsCost && data.totalAcquisitionCost !== ""
          ? Number(data.totalAcquisitionCost)
          : null;
      const acquiredAt = needsDate && data.acquiredAt ? data.acquiredAt : null;
      if (totalAcquisitionCost === null && !acquiredAt) {
        $("#completePurchaseHistoryError").textContent =
          "Add a total acquisition cost or the original purchase date.";
        return;
      }
      if (
        totalAcquisitionCost !== null &&
        (!Number.isFinite(totalAcquisitionCost) || totalAcquisitionCost < 0)
      ) {
        $("#completePurchaseHistoryError").textContent =
          "Enter a valid total acquisition cost.";
        return;
      }
      if (acquiredAt && acquiredAt > today) {
        $("#completePurchaseHistoryError").textContent =
          "Acquisition dates cannot be later than today.";
        return;
      }
      const submit = event.currentTarget.querySelector('[type="submit"]');
      submit.disabled = true;
      $("#completePurchaseHistoryError").textContent =
        "Updating purchase history…";
      try {
        await completeUnknownPurchaseLot(supabase, {
          purchaseLotId: lot.id,
          totalAcquisitionCost,
          acquiredAt,
        });
        closeSheet({ discardHistory: true });
        await reloadPortfolio(item.uid);
        toast("Purchase history updated");
      } catch (error) {
        const message = String(error.message || "");
        $("#completePurchaseHistoryError").textContent = message.includes(
          "already_known",
        )
          ? "This purchase was already updated. Refresh and try again."
          : message.includes("future")
            ? "Acquisition dates cannot be later than today."
            : `Could not update this purchase: ${message || "Unknown error"}`;
        submit.disabled = false;
      }
    },
  );
}

function openGradingSubmissionSheet(item, submission = null) {
  const today = localIsoDate();
  const editing = Boolean(submission);
  const latestAcquisition =
    (item.lots || [])
      .map((lot) => lot.acquiredAt)
      .filter(Boolean)
      .sort()
      .at(-1) || "";
  const statuses = [
    ["submitted", "Sent to grader"],
    ["received", "Received by grader"],
    ["grading", "Grading in progress"],
    ["assembly", "Slab assembly"],
    ["shipped", "Return shipped"],
  ];
  const currentIndex = Math.max(
    0,
    statuses.findIndex(([value]) => value === submission?.status),
  );
  const availableStatuses = statuses.slice(currentIndex);
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">${editing ? "Update grading submission" : "Send to grading"}</h2><p>${esc(item.name)} · ${item.quantity} raw card${item.quantity === 1 ? "" : "s"} · private manual tracking</p></div><button class="sheet-close" aria-label="Close">×</button></div><form id="gradingSubmissionForm"><div class="form-grid">
    ${editing ? `<div class="field"><label for="submissionStatus">Current stage</label><select id="submissionStatus" name="status" required>${availableStatuses.map(([value, label]) => `<option value="${value}" ${value === submission.status ? "selected" : ""}>${label}</option>`).join("")}<option value="cancelled">Cancel submission</option></select></div><div class="field"><label for="submissionStatusDate">Status date</label><input id="submissionStatusDate" name="statusUpdatedAt" type="date" min="${esc(submission.submittedAt)}" max="${today}" value="${today}" required></div>` : `<div class="field"><label for="submissionGrader">Grading company</label><select id="submissionGrader" name="grader" required><option value="">Choose grader</option>${["PSA", "BGS", "CGC", "TAG", "SGC"].map((value) => `<option>${value}</option>`).join("")}</select></div><div class="field"><label for="submissionSentDate">Date sent</label><input id="submissionSentDate" name="submittedAt" type="date" min="${esc(latestAcquisition)}" max="${today}" value="${today}" required></div>`}
    <div class="field"><label for="submissionExpectedDate">Expected return <span class="optional-label">Optional</span></label><input id="submissionExpectedDate" name="expectedReturnDate" type="date" min="${esc(editing ? submission.submittedAt : latestAcquisition || today)}" value="${esc(submission?.expectedReturnDate || "")}"></div>
    ${editing ? "" : `<div class="field"><label for="submissionEstimatedCost">Estimated all-in cost <span class="optional-label">Planning only</span></label><div class="money-input"><span>$</span><input id="submissionEstimatedCost" name="estimatedTotalCost" type="number" inputmode="decimal" min="0" step="0.01" value="" placeholder="0.00"></div></div>`}
    <div class="field full"><label for="submissionReference">Submission reference <span class="optional-label">Optional</span></label><input id="submissionReference" name="submissionReference" maxlength="120" value="${esc(submission?.submissionReference || "")}" autocomplete="off" placeholder="Order or submission number"></div>
    <div class="field full"><label for="submissionNotes">Notes <span class="optional-label">Optional</span></label><textarea id="submissionNotes" name="notes" maxlength="10000" placeholder="Service level, middleman, shipping, or status details">${esc(submission?.notes || "")}</textarea></div>
    <p class="form-error" id="gradingSubmissionError" role="alert"></p>
  </div><div class="warning-panel"><strong>${editing ? "Status is manual" : "All current copies in this position are included"}.</strong><p>${editing ? "Mica does not claim a live connection to the grader. Choose only a stage you have verified. Recording the returned grade closes this submission automatically." : "Purchases and sales for this position pause while the cards are away. Estimated cost is not counted as paid or added to profit; enter the actual all-in total when the cards return."}</p></div><div class="sheet-actions"><button class="secondary" type="button" id="gradingSubmissionCancel">Close</button><button class="primary" type="submit">${editing ? "Save status" : "Start tracking"}</button></div></form>`);
  $("#gradingSubmissionCancel").addEventListener("click", closeSheet);
  $("#gradingSubmissionForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const submit = event.currentTarget.querySelector('[type="submit"]');
    if (editing) {
      if (
        data.statusUpdatedAt > today ||
        data.statusUpdatedAt < submission.submittedAt
      ) {
        $("#gradingSubmissionError").textContent =
          "The status date must be between the submission date and today.";
        return;
      }
      if (
        data.expectedReturnDate &&
        data.expectedReturnDate < submission.submittedAt
      ) {
        $("#gradingSubmissionError").textContent =
          "Expected return cannot be before the cards were sent.";
        return;
      }
    } else {
      const grader = normalizeGrader(data.grader).normalized;
      const estimate =
        data.estimatedTotalCost === "" ? null : Number(data.estimatedTotalCost);
      if (!grader) {
        $("#gradingSubmissionError").textContent =
          "Choose a supported grading company.";
        return;
      }
      if (
        data.submittedAt > today ||
        (latestAcquisition && data.submittedAt < latestAcquisition)
      ) {
        $("#gradingSubmissionError").textContent =
          "The sent date must be after known purchases and cannot be in the future.";
        return;
      }
      if (
        data.expectedReturnDate &&
        data.expectedReturnDate < data.submittedAt
      ) {
        $("#gradingSubmissionError").textContent =
          "Expected return cannot be before the cards were sent.";
        return;
      }
      if (estimate !== null && (!Number.isFinite(estimate) || estimate < 0)) {
        $("#gradingSubmissionError").textContent =
          "Enter a valid estimated total or leave it blank.";
        return;
      }
      data.grader = grader;
      data.estimatedTotalCost = estimate;
    }
    submit.disabled = true;
    $("#gradingSubmissionError").textContent = editing
      ? "Updating the private timeline…"
      : "Creating the private submission timeline…";
    try {
      if (editing)
        await updateGradingSubmission(supabase, {
          ...data,
          submissionId: submission.id,
        });
      else
        await recordGradingSubmission(supabase, {
          ...data,
          collectionItemId: item.uid,
          idempotencyKey: crypto.randomUUID(),
        });
      closeSheet({ discardHistory: true });
      await reloadPortfolio(item.uid);
      toast(
        editing
          ? data.status === "cancelled"
            ? "Submission cancelled · inventory unlocked"
            : "Submission status updated"
          : "Grading submission is now tracked",
      );
    } catch (error) {
      const message = String(error.message || "");
      $("#gradingSubmissionError").textContent = message.includes(
        "active_submission_exists",
      )
        ? "This position already has an active submission."
        : message.includes("status_cannot_move_backward")
          ? "Submission stages cannot move backward; add a note or cancel instead."
          : message.includes("position_not_raw")
            ? "Only an owned raw position can start a submission."
            : message.includes("before_acquisition")
              ? "The submission date cannot be before a known purchase."
              : `Could not save the submission: ${message || "Unknown error"}`;
      submit.disabled = false;
    }
  });
}

function openGradingResultSheet(item) {
  const today = localIsoDate();
  const latestAcquisition =
    (item.lots || [])
      .map((lot) => lot.acquiredAt)
      .filter(Boolean)
      .sort()
      .at(-1) || "";
  const activeSubmission = item.activeGradingSubmission || null;
  const earliestReturn =
    [latestAcquisition, activeSubmission?.submittedAt || ""]
      .filter(Boolean)
      .sort()
      .at(-1) || "";
  const basisReady =
    (item.lots || []).length > 0 &&
    (item.lots || []).every((lot) => lot.costBasisKnown);
  const batchNote =
    Number(item.quantity) > 1
      ? "Every copy in this position must have the same grader and grade. Leave certification blank unless one number represents the whole position. Use separate positions when results differ."
      : "The original purchase stays in place; this adds only the grading cost and returned slab details.";
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">Record returned grade</h2><p>${esc(item.name)} · convert this raw position without a fake sale</p></div><button class="sheet-close" aria-label="Close">×</button></div><form id="gradingResultForm"><div class="form-grid">
    <div class="field"><label for="gradingResultGrader">Grading company</label><select id="gradingResultGrader" name="grader" required>${activeSubmission ? `<option>${esc(activeSubmission.grader)}</option>` : `<option value="">Choose grader</option>${["PSA", "BGS", "CGC", "TAG", "SGC"].map((value) => `<option>${value}</option>`).join("")}`}</select></div>
    <div class="field"><label for="gradingResultGrade">Returned grade</label><input id="gradingResultGrade" name="grade" type="number" inputmode="decimal" min="1" max="10" step="0.1" placeholder="10" required></div>
    <div class="field"><label for="gradingResultDate">Return date</label><input id="gradingResultDate" name="transactionDate" type="date" min="${esc(earliestReturn)}" max="${today}" value="${today}" required></div>
    <div class="field"><label for="gradingResultCost">Total all-in grading cost</label><div class="money-input"><span>$</span><input id="gradingResultCost" name="totalGradingCost" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" required></div><small>Fees, shipping, insurance, and supplies for these ${item.quantity} card${item.quantity === 1 ? "" : "s"} as one total.</small></div>
    <div class="field full"><label for="gradingResultCert">Certification number <span class="optional-label">Optional</span></label><input id="gradingResultCert" name="certificationNumber" maxlength="120" autocomplete="off"><small>${item.quantity === 1 ? "Printed on the returned slab." : "For different certification numbers, keep each slab in a separate position."}</small></div>
    <div class="field full"><label for="gradingResultNotes">Notes <span class="optional-label">Optional</span></label><textarea id="gradingResultNotes" name="notes" maxlength="10000" placeholder="Submission or return details"></textarea></div>
    <p class="form-error" id="gradingResultError" role="alert">${basisReady ? "" : "Complete the missing acquisition cost before grading so Mica can preserve an honest basis."}</p>
  </div><div class="warning-panel"><strong>All ${item.quantity} current card${item.quantity === 1 ? "" : "s"} will become graded.</strong><p>${esc(batchNote)} Raw price observations are cleared, and the total grading cost is allocated across the remaining FIFO lots to the cent.</p></div><div class="sheet-actions"><button class="secondary" type="button" id="gradingResultCancel">Cancel</button><button class="primary" type="submit" ${basisReady ? "" : "disabled"}>Save graded result</button></div></form>`);
  $("#gradingResultCancel").addEventListener("click", closeSheet);
  $("#gradingResultForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const normalizedGrade = normalizeGrade(data.grade);
    const normalizedGrader = normalizeGrader(data.grader).normalized;
    const total = Number(data.totalGradingCost);
    if (!normalizedGrader || !normalizedGrade) {
      $("#gradingResultError").textContent =
        "Choose a supported grading company and enter a grade from 1 to 10.";
      return;
    }
    if (!Number.isFinite(total) || total < 0) {
      $("#gradingResultError").textContent =
        "Enter the total all-in grading cost.";
      return;
    }
    if (
      data.transactionDate > today ||
      (earliestReturn && data.transactionDate < earliestReturn)
    ) {
      $("#gradingResultError").textContent =
        "The return date must be after the submission and known purchases, and cannot be in the future.";
      return;
    }
    const submit = event.currentTarget.querySelector('[type="submit"]');
    submit.disabled = true;
    $("#gradingResultError").textContent =
      "Preserving the ledger and updating this position…";
    try {
      await recordGradingResult(supabase, {
        ...data,
        collectionItemId: item.uid,
        grader: normalizedGrader,
        grade: normalizedGrade,
        totalGradingCost: total,
        idempotencyKey: crypto.randomUUID(),
      });
      closeSheet({ discardHistory: true });
      await reloadPortfolio(item.uid);
      toast(
        "Returned grade recorded · submission closed · purchase history preserved",
      );
    } catch (error) {
      const message = String(error.message || "");
      $("#gradingResultError").textContent = message.includes(
        "acquisition_cost_required",
      )
        ? "Complete the missing acquisition cost first."
        : message.includes("submission_grader_mismatch")
          ? "Use the same grader recorded on the active submission."
          : message.includes("position_not_raw")
            ? "This position is already graded."
            : message.includes("position_not_owned")
              ? "Return this position to owned status before recording grading."
              : message.includes("grading_before_acquisition")
                ? "The grading date cannot be before a known purchase date."
                : `Could not record the graded result: ${message || "Unknown error"}`;
      submit.disabled = false;
    }
  });
}

function openSaleSheet(item, defaults = {}) {
  const today = localIsoDate();
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Record sale</h2><p>${esc(item.name)} · ${esc(item.gradingCompany ? `${item.gradingCompany} ${item.grade}` : item.condition)} · ${item.quantity} owned</p></div><button class="sheet-close" aria-label="Close">×</button></div><form id="saleForm"><div class="form-grid"><div class="field"><label for="saleQuantity">Quantity sold</label><input id="saleQuantity" name="quantity" type="number" min="1" max="${item.quantity}" step="1" value="${esc(defaults.quantity || "")}" required></div><div class="field"><label for="saleDate">Sale date</label><input id="saleDate" name="transactionDate" type="date" max="${today}" value="${today}" required></div><div class="field"><label for="salePrice">Unit sale price</label><input id="salePrice" name="unitPrice" type="number" min="0" step="0.01" value="${esc(defaults.unitPrice || "")}" required></div><div class="field"><label for="saleFees">Marketplace fees</label><input id="saleFees" name="marketplaceFees" type="number" min="0" step="0.01" value="${esc(defaults.marketplaceFees ?? "0.00")}"></div><div class="field"><label for="saleShipping">Shipping</label><input id="saleShipping" name="shipping" type="number" min="0" step="0.01" value="${esc(defaults.shipping ?? "0.00")}"></div><div class="field"><label for="saleOther">Other selling costs</label><input id="saleOther" name="otherCosts" type="number" min="0" step="0.01" value="${esc(defaults.otherCosts ?? "0.00")}"></div><div class="field full"><label for="saleMarketplace">Marketplace</label><input id="saleMarketplace" name="marketplace"></div><div class="field full"><label for="saleNotes">Notes</label><textarea id="saleNotes" name="notes"></textarea></div><p class="form-error" id="saleError" role="alert"></p></div><div class="warning-panel"><strong>FIFO allocation is automatic.</strong><p>The oldest remaining purchase lots will be allocated first and the allocation will remain in transaction history.</p></div><div class="sheet-actions"><button class="secondary" type="button" id="saleCancel">Cancel</button><button class="primary" type="submit">Record sale</button></div></form>`,
  );
  $("#saleCancel").addEventListener("click", closeSheet);
  $("#saleForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    if (data.transactionDate > today) {
      $("#saleError").textContent =
        "Transaction dates cannot be later than today.";
      return;
    }
    const quantity = Number(data.quantity);
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > item.quantity
    ) {
      $("#saleError").textContent =
        "Sale quantity exceeds the currently owned quantity.";
      return;
    }
    const submit = event.currentTarget.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      await recordSale(supabase, {
        ...data,
        collectionItemId: item.uid,
        quantity,
        idempotencyKey: crypto.randomUUID(),
        currency: item.currency || "USD",
      });
      closeSheet({ discardHistory: true });
      await reloadPortfolio(item.uid);
      toast("Sale recorded and oldest purchase lots allocated first");
    } catch (error) {
      $("#saleError").textContent =
        `Could not record sale: ${error.message || "Unknown error"}`;
      submit.disabled = false;
    }
  });
}

async function reloadPortfolio(focusId = null) {
  state.items = await loadPortfolio(supabase);
  state.movementStatus = "idle";
  renderCollection();
  renderInsights();
  if (focusId) {
    state.detailId = focusId;
    state.detailCard = state.items.find((item) => item.uid === focusId) || null;
    state.detailReturnRoute = "collection";
    routeTo("detail");
  }
  await refreshLivePricing();
}

async function toggleFavorite(item) {
  const originalTags = [...(item.tags || [])];
  const tags = [...originalTags];
  const index = tags.findIndex(
    (tag) => String(tag).toLowerCase() === "favorites",
  );
  if (index === -1) tags.push("Favorites");
  else tags.splice(index, 1);
  state.items = state.items.map((candidate) =>
    candidate.uid === item.uid ? { ...candidate, tags } : candidate,
  );
  state.detailCard =
    state.items.find((candidate) => candidate.uid === item.uid) ||
    state.detailCard;
  renderCollection();
  renderDetail();
  try {
    await updatePosition(supabase, item.uid, { tags });
    toast(index === -1 ? "Added to Favorites" : "Removed from Favorites");
  } catch (error) {
    state.items = state.items.map((candidate) =>
      candidate.uid === item.uid
        ? { ...candidate, tags: originalTags }
        : candidate,
    );
    state.detailCard =
      state.items.find((candidate) => candidate.uid === item.uid) ||
      state.detailCard;
    renderCollection();
    renderDetail();
    toast(`Could not update Favorites: ${error.message || "Unknown error"}`);
  }
}

function openDeleteCopySheet(item) {
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Remove position?</h2><p>${esc(item.name)} · ${esc(item.set)} ${esc(item.number)}</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="warning-panel"><strong>This removes the position, purchase lots, transactions, and FIFO allocations.</strong><p>This action cannot be undone.</p></div><div class="sheet-actions"><button class="secondary" id="keepCloudPosition" type="button">Keep position</button><button class="danger-action" id="removeCloudPosition" type="button">Remove position</button></div>`,
  );
  $("#keepCloudPosition").addEventListener("click", closeSheet);
  $("#removeCloudPosition").addEventListener("click", async () => {
    const button = $("#removeCloudPosition");
    button.disabled = true;
    try {
      await deletePosition(supabase, item.uid);
      closeSheet({ discardHistory: true });
      state.detailId = null;
      state.detailCard = null;
      state.detailCanPop = false;
      routeTo("collection");
      await reloadPortfolio();
      toast("Position and transaction history removed");
    } catch (error) {
      button.disabled = false;
      toast(`Could not remove position: ${error.message || "Unknown error"}`);
    }
  });
}

function openPositionEditSheet(item) {
  const favorite = (item.tags || []).some(
    (tag) => String(tag).toLowerCase() === "favorites",
  );
  const labels = (item.tags || []).filter(
    (tag) => String(tag).toLowerCase() !== "favorites",
  );
  const today = localIsoDate();
  const editableStatus = ["owned", "listed", "archived"].includes(item.status)
    ? item.status
    : "owned";
  const atGrader = Boolean(item.activeGradingSubmission);
  const statusOptions = atGrader
    ? '<option value="owned" selected>At grader · keep owned</option>'
    : `<option value="owned" ${editableStatus === "owned" ? "selected" : ""}>Keeping it</option><option value="listed" ${editableStatus === "listed" ? "selected" : ""}>Listed for sale</option><option value="archived" ${editableStatus === "archived" ? "selected" : ""}>Archived</option>`;
  const statusHelp = atGrader
    ? "This position stays owned while it is at the grader. Record its return or cancel the submission before listing or archiving it."
    : "Choose Listed for sale to open seller details. A recorded sale remains a separate auditable transaction.";
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Edit position details</h2><p>${esc(item.name)} · financial transactions remain auditable</p></div><button class="sheet-close" aria-label="Close">×</button></div><form id="positionEditForm"><div class="form-grid"><div class="field full"><label for="editStatus">What are you doing with it?</label><select id="editStatus" name="status">${statusOptions}</select><small>${statusHelp}</small></div><div class="listing-edit-fields full" id="listingEditFields"><div class="form-grid"><div class="field"><label for="editAskingPrice">Asking price · each</label><div class="money-input"><span>$</span><input id="editAskingPrice" name="askingPrice" type="number" inputmode="decimal" min="0" step="0.01" value="${item.askingPrice ?? ""}" placeholder="0.00"></div></div><div class="field"><label for="editListedAt">Listed date</label><input id="editListedAt" name="listedAt" type="date" max="${today}" value="${esc(item.listedAt || today)}"></div><div class="field full"><label for="editListingVenue">Where is it listed?</label><input id="editListingVenue" name="listingVenue" maxlength="100" value="${esc(item.listingVenue || "")}" placeholder="eBay, TCGplayer, card show table…"></div></div><p>Mica compares your ask with the exact current market and flags it for another review after 7 days.</p></div><div class="field full"><label for="editCertification">Certification number</label><input id="editCertification" name="certificationNumber" value="${esc(item.certificationNumber || "")}"></div><div class="field full"><label for="editLocation">Storage location</label><input id="editLocation" name="location" maxlength="250" value="${esc(item.location || "")}" placeholder="Binder 1 · Page 4"></div><div class="field full"><label for="editTags">Labels <span class="optional-label">Optional</span></label><input id="editTags" name="tags" maxlength="500" value="${esc(labels.join(", "))}" placeholder="Trade binder, Grade next, Show case"><small>Separate labels with commas. Favorites is managed from the card page.</small></div><div class="field full"><label for="editNotes">Notes</label><textarea id="editNotes" name="notes" maxlength="10000">${esc(item.notes || "")}</textarea></div><p class="form-error" id="editError" role="alert"></p></div><div class="sheet-actions"><button class="secondary" type="button" id="editCancel">Cancel</button><button class="primary" type="submit">Save details</button></div></form>`,
  );
  const syncListing = () => {
    const listed = $("#editStatus").value === "listed";
    $("#listingEditFields").hidden = !listed;
    $("#editAskingPrice").required = listed;
    $("#editListingVenue").required = listed;
    $("#editListedAt").required = listed;
  };
  $("#editStatus").addEventListener("change", syncListing);
  syncListing();
  $("#editCancel").addEventListener("click", closeSheet);
  $("#positionEditForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const tags = [
      ...new Map(
        String(data.tags || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
          .map((tag) => [tag.toLowerCase(), tag]),
      ).values(),
    ].slice(0, favorite ? 19 : 20);
    if (tags.some((tag) => tag.length > 40)) {
      $("#editError").textContent =
        "Keep each label to 40 characters or fewer.";
      return;
    }
    if (
      data.status === "listed" &&
      (data.askingPrice === "" ||
        Number(data.askingPrice) < 0 ||
        !data.listingVenue.trim())
    ) {
      $("#editError").textContent =
        "Add an asking price and listing venue so this listing is ready to manage.";
      return;
    }
    if (data.status === "listed" && data.listedAt > today) {
      $("#editError").textContent =
        "The listed date cannot be later than today.";
      return;
    }
    if (favorite) tags.unshift("Favorites");
    delete data.tags;
    const listing = data.status === "listed";
    const submit = event.currentTarget.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      await updatePosition(supabase, item.uid, {
        ...data,
        tags,
        askingPrice: listing ? data.askingPrice : null,
        listingVenue: listing ? data.listingVenue : null,
        listedAt: listing ? data.listedAt || today : null,
        priceReviewedAt: listing ? today : null,
      });
      closeSheet({ discardHistory: true });
      await reloadPortfolio(item.uid);
      toast(
        listing
          ? "Listing saved and price marked reviewed"
          : "Position details updated",
      );
    } catch (error) {
      $("#editError").textContent =
        `Could not update position: ${error.message || "Unknown error"}`;
      submit.disabled = false;
    }
  });
}

function catalogVariants(card) {
  const values = (card.variants || []).map((value) => String(value));
  const normalized = values.map((value) => normalizeIdentity(value));
  const first = normalized.some((value) => value.includes("firstedition"));
  const holo = normalized.some(
    (value) => value.includes("holo") && !value.includes("reverse"),
  );
  const reverse = normalized.some((value) => value.includes("reverse"));
  const normal = normalized.some((value) => value.includes("normal"));
  const result = [];
  if (first && holo) result.push("1st Edition Holofoil");
  if (first && (normal || !holo)) result.push("1st Edition Normal");
  if (holo) result.push("Holofoil");
  if (reverse) result.push("Reverse Holofoil");
  if (normal) result.push("Normal");
  values.forEach((value, index) => {
    if (!/(firstedition|holo|reverse|normal)/.test(normalized[index]))
      result.push(
        value
          .replace(/([a-z])([A-Z])/g, "$1 $2")
          .replace(/^./, (letter) => letter.toUpperCase()),
      );
  });
  if (!result.length && card.variant) result.push(card.variant);
  return [...new Set(result.length ? result : ["Unknown"])];
}

function openRemapPositionSheet(item) {
  let selected = null;
  let requestId = 0;
  let timer;
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Correct card or printing</h2><p>Replace catalog identity only · purchases, sales, grade, condition, and quantity stay unchanged</p></div><button class="sheet-close" aria-label="Close">×</button></div><form id="remapPositionForm"><div class="form-grid"><label class="search-field full"><span class="sr-only">Search the correct card</span><input id="remapQuery" type="search" value="${esc(`${item.name} ${item.number || ""}`.trim())}" placeholder="Card name, set, or collector number" autocomplete="off"></label><div class="field full"><label for="remapLanguage">Card language</label><select id="remapLanguage">${["en", "ja", "fr", "de", "es", "it", "pt", "zh-tw", "id", "th"].map((code) => `<option value="${code}" ${code === (item.language || "en") ? "selected" : ""}>${esc(languageName(code))}</option>`).join("")}</select></div></div><div class="manual-results" id="remapResults" aria-live="polite"></div><div class="simple-note" id="remapChoice" hidden></div><p class="form-error" id="remapError" role="alert"></p><div class="warning-panel"><strong>Financial history is preserved.</strong><p>Only the catalog match changes. Old price observations are cleared so values from the wrong card or printing cannot remain in this position.</p></div><div class="sheet-actions"><button class="secondary" id="remapCancel" type="button">Cancel</button><button class="primary" id="remapSave" type="submit" disabled>Use selected match</button></div></form>`,
  );
  const renderResults = (cards) => {
    selected = null;
    $("#remapSave").disabled = true;
    $("#remapChoice").hidden = true;
    $("#remapResults").innerHTML = cards.length
      ? cards
          .map(
            (card, index) =>
              `<button class="catalog-result" type="button" data-remap-result="${index}"><img src="${esc(card.thumb || card.image || "./icons/icon.svg")}" alt=""><span><strong>${esc(card.name)}</strong>${esc(card.set)} · ${esc(card.number)}<small>${esc(languageName(card.language))} · ${esc(card.rarity || "Rarity unavailable")}</small>${matchReason(card)}</span><b>Select</b></button>`,
          )
          .join("")
      : '<div class="unavailable-panel">No exact catalog matches found. Try fewer details or verify the language.</div>';
    $$("[data-remap-result]", $("#remapResults")).forEach((button) =>
      button.addEventListener("click", () => {
        selected = cards[Number(button.dataset.remapResult)];
        const variants = catalogVariants(selected);
        $("#remapChoice").hidden = false;
        $("#remapChoice").innerHTML =
          `<strong>Selected: ${esc(selected.name)} · ${esc(selected.set)} ${esc(selected.number)}</strong><br><label for="remapVariant">Exact printing</label><select id="remapVariant">${variants.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}</select>`;
        $("#remapSave").disabled = false;
        $$("[data-remap-result]", $("#remapResults")).forEach((row) =>
          row.setAttribute("aria-pressed", String(row === button)),
        );
      }),
    );
  };
  const search = async () => {
    const query = $("#remapQuery").value.trim();
    const current = ++requestId;
    if (query.length < 2) {
      $("#remapResults").innerHTML =
        '<div class="unavailable-panel">Type at least two characters.</div>';
      return;
    }
    $("#remapResults").setAttribute("aria-busy", "true");
    $("#remapResults").innerHTML =
      '<div class="searching-cards"><i></i><span>Finding exact printings…</span></div>';
    try {
      const result = await searchCatalog(query, $("#remapLanguage").value, 12);
      if (current !== requestId) return;
      renderResults(result.items);
    } catch {
      if (current === requestId)
        $("#remapResults").innerHTML =
          '<div class="unavailable-panel">Catalog search is temporarily unavailable. Your position is unchanged.</div>';
    } finally {
      if (current === requestId)
        $("#remapResults").setAttribute("aria-busy", "false");
    }
  };
  $("#remapQuery").addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(search, 250);
  });
  $("#remapLanguage").addEventListener("change", search);
  $("#remapCancel").addEventListener("click", closeSheet);
  $("#remapPositionForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selected || !$("#remapVariant")) return;
    const submit = $("#remapSave");
    submit.disabled = true;
    $("#remapError").textContent = "Updating the exact match…";
    const variant = $("#remapVariant").value;
    try {
      await remapCollectionPosition(supabase, {
        collectionItemId: item.uid,
        identity: identitySnapshot(selected, variant),
        cardId: selected.cardId || null,
        variantId: selected.variantId || null,
      });
      closeSheet({ discardHistory: true });
      await reloadPortfolio(item.uid);
      toast("Catalog match corrected · pricing history restarted");
    } catch (error) {
      submit.disabled = false;
      $("#remapError").textContent =
        `Could not correct this match: ${error.message || "Unknown error"}`;
    }
  });
  void search();
}

function openSheet(content, trigger = document.activeElement) {
  const wasOpen = !$("#bottomSheet").hidden;
  if (!wasOpen) state.lastFocus = trigger;
  if (!wasOpen && trigger?.setAttribute)
    trigger.setAttribute("aria-expanded", "true");
  $("#sheetContent").innerHTML = content;
  $("#sheetBackdrop").hidden = false;
  $("#bottomSheet").hidden = false;
  $("#appShell").inert = true;
  $("#appShell").setAttribute("aria-hidden", "true");
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() =>
    $(".sheet-close, input, button", $("#sheetContent"))?.focus(),
  );
  $$(".sheet-close").forEach((button) =>
    button.addEventListener("click", closeSheet),
  );
  if (!wasOpen) {
    history.pushState({ route: state.route, sheet: true }, "", location.href);
    state.sheetHistory = true;
  }
}
function closeSheet(options = {}) {
  if ($("#bottomSheet").dataset.lockClose === "true" && !options.force) return;
  $("#sheetBackdrop").hidden = true;
  $("#bottomSheet").hidden = true;
  document.body.style.overflow = "";
  $("#appShell").inert = false;
  $("#appShell").removeAttribute("aria-hidden");
  state.lastFocus?.setAttribute?.("aria-expanded", "false");
  state.lastFocus?.focus?.();
  const shouldPop =
    state.sheetHistory && !options.fromHistory && !options.discardHistory;
  if (state.sheetHistory && options.discardHistory)
    history.replaceState(
      { route: state.route },
      "",
      state.route === "collection"
        ? `${location.pathname}${location.search}`
        : `#${state.route}`,
    );
  state.sheetHistory = false;
  if (shouldPop) history.back();
}

function handleDialogKeydown(event) {
  if ($("#bottomSheet").hidden) return;
  if (event.key === "Escape") {
    closeSheet();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = $$(
    "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]",
    $("#bottomSheet"),
  ).filter((node) => node.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function openFilterSheet() {
  const source =
    state.ledgerView === "watchlist" ? state.watchlist : state.items;
  const sets = [
    ...new Set(source.map((item) => item.set).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
  const labels = [
    ...new Map(
      source
        .flatMap((item) => item.tags || [])
        .filter((tag) => String(tag).toLowerCase() !== "favorites")
        .map((tag) => [String(tag).toLowerCase(), String(tag)]),
    ).values(),
  ].sort((a, b) => a.localeCompare(b));
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">Filter & sort</h2><p>Choose which cards you want to see.</p></div><button class="sheet-close" aria-label="Close">×</button></div>
    <div class="field"><label for="sheetView">Show</label><select id="sheetView"><option value="all">All items</option><option value="favorites">Favorites only</option><option value="graded">Graded only</option><option value="unpriced">Needs pricing review</option><option value="for-sale">For sale</option><option value="watchlist">Watchlist</option><option value="sets">Set progress</option></select></div>
    <div class="field"><label for="sheetSet">Set</label><select id="sheetSet"><option value="">Every set</option>${sets.map((set) => `<option value="${esc(set)}">${esc(set)}</option>`).join("")}</select></div>
    <div class="field"><label for="sheetCondition">Condition</label><select id="sheetCondition"><option value="">Every condition</option><option>Raw</option><option>Graded</option><option>Sealed</option>${["Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"].map((value) => `<option>${value}</option>`).join("")}</select></div>
    <div class="field"><label for="sheetLabel">Label</label><select id="sheetLabel"><option value="">Every label</option>${labels.map((label) => `<option value="${esc(label)}">${esc(label)}</option>`).join("")}</select></div>
    <div class="field"><label for="sheetSort">Sort by</label><select id="sheetSort"><option value="value-desc">Value, high to low</option><option value="name">Name, A to Z</option></select></div>
    <div class="sheet-actions"><button class="secondary" id="resetSheet">Reset</button><button class="primary" id="applySheet">Apply filters</button></div>`);
  $("#sheetView").value = state.ledgerView;
  $("#sheetSet").value = state.setFilter;
  $("#sheetCondition").value = state.conditionFilter;
  $("#sheetLabel").value = state.labelFilter;
  $("#sheetSort").value = state.sort;
  $("#resetSheet").addEventListener("click", () => {
    state.ledgerView = "all";
    state.setFilter = "";
    state.conditionFilter = "";
    state.labelFilter = "";
    state.sort = "value-desc";
    state.query = "";
    $("#collectionSearch").value = "";
    closeSheet();
    syncTabs();
    renderCollection();
  });
  $("#applySheet").addEventListener("click", () => {
    state.ledgerView = $("#sheetView").value;
    state.setFilter = $("#sheetSet").value;
    state.conditionFilter = $("#sheetCondition").value;
    state.labelFilter = $("#sheetLabel").value;
    state.sort = $("#sheetSort").value;
    closeSheet();
    syncTabs();
    renderCollection();
    toast("Collection view updated");
  });
}

function openMethodSheet() {
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">How your value is calculated</h2><p>Simple and transparent.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="info-copy"><p><strong>Collection value</strong> is each card's matching market price multiplied by how many you own.</p><p><strong>Known gain/loss</strong> uses only copies that have both a matching market price and a recorded purchase cost. A blank cost is unknown, never treated as free.</p><p>Raw and graded cards are kept separate. We also match the printing and condition whenever the source supports it.</p><p>Cards without a reliable matching price stay in your library but are not counted in the total.</p></div>`,
  );
}

function showProcessing(file) {
  const url = URL.createObjectURL(file);
  $("#capturePreview").innerHTML =
    `<img src="${url}" alt="Selected card photograph">`;
  let loadedImages = 0;
  const releaseUrl = () => {
    loadedImages += 1;
    if (loadedImages === 2) URL.revokeObjectURL(url);
  };
  $("#capturePreview img").addEventListener("load", releaseUrl, { once: true });
  $("#qualityChip").innerHTML = "<span></span> Photo ready";
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Photo ready</h2><p>Use the visible card details to find the exact printing.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="photo-assist"><img id="photoAssistImage" src="${url}" alt="Selected card photograph"><p><strong>Mica will not guess from this image.</strong> Automated image recognition is not connected in this build. Search the name, set, or collector number and confirm the matching card.</p></div><div class="sheet-actions"><button class="secondary" id="photoAssistCancel" type="button">Choose another</button><button class="primary" id="photoAssistSearch" type="button">Search card details</button></div>`,
  );
  $("#photoAssistImage").addEventListener("load", releaseUrl, { once: true });
  $("#photoAssistCancel").addEventListener("click", closeSheet);
  $("#photoAssistSearch").addEventListener("click", () => {
    closeSheet();
    routeTo("scan");
    setTimeout(() => $("#quickCardSearch").focus(), 0);
    toast("Enter the name, set, or number shown on the card");
  });
}

function catalogItem(item) {
  return {
    ...item,
    variant: item.variants?.includes("holo")
      ? "Holofoil"
      : item.variants?.includes("normal")
        ? "Normal"
        : item.variants?.includes("reverse")
          ? "Reverse Holofoil"
          : item.variants?.[0] || "Unknown",
    price: null,
    move: null,
    cost: null,
    quantity: 1,
    condition: "Near Mint",
    gradingCompany: "",
    grade: "",
    tags: [],
    location: "",
    notes: "",
    pricingStatus: "loading",
  };
}

function rememberCatalogItems(items) {
  for (const item of items) {
    const index = catalog.findIndex((existing) => existing.id === item.id);
    if (index === -1) catalog.push(item);
    else catalog[index] = { ...catalog[index], ...item };
  }
}

async function searchCatalog(query, language, limit = 12) {
  const response = await fetch(
    `/api/catalog?q=${encodeURIComponent(query)}&language=${encodeURIComponent(language)}&limit=${limit}`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) throw new Error("catalog");
  const payload = await response.json();
  const items = (payload.cards || []).map(catalogItem);
  rememberCatalogItems(items);
  return { items, parsedQuery: payload.parsedQuery || null };
}

function matchReason(item) {
  if (!item.match?.reasons?.length) return "";
  return `<small class="match-reason"><strong>${esc(item.match.confidence || "Possible match")}</strong> · ${esc(item.match.reasons.slice(0, 3).join(" · "))}</small>`;
}

function ownedSearchStatus(item) {
  const owned = ownedCardSummary(item, state.items);
  if (!owned.quantity) return "";
  return `<small class="owned-search-status"><strong>In your library</strong> · ${owned.quantity} card${owned.quantity === 1 ? "" : "s"}${owned.positions > 1 ? ` across ${owned.positions} conditions or grades` : ""}</small>`;
}

function setFilterMarkup(results, selected = "") {
  const sets = [
    ...new Set(results.map((item) => item.set).filter(Boolean)),
  ].slice(0, 5);
  if (results.length < 6 || sets.length < 2) return "";
  return `<div class="result-filters" role="group" aria-label="Filter search results by set"><button type="button" data-result-set="" aria-pressed="${String(!selected)}">All</button>${sets.map((set) => `<button type="button" data-result-set="${esc(set)}" aria-pressed="${String(selected === set)}">${esc(set)}</button>`).join("")}</div>`;
}

function openManualSearch() {
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Search catalog</h2><p>Use a name, set, number, rarity, finish, or any combination.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="form-grid"><label class="search-field"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg><input id="catalogQuery" type="search" placeholder="Charizard Base Set 4/102" aria-label="Search catalog by card details"></label><div class="field"><label for="catalogLanguage">Language</label><select id="catalogLanguage"><option value="en">English</option><option value="ja">Japanese</option><option value="fr">French</option><option value="de">German</option><option value="es">Spanish</option><option value="it">Italian</option><option value="pt">Portuguese</option><option value="zh-tw">Traditional Chinese</option><option value="id">Indonesian</option><option value="th">Thai</option></select></div></div><div class="manual-results" id="manualResults" aria-live="polite"><div class="unavailable-panel">Type at least two characters to search.</div></div>`,
  );
  const input = $("#catalogQuery");
  const language = $("#catalogLanguage");
  let timer;
  let requestId = 0;
  let allResults = [];
  let selectedSet = "";
  const bindResults = () => {
    const visible = selectedSet
      ? allResults.filter((item) => item.set === selectedSet)
      : allResults;
    $("#manualResults").innerHTML = allResults.length
      ? `${setFilterMarkup(allResults, selectedSet)}${visible
          .map((item) => {
            const owned = ownedCardSummary(item, state.items);
            return `<button class="catalog-result" type="button" data-catalog-id="${esc(item.id)}" aria-label="Review ${esc(item.name)} from ${esc(item.set)}, number ${esc(item.number)}${owned.quantity ? `, ${owned.quantity} already owned` : ""}"><img src="${esc(item.thumb || "")}" alt="${esc(item.name)} card"><span><strong>${esc(item.name)}</strong>${esc(item.set || "Set unavailable")} · ${esc(item.number)}<small>${esc(item.rarity || "Rarity unavailable")} · ${esc(languageName(item.language || language.value))} · ${esc(item.variant)}</small>${ownedSearchStatus(item)}${matchReason(item)}</span><b>${owned.quantity ? "Owned" : "Review"}</b></button>`;
          })
          .join("")}`
      : '<div class="unavailable-panel">No catalog matches found. Try fewer details or verify the language.</div>';
    $$("[data-result-set]", $("#manualResults")).forEach((button) =>
      button.addEventListener("click", () => {
        selectedSet = button.dataset.resultSet;
        bindResults();
      }),
    );
    $$("[data-catalog-id]", $("#manualResults")).forEach((button) =>
      button.addEventListener("click", () => {
        const card = catalog.find(
          (item) => item.id === button.dataset.catalogId,
        );
        closeSheet({ discardHistory: true });
        openCardDetail(card);
      }),
    );
  };
  const renderResults = async () => {
    const q = input.value.trim();
    const current = ++requestId;
    if (q.length < 2) {
      $("#manualResults").innerHTML =
        '<div class="unavailable-panel">Type at least two characters to search.</div>';
      return;
    }
    $("#manualResults").setAttribute("aria-busy", "true");
    $("#manualResults").innerHTML =
      '<div class="unavailable-panel">Searching exact printings…</div>';
    try {
      const result = await searchCatalog(q, language.value, 12);
      if (current !== requestId) return;
      allResults = result.items;
      selectedSet = "";
      bindResults();
    } catch {
      if (current === requestId)
        $("#manualResults").innerHTML =
          '<div class="unavailable-panel">Catalog search is temporarily unavailable.</div>';
    } finally {
      if (current === requestId)
        $("#manualResults").setAttribute("aria-busy", "false");
    }
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(renderResults, 250);
  };
  input.addEventListener("input", schedule);
  language.addEventListener("change", renderResults);
  input.focus();
}

function openInfo(kind) {
  if (kind === "privacy") {
    openSheet(
      `<div class="sheet-heading"><div><h2 id="sheetTitle">Privacy & account deletion</h2><p>Your portfolio belongs to you.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="info-copy"><p>Collection records, transaction history, purchase lots, watchlist entries, labels, and account details are private to your signed-in account.</p><p>Download a backup before deleting if you want to keep a personal copy. Deleting the account permanently removes the account and its linked portfolio data.</p></div><div class="sheet-actions"><button class="secondary" id="privacyBackup" type="button">Download backup</button><button class="danger-action" id="startAccountDeletion" type="button">Delete account…</button></div>`,
    );
    $("#privacyBackup").addEventListener("click", downloadAccountBackup);
    $("#startAccountDeletion").addEventListener(
      "click",
      openAccountDeletionSheet,
    );
    return;
  }
  const content = {
    sources:
      "Live quotes are requested through server-side provider adapters. PkmnPrices is preferred, with JustTCG and public TCGdex pricing used only as configured fallbacks. Every quote preserves provider IDs, condition, printing, currency, timestamps, attribution, and quality metadata. Provider keys are never sent to the browser.",
    retention:
      "Original scan uploads should be private and deleted after identification or within 24 hours. Derived crops should be removed within 7 days unless the user explicitly saves one. This preview processes the image only in the browser.",
    privacy:
      "Collection records are private. Production uses Supabase Auth, ownership-based Row Level Security, private storage, data export, and an account-deletion workflow. Never place service-role credentials in the client.",
  }[kind];
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">${kind === "sources" ? "Data sources" : kind === "retention" ? "Scan retention" : "Privacy & deletion"}</h2></div><button class="sheet-close" aria-label="Close">×</button></div><p class="info-copy">${esc(content)}</p>`,
  );
}

function isInstalledApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigator.standalone === true
  );
}

function updateInstallControl() {
  const button = $("#installAppButton");
  if (!button) return;
  const installed = isInstalledApp();
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  button.disabled = installed;
  $("#installAppState").textContent = installed
    ? "Installed"
    : deferredInstallPrompt
      ? "Ready"
      : ios
        ? "How to"
        : "Options";
  $("#installAppHelp").textContent = installed
    ? "Mica is already installed on this device"
    : deferredInstallPrompt
      ? "Install with your browser’s secure app prompt"
      : ios
        ? "Use Safari’s Share menu, then Add to Home Screen"
        : "See the install steps supported by this browser";
}

function applyMotionPreference() {
  document.body.dataset.motion = motionPreference;
  const label = { auto: "Auto", reduce: "Reduce", full: "Full" }[
    motionPreference
  ];
  const help = {
    auto: "Follow your device preference · select to change",
    reduce: "Animations minimized on this device · select to change",
    full: "Use full interface motion · select to change",
  }[motionPreference];
  if ($("#motionState")) $("#motionState").textContent = label;
  if ($("#motionHelp")) $("#motionHelp").textContent = help;
}

function cycleMotionPreference() {
  const modes = ["auto", "reduce", "full"];
  motionPreference =
    modes[(modes.indexOf(motionPreference) + 1) % modes.length];
  try {
    localStorage.setItem("mica-motion-preference", motionPreference);
  } catch {}
  applyMotionPreference();
  toast(
    `Motion set to ${{ auto: "device preference", reduce: "reduced", full: "full" }[motionPreference]}`,
  );
}

function updateTargetAlertControl() {
  const button = $("#targetAlertButton");
  if (!button) return;
  const supported = "Notification" in window;
  const permission = supported ? Notification.permission : "unsupported";
  if (!supported) {
    button.disabled = true;
    $("#targetAlertState").textContent = "Unavailable";
    $("#targetAlertHelp").textContent =
      "This browser does not support notifications";
    return;
  }
  button.disabled = false;
  if (permission === "denied") {
    targetAlertsEnabled = false;
    try {
      localStorage.setItem("mica-target-alerts", "off");
    } catch {}
    $("#targetAlertState").textContent = "Blocked";
    $("#targetAlertHelp").textContent =
      "Allow notifications in browser settings to use target alerts";
    return;
  }
  $("#targetAlertState").textContent =
    targetAlertsEnabled && permission === "granted" ? "On" : "Off";
  $("#targetAlertHelp").textContent =
    targetAlertsEnabled && permission === "granted"
      ? "Alerts once when a matching price crosses each target"
      : "Alert while Mica is open and prices refresh";
}

async function notifyReachedTargets() {
  if (
    !targetAlertsEnabled ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  )
    return;
  let previous = {};
  try {
    previous = JSON.parse(
      localStorage.getItem("mica-target-alert-hits") || "{}",
    );
  } catch {}
  const { notifications, next } = targetAlertChanges(state.watchlist, previous);
  try {
    localStorage.setItem("mica-target-alert-hits", JSON.stringify(next));
  } catch {}
  for (const item of notifications) {
    const options = {
      body: `${item.name} is ${money(item.currentPrice, item.currency)} · your target is ${money(item.targetPrice, item.currency)}`,
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      tag: `mica-target-${item.watchlistId || item.id}`,
      data: { url: location.origin },
    };
    try {
      const registration = await navigator.serviceWorker?.getRegistration?.();
      if (registration?.showNotification)
        await registration.showNotification("Mica buy target reached", options);
      else new Notification("Mica buy target reached", options);
    } catch {}
  }
}

async function toggleTargetAlerts() {
  if (!("Notification" in window)) return;
  if (targetAlertsEnabled && Notification.permission === "granted") {
    targetAlertsEnabled = false;
    try {
      localStorage.setItem("mica-target-alerts", "off");
      localStorage.removeItem("mica-target-alert-hits");
    } catch {}
    updateTargetAlertControl();
    toast("Buy target alerts turned off");
    return;
  }
  let permission = Notification.permission;
  if (permission === "default")
    permission = await Notification.requestPermission();
  if (permission !== "granted") {
    targetAlertsEnabled = false;
    try {
      localStorage.setItem("mica-target-alerts", "off");
    } catch {}
    updateTargetAlertControl();
    toast("Notifications are blocked in this browser");
    return;
  }
  targetAlertsEnabled = true;
  try {
    localStorage.setItem("mica-target-alerts", "on");
    localStorage.removeItem("mica-target-alert-hits");
  } catch {}
  updateTargetAlertControl();
  toast("Buy target alerts turned on");
  void notifyReachedTargets();
}

async function openInstallExperience() {
  if (isInstalledApp()) {
    toast("Mica is already installed");
    return;
  }
  if (deferredInstallPrompt) {
    const prompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    updateInstallControl();
    toast(
      choice.outcome === "accepted"
        ? "Mica installation started"
        : "Installation canceled",
    );
    return;
  }
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const steps = ios
    ? "<ol><li>Open Mica in Safari.</li><li>Tap the Share button.</li><li>Choose Add to Home Screen, then confirm.</li></ol>"
    : "<ol><li>Open your browser menu.</li><li>Choose Install Mica, Install app, or Add to Home Screen when available.</li><li>Confirm the browser prompt.</li></ol>";
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Install Mica</h2><p>Keep your portfolio one tap away.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="info-copy">${steps}<p>Once installed, the app shell can open offline. Current prices and cloud changes still require an internet connection.</p></div><div class="sheet-actions"><button class="primary" id="installStepsDone" type="button">Got it</button></div>`,
  );
  $("#installStepsDone").addEventListener("click", closeSheet);
}

function openAccountDeletionSheet() {
  const email = state.session?.user?.email || "";
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Permanently delete account?</h2><p>This cannot be undone.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="warning-panel"><strong>Your account and linked portfolio data will be permanently removed.</strong><p>Type your account email to confirm. You can cancel without changing anything.</p></div><form id="deleteAccountForm"><div class="field"><label for="deleteAccountEmail">Type ${esc(email)}</label><input id="deleteAccountEmail" type="email" autocomplete="off" autocapitalize="none" spellcheck="false" required></div><p class="form-error" id="deleteAccountError" role="alert"></p><div class="sheet-actions"><button class="secondary" id="cancelAccountDeletion" type="button">Keep my account</button><button class="danger-action" id="confirmAccountDeletion" type="submit" disabled>Delete permanently</button></div></form>`,
  );
  const input = $("#deleteAccountEmail");
  const confirm = $("#confirmAccountDeletion");
  input.addEventListener("input", () => {
    confirm.disabled = input.value.trim().toLowerCase() !== email.toLowerCase();
  });
  $("#cancelAccountDeletion").addEventListener("click", closeSheet);
  $("#deleteAccountForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (input.value.trim().toLowerCase() !== email.toLowerCase()) return;
    confirm.disabled = true;
    input.disabled = true;
    $("#cancelAccountDeletion").disabled = true;
    $(".sheet-close").disabled = true;
    $("#deleteAccountError").textContent =
      "Deleting your account and private portfolio…";
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${state.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmation: input.value.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          result.error || `Request failed with status ${response.status}`,
        );
      await signOut(supabase);
      location.reload();
    } catch (error) {
      confirm.disabled = false;
      input.disabled = false;
      $("#cancelAccountDeletion").disabled = false;
      $(".sheet-close").disabled = false;
      $("#deleteAccountError").textContent =
        `Account was not deleted: ${error.message || "Unknown error"}`;
    }
  });
}

function downloadTextFile(content, type, filename) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function accountDataUnavailable() {
  return state.accountLoading || Boolean(state.accountLoadError);
}
function requireAccountData() {
  if (!accountDataUnavailable()) return true;
  toast("Reconnect to your cloud library before using this feature");
  return false;
}

function downloadCollectionCsv() {
  if (!requireAccountData()) return false;
  const date = localIsoDate();
  downloadTextFile(
    collectionToCsv(state.items),
    "text/csv;charset=utf-8",
    `mica-collection-${date}.csv`,
  );
  toast("Importable collection CSV downloaded");
  return true;
}

function downloadAccountBackup() {
  if (!requireAccountData()) return false;
  const exportedAt = new Date().toISOString();
  const date = exportedAt.slice(0, 10);
  const content = accountBackupJson({
    items: state.items,
    watchlist: state.watchlist,
    accountEmail: state.session?.user?.email || "",
    exportedAt,
  });
  downloadTextFile(
    content,
    "application/json;charset=utf-8",
    `mica-account-backup-${date}.json`,
  );
  toast("Complete account backup downloaded");
  return true;
}

function openInsuranceReport() {
  if (!requireAccountData()) return;
  const date = localIsoDate();
  const totals = calculateTotals(state.items);
  const documentation = insuranceDocumentation(state.items);
  const rows = [...state.items]
    .sort((a, b) => (itemValue(b) ?? -1) - (itemValue(a) ?? -1))
    .map((item) => {
      const context = item.gradingCompany
        ? `${item.gradingCompany} ${item.grade}`
        : item.condition || "Raw condition not recorded";
      const basis =
        item.costBasis === null || item.costBasis === undefined
          ? null
          : Number(item.costBasis);
      const value =
        item.price === null || item.price === undefined
          ? null
          : Number(item.price) * Number(item.quantity || 0);
      return `<article class="insurance-row"><img src="${esc(item.thumb || item.image || "./icons/icon.svg")}" alt="${esc(item.name)} catalog reference"><div class="insurance-card-main"><strong>${esc(item.name)}</strong><span>${esc(item.set)} · ${esc(item.number)} · ${esc(item.variant || "Printing unknown")}</span><small>${esc(context)} · ${Number(item.quantity) || 0} owned</small>${item.certificationNumber ? `<small>Certification ${esc(item.certificationNumber)}</small>` : ""}${item.location ? `<small>Stored at ${esc(item.location)}</small>` : ""}${item.notes ? `<p>${esc(item.notes)}</p>` : ""}</div><div class="insurance-values"><span>Acquisition<strong>${basis === null ? "Not recorded" : money(basis, item.currency)}</strong></span><span>Current reference<strong>${value === null ? "Unavailable" : money(value, item.currency)}</strong></span></div></article>`;
    })
    .join("");
  openSheet(
    `<div class="insurance-report"><div class="sheet-heading"><div><h2 id="sheetTitle">Insurance inventory report</h2><p>Private account record · ${date}</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="insurance-owner"><span>Prepared for</span><strong>${esc(state.session?.user?.email || "Mica account holder")}</strong><small>${documentation.cards} card${documentation.cards === 1 ? "" : "s"} across ${documentation.positions} position${documentation.positions === 1 ? "" : "s"}</small></div><div class="insurance-summary"><div><span>Current reference value</span><strong>${money(totals.value)}</strong><small>${totals.unpriced ? `${totals.unpriced} card${totals.unpriced === 1 ? "" : "s"} excluded without an exact price` : "Every card has a matching reference"}</small></div><div><span>Recorded acquisition basis</span><strong>${totals.costKnown ? money(totals.cost) : "Unavailable"}</strong><small>${totals.unknownCost ? `${totals.unknownCost} card${totals.unknownCost === 1 ? "" : "s"} missing cost` : "Cost recorded for every card"}</small></div></div><div class="insurance-documentation"><strong>Documentation check</strong><span>${documentation.missingLocation} position${documentation.missingLocation === 1 ? "" : "s"} missing storage · ${documentation.missingCertification} graded position${documentation.missingCertification === 1 ? "" : "s"} missing certification · ${documentation.missingPrice} missing current price</span></div><div class="insurance-list">${rows || '<div class="find-empty"><strong>No positions to report</strong><span>Add a card to your library before creating an insurance inventory.</span></div>'}</div><p class="insurance-disclaimer">Catalog images help identify printings but are not proof of ownership, authenticity, condition, or possession. Market references are estimates, not appraisals. Add your own photographs, receipts, and professional valuations to an insurer submission when required.</p><div class="sheet-actions insurance-actions"><button class="secondary" id="insuranceClose" type="button">Close</button><button class="primary" id="printInsuranceReport" type="button" ${state.items.length ? "" : "disabled"}>Print / Save PDF</button></div></div>`,
  );
  $("#insuranceClose").addEventListener("click", closeSheet);
  $("#printInsuranceReport").addEventListener("click", () => window.print());
}

function openSharePortfolioSheet() {
  if (!requireAccountData()) return;
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Share a portfolio snapshot</h2><p>Preview exactly what leaves Mica.</p></div><button class="sheet-close" aria-label="Close">×</button></div><label class="share-performance"><input id="sharePerformance" type="checkbox"> Include recorded cost basis and known gain/loss</label><pre class="share-preview" id="sharePreview"></pre><div class="simple-note"><strong>Private by default.</strong><br>Notes, storage locations, certification numbers, purchase dates, account details, and transaction history are never included.</div><div class="sheet-actions"><button class="secondary" id="copyPortfolioSnapshot" type="button">Copy summary</button>${navigator.share ? '<button class="primary" id="nativeSharePortfolio" type="button">Share…</button>' : ""}</div>`,
  );
  const text = () =>
    portfolioSnapshot(state.items, {
      includePerformance: $("#sharePerformance").checked,
    });
  const update = () => {
    $("#sharePreview").textContent = text();
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text());
      toast("Portfolio summary copied");
    } catch {
      toast("Copy is unavailable in this browser");
    }
  };
  $("#sharePerformance").addEventListener("change", update);
  $("#copyPortfolioSnapshot").addEventListener("click", copy);
  $("#nativeSharePortfolio")?.addEventListener("click", async () => {
    const button = $("#nativeSharePortfolio");
    button.disabled = true;
    try {
      await navigator.share({
        title: "My Mica Pokémon collection",
        text: text(),
      });
      toast("Portfolio snapshot shared");
    } catch (error) {
      if (error?.name !== "AbortError")
        toast("Sharing is unavailable right now");
    } finally {
      button.disabled = false;
    }
  });
  update();
}

function handleCsv(file) {
  if (!requireAccountData()) return;
  const reader = new FileReader();
  reader.onerror = () => toast("Mica could not read that CSV");
  reader.onload = () => {
    const {
      records,
      errors,
      source = "Generic CSV",
    } = parseCollectionCsv(String(reader.result));
    if (!records.length) {
      toast(errors[0] || "No importable rows found");
      return;
    }
    const errorCopy = errors.length
      ? `<div class="unavailable-panel">${errors.length} row${errors.length === 1 ? "" : "s"} will be skipped. ${esc(errors.slice(0, 3).join(" · "))}</div>`
      : "";
    const today = localIsoDate();
    const unknownCostRows = records.filter(
      (record) => record.totalAcquisitionCost == null && record.cost == null,
    ).length;
    const unknownDateRows = records.filter(
      (record) => !record.purchaseDate,
    ).length;
    const unknownCopy =
      unknownCostRows || unknownDateRows
        ? `<div class="simple-note"><strong>Mica will not invent missing history.</strong><br>${unknownCostRows ? `${unknownCostRows.toLocaleString()} row${unknownCostRows === 1 ? " has" : "s have"} no acquisition cost and will be excluded from profit and ROI. ` : ""}${unknownDateRows ? `${unknownDateRows.toLocaleString()} row${unknownDateRows === 1 ? " has" : "s have"} no purchase date; the date below controls FIFO order but remains labeled “not recorded.”` : ""}</div>`
        : "";
    openSheet(
      `<div class="sheet-heading"><div><h2 id="sheetTitle">Import ${records.length.toLocaleString()} card record${records.length === 1 ? "" : "s"}?</h2><p>${esc(source)} format detected · private cloud portfolio</p></div><button class="sheet-close" aria-label="Close">×</button></div>${errorCopy}${unknownCopy}<div class="info-copy"><p>Mica preserves exact card state, grade, variant, known purchase history, certification, labels, location, and notes. Existing positions are never overwritten. Re-importing the same rows with the same fallback date safely reuses positions already saved.</p></div><div class="field"><label for="importFallbackDate">FIFO order date for rows missing purchase dates</label><input id="importFallbackDate" type="date" max="${today}" value="${today}" required><small>This keeps inventory order deterministic. Mica still displays the original acquisition date as not recorded.</small></div><section class="import-progress" id="importProgress" aria-labelledby="importProgressTitle" hidden><div><strong id="importProgressTitle">Preparing import…</strong><span id="importProgressCount">0 of ${records.length.toLocaleString()}</span></div><progress id="importProgressBar" max="${records.length}" value="0">0%</progress><small id="importProgressHelp">You can pause after the current secure saves finish.</small></section><p class="form-error" id="importStatus" role="status" aria-live="polite"></p><div class="sheet-actions import-actions"><button class="secondary" id="cancelCsvImport" type="button">Cancel</button><button class="secondary" id="pauseCsvImport" type="button" hidden>Pause</button><button class="primary" id="addCsvImport" type="button">Add to my account</button></div>`,
    );
    const prepare = (record, index) => {
      const cardState =
        record.cardState === "sealed"
          ? "sealed"
          : record.cardState === "graded" || Boolean(record.gradingCompany)
            ? "graded"
            : "raw";
      const rawCondition =
        cardState === "raw"
          ? normalizeRawCondition(record.rawCondition || record.condition)
              .normalized
          : null;
      const grader =
        cardState === "graded"
          ? normalizeGrader(record.gradingCompany).normalized
          : null;
      const grade =
        cardState === "graded" ? normalizeGrade(record.grade) : null;
      const acquisitionDateKnown = Boolean(record.purchaseDate);
      const transactionDate =
        record.purchaseDate || $("#importFallbackDate").value;
      const total =
        record.totalAcquisitionCost ??
        (record.cost === null
          ? null
          : Number(record.cost) * Number(record.quantity));
      const acquisitionCostKnown = total !== null;
      if (
        acquisitionCostKnown &&
        (!Number.isFinite(Number(total)) || Number(total) < 0)
      )
        return {
          error: `Row ${index + 2}: purchase price or total acquisition cost is invalid`,
        };
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(transactionDate) ||
        transactionDate > today
      )
        return {
          error: `Row ${index + 2}: purchase date is invalid or in the future`,
        };
      if (cardState === "raw" && !rawCondition)
        return {
          error: `Row ${index + 2}: use Near Mint, Lightly Played, Moderately Played, Heavily Played, or Damaged`,
        };
      if (cardState === "graded" && (!grader || !grade))
        return {
          error: `Row ${index + 2}: graded cards need a valid grading company and grade`,
        };
      if (
        String(record.location || "").length > 250 ||
        String(record.notes || "").length > 10000
      )
        return {
          error: `Row ${index + 2}: location or notes exceed the safe length limit`,
        };
      const exact =
        cardState === "sealed"
          ? null
          : catalog.find((item) => item.id === record.id) ||
            (record.externalIds?.tcgplayer
              ? catalog.find(
                  (item) =>
                    String(item.externalIds?.tcgplayer || "") ===
                    String(record.externalIds.tcgplayer),
                )
              : null) ||
            catalog.find(
              (item) =>
                normalizeIdentity(item.name) ===
                  normalizeIdentity(record.name) &&
                normalizeIdentity(item.set) === normalizeIdentity(record.set) &&
                normalizeIdentity(item.number) ===
                  normalizeIdentity(record.number),
            );
      const sealedId =
        cardState === "sealed"
          ? String(record.id || "").match(/^sealed:(\d{1,12})$/)?.[1] || null
          : null;
      const card = {
        ...record,
        ...exact,
        id:
          exact?.id ||
          record.id ||
          `import:${normalizeIdentity(`${record.name}-${record.set}-${record.number}`) || "card"}`,
        language: record.language || exact?.language || "en",
        variant:
          record.variant ||
          exact?.variant ||
          (cardState === "sealed" ? "Sealed" : "Unknown"),
        productType:
          cardState === "sealed"
            ? record.productType || "sealed"
            : record.productType || exact?.productType || null,
        externalIds:
          cardState === "sealed" && sealedId
            ? { pkmnpricesSealed: Number(sealedId) }
            : { ...(exact?.externalIds || {}), ...(record.externalIds || {}) },
      };
      const breakdown = acquisitionFromTotal(
        acquisitionCostKnown ? total : 0,
        record.quantity,
      );
      const currency = /^[A-Z]{3}$/.test(record.currency || "USD")
        ? record.currency
        : "USD";
      return {
        record,
        card,
        keyRecord: {
          ...record,
          id: card.id,
          language: card.language,
          variant: card.variant,
          cardState,
          rawCondition,
          gradingCompany: grader,
          grade,
          quantity: Number(record.quantity),
          totalAcquisitionCost: acquisitionCostKnown ? Number(total) : null,
          purchaseDate: transactionDate,
          currency,
        },
        input: {
          ...breakdown,
          identity: {
            ...identitySnapshot(card, card.variant),
            acquisitionCostKnown,
            acquisitionDateKnown,
          },
          cardId: exact?.cardId || null,
          variantId: exact?.variantId || null,
          cardState,
          rawCondition,
          grader,
          grade,
          certificationNumber: record.certificationNumber || null,
          quantity: Number(record.quantity),
          transactionDate,
          currency,
          notes: record.notes || null,
        },
      };
    };
    let entries = [];
    let validationFailures = [];
    let pauseRequested = false;
    let running = false;
    const setRunning = (value) => {
      running = value;
      $("#bottomSheet").dataset.lockClose = value ? "true" : "false";
      $("#importFallbackDate").disabled = value;
      $("#cancelCsvImport").disabled = value;
      $(".sheet-close").disabled = value;
      $("#pauseCsvImport").hidden = !value;
      $("#addCsvImport").disabled = value;
    };
    const updateProgress = (active) => {
      const settled = active
        ? entries.filter((item) => item.status === "done").length +
          active.completed
        : entries.filter(
            (item) => item.status === "done" || item.status === "failed",
          ).length;
      const finished = active
        ? entries.filter((item) => item.status === "done").length +
          active.succeeded
        : entries.filter((item) => item.status === "done").length;
      const failed = active
        ? active.failed
        : entries.filter((item) => item.status === "failed").length;
      const remaining = Math.max(0, entries.length - settled);
      $("#importProgress").hidden = false;
      $("#importProgressBar").max = Math.max(entries.length, 1);
      $("#importProgressBar").value = settled;
      $("#importProgressCount").textContent =
        `${settled.toLocaleString()} of ${entries.length.toLocaleString()}`;
      $("#importProgressTitle").textContent = running
        ? pauseRequested
          ? "Finishing current secure saves…"
          : "Saving securely…"
        : remaining
          ? "Import paused"
          : "Import complete";
      $("#importProgressHelp").textContent = running
        ? `${finished.toLocaleString()} saved · ${failed.toLocaleString()} failed so far. Pause finishes current saves first.`
        : remaining
          ? `${remaining.toLocaleString()} row${remaining === 1 ? "" : "s"} ready to continue.`
          : `${finished.toLocaleString()} saved or safely recovered · ${failed.toLocaleString()} failed.`;
    };
    const finishView = async () => {
      try {
        await reloadPortfolio();
      } catch (error) {
        validationFailures.push(
          `Portfolio refresh: ${error.message || "try refreshing the page"}`,
        );
      }
      state.ledgerView = "all";
      state.query = "";
      state.setFilter = "";
      state.conditionFilter = "";
      state.labelFilter = "";
      $("#collectionSearch").value = "";
      syncTabs();
      renderCollection();
    };
    const runImport = async () => {
      if (running) return;
      const pending = entries.filter(
        (item) => item.status === "pending" || item.status === "failed",
      );
      if (!pending.length) return;
      pending.forEach((item) => {
        item.status = "pending";
        delete item.error;
      });
      pauseRequested = false;
      setRunning(true);
      updateProgress();
      const result = await runBoundedTasks(
        pending,
        async (item) => {
          const saved = await createImportedPosition(supabase, {
            ...item.input,
            idempotencyKey: item.idempotencyKey,
          });
          if (item.record.location || (item.record.tags || []).length)
            await updatePosition(supabase, saved.id, {
              location: item.record.location || "",
              tags: (item.record.tags || []).slice(0, 50),
            });
          return saved;
        },
        {
          concurrency: 4,
          shouldStop: () => pauseRequested,
          onProgress: updateProgress,
        },
      );
      result.results.forEach((outcome, index) => {
        const item = pending[index];
        if (!outcome) return;
        item.status = outcome.status === "fulfilled" ? "done" : "failed";
        if (outcome.status === "rejected")
          item.error = `${item.record.name}: ${outcome.reason?.message || "could not save"}`;
      });
      $("#pauseCsvImport").disabled = true;
      $("#importProgressTitle").textContent = "Refreshing your collection…";
      $("#importProgressHelp").textContent =
        "Your saved rows are safe. Mica is loading the updated library.";
      await finishView();
      setRunning(false);
      updateProgress();
      const remaining = entries.filter(
        (item) => item.status === "pending",
      ).length;
      const failed = entries.filter((item) => item.status === "failed");
      const done = entries.filter((item) => item.status === "done").length;
      $("#cancelCsvImport").textContent = "Close";
      $("#addCsvImport").disabled = false;
      $("#addCsvImport").textContent = remaining
        ? "Continue import"
        : failed.length
          ? "Retry failed rows"
          : "Import complete";
      $("#addCsvImport").disabled = !remaining && !failed.length;
      const issues = [
        ...validationFailures,
        ...failed.map((item) => item.error),
      ].filter(Boolean);
      $("#importStatus").textContent = remaining
        ? `${done.toLocaleString()} saved · paused with ${remaining.toLocaleString()} remaining.`
        : issues.length
          ? `${done.toLocaleString()} saved · ${issues.length.toLocaleString()} issue${issues.length === 1 ? "" : "s"}. ${issues.slice(0, 3).join(" · ")}`
          : `${done.toLocaleString()} position${done === 1 ? "" : "s"} saved. Safe to close.`;
      toast(
        remaining
          ? `Import paused · ${done.toLocaleString()} saved`
          : issues.length
            ? `${done.toLocaleString()} saved · ${issues.length.toLocaleString()} need review`
            : `${done.toLocaleString()} positions saved to your account`,
      );
    };
    $("#cancelCsvImport").addEventListener("click", closeSheet);
    $("#pauseCsvImport").addEventListener("click", () => {
      pauseRequested = true;
      $("#pauseCsvImport").disabled = true;
      updateProgress();
    });
    $("#addCsvImport").addEventListener("click", async () => {
      const fallback = $("#importFallbackDate");
      if (!fallback.reportValidity()) return;
      if (!entries.length) {
        const button = $("#addCsvImport");
        button.disabled = true;
        fallback.disabled = true;
        $("#importProgress").hidden = false;
        $("#importProgressTitle").textContent = "Preparing secure row keys…";
        $("#importProgressHelp").textContent =
          "Checking exact identity and duplicate rows before anything is saved.";
        const prepared = records.map(prepare);
        validationFailures = prepared
          .filter((item) => item.error)
          .map((item) => item.error);
        const ready = prepared.filter((item) => !item.error);
        $("#importProgressBar").max = Math.max(ready.length, 1);
        if (!ready.length) {
          button.disabled = false;
          fallback.disabled = false;
          $("#importStatus").textContent = validationFailures
            .slice(0, 3)
            .join(" · ");
          return;
        }
        const occurrences = new Map();
        try {
          for (const [index, item] of ready.entries()) {
            const baseKey = await importRecordKey(item.keyRecord);
            const occurrence = occurrences.get(baseKey) || 0;
            occurrences.set(baseKey, occurrence + 1);
            item.idempotencyKey = await importRecordKey(
              item.keyRecord,
              occurrence,
            );
            item.status = "pending";
            if (index % 25 === 0 || index === ready.length - 1) {
              $("#importProgressBar").value = index + 1;
              $("#importProgressCount").textContent =
                `${(index + 1).toLocaleString()} of ${ready.length.toLocaleString()}`;
            }
          }
        } catch {
          button.disabled = false;
          fallback.disabled = false;
          $("#importStatus").textContent =
            "This browser could not prepare secure import keys. Update the browser and try again.";
          return;
        }
        entries = ready;
        if (validationFailures.length)
          $("#importStatus").textContent =
            `${validationFailures.length} invalid row${validationFailures.length === 1 ? "" : "s"} will be skipped.`;
      }
      $("#pauseCsvImport").disabled = false;
      await runImport();
    });
  };
  reader.readAsText(file);
}

async function refreshLivePricing() {
  const uniqueItems = [
    ...new Map(
      state.items.filter((item) => item.id).map((item) => [item.id, item]),
    ).values(),
  ];
  if (!uniqueItems.length) return;
  const cardItems = uniqueItems.filter((item) => item.cardState !== "sealed");
  const sealedItems = uniqueItems.filter((item) => item.cardState === "sealed");
  const lookups = cardItems.map((item) => ({
    clientId: item.id,
    pkmnpricesId: item.externalIds?.pkmnprices || "",
    justtcgId: item.externalIds?.justtcg || "",
    tcgplayerId: item.externalIds?.tcgplayer || "",
    tcgdexId: item.externalIds?.tcgdex || "",
    name: item.name,
    set: item.set,
    number: item.number,
    language: item.language || "en",
  }));
  state.pricingStatus = "loading";
  renderCollection();
  try {
    const cards = new Map();
    const sealedProducts = new Map();
    const processedIds = new Set();
    const sealedProcessed = new Set();
    let partial = false;
    let rateLimited = false;
    let retrievedAt = null;
    for (let start = 0; start < lookups.length; start += 8) {
      const batch = lookups.slice(start, start + 8);
      const response = await fetch(
        `/api/cards?lookups=${encodeURIComponent(JSON.stringify(batch))}`,
        { headers: { Accept: "application/json" } },
      );
      if (response.status === 429) {
        rateLimited = true;
        partial = true;
        break;
      }
      if (!response.ok)
        throw new Error(`Pricing request failed with ${response.status}`);
      const payload = await response.json();
      retrievedAt = payload.retrievedAt || retrievedAt;
      batch.forEach((lookup) => processedIds.add(lookup.clientId));
      (payload.cards || []).forEach((card) =>
        cards.set(card.providerCardId, card),
      );
      partial =
        partial || Boolean(payload.partial) || payload.unavailable?.length > 0;
    }
    for (let start = 0; start < sealedItems.length; start += 5) {
      const batch = sealedItems.slice(start, start + 5);
      const results = await Promise.allSettled(
        batch.map(async (item) => {
          const id =
            item.externalIds?.pkmnpricesSealed ||
            String(item.id).replace(/^sealed:/, "");
          const response = await fetch(
            `/api/sealed?id=${encodeURIComponent(id)}`,
            { headers: { Accept: "application/json" } },
          );
          if (!response.ok) throw new Error(String(response.status));
          const payload = await response.json();
          retrievedAt = payload.retrievedAt || retrievedAt;
          return { item, product: payload.product };
        }),
      );
      results.forEach((result, index) => {
        const item = batch[index];
        sealedProcessed.add(item.id);
        if (result.status === "fulfilled" && result.value.product)
          sealedProducts.set(item.id, result.value.product);
        else partial = true;
      });
    }
    const applyPricing = (item) => {
      const sealed = item.cardState === "sealed";
      const card = sealed ? sealedProducts.get(item.id) : cards.get(item.id);
      const demoPrice = item.demoPrice ?? item.price;
      const processed = sealed
        ? sealedProcessed.has(item.id)
        : processedIds.has(item.id);
      if (!processed)
        return rateLimited
          ? {
              ...item,
              demoPrice,
              pricingStatus:
                item.price == null ? "rate_limited" : item.pricingStatus,
            }
          : item;
      if (!card)
        return {
          ...item,
          demoPrice,
          price: null,
          move: null,
          quotes: [],
          pricingStatus: "unavailable",
          pricingUpdatedAt: null,
        };
      const quote = selectReferenceQuote(
        card.quotes,
        item.variant,
        "USD",
        item,
      );
      const updated = {
        ...item,
        externalIds: {
          ...(item.externalIds || {}),
          ...(card.externalIds || {}),
        },
        metadata: card.metadata || item.metadata || null,
        productType: card.productType || item.productType || null,
        demoPrice,
        price: quote?.amount ?? null,
        quotes: card.quotes,
        historyStatus: card.historyStatus || null,
        priceHistory: quote
          ? recordPriceObservation(
              item,
              quote,
              mergePriceHistory(item.priceHistory || [], card.history || []),
            )
          : mergePriceHistory(item.priceHistory || [], card.history || []),
        pricingStatus: quote ? quoteStatus(quote) : "unavailable",
        pricingUpdatedAt:
          quote?.observedAt || quote?.retrievedAt?.slice(0, 10) || null,
      };
      const movement = movementForItem(updated);
      return { ...updated, move: movement?.changePercent ?? null, movement };
    };
    state.items = state.items.map(applyPricing);
    catalog = catalog.map((item) =>
      cards.has(item.id) ? applyPricing(item) : item,
    );
    state.pricingStatus = partial ? "partial" : "live";
    state.pricingRetrievedAt = retrievedAt;
    renderCollection();
    renderInsights();
    if (state.route === "detail") renderDetail();
    if (state.route === "insights") void refreshMovementHistory();
  } catch {
    state.pricingStatus = "error";
    state.items = state.items.map((item) => ({
      ...item,
      pricingStatus: item.price == null ? "error" : item.pricingStatus,
    }));
    renderCollection();
    renderInsights();
  }
}

async function refreshMovementHistory() {
  if (
    !["idle", "error"].includes(state.movementStatus) ||
    !state.items.some((item) => item.cardState !== "sealed")
  )
    return;
  const cardItems = [
    ...new Map(
      state.items
        .filter((item) => item.cardState !== "sealed" && item.id)
        .map((item) => [item.id, item]),
    ).values(),
  ];
  const lookups = cardItems.map((item) => ({
    clientId: item.id,
    pkmnpricesId: item.externalIds?.pkmnprices || "",
    justtcgId: item.externalIds?.justtcg || "",
    tcgplayerId: item.externalIds?.tcgplayer || "",
    tcgdexId: item.externalIds?.tcgdex || "",
    name: item.name,
    set: item.set,
    number: item.number,
    language: item.language || "en",
  }));
  state.movementStatus = "loading";
  renderInsights();
  try {
    const cards = new Map();
    let planLimited = false;
    let failed = false;
    for (let start = 0; start < lookups.length; start += 8) {
      const batch = lookups.slice(start, start + 8);
      const response = await fetch(
        `/api/cards?history=full&lookups=${encodeURIComponent(JSON.stringify(batch))}`,
        { headers: { Accept: "application/json" } },
      );
      if (!response.ok) {
        failed = true;
        continue;
      }
      const payload = await response.json();
      (payload.cards || []).forEach((card) => {
        cards.set(card.providerCardId, card);
        if (card.historyStatus === "plan_required") planLimited = true;
      });
    }
    state.items = state.items.map((item) => {
      const card = cards.get(item.id);
      if (!card) return item;
      const quote = selectReferenceQuote(
        card.quotes,
        item.variant,
        item.currency || "USD",
        item,
      );
      const updated = {
        ...item,
        externalIds: {
          ...(item.externalIds || {}),
          ...(card.externalIds || {}),
        },
        metadata: card.metadata || item.metadata || null,
        priceCapabilities:
          card.priceCapabilities || item.priceCapabilities || null,
        price: quote?.amount ?? item.price,
        quotes: card.quotes || item.quotes || [],
        historyStatus: card.historyStatus || item.historyStatus || null,
        priceHistory: recordPriceObservation(
          item,
          quote,
          mergePriceHistory(item.priceHistory || [], card.history || []),
        ),
        pricingStatus: quote ? quoteStatus(quote) : item.pricingStatus,
        pricingUpdatedAt:
          quote?.observedAt ||
          quote?.retrievedAt?.slice?.(0, 10) ||
          item.pricingUpdatedAt,
      };
      const movement = movementForItem(updated);
      return { ...updated, move: movement?.changePercent ?? null, movement };
    });
    state.movementStatus = state.items.some((item) => movementForItem(item))
      ? "live"
      : planLimited
        ? "plan_required"
        : failed
          ? "error"
          : "unavailable";
  } catch {
    state.movementStatus = "error";
  }
  renderCollection();
  renderInsights();
  if (state.route === "detail") renderDetail();
}

async function refreshWatchlistPricing() {
  const unique = [
    ...new Map(
      state.watchlist.filter((item) => item.id).map((item) => [item.id, item]),
    ).values(),
  ];
  if (!unique.length) return;
  state.watchlist = state.watchlist.map((item) => ({
    ...item,
    pricingStatus: "loading",
  }));
  if (state.ledgerView === "watchlist") renderCollection();
  const cardItems = unique.filter((item) => item.cardState !== "sealed");
  const sealedItems = unique.filter((item) => item.cardState === "sealed");
  const lookups = cardItems.map((item) => ({
    clientId: item.id,
    pkmnpricesId: item.externalIds?.pkmnprices || "",
    justtcgId: item.externalIds?.justtcg || "",
    tcgplayerId: item.externalIds?.tcgplayer || "",
    tcgdexId: item.externalIds?.tcgdex || "",
    name: item.name,
    set: item.set,
    number: item.number,
    language: item.language || "en",
  }));
  try {
    const cards = new Map();
    const sealedProducts = new Map();
    const processed = new Set();
    const sealedProcessed = new Set();
    let rateLimited = false;
    let sealedPlanRequired = false;
    for (let start = 0; start < lookups.length; start += 8) {
      const batch = lookups.slice(start, start + 8);
      const response = await fetch(
        `/api/cards?lookups=${encodeURIComponent(JSON.stringify(batch))}`,
        { headers: { Accept: "application/json" } },
      );
      if (response.status === 429) {
        rateLimited = true;
        break;
      }
      if (!response.ok)
        throw new Error(`Watch pricing failed with ${response.status}`);
      const payload = await response.json();
      batch.forEach((lookup) => processed.add(lookup.clientId));
      (payload.cards || []).forEach((card) =>
        cards.set(card.providerCardId, card),
      );
    }
    for (let start = 0; start < sealedItems.length; start += 5) {
      const batch = sealedItems.slice(start, start + 5);
      const results = await Promise.allSettled(
        batch.map(async (item) => {
          const id =
            item.externalIds?.pkmnpricesSealed ||
            String(item.id).replace(/^sealed:/, "");
          const response = await fetch(
            `/api/sealed?id=${encodeURIComponent(id)}`,
            { headers: { Accept: "application/json" } },
          );
          if (response.status === 403) {
            sealedPlanRequired = true;
            sealedProcessed.add(item.id);
            return null;
          }
          if (response.status === 429) {
            rateLimited = true;
            return null;
          }
          if (!response.ok) throw new Error(String(response.status));
          const payload = await response.json();
          sealedProcessed.add(item.id);
          return { item, product: payload.product };
        }),
      );
      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value?.product)
          sealedProducts.set(result.value.item.id, result.value.product);
      });
    }
    state.watchlist = state.watchlist.map((item) => {
      const sealed = item.cardState === "sealed";
      if (sealed && !sealedProcessed.has(item.id))
        return {
          ...item,
          pricingStatus: rateLimited ? "rate_limited" : "error",
        };
      if (!sealed && !processed.has(item.id))
        return {
          ...item,
          pricingStatus: rateLimited ? "rate_limited" : "error",
        };
      const card = sealed ? sealedProducts.get(item.id) : cards.get(item.id);
      if (!card)
        return {
          ...item,
          currentPrice: null,
          quotes: [],
          pricingStatus:
            sealed && sealedPlanRequired ? "plan_required" : "unavailable",
        };
      const quote = selectReferenceQuote(
        card.quotes,
        item.variant,
        item.currency || "USD",
        sealed ? {} : item,
      );
      return {
        ...item,
        externalIds: {
          ...(item.externalIds || {}),
          ...(card.externalIds || {}),
        },
        metadata: card.metadata || item.metadata || null,
        productType: card.productType || item.productType || null,
        currentPrice: quote?.amount ?? null,
        quotes: card.quotes || [],
        priceHistory: card.history || [],
        historyStatus: card.historyStatus || null,
        pricingStatus: quote ? quoteStatus(quote) : "unavailable",
        pricingUpdatedAt:
          quote?.observedAt || quote?.retrievedAt?.slice?.(0, 10) || null,
      };
    });
  } catch {
    state.watchlist = state.watchlist.map((item) => ({
      ...item,
      pricingStatus: "error",
    }));
  }
  if (state.ledgerView === "watchlist") renderCollection();
  renderInsights();
  if (state.route === "detail" && state.detailCard?.watchlistId) {
    const updated = state.watchlist.find(
      (item) => item.watchlistId === state.detailCard.watchlistId,
    );
    if (updated) {
      state.detailCard = { ...updated, price: updated.currentPrice };
      renderDetail();
    }
  }
  void notifyReachedTargets();
}

function renderBusinessReview() {
  const review = portfolioReview(state.items, state.watchlist);
  const actions = portfolioActions(state.items, state.watchlist);
  const signalCount = actions.reduce(
    (sum, action) => sum + action.items.length,
    0,
  );
  if (!state.items.length && !state.watchlist.length) {
    $("#businessReview").innerHTML =
      '<div class="action-center-empty"><span>Start here</span><strong>Add your first exact item</strong><small>Search a card or sealed product, then enter one total acquisition cost. Mica will build the action queue from your real data.</small><button id="actionCenterAdd" type="button">Find an item →</button></div>';
    $("#actionCenterAdd").addEventListener("click", () => routeTo("scan"));
    return;
  }
  if (!actions.length) {
    $("#businessReview").innerHTML =
      '<div class="action-center-clear"><span>Today</span><strong>You’re caught up</strong><small>No reached buy targets, price gaps, below-cost positions, or inventory older than 180 days need review.</small><b>✓</b></div>';
    return;
  }
  $("#businessReview").innerHTML =
    `<div class="action-center-summary"><span>Today’s queue</span><strong>${signalCount} signal${signalCount === 1 ? "" : "s"} across ${actions.length} next step${actions.length === 1 ? "" : "s"}</strong><small>Ordered by time sensitivity, data quality, downside, then inventory age.</small></div>${actions.map((action, index) => `<button type="button" data-business-review="${action.key}" class="${index === 0 ? "recommended" : ""}"><span>${index === 0 ? "Do this first" : `Priority ${index + 1}`}</span><strong>${esc(action.title)}</strong><small>${action.items.length} item${action.items.length === 1 ? "" : "s"} · ${esc(action.copy)}</small><b>Review ${action.items.length} →</b></button>`).join("")}`;
  $$("[data-business-review]").forEach((button) =>
    button.addEventListener("click", () => {
      const key = button.dataset.businessReview;
      const items =
        {
          pricing: review.needsPricing,
          "below-cost": review.belowCost,
          older: review.olderInventory,
          targets: review.reachedTargets,
        }[key] || [];
      openBusinessReviewQueue(key, items);
    }),
  );
}

function openBusinessReviewQueue(key, items) {
  const config = {
    pricing: {
      title: "Price gaps",
      copy: "Positions missing an exact current reference",
    },
    "below-cost": {
      title: "Below cost",
      copy: "Positions whose current reference is below remaining basis",
    },
    older: {
      title: "Older inventory",
      copy: "Positions owned for at least 180 days",
    },
    targets: {
      title: "Reached buy targets",
      copy: "Watchlist prices at or below your target",
    },
  }[key];
  if (!config || !items.length) return;
  const rows = items
    .map((item, index) => {
      let metric = "";
      let detail = "";
      if (key === "pricing") {
        metric = "Needs price";
        detail = esc(
          item.gradingCompany
            ? `${item.gradingCompany} ${item.grade}`
            : item.condition,
        );
      } else if (key === "below-cost") {
        const value = Number(item.price || 0) * Number(item.quantity || 0);
        const gap = value - Number(item.costBasis || 0);
        metric = `${gap >= 0 ? "+" : ""}${money(gap, item.currency)}`;
        detail = `${money(value, item.currency)} value · ${money(item.costBasis, item.currency)} basis`;
      } else if (key === "older") {
        const days = holdingDays(item.purchaseDate);
        metric = days === null ? "Date missing" : `${days} days`;
        detail = `First purchased ${esc(item.purchaseDate || "date not recorded")}`;
      } else {
        metric =
          item.currentPrice === null
            ? "Price missing"
            : money(item.currentPrice, item.currency);
        detail = `Target ${money(item.targetPrice, item.currency)} · ${esc(item.gradingCompany ? `${item.gradingCompany} ${item.grade}` : item.condition)}`;
      }
      return `<button class="review-queue-row" type="button" data-review-index="${index}"><img src="${esc(item.thumb || "./icons/icon.svg")}" alt=""><span><strong>${esc(item.name)}</strong><small>${esc(item.set)} · ${esc(item.number)}</small><em>${detail}</em></span><b>${metric}<small>Review →</small></b></button>`;
    })
    .join("");
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">${esc(config.title)}</h2><p>${items.length} item${items.length === 1 ? "" : "s"} · ${esc(config.copy)}</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="review-queue-list">${rows}</div>${key === "pricing" ? '<div class="sheet-actions"><button class="secondary" id="showAllPriceGaps" type="button">Open filtered library</button></div>' : ""}`,
  );
  $$("[data-review-index]").forEach((button) =>
    button.addEventListener("click", () => {
      const item = items[Number(button.dataset.reviewIndex)];
      closeSheet({ discardHistory: true });
      if (key === "targets") openWatchlistDetail(item);
      else openCardDetail(item, true);
    }),
  );
  $("#showAllPriceGaps")?.addEventListener("click", () => {
    closeSheet({ discardHistory: true });
    state.ledgerView = "unpriced";
    state.query = "";
    state.setFilter = "";
    state.conditionFilter = "";
    state.labelFilter = "";
    $("#collectionSearch").value = "";
    syncTabs();
    renderCollection();
    routeTo("collection");
  });
}

function businessDates(range, today = localIsoDate()) {
  if (range === "all")
    return { from: "0000-01-01", to: today, label: "All time" };
  if (range === "ytd")
    return {
      from: `${today.slice(0, 4)}-01-01`,
      to: today,
      label: "Year to date",
    };
  const days = range === "30d" ? 30 : 90;
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return {
    from: start.toISOString().slice(0, 10),
    to: today,
    label: `Last ${days} days`,
  };
}

function renderBusinessSummary() {
  const period = businessDates(state.businessRange);
  const summary = businessSummary(state.items, {
    from: period.from,
    to: period.to,
    currency: "USD",
  });
  if (!summary) return;
  $("#businessReportPeriod").textContent =
    `${period.label} · through ${period.to}`;
  $("#businessExport").disabled = !summary.transactionCount;
  if (!summary.transactionCount) {
    $("#businessReportMetrics").innerHTML =
      '<div class="data-boundary"><strong>No transactions in this period</strong><p>Record purchases and sales to see cash flow and realized profit here.</p></div>';
    $("#businessReportNote").textContent =
      "Business reporting uses only transactions you record. Market-value changes are kept separate.";
    return;
  }
  const cashClass = summary.cashFlowMinor >= 0 ? "positive" : "negative";
  const profitClass =
    summary.realizedProfitMinor >= 0 ? "positive" : "negative";
  $("#businessReportMetrics").innerHTML =
    `<div><span>Net sales</span><strong>${money(summary.netSalesMinor / 100, summary.currency)}</strong><small>${summary.unitsSold} card${summary.unitsSold === 1 ? "" : "s"} sold</small></div><div><span>Acquisition spend</span><strong>${money(summary.acquisitionSpendMinor / 100, summary.currency)}</strong><small>${summary.unitsPurchased} card${summary.unitsPurchased === 1 ? "" : "s"} purchased</small></div><div class="${cashClass}"><span>Cash flow</span><strong>${summary.cashFlowMinor >= 0 ? "+" : ""}${money(summary.cashFlowMinor / 100, summary.currency)}</strong><small>Net sales minus acquisitions</small></div><div class="${profitClass}"><span>${summary.realizedCoverage === summary.saleCount ? "Realized profit" : "Known realized profit"}</span><strong>${summary.realizedProfitMinor >= 0 ? "+" : ""}${money(summary.realizedProfitMinor / 100, summary.currency)}</strong><small>FIFO basis on ${summary.realizedCoverage} of ${summary.saleCount} sales</small></div><div><span>Selling costs</span><strong>${money(summary.sellingCostsMinor / 100, summary.currency)}</strong><small>Gross sale price minus net</small></div><div><span>Activity</span><strong>${summary.transactionCount}</strong><small>${summary.purchaseCount} purchase${summary.purchaseCount === 1 ? "" : "s"} · ${summary.saleCount} sale${summary.saleCount === 1 ? "" : "s"}</small></div>`;
  $("#businessReportNote").textContent = summary.skippedCurrencyCount
    ? `${summary.skippedCurrencyCount} transaction${summary.skippedCurrencyCount === 1 ? " was" : "s were"} excluded to avoid mixing currencies. USD is shown separately.`
    : "USD transactions only. Market value and unrealized gains are not counted as cash or realized profit.";
}

function liquidationInputs() {
  return {
    referencePercent: $("#liquidationReferencePercent")?.value ?? 100,
    feePercent: $("#liquidationFeePercent")?.value ?? 0,
    totalSellingCosts: $("#liquidationSellingCosts")?.value ?? 0,
    currency: "USD",
  };
}

function currentLiquidationPlan() {
  return liquidationPlan(state.items, liquidationInputs());
}

function renderLiquidationPlanner() {
  const output = $("#liquidationOutput");
  const note = $("#liquidationNote");
  const exportButton = $("#liquidationExport");
  if (!output || !note || !exportButton) return;
  const plan = currentLiquidationPlan();
  exportButton.disabled = !plan?.rows.length;
  if (!plan) {
    output.innerHTML =
      '<div class="data-boundary"><strong>Check the scenario inputs</strong><p>Use non-negative percentages and costs. Selling fees must stay below 100%.</p></div>';
    note.textContent = "No estimate is shown until every assumption is valid.";
    return;
  }
  if (!plan.rows.length) {
    output.innerHTML =
      '<div class="data-boundary"><strong>No priced USD inventory yet</strong><p>Add an item and load an exact market reference to plan a take-home amount.</p></div>';
    note.textContent = plan.unpricedUnits
      ? `${plan.unpricedUnits} unpriced card${plan.unpricedUnits === 1 ? " is" : "s are"} excluded, not valued at zero.`
      : "Market references are estimates, not guaranteed sale prices.";
    return;
  }
  const profitClass =
    plan.profitMinor === null
      ? ""
      : plan.profitMinor >= 0
        ? "positive"
        : "negative";
  output.innerHTML = `<div><span>Shown reference value</span><strong>${money(plan.referenceValueMinor / 100, plan.currency)}</strong><small>${plan.pricedUnits} priced item${plan.pricedUnits === 1 ? "" : "s"}</small></div><div><span>Expected gross sales</span><strong>${money(plan.expectedGrossMinor / 100, plan.currency)}</strong><small>At ${Number(liquidationInputs().referencePercent).toFixed(1)}% of reference</small></div><div><span>Fees & other costs</span><strong>−${money((plan.marketplaceFeesMinor + plan.totalSellingCostsMinor) / 100, plan.currency)}</strong><small>${money(plan.marketplaceFeesMinor / 100, plan.currency)} percentage fee · ${money(plan.totalSellingCostsMinor / 100, plan.currency)} other</small></div><div class="take-home"><span>Estimated take-home</span><strong>${money(plan.netProceedsMinor / 100, plan.currency)}</strong><small>Gross minus the assumptions above</small></div><div class="${profitClass}"><span>${plan.profitMinor === null ? "Profit unavailable" : "Estimated profit"}</span><strong>${plan.profitMinor === null ? "Basis incomplete" : `${plan.profitMinor >= 0 ? "+" : ""}${money(plan.profitMinor / 100, plan.currency)}`}</strong><small>${plan.profitMinor === null ? `${plan.unknownBasisUnits} priced item${plan.unknownBasisUnits === 1 ? " is" : "s are"} missing acquisition cost` : plan.roiPercent === null ? "No return percentage on zero basis" : `${plan.roiPercent >= 0 ? "+" : ""}${plan.roiPercent.toFixed(1)}% on remaining basis`}</small></div><div><span>Break-even sale level</span><strong>${plan.breakEvenReferencePercent === null ? "—" : `${plan.breakEvenReferencePercent.toFixed(1)}%`}</strong><small>Of shown reference after fees and costs</small></div>`;
  const omissions = [];
  if (plan.unpricedUnits)
    omissions.push(
      `${plan.unpricedUnits} unpriced item${plan.unpricedUnits === 1 ? "" : "s"} excluded`,
    );
  if (plan.skippedCurrencyUnits)
    omissions.push(
      `${plan.skippedCurrencyUnits} non-USD item${plan.skippedCurrencyUnits === 1 ? "" : "s"} kept separate`,
    );
  if (plan.unknownBasisUnits)
    omissions.push(
      `${plan.unknownBasisUnits} item${plan.unknownBasisUnits === 1 ? "" : "s"} missing cost basis`,
    );
  note.textContent = omissions.length
    ? `${omissions.join(" · ")}. Missing values are never treated as zero.`
    : "Every included item has a matching USD reference and recorded cost basis. This is still a planning estimate, not a guaranteed offer.";
}

function downloadLiquidationScenario() {
  const plan = currentLiquidationPlan();
  if (!plan?.rows.length) return;
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const dollars = (minor) => (Number(minor || 0) / 100).toFixed(2);
  const rows = [
    [
      "Item",
      "Set",
      "Number",
      "Condition or grade",
      "Quantity",
      "Reference each",
      "Expected sale each",
      "Expected gross",
      "Estimated percentage fee",
      "Cost basis",
    ],
  ];
  plan.rows.forEach((row) =>
    rows.push([
      row.name,
      row.set,
      row.number,
      row.context,
      row.quantity,
      dollars(row.referenceUnitMinor),
      dollars(row.expectedUnitMinor),
      dollars(row.grossMinor),
      dollars(row.feesMinor),
      row.costBasisMinor === null ? "" : dollars(row.costBasisMinor),
    ]),
  );
  rows.push(
    [],
    [
      `Scenario: ${liquidationInputs().referencePercent}% of reference`,
      `Fee: ${liquidationInputs().feePercent}%`,
      `Other selling costs: ${dollars(plan.totalSellingCostsMinor)}`,
      `Estimated take-home: ${dollars(plan.netProceedsMinor)}`,
      plan.profitMinor === null
        ? "Estimated profit: unavailable — basis incomplete"
        : `Estimated profit: ${dollars(plan.profitMinor)}`,
    ],
  );
  downloadTextFile(
    rows.map((row) => row.map(quote).join(",")).join("\n"),
    "text/csv;charset=utf-8",
    `mica-take-home-scenario-${localIsoDate()}.csv`,
  );
  toast("Take-home scenario downloaded");
}

function downloadBusinessReport() {
  if (!requireAccountData()) return;
  const period = businessDates(state.businessRange);
  const csv = transactionReportCsv(state.items, {
    from: period.from,
    to: period.to,
    currency: "USD",
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mica-business-${state.businessRange}-${period.to}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast("Business report downloaded");
}

function renderInventoryHealth() {
  const health = inventoryHealth(state.items, { currency: "USD" });
  if (!health.totalQuantity) {
    $("#inventoryHealth").innerHTML =
      '<div class="data-boundary"><strong>No inventory to analyze yet</strong><p>Add a purchase and Mica will show concentration and the age of remaining capital.</p></div>';
    $("#inventoryHealthNote").textContent =
      "Uses remaining FIFO lots when they are available.";
    return;
  }
  const basisScale = health.totalCostBasis > 0 && !health.unknownBasisQuantity;
  const scaleTotal = basisScale ? health.totalCostBasis : health.totalQuantity;
  const top = health.topPosition;
  const coverage = health.totalQuantity
    ? (health.pricedQuantity / health.totalQuantity) * 100
    : 0;
  const bucketRows = health.buckets
    .filter((bucket) => bucket.quantity > 0)
    .map((bucket) => {
      const scale = basisScale ? bucket.costBasis : bucket.quantity;
      const width = scaleTotal ? Math.max(2, (scale / scaleTotal) * 100) : 0;
      return `<div class="inventory-age-row ${bucket.key === "181+" ? "aged" : ""}"><div><strong>${esc(bucket.label)}</strong><span>${bucket.quantity} card${bucket.quantity === 1 ? "" : "s"} · ${basisScale ? `${money(bucket.costBasis, health.currency)} basis` : "basis unavailable"}</span></div><div class="inventory-age-track" aria-label="${esc(bucket.label)} ${width.toFixed(1)} percent of ${basisScale ? "remaining cost basis" : "inventory"}"><i style="width:${width}%"></i></div></div>`;
    })
    .join("");
  $("#inventoryHealth").innerHTML =
    `<div class="inventory-health-metrics"><div><span>Largest position</span><strong>${top ? `${top.sharePercent.toFixed(1)}%` : "—"}</strong><small>${top ? esc(top.name) : "Needs pricing"}</small></div><div><span>Top 3 concentration</span><strong>${health.topThreeSharePercent === null ? "—" : `${health.topThreeSharePercent.toFixed(1)}%`}</strong><small>Share of priced value</small></div><div><span>Pricing coverage</span><strong>${coverage.toFixed(0)}%</strong><small>${health.pricedQuantity} of ${health.totalQuantity} cards</small></div></div><div class="inventory-aging"><div class="inventory-aging-title"><strong>Age of remaining inventory</strong><span>${basisScale ? "By FIFO cost basis" : "By card count"}</span></div>${bucketRows}</div>`;
  $("#inventoryHealthNote").textContent = health.unknownBasisQuantity
    ? `${health.unknownBasisQuantity} card${health.unknownBasisQuantity === 1 ? " has" : "s have"} unknown acquisition cost, so aging is shown by card count and profit stays unavailable.`
    : health.skippedCurrencyPositions
      ? `${health.skippedCurrencyPositions} non-USD position${health.skippedCurrencyPositions === 1 ? " was" : "s were"} kept separate. Aging uses remaining purchase lots, not the original full purchase.`
      : "Aging uses remaining FIFO purchase lots. Concentration uses priced positions only; missing prices are not treated as zero.";
}

function renderInsights() {
  const priced = state.items.filter((item) => item.price != null).length;
  const movements = state.items
    .map((item) => ({ item, movement: movementForItem(item) }))
    .filter((row) => row.movement)
    .sort(
      (left, right) =>
        Math.abs(right.movement.changePercent) -
        Math.abs(left.movement.changePercent),
    );
  const ranked = [...state.items]
    .map((item) => ({
      item,
      value:
        item.price == null ? null : Number(item.price) * Number(item.quantity),
      gain:
        item.price == null || item.costBasis == null
          ? null
          : Number(item.price) * Number(item.quantity) - Number(item.costBasis),
    }))
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  $("#positionRankings").innerHTML = ranked.length
    ? ranked
        .slice(0, 5)
        .map(
          ({ item, value, gain }) =>
            `<div class="mover"><img src="${esc(item.thumb)}" alt=""><div><strong>${esc(item.name)}</strong><span>${esc(item.gradingCompany ? `${item.gradingCompany} ${item.grade}` : item.condition)} · ${item.quantity} owned</span></div><b>${value === null ? "Unavailable" : `${money(value)}${gain === null ? "" : ` · ${gain >= 0 ? "+" : ""}${money(gain)}`}`}</b></div>`,
        )
        .join("")
    : '<div class="data-boundary"><strong>No positions yet</strong><p>Add an exact card and purchase lot to start portfolio analysis.</p></div>';
  renderInventoryHealth();
  const rawCount = state.items
    .filter((item) => item.cardState !== "sealed" && !item.gradingCompany)
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  $("#batchGradingCount").textContent = rawCount
    ? `${rawCount} raw card${rawCount === 1 ? "" : "s"} available`
    : "Add a raw card to begin";
  const recent = state.items
    .flatMap((item) =>
      (item.transactions || []).map((transaction) => ({ item, transaction })),
    )
    .sort((a, b) => b.transaction.date.localeCompare(a.transaction.date))
    .slice(0, 6);
  $("#recentActivity").innerHTML = recent.length
    ? recent
        .map(({ item, transaction }) => {
          const label =
            transaction.type === "purchase"
              ? "Purchased"
              : transaction.type === "sale"
                ? "Sold"
                : transaction.type === "grading_submission"
                  ? "Sent to grading"
                  : transaction.type === "grading_return"
                    ? "Returned graded"
                    : String(transaction.type).replaceAll("_", " ");
          const detail =
            transaction.type === "purchase"
              ? transaction.unitPrice == null
                ? "cost not recorded"
                : `${money(transaction.totalCost, transaction.currency)} total`
              : transaction.type === "sale"
                ? `${money(transaction.netProceeds, transaction.currency)} net`
                : transaction.type === "grading_return"
                  ? `${transaction.gradingCompany} ${transaction.grade} · ${money(transaction.gradingFees, transaction.currency)} added basis`
                  : transaction.type === "grading_submission"
                    ? `${transaction.gradingCompany || transaction.marketplace} · manual tracking`
                    : `${transaction.quantity} recorded`;
          return `<div class="mover"><img src="${esc(item.thumb)}" alt=""><div><strong>${esc(label)} ${esc(item.name)}</strong><span>${esc(transaction.date || "Date not recorded")} · ${esc(detail)}</span></div><b>×${transaction.quantity}</b></div>`;
        })
        .join("")
    : '<div class="data-boundary"><strong>No transactions yet</strong><p>Purchases, sales, and grading events will appear here.</p></div>';
  renderBusinessSummary();
  renderBusinessReview();
  renderLiquidationPlanner();
  if (["live", "partial"].includes(state.pricingStatus)) {
    const comparable = movements.filter(
      (row) => row.movement.currency === "USD",
    );
    const prior = comparable.reduce(
      (sum, row) =>
        sum + row.movement.fromAmount * Number(row.item.quantity || 0),
      0,
    );
    const current = comparable.reduce(
      (sum, row) =>
        sum + row.movement.toAmount * Number(row.item.quantity || 0),
      0,
    );
    const change = current - prior;
    const percent = prior > 0 ? (change / prior) * 100 : null;
    if (movements.length) {
      $(".insight-feature").innerHTML =
        `<div class="insight-kicker">Verified 30-day movement</div><strong>${comparable.length ? `${change >= 0 ? "+" : ""}${money(change)}` : `${movements.length} comparable series`}</strong><span>${percent === null ? "Exact comparable history" : `${percent >= 0 ? "+" : ""}${percent.toFixed(1)}% across ${comparable.length} USD position${comparable.length === 1 ? "" : "s"}`} · current quantities</span><div class="unavailable-panel">Calculated from the same printing, condition or grade, currency, and provider series. It is market movement, not realized profit.</div>`;
    } else {
      $(".insight-feature").innerHTML =
        `<div class="insight-kicker">${state.pricingStatus === "partial" ? "Partial" : "Live"} pricing status</div><strong>${priced} of ${state.items.length} items priced</strong><span>Exact-product matches only · ${state.items.length - priced} need review</span><div class="unavailable-panel">${state.movementStatus === "loading" ? "Loading exact historical observations…" : state.movementStatus === "plan_required" ? "Historical observations are ready for PkmnPrices Pro. Current prices remain available on the connected plan." : state.movementStatus === "error" ? "Historical pricing could not be refreshed. Current portfolio values are unchanged." : "Price trends appear after at least 30 days of matching history exist."}</div>`;
    }
    $("#moversList").innerHTML = movements.length
      ? movements
          .slice(0, 6)
          .map(({ item, movement }) => {
            const context = item.gradingCompany
              ? `${item.gradingCompany} ${item.grade}`
              : item.condition;
            const provider =
              movement.provider === "ebay"
                ? "eBay sold"
                : movement.provider === "tcgplayer"
                  ? "TCGplayer"
                  : movement.provider === "cardmarket"
                    ? "Cardmarket"
                    : movement.provider;
            return `<button type="button" class="mover mover-button" data-mover-id="${esc(item.uid)}"><img src="${esc(item.thumb)}" alt=""><div><strong>${esc(item.name)}</strong><span>${esc(context)} · ${esc(provider)} · ${money(movement.fromAmount, movement.currency)} to ${money(movement.toAmount, movement.currency)}</span></div><b class="${movement.changePercent < 0 ? "negative" : ""}">${movement.changePercent >= 0 ? "+" : ""}${movement.changePercent.toFixed(1)}%</b></button>`;
          })
          .join("")
      : '<div class="data-boundary"><strong>No verified 30-day movement yet</strong><p>Mica needs an observation at least 30 days earlier from the same printing, condition or grade, currency, and provider series. It will not blend incompatible prices.</p></div>';
    $$("[data-mover-id]").forEach((button) =>
      button.addEventListener("click", () =>
        openCardDetail(
          state.items.find((item) => item.uid === button.dataset.moverId),
          true,
        ),
      ),
    );
    return;
  }
  $(".insight-feature").innerHTML =
    `<div class="insight-kicker">Preview movement · fixture data</div><strong>+$124.18</strong><span>Illustrative only · replaced when live comparable history exists</span>`;
  $("#moversList").innerHTML = [...state.items]
    .filter((i) => i.move != null)
    .sort((a, b) => Math.abs(b.move) - Math.abs(a.move))
    .slice(0, 4)
    .map(
      (item) =>
        `<div class="mover"><img src="${item.thumb}" alt=""><div><strong>${esc(item.name)}</strong><span>${esc(item.set)} · preview fixture</span></div><b style="color:${item.move < 0 ? "var(--danger)" : ""}">${item.move >= 0 ? "+" : ""}${item.move.toFixed(1)}%</b></div>`,
    )
    .join("");
}

function tradeItemMarkup(item, side) {
  const max = item.maxQuantity ? ` max="${item.maxQuantity}"` : "";
  return `<article class="trade-item" data-trade-item="${esc(item.tradeId)}" data-trade-item-side="${side}"><img src="${esc(item.thumb || "./icons/icon.svg")}" alt=""><div class="trade-item-main"><strong>${esc(item.name)}</strong><span>${esc(item.set)} · ${esc(item.number)} · ${esc(item.variant || "Printing unknown")}</span><small>${item.pricingStatus === "live" ? "Market reference loaded" : item.pricingStatus === "loading" ? "Checking market reference…" : "Enter the agreed value"}</small></div><div class="trade-item-inputs"><label>Qty<input data-trade-quantity type="number" inputmode="numeric" min="1"${max} step="1" value="${item.quantity}"></label><label>Value each<div class="money-input"><span>$</span><input data-trade-value type="number" inputmode="decimal" min="0" step="0.01" value="${esc(item.valuePerCard)}" placeholder="0.00"></div></label><label class="trade-context">Condition or grade<input data-trade-context type="text" maxlength="80" value="${esc(item.context)}" placeholder="Raw · Near Mint or PSA 10"></label></div><button class="trade-remove" data-trade-remove type="button" aria-label="Remove ${esc(item.name)} from trade">×</button></article>`;
}

function updateTradeSummary() {
  const analysis = tradeAnalysis({
    giveItems: state.trade.give,
    receiveItems: state.trade.receive,
    giveCash: state.trade.giveCash,
    receiveCash: state.trade.receiveCash,
  });
  const verdict = $("#tradeVerdict");
  const copyButton = $("#copyTradeSummary");
  const contextsReady = [...state.trade.give, ...state.trade.receive].every(
    (item) => String(item.context || "").trim(),
  );
  copyButton.disabled =
    !analysis ||
    !state.trade.give.length ||
    !state.trade.receive.length ||
    !contextsReady;
  if (!analysis) {
    $("#tradeGiveTotal").textContent = "Check values";
    $("#tradeReceiveTotal").textContent = "Check values";
    verdict.className = "trade-verdict negative";
    verdict.innerHTML =
      '<span>Check the trade values</span><strong>Quantities and values must be zero or higher.</strong><small id="tradeBalanceHelp">Fix the highlighted side, then Mica will compare the deal.</small>';
    return;
  }
  $("#tradeGiveTotal").textContent = money(analysis.giveTotalMinor / 100);
  $("#tradeReceiveTotal").textContent = money(analysis.receiveTotalMinor / 100);
  if (!state.trade.give.length || !state.trade.receive.length) {
    verdict.className = "trade-verdict neutral";
    verdict.innerHTML =
      '<span>Build both sides</span><strong>Add at least one card to You give and You receive.</strong><small id="tradeBalanceHelp">You can use market references or type the value both people agreed on.</small>';
    return;
  }
  const copy =
    analysis.verdict === "balanced"
      ? {
          tone: "balanced",
          label: "Looks close",
          headline: `The two sides are within ${money(Math.abs(analysis.differenceMinor) / 100)}.`,
        }
      : analysis.verdict === "in_your_favor"
        ? {
            tone: "positive",
            label: "In your favor",
            headline: `You receive about ${money(analysis.differenceMinor / 100)} more.`,
          }
        : {
            tone: "negative",
            label: "In their favor",
            headline: `You give about ${money(Math.abs(analysis.differenceMinor) / 100)} more.`,
          };
  const balance =
    analysis.differenceMinor === 0
      ? "The agreed values are exactly even."
      : `${money(analysis.cashToBalanceMinor / 100)} in cash to ${analysis.cashGoesTo === "them" ? "them" : "you"} would make the totals even.`;
  verdict.className = `trade-verdict ${copy.tone}`;
  verdict.innerHTML = `<span>${copy.label}</span><strong>${copy.headline}</strong><small id="tradeBalanceHelp">${balance} Difference: ${analysis.differencePercent >= 0 ? "+" : ""}${analysis.differencePercent.toFixed(1)}%.</small>`;
}

function bindTradeItemRows() {
  $$(".trade-item").forEach((row) => {
    const side = row.dataset.tradeItemSide;
    const item = state.trade[side].find(
      (candidate) => candidate.tradeId === row.dataset.tradeItem,
    );
    row
      .querySelector("[data-trade-quantity]")
      .addEventListener("input", (event) => {
        item.quantity = Number(event.target.value);
        updateTradeSummary();
      });
    row
      .querySelector("[data-trade-value]")
      .addEventListener("input", (event) => {
        item.valuePerCard = event.target.value;
        item.pricingStatus = "manual";
        updateTradeSummary();
      });
    row
      .querySelector("[data-trade-context]")
      .addEventListener("input", (event) => {
        item.context = event.target.value;
        updateTradeSummary();
      });
    row.querySelector("[data-trade-remove]").addEventListener("click", () => {
      state.trade[side] = state.trade[side].filter(
        (candidate) => candidate.tradeId !== item.tradeId,
      );
      renderTrade();
    });
  });
}

function renderTrade() {
  $("#tradeGiveItems").innerHTML = state.trade.give.length
    ? state.trade.give.map((item) => tradeItemMarkup(item, "give")).join("")
    : '<div class="trade-side-empty">No cards added yet.</div>';
  $("#tradeReceiveItems").innerHTML = state.trade.receive.length
    ? state.trade.receive
        .map((item) => tradeItemMarkup(item, "receive"))
        .join("")
    : '<div class="trade-side-empty">No cards added yet.</div>';
  $("#tradeGiveCash").value = state.trade.giveCash;
  $("#tradeReceiveCash").value = state.trade.receiveCash;
  $$("[data-trade-side]").forEach((button) =>
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.tradeSide === state.trade.addingTo),
    ),
  );
  const owned = state.items.filter((item) => item.quantity > 0).slice(0, 6);
  $("#tradeOwned").innerHTML = owned.length
    ? `<div class="trade-owned-head"><strong>Add from your library</strong><span>Uses the current matching reference when available.</span></div><div class="trade-owned-list">${owned.map((item) => `<button type="button" data-trade-owned="${esc(item.uid)}"><img src="${esc(item.thumb)}" alt=""><span><strong>${esc(item.name)}</strong><small>${esc(item.gradingCompany ? `${item.gradingCompany} ${item.grade}` : item.condition)} · ${item.price == null ? "Value needed" : money(item.price)}</small></span><b>Give</b></button>`).join("")}</div>`
    : "";
  $$("[data-trade-owned]").forEach((button) =>
    button.addEventListener("click", () =>
      addTradeCard(
        state.items.find((item) => item.uid === button.dataset.tradeOwned),
        "give",
        true,
      ),
    ),
  );
  bindTradeItemRows();
  updateTradeSummary();
}

function renderTradeSearchResults() {
  const node = $("#tradeSearchResults");
  const results = state.trade.searchResults;
  node.innerHTML = results.length
    ? results
        .map(
          (item) =>
            `<button class="quick-card-result" type="button" data-trade-card="${esc(item.id)}"><img src="${esc(item.thumb || item.image || "")}" alt=""><span><strong>${esc(item.name)}</strong><small>${esc(item.set)} · ${esc(item.number)}</small><em>${esc(item.variant || "Printing unknown")} · ${esc(languageName(item.language || "en"))}</em>${ownedSearchStatus(item)}</span><b>Add</b></button>`,
        )
        .join("")
    : '<div class="find-empty"><strong>No matching cards</strong><span>Try the card name with its set or collector number.</span></div>';
  $$("[data-trade-card]", node).forEach((button) =>
    button.addEventListener("click", () =>
      addTradeCard(
        state.trade.searchResults.find(
          (item) => item.id === button.dataset.tradeCard,
        ),
        state.trade.addingTo,
      ),
    ),
  );
}

async function priceTradeCard(tradeItem, card) {
  const lookup = [
    {
      clientId: card.id,
      pkmnpricesId: card.externalIds?.pkmnprices || "",
      tcgdexId: card.externalIds?.tcgdex || "",
      name: card.name,
      set: card.set,
      number: card.number,
      language: card.language || "en",
    },
  ];
  try {
    const response = await fetch(
      `/api/cards?lookups=${encodeURIComponent(JSON.stringify(lookup))}`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) throw new Error("pricing unavailable");
    const payload = await response.json();
    const priced = payload.cards?.[0];
    const quote = priced
      ? selectReferenceQuote(priced.quotes, card.variant, "USD", {
          condition: "Near Mint",
        })
      : null;
    if (quote && String(tradeItem.valuePerCard).trim() === "") {
      tradeItem.valuePerCard = Number(quote.amount).toFixed(2);
      tradeItem.pricingStatus = "live";
    } else tradeItem.pricingStatus = quote ? "live" : "unavailable";
  } catch {
    tradeItem.pricingStatus = "unavailable";
  }
  if (state.route === "trade") renderTrade();
}

function addTradeCard(card, side = state.trade.addingTo, owned = false) {
  if (!card) return;
  const context = card.gradingCompany
    ? `${card.gradingCompany} ${card.grade}`
    : `Raw · ${card.condition || "Near Mint"}`;
  const tradeItem = {
    tradeId: crypto.randomUUID(),
    cardId: card.id,
    name: card.name,
    set: card.set,
    number: card.number,
    variant: card.variant,
    context,
    thumb: card.thumb || card.image,
    quantity: 1,
    maxQuantity: owned ? Number(card.quantity) : null,
    valuePerCard: card.price == null ? "" : Number(card.price).toFixed(2),
    pricingStatus: card.price == null ? "loading" : "live",
  };
  state.trade[side].push(tradeItem);
  renderTrade();
  toast(
    `${card.name} added to ${side === "give" ? "You give" : "You receive"}`,
  );
  if (card.price == null) void priceTradeCard(tradeItem, card);
}

function bindTradeUI() {
  let timer;
  let requestId = 0;
  const input = $("#tradeCardSearch");
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const query = input.value.trim();
      const current = ++requestId;
      if (query.length < 2) {
        state.trade.searchResults = [];
        $("#tradeSearchResults").innerHTML =
          '<div class="find-empty"><strong>Search the catalog</strong><span>Pick the exact printing, then set the value used for this trade.</span></div>';
        return;
      }
      $("#tradeSearchResults").innerHTML =
        '<div class="searching-cards"><i></i><span>Finding exact printings…</span></div>';
      try {
        const result = await searchCatalog(query, "en", 8);
        if (current !== requestId) return;
        state.trade.searchResults = result.items;
        renderTradeSearchResults();
      } catch {
        if (current !== requestId) return;
        state.trade.searchResults = catalog
          .filter((item) => matchesSearch(item, query))
          .slice(0, 8);
        renderTradeSearchResults();
      }
    }, 220);
  });
  $$("[data-trade-side]").forEach((button) =>
    button.addEventListener("click", () => {
      state.trade.addingTo = button.dataset.tradeSide;
      $$("[data-trade-side]").forEach((candidate) =>
        candidate.setAttribute("aria-pressed", String(candidate === button)),
      );
    }),
  );
  $("#tradeGiveCash").addEventListener("input", (event) => {
    state.trade.giveCash = event.target.value;
    updateTradeSummary();
  });
  $("#tradeReceiveCash").addEventListener("input", (event) => {
    state.trade.receiveCash = event.target.value;
    updateTradeSummary();
  });
  $("#resetTradeButton").addEventListener("click", () => {
    state.trade = {
      give: [],
      receive: [],
      giveCash: "0.00",
      receiveCash: "0.00",
      addingTo: "give",
      searchResults: [],
    };
    input.value = "";
    renderTrade();
    $("#tradeSearchResults").innerHTML =
      '<div class="find-empty"><strong>Search the catalog</strong><span>Pick the exact printing, then set the value used for this trade.</span></div>';
    toast("Trade cleared");
  });
  $("#copyTradeSummary").addEventListener("click", async () => {
    const text = tradeSummary({
      giveItems: state.trade.give,
      receiveItems: state.trade.receive,
      giveCash: state.trade.giveCash,
      receiveCash: state.trade.receiveCash,
    });
    if (!text) {
      toast("Add valid cards and values to both sides first");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast("Deal summary copied");
    } catch {
      toast("Copy is unavailable in this browser");
    }
  });
}

function syncTabs() {
  $$(".view-tab").forEach((tab) => {
    const active = tab.dataset.ledgerView === state.ledgerView;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
}
function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  $("#toastRegion").append(node);
  setTimeout(() => node.remove(), 3000);
}

function renderIntakeQueueBar() {
  const bar = $("#intakeQueueBar");
  if (!bar) return;
  bar.classList.toggle("hidden", state.intakeQueue.length === 0);
  $("#intakeQueueCount").textContent =
    `${state.intakeQueue.length} exact card${state.intakeQueue.length === 1 ? "" : "s"} queued`;
}

function queueIntakeCard(card) {
  if (!card) return;
  state.intakeQueue.push({ queueEntryId: crypto.randomUUID(), card });
  renderIntakeQueueBar();
  toast(`${card.name} queued · exact printing preserved`);
}

function openBatchIntakeSheet() {
  if (!state.intakeQueue.length) {
    toast("Your intake queue is empty");
    return;
  }
  const today = localIsoDate();
  const entries = [...state.intakeQueue];
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Batch add raw cards</h2><p>One condition and purchase date · exact details stay visible for every card.</p></div><button class="sheet-close" aria-label="Close">×</button></div><form id="batchIntakeForm"><div class="form-grid batch-shared-fields"><div class="field"><label for="batchCondition">Condition for every card</label><select id="batchCondition"><option value="near_mint">Near Mint</option><option value="lightly_played">Lightly Played</option><option value="moderately_played">Moderately Played</option><option value="heavily_played">Heavily Played</option><option value="damaged">Damaged</option></select></div><div class="field"><label for="batchDate">Purchase date</label><input id="batchDate" type="date" max="${today}" value="${today}" required></div></div><div class="batch-intake-list">${entries
      .map((entry, index) => {
        const variants =
          Array.isArray(entry.card.variants) && entry.card.variants.length
            ? entry.card.variants
            : [entry.card.variant || "Unknown"];
        return `<article class="batch-intake-row" data-batch-index="${index}"><img src="${esc(entry.card.thumb || entry.card.image || "./icons/icon.svg")}" alt=""><div class="batch-intake-identity"><strong>${esc(entry.card.name)}</strong><span>${esc(entry.card.set)} · ${esc(entry.card.number)} · ${esc(languageName(entry.card.language || "en"))}</span><label>Exact variant<select data-batch-variant>${variants.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}</select></label></div><div class="batch-intake-values"><label>Quantity<input data-batch-quantity type="number" inputmode="numeric" min="1" max="99999" step="1" value="1" required></label><label>Total acquisition cost<div class="money-input"><span>$</span><input data-batch-cost type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" required></div></label></div></article>`;
      })
      .join(
        "",
      )}</div><p class="form-error" id="batchIntakeStatus" role="status">Nothing is saved until every row is valid.</p><div class="sheet-actions"><button class="secondary" id="batchIntakeBack" type="button">Back to queue</button><button class="primary" type="submit">Add ${entries.length} raw card${entries.length === 1 ? "" : "s"}</button></div></form>`,
  );
  $("#batchIntakeBack").addEventListener("click", () => {
    closeSheet({ discardHistory: true });
    openIntakeQueueSheet();
  });
  $("#batchIntakeForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const rows = $$(".batch-intake-row", event.currentTarget).map(
      (row, index) => ({
        id: entries[index].queueEntryId,
        variant: $("[data-batch-variant]", row).value,
        quantity: $("[data-batch-quantity]", row).value,
        totalAcquisitionCost: $("[data-batch-cost]", row).value,
      }),
    );
    const rawCondition = $("#batchCondition").value;
    const plan = batchAcquisitionPlan(
      rows,
      { rawCondition, transactionDate: $("#batchDate").value },
      today,
    );
    if (plan.errors.length) {
      $("#batchIntakeStatus").textContent = plan.errors
        .slice(0, 3)
        .map((error) => error.message)
        .join(" · ");
      return;
    }
    const submit = event.currentTarget.querySelector('[type="submit"]');
    submit.disabled = true;
    $("#batchIntakeBack").disabled = true;
    $(".sheet-close").disabled = true;
    const saved = new Set();
    const failures = [];
    for (const [index, input] of plan.ready.entries()) {
      const entry = entries.find(
        (candidate) => candidate.queueEntryId === input.id,
      );
      $("#batchIntakeStatus").textContent =
        `Saving ${index + 1} of ${plan.ready.length} securely…`;
      try {
        await createPosition(supabase, {
          ...input,
          identity: identitySnapshot(entry.card, input.variant),
          cardId: entry.card.cardId || null,
          variantId: entry.card.variantId || null,
          grader: null,
          grade: null,
          idempotencyKey: crypto.randomUUID(),
          currency: "USD",
        });
        saved.add(input.id);
      } catch (error) {
        failures.push(
          `${entry.card.name}: ${error.message || "could not save"}`,
        );
      }
    }
    state.intakeQueue = state.intakeQueue.filter(
      (entry) => !saved.has(entry.queueEntryId),
    );
    renderIntakeQueueBar();
    try {
      await reloadPortfolio();
    } catch {
      failures.push("Library refresh will retry automatically");
    }
    closeSheet({ discardHistory: true });
    if (failures.length) {
      if (state.intakeQueue.length) openIntakeQueueSheet();
      toast(`${saved.size} saved · ${failures.length} need review`);
    } else {
      routeTo("collection");
      toast(
        `${saved.size} raw card${saved.size === 1 ? "" : "s"} added to your library`,
      );
    }
  });
}

function openIntakeQueueSheet() {
  if (!state.intakeQueue.length) {
    toast("Your intake queue is empty");
    return;
  }
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Rapid intake queue</h2><p>Confirm condition and one total acquisition cost for each exact printing.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="intake-batch-choice"><div><strong>Adding raw cards with the same condition?</strong><span>Review exact variants, quantities, and total costs together.</span></div><button id="batchRawIntake" type="button">Batch add raw</button></div><div class="intake-list">${state.intakeQueue.map((entry) => `<div class="intake-row"><img src="${esc(entry.card.thumb || entry.card.image || "./icons/icon.svg")}" alt=""><div><strong>${esc(entry.card.name)}</strong><span>${esc(entry.card.set)} · ${esc(entry.card.number)}<br>${esc(entry.card.variant || "Printing unknown")} · ${esc(languageName(entry.card.language || "en"))}</span></div><div class="intake-row-actions"><button type="button" data-intake-prepare="${esc(entry.queueEntryId)}">Add details</button><button class="remove" type="button" data-intake-remove="${esc(entry.queueEntryId)}">Remove</button></div></div>`).join("")}</div><p class="legal-copy">Mica never merges queued search results or guesses the condition. Use Add details for graded cards or cards that need different information.</p><div class="sheet-actions"><button class="secondary" id="clearIntakeQueue" type="button">Clear queue</button><button class="primary" id="intakeDone" type="button">Keep searching</button></div>`,
  );
  $("#batchRawIntake").addEventListener("click", () => {
    closeSheet({ discardHistory: true });
    openBatchIntakeSheet();
  });
  $$("[data-intake-prepare]", $("#sheetContent")).forEach((button) =>
    button.addEventListener("click", () => {
      const entry = state.intakeQueue.find(
        (item) => item.queueEntryId === button.dataset.intakePrepare,
      );
      if (!entry) return;
      closeSheet({ discardHistory: true });
      openPositionSheet(entry.card, { queueEntryId: entry.queueEntryId });
    }),
  );
  $$("[data-intake-remove]", $("#sheetContent")).forEach((button) =>
    button.addEventListener("click", () => {
      state.intakeQueue = state.intakeQueue.filter(
        (item) => item.queueEntryId !== button.dataset.intakeRemove,
      );
      renderIntakeQueueBar();
      if (state.intakeQueue.length) openIntakeQueueSheet();
      else closeSheet({ discardHistory: true });
    }),
  );
  $("#clearIntakeQueue").addEventListener("click", () => {
    state.intakeQueue = [];
    renderIntakeQueueBar();
    closeSheet({ discardHistory: true });
    toast("Intake queue cleared");
  });
  $("#intakeDone").addEventListener("click", () => {
    closeSheet({ discardHistory: true });
    routeTo("scan");
    $("#quickCardSearch").focus();
  });
}

function bindQuickCardSearch() {
  const input = $("#quickCardSearch");
  const language = $("#quickSearchLanguage");
  const resultsNode = $("#quickSearchResults");
  let timer;
  let requestId = 0;
  let allResults = [];
  let selectedSet = "";
  const showResults = (results) => {
    if (results) {
      allResults = results;
      selectedSet = "";
    }
    const visible = selectedSet
      ? allResults.filter((item) => item.set === selectedSet)
      : allResults;
    resultsNode.innerHTML = allResults.length
      ? `${setFilterMarkup(allResults, selectedSet)}${visible
          .map((item) => {
            const owned = ownedCardSummary(item, state.items);
            return `<div class="quick-card-result-wrap"><button class="quick-card-result" type="button" data-quick-card="${esc(item.id)}" aria-label="View ${esc(item.name)} from ${esc(item.set)}, number ${esc(item.number)}${owned.quantity ? `, ${owned.quantity} already owned` : ""}"><img src="${esc(item.thumb || item.image || "")}" alt="${esc(item.name)} card"><span><strong>${esc(item.name)}</strong><small>${esc(item.set || "Set unavailable")} · ${esc(item.number || "Number unavailable")}</small><em>${esc(item.rarity || "Rarity unavailable")} · ${esc(languageName(item.language || language.value))} · ${esc(item.variant || "Printing unknown")}</em>${ownedSearchStatus(item)}${matchReason(item)}</span><b>${owned.quantity ? "Owned" : "View"}</b></button><button class="queue-card-button" type="button" data-queue-card="${esc(item.id)}" aria-label="Queue exact ${esc(item.name)} printing for rapid intake">+ Queue</button></div>`;
          })
          .join("")}`
      : '<div class="find-empty"><strong>No matching cards</strong><span>Try fewer details, verify the language, or search the collector number by itself.</span></div>';
    $$("[data-result-set]", resultsNode).forEach((button) =>
      button.addEventListener("click", () => {
        selectedSet = button.dataset.resultSet;
        showResults();
      }),
    );
    $$("[data-quick-card]", resultsNode).forEach((button) =>
      button.addEventListener("click", () =>
        openCardDetail(
          catalog.find((card) => card.id === button.dataset.quickCard),
        ),
      ),
    );
    $$("[data-queue-card]", resultsNode).forEach((button) =>
      button.addEventListener("click", () =>
        queueIntakeCard(
          catalog.find((card) => card.id === button.dataset.queueCard),
        ),
      ),
    );
  };
  const search = async () => {
    const q = input.value.trim();
    const current = ++requestId;
    if (q.length < 2) {
      resultsNode.innerHTML =
        '<div class="find-empty"><strong>Find the exact printing</strong><span>Results show the set and card number so you can pick the right one.</span></div>';
      return;
    }
    resultsNode.setAttribute("aria-busy", "true");
    resultsNode.innerHTML =
      '<div class="searching-cards"><i></i><span>Finding exact printings…</span></div>';
    try {
      const result = await searchCatalog(q, language.value, 12);
      if (current !== requestId) return;
      showResults(result.items);
    } catch {
      if (current !== requestId) return;
      const offlineMatches = catalog
        .filter((item) => matchesSearch(item, q))
        .slice(0, 12);
      if (offlineMatches.length) showResults(offlineMatches);
      else
        resultsNode.innerHTML =
          '<div class="find-empty"><strong>Search is temporarily unavailable</strong><span>Your library is still safe. Try again in a moment.</span></div>';
    } finally {
      if (current === requestId) resultsNode.setAttribute("aria-busy", "false");
    }
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(search, 220);
  };
  input.addEventListener("input", schedule);
  language.addEventListener("change", search);
  $$("[data-search-example]").forEach((button) =>
    button.addEventListener("click", () => {
      input.value = button.dataset.searchExample;
      search();
      input.focus();
    }),
  );
}

function bindEvents() {
  $$("[data-route]").forEach((button) =>
    button.addEventListener("click", () => {
      const route = button.dataset.route;
      if (route === "insights") {
        renderInsights();
        void refreshMovementHistory();
      }
      if (route === "trade") renderTrade();
      routeTo(route);
    }),
  );
  $$(".view-tab").forEach((tab) =>
    tab.addEventListener("click", () => {
      state.ledgerView = tab.dataset.ledgerView;
      syncTabs();
      renderCollection();
    }),
  );
  $$(".view-tab").forEach((tab) =>
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      event.preventDefault();
      const tabs = $$(".view-tab");
      const current = tabs.indexOf(event.currentTarget);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
              tabs.length;
      tabs[next].focus();
      tabs[next].click();
    }),
  );
  $("#collectionSearch").addEventListener("input", (event) => {
    state.query = event.target.value;
    renderCollection();
  });
  $("#filterButton").addEventListener("click", openFilterSheet);
  $("#sortButton").addEventListener("click", () => {
    state.sort = state.sort === "value-desc" ? "name" : "value-desc";
    renderCollection();
  });
  $("#loadMorePositions").addEventListener("click", () => {
    state.visibleLimit += 100;
    renderCollection();
  });
  $("#selectPositionsButton").addEventListener("click", () =>
    setBulkMode(!state.bulkMode),
  );
  $("#bulkDoneButton").addEventListener("click", () => setBulkMode(false));
  $("#bulkOrganizeButton").addEventListener("click", openBulkOrganizeSheet);
  $("#bulkSelectShown").addEventListener("click", () => {
    const allShown =
      state.visiblePositionIds.length &&
      state.visiblePositionIds.every((id) => state.bulkSelected.has(id));
    state.visiblePositionIds.forEach((id) =>
      allShown ? state.bulkSelected.delete(id) : state.bulkSelected.add(id),
    );
    renderCollection();
  });
  $("#clearFilters").addEventListener("click", () => {
    state.query = "";
    state.ledgerView = "all";
    state.setFilter = "";
    state.conditionFilter = "";
    state.labelFilter = "";
    $("#collectionSearch").value = "";
    syncTabs();
    renderCollection();
  });
  $("#emptyAddCard").addEventListener("click", () => {
    if (state.accountLoadError) void retryAccountLoad();
    else routeTo("scan");
  });
  $("#methodButton").addEventListener("click", openMethodSheet);
  $("#syncState").addEventListener("click", () => {
    if (state.accountLoadError) void retryAccountLoad();
    else if (state.storageStatus === "error")
      toast(
        "Cloud save is unavailable · changes may last only for this session",
      );
    else if (state.pricingStatus !== "loading") {
      state.movementStatus = "idle";
      void Promise.all([refreshLivePricing(), refreshWatchlistPricing()]);
    }
  });
  $("#manualSearchButton").addEventListener("click", openManualSearch);
  $("#sealedSearchButton").addEventListener("click", openSealedSearch);
  $("#reviewIntakeQueue").addEventListener("click", openIntakeQueueSheet);
  renderIntakeQueueBar();
  $("#cameraInput").addEventListener("change", (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    validateImage(file);
  });
  $("#galleryInput").addEventListener("change", (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    validateImage(file);
  });
  $("#sheetBackdrop").addEventListener("click", closeSheet);
  $("#exportButton").addEventListener("click", downloadAccountBackup);
  $("#exportCsvButton").addEventListener("click", downloadCollectionCsv);
  $("#importButton").addEventListener("click", () => $("#csvInput").click());
  $("#sharePortfolioButton").addEventListener("click", openSharePortfolioSheet);
  $("#insuranceReportButton").addEventListener("click", openInsuranceReport);
  $("#batchGradingButton").addEventListener("click", openBatchGradingPlanner);
  $("#businessRange").addEventListener("change", (event) => {
    state.businessRange = event.target.value;
    renderBusinessSummary();
  });
  $("#businessExport").addEventListener("click", downloadBusinessReport);
  [
    "#liquidationReferencePercent",
    "#liquidationFeePercent",
    "#liquidationSellingCosts",
  ].forEach((selector) =>
    $(selector).addEventListener("input", renderLiquidationPlanner),
  );
  $("#liquidationExport").addEventListener(
    "click",
    downloadLiquidationScenario,
  );
  $$("[data-workspace-mode]").forEach((button) =>
    button.addEventListener("click", () =>
      applyWorkspaceMode(button.dataset.workspaceMode, { announce: true }),
    ),
  );
  $$("[data-ui-theme-option]").forEach((button) =>
    button.addEventListener("click", () =>
      applyUiTheme(button.dataset.uiThemeOption, { announce: true }),
    ),
  );
  $("#themeQuickSwitch").addEventListener("click", () =>
    applyUiTheme(uiTheme === "clean" ? "analytics" : "clean", {
      announce: true,
    }),
  );
  $("#workspaceExpand").addEventListener("click", () =>
    applyWorkspaceMode("growth", { announce: true }),
  );
  $("#csvInput").addEventListener("change", (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (file) handleCsv(file);
  });
  $$("[data-info]").forEach((button) =>
    button.addEventListener("click", () => openInfo(button.dataset.info)),
  );
  $("#currencyButton").addEventListener("click", () =>
    toast("USD display currency · source currencies preserved"),
  );
  $("#installAppButton").addEventListener(
    "click",
    () => void openInstallExperience(),
  );
  $("#motionButton").addEventListener("click", cycleMotionPreference);
  $("#targetAlertButton").addEventListener(
    "click",
    () => void toggleTargetAlerts(),
  );
  $("#moreButton").addEventListener("click", () => {
    if (!requireAccountData()) return;
    openSheet(
      `<div class="sheet-heading"><div><h2 id="sheetTitle">Library options</h2><p>Keep portable copies of your card data.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="settings-group"><button type="button" id="sheetAccountBackup"><span>Complete account backup<small>Cards, transaction history, purchase lots, and watchlist</small></span><b>›</b></button><button type="button" id="sheetCollectionCsv"><span>Collection CSV<small>Importable copy of current positions</small></span><b>›</b></button></div>`,
    );
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest("#sheetAccountBackup") && downloadAccountBackup())
      closeSheet();
    if (event.target.closest("#sheetCollectionCsv") && downloadCollectionCsv())
      closeSheet();
  });
  document.addEventListener("keydown", handleDialogKeydown);
  window.addEventListener("popstate", (event) => {
    if (!$("#bottomSheet").hidden) {
      closeSheet({ fromHistory: true });
      return;
    }
    const route =
      event.state?.route ||
      (["scan", "insights", "trade", "profile"].includes(location.hash.slice(1))
        ? location.hash.slice(1)
        : "collection");
    state.detailCanPop = false;
    if (route === "trade") renderTrade();
    routeTo(route, { instant: true, history: "none" });
  });
  bindQuickCardSearch();
  bindTradeUI();
  applyWorkspaceMode(workspaceMode);
  applyUiTheme(uiTheme);
}

function validateImage(file) {
  if (!file) return;
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ];
  if (!allowed.includes(file.type)) {
    toast("Choose a JPEG, PNG, WebP, HEIC, or HEIF image");
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    toast("Image is over the 12 MB capture limit");
    return;
  }
  showProcessing(file);
}

let appEventsBound = false;

function authMessage(message, error = false) {
  const node = $("#authMessage");
  node.textContent = message;
  node.style.color = error ? "var(--danger)" : "var(--pine-2)";
}

function bindAuthUI() {
  $("#passwordAuthForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    authMessage("Signing in…");
    const { error } = await signInWithPassword(
      supabase,
      String(data.get("email")).trim(),
      String(data.get("password")),
    );
    if (error) authMessage(error.message, true);
  });
  $("#passwordSignUp").addEventListener("click", async () => {
    const form = $("#passwordAuthForm");
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    authMessage("Creating your account…");
    const { data: result, error } = await signUpWithPassword(
      supabase,
      String(data.get("email")).trim(),
      String(data.get("password")),
    );
    if (error) authMessage(error.message, true);
    else
      authMessage(
        result.session
          ? "Account created. Loading your portfolio…"
          : "Check your email to confirm your account, then sign in.",
      );
  });
  $("#magicLinkForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email")).trim();
    authMessage("Sending your secure magic link…");
    const { error } = await sendMagicLink(supabase, email);
    authMessage(
      error ? error.message : "Magic link sent. Check your email.",
      Boolean(error),
    );
  });
}

async function openAdminDiagnostics() {
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Pricing diagnostics</h2><p>Protected administrator view</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="info-copy" id="diagnosticsContent"><p>Loading provider health, mappings, and anomalies…</p></div><p class="form-error" id="diagnosticsError" role="alert"></p><div class="sheet-actions"><button class="secondary" id="diagnosticsClose" type="button">Close</button><button class="primary" id="manualPriceSync" type="button">Run price sync</button></div>`,
  );
  $("#diagnosticsClose").addEventListener("click", closeSheet);
  const render = async () => {
    const diagnostics = await loadDiagnostics(supabase);
    if (diagnostics.errors.length) throw diagnostics.errors[0];
    const providerRows =
      diagnostics.providers
        .map(
          (provider) =>
            `<div class="transaction-row"><div><strong>${esc(provider.provider)} · ${provider.enabled ? "Enabled" : "Disabled"}</strong><span>${provider.disabled_reason ? esc(provider.disabled_reason) : `Last success: ${esc(provider.last_success_at || "Never")} · Last failure: ${esc(provider.last_failure_at || "None")}`}</span><span>Error: ${esc(provider.last_error_code || "None")} · Rate limit remaining: ${esc(provider.rate_limit_remaining ?? "Unknown")}</span></div></div>`,
        )
        .join("") || "<p>No provider status rows.</p>";
    const mappingRows =
      diagnostics.mappings
        .map(
          (mapping) =>
            `<div class="transaction-row"><div><strong>${esc(mapping.provider)} · ${esc(mapping.match_status)}</strong><span>Confidence: ${esc(mapping.match_confidence ?? "Unknown")} · Updated: ${esc(mapping.updated_at || "Unknown")}</span></div></div>`,
        )
        .join("") || "<p>No ambiguous or missing mappings.</p>";
    const anomalyRows =
      diagnostics.anomalies
        .map(
          (anomaly) =>
            `<div class="transaction-row"><div><strong>${esc(anomaly.anomaly_type)}</strong><span>Measured: ${esc(anomaly.measured_percent ?? "Unknown")}% · Threshold: ${esc(anomaly.threshold_percent ?? "Unknown")}%</span><span>Opened: ${esc(anomaly.created_at || "Unknown")}</span></div></div>`,
        )
        .join("") || "<p>No open price anomalies.</p>";
    $("#diagnosticsContent").innerHTML =
      `<h3>Provider health</h3><div class="transaction-list">${providerRows}</div><h3>Mapping review queue</h3><div class="transaction-list">${mappingRows}</div><h3>Open anomalies</h3><div class="transaction-list">${anomalyRows}</div>`;
  };
  try {
    await render();
  } catch (error) {
    $("#diagnosticsError").textContent =
      `Could not load diagnostics: ${error.message || "Administrator access is required"}`;
  }
  $("#manualPriceSync").addEventListener("click", async () => {
    const button = $("#manualPriceSync");
    button.disabled = true;
    $("#diagnosticsError").textContent = "Running the protected provider sync…";
    try {
      const response = await fetch("/api/price-sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${state.session.access_token}` },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          result.error || `Request failed with status ${response.status}`,
        );
      $("#diagnosticsError").textContent =
        `Sync complete: ${result.inserted} observations added, ${result.duplicates} duplicates, ${result.failures} failures.`;
      await render();
    } catch (error) {
      $("#diagnosticsError").textContent =
        `Price sync failed: ${error.message || "Unknown error"}`;
    } finally {
      button.disabled = false;
    }
  });
}

function ensureProfileAccount() {
  const email = state.session?.user?.email || "Signed in";
  const heading = $("#profileTitle");
  if (heading) heading.textContent = "Your portfolio account";
  const profile = $(".profile-card");
  const strong = profile?.querySelector("strong");
  const span = profile?.querySelector("span");
  if (strong) strong.textContent = email;
  if (span)
    span.textContent =
      "Collection, transactions, and FIFO lots sync to Supabase";
  const isAdmin = state.session?.user?.app_metadata?.role === "admin";
  let diagnostics = $("#adminDiagnosticsButton");
  if (isAdmin && !diagnostics) {
    diagnostics = document.createElement("button");
    diagnostics.id = "adminDiagnosticsButton";
    diagnostics.type = "button";
    diagnostics.className = "profile-admin";
    diagnostics.textContent = "Pricing diagnostics and manual re-sync";
    $("#view-profile").insertBefore(
      diagnostics,
      $("#view-profile .legal-copy"),
    );
  } else if (!isAdmin && diagnostics) {
    diagnostics.remove();
    diagnostics = null;
  }
  if (diagnostics) diagnostics.onclick = () => void openAdminDiagnostics();
  let button = $("#signOutButton");
  if (!button) {
    button = document.createElement("button");
    button.id = "signOutButton";
    button.type = "button";
    button.className = "profile-signout";
    button.textContent = "Sign out";
    $("#view-profile").insertBefore(button, $("#view-profile .legal-copy"));
  }
  button.onclick = async () => {
    button.disabled = true;
    const { error } = await signOut(supabase);
    if (error) {
      toast(error.message);
      button.disabled = false;
    }
  };
  updateInstallControl();
  applyMotionPreference();
  updateTargetAlertControl();
}

async function retryAccountLoad() {
  if (state.accountLoading || !state.session) return;
  state.accountLoading = true;
  renderCollection();
  try {
    const [items, watchlist] = await Promise.all([
      loadPortfolio(supabase),
      loadWatchlist(supabase),
    ]);
    state.items = items;
    state.watchlist = watchlist;
    state.storageStatus = "cloud";
    state.accountLoadError = "";
    state.accountLoading = false;
    renderCollection();
    renderInsights();
    renderTrade();
    toast("Your cloud portfolio is available again");
    await Promise.all([refreshLivePricing(), refreshWatchlistPricing()]);
  } catch (error) {
    state.items = [];
    state.watchlist = [];
    state.storageStatus = "error";
    state.accountLoadError = error.message || "Cloud portfolio unavailable";
    state.accountLoading = false;
    renderCollection();
    renderInsights();
    renderTrade();
    toast("Your saved data is unchanged · Mica still cannot reach it");
  }
}

async function applySession(session) {
  state.session = session;
  $("#skipLink").setAttribute("href", session ? "#main" : "#authGate");
  document.body.classList.toggle("authenticated", Boolean(session));
  $("#authGate").hidden = Boolean(session);
  if (!session) {
    state.items = [];
    state.watchlist = [];
    state.detailId = null;
    state.detailCard = null;
    state.movementStatus = "idle";
    state.accountLoading = false;
    state.accountLoadError = "";
    chartInstance?.destroy();
    return;
  }
  if (!appEventsBound) {
    bindEvents();
    appEventsBound = true;
  }
  ensureProfileAccount();
  state.items = [];
  state.watchlist = [];
  state.detailId = null;
  state.detailCard = null;
  state.pricingStatus = "idle";
  state.pricingRetrievedAt = null;
  state.movementStatus = "idle";
  state.accountLoading = true;
  state.accountLoadError = "";
  renderCollection();
  renderInsights();
  renderTrade();
  routeTo(
    location.hash &&
      ["scan", "insights", "trade", "profile"].includes(location.hash.slice(1))
      ? location.hash.slice(1)
      : "collection",
    { instant: true, history: "replace" },
  );
  try {
    [state.items, state.watchlist] = await Promise.all([
      loadPortfolio(supabase),
      loadWatchlist(supabase),
    ]);
    state.storageStatus = "cloud";
    state.accountLoading = false;
    state.accountLoadError = "";
    renderCollection();
    renderInsights();
    renderTrade();
    await Promise.all([refreshLivePricing(), refreshWatchlistPricing()]);
  } catch (error) {
    state.items = [];
    state.watchlist = [];
    state.storageStatus = "error";
    state.accountLoading = false;
    state.accountLoadError = error.message || "Cloud portfolio unavailable";
    renderCollection();
    renderInsights();
    renderTrade();
    routeTo("collection", { instant: true, history: "replace" });
    toast("Your saved data is unchanged · Mica could not load it");
  }
}

async function bootstrap() {
  if (!supabase) {
    authMessage(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then rebuild.",
      true,
    );
    return;
  }
  bindAuthUI();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    authMessage(error.message, true);
    return;
  }
  await applySession(data.session);
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION") return;
    setTimeout(() => void applySession(session), 0);
  });
  if ("serviceWorker" in navigator && location.protocol !== "file:")
    navigator.serviceWorker.register("./sw.js").catch(() => {});
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallControl();
});
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  updateInstallControl();
  toast("Mica installed");
});
window
  .matchMedia("(display-mode: standalone)")
  .addEventListener?.("change", updateInstallControl);

applyUiTheme(uiTheme);
applyMotionPreference();
void bootstrap();
