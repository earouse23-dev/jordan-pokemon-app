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
  selectedInventoryShare,
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
  listingReviewItems,
  marketAdjustedPortfolioHistory,
  portfolioActions,
  portfolioReview,
  positionPerformance,
  purchaseEntryPoints,
  rebasePortfolioSnapshots,
  salePlan,
  targetAlertChanges,
  tradeAnalysis,
  tradeSummary,
  validateAcquisition,
  watchPerformance,
} from "./lib/portfolio.js";
import {
  graderCertificationLookup,
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
  loadProfile,
  loadPortfolio,
  loadPortfolioValuationHistory,
  loadWatchlist,
  recordGradingResult,
  recordGradingSubmission,
  recordPortfolioValuationSnapshot,
  recordPurchaseLot,
  recordSale,
  remapCollectionPosition,
  sendMagicLink,
  sendPasswordReset,
  saveProfile,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  splitCollectionPosition,
  updateGradingSubmission,
  updateAccountPassword,
  updatePosition,
  updateWatchlistEntry,
} from "./lib/supabase-data.js";

const supabase = createAppSupabase();
let chartInstance = null;
let chartMountVersion = 0;
let portfolioChartInstance = null;
let portfolioChartMountVersion = 0;
let deferredInstallPrompt = null;
let activeCameraStream = null;
let activeCameraTimer = null;
let motionPreference = "auto";
let targetAlertsEnabled = false;
let workspaceMode = "guided";
let uiTheme = "analytics";
let sessionLoadVersion = 0;
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
  portfolioHistory: [],
  portfolioHistoryMode: "return",
  portfolioHistoryRange: "3m",
  portfolioHistoryStatus: "idle",
  watchlist: [],
  intakeQueue: [],
  setCatalogs: new Map(),
  setCatalogLoading: new Set(),
  session: null,
  route: "collection",
  sidebarTarget: "dashboard",
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
  profile: null,
  preferences: {
    tradeValuePercent: 90,
    quickSalePercent: 80,
    sellingFeePercent: 0,
    otherSellingCosts: 0,
    collectorGoal: "collecting",
    experienceLevel: "beginner",
  },
  visionDestination: null,
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
const accountRequestIsCurrent = (ownerId, loadVersion) =>
  Boolean(ownerId) &&
  state.session?.user?.id === ownerId &&
  sessionLoadVersion === loadVersion;
const isShowcaseAccount = () =>
  state.session?.user?.app_metadata?.account_type === "showcase";
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
const workflowDefault = (key) => {
  try {
    const owner = state.session?.user?.id || "guest";
    return localStorage.getItem(`mica-workflow-${owner}-${key}`) || "";
  } catch {
    return "";
  }
};
const rememberWorkflowDefault = (key, value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return;
  try {
    const owner = state.session?.user?.id || "guest";
    localStorage.setItem(`mica-workflow-${owner}-${key}`, normalized);
  } catch {}
};
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
const recommendedWorkspace = (preferences = state.preferences) =>
  preferences?.experienceLevel === "professional"
    ? "pro"
    : preferences?.experienceLevel === "familiar"
      ? "growth"
      : "guided";
function applyProfileDetailDefault() {
  try {
    if (localStorage.getItem("mica-detail-level-version") === "2") return;
    applyWorkspaceMode(recommendedWorkspace());
    localStorage.setItem("mica-detail-level-version", "2");
  } catch {
    applyWorkspaceMode(recommendedWorkspace());
  }
}
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

function currencyInputValue(value) {
  const amount = Number(value);
  return value === null || value === undefined || !Number.isFinite(amount)
    ? ""
    : amount.toFixed(2);
}

function friendlyObservedAt(value) {
  if (!value) return "date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function priceStatusText(item) {
  if (item.price == null)
    return item.gradingCompany
      ? "Graded market price not connected"
      : "Matching market price unavailable";
  if (item.pricingStatus === "live")
    return `Updated ${friendlyObservedAt(item.pricingUpdatedAt)}`;
  if (item.pricingStatus === "stale")
    return `Stale · observed ${friendlyObservedAt(item.pricingUpdatedAt)}`;
  return "Demo estimate";
}

function applyWorkspaceMode(
  mode,
  { announce = false, userSelected = false } = {},
) {
  if (!["guided", "growth", "pro"].includes(mode)) return;
  workspaceMode = mode;
  document.body.dataset.workspace = mode;
  try {
    localStorage.setItem("mica-workspace-mode", mode);
    if (userSelected) localStorage.setItem("mica-detail-level-version", "2");
  } catch {}
  $$("[data-workspace-mode]").forEach((button) => {
    const active = button.dataset.workspaceMode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const copy = {
    guided: {
      title: "Simple view",
      intro:
        "See important price changes and the clearest thing to review next.",
      help: "Simple shows everyday collection tasks and hides seller math.",
    },
    growth: {
      title: "More tools view",
      intro:
        "See price changes, grading choices, selling estimates, and money reports.",
      help: "More tools adds grading, selling, and collection business reports.",
    },
    pro: {
      title: "Everything view",
      intro:
        "Use every price, grading, sales, and collection business tool in one denser view.",
      help: "Everything keeps all tools visible and fits more cards on each screen.",
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
  const label = dark ? "Dark" : "Light";
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
        : "Switch to dark dashboard interface",
    );
  if ($("#uiThemeHelp"))
    $("#uiThemeHelp").textContent = dark
      ? "Dark dashboard uses a dark background and fits more on screen. Your saved cards do not change."
      : "Clean modern uses a bright background and more space. Your saved cards do not change.";
  if (state.portfolioHistory.length) renderPortfolioHistory();
  if (announce) toast(`${dark ? "Dark dashboard" : "Clean modern"} selected`);
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
  return `<div class="price-source"><div>${source}<span>${esc(quote.finish)} · ${esc(quote.condition ? conditionLabel(quote.condition) : "Wear not specified")} · ${esc(quote.currency)}</span><span>Price dated ${esc(friendlyObservedAt(quote.observedAt))} · checked ${esc(friendlyObservedAt(quote.retrievedAt))}</span></div><div class="source-value"><b>${money(quote.amount, quote.currency)}</b><small>${esc(quote.attribution)}</small></div></div>`;
}

function showcaseReference(item) {
  const amount = Number(item?.demoPrice ?? item?.price);
  return isShowcaseAccount() && Number.isFinite(amount) && amount > 0
    ? amount
    : null;
}

function usesShowcaseFallback(item, pricingStatus = item?.pricingStatus) {
  return (
    showcaseReference(item) !== null &&
    !["live", "stale"].includes(String(pricingStatus || ""))
  );
}

function renderPriceEvidence(item, context) {
  if (usesShowcaseFallback(item)) {
    const contextLabel =
      item.cardState === "sealed"
        ? "Unopened product"
        : context.gradingCompany
          ? `${String(context.gradingCompany).toUpperCase()} ${context.grade}`
          : `Ungraded · ${conditionLabel(context.condition || "Near Mint")}`;
    return `<section class="price-confidence preview" aria-label="How reliable this price is"><div class="price-confidence-head"><div><span>How reliable is this price?</span><strong>Demo price</strong></div><b>Not live</b></div><p>This made-up price only shows how the finished screen works. It is limited to the demo account.</p><div class="price-confidence-facts"><span>${esc(contextLabel)}</span><span>Demo only</span><span>Real price connection ready</span></div></section>`;
  }
  const report = priceEvidence(
    item.quotes,
    item.variant,
    item.currency || "USD",
    context,
  );
  const contextLabel =
    item.cardState === "sealed"
      ? "Unopened product"
      : context.gradingCompany
        ? `${String(context.gradingCompany).toUpperCase()} ${context.grade}`
        : `Ungraded · ${conditionLabel(context.condition || "Near Mint")}`;
  const agreement =
    report.sourceCount === 0
      ? "No matching price source"
      : report.spreadPercent === null
        ? "One matching source"
        : report.spreadPercent <= 10
          ? "Sources are close"
          : report.spreadPercent <= 25
            ? "Sources differ somewhat"
            : "Sources differ a lot";
  const freshness = report.freshestAt
    ? `Newest price ${String(report.freshestAt).slice(0, 10)}`
    : "No price date";
  return `<section class="price-confidence ${report.level}" aria-label="How reliable this price is"><div class="price-confidence-head"><div><span>How reliable is this price?</span><strong>${esc(report.label)}</strong></div><b>${report.sourceCount} matching source${report.sourceCount === 1 ? "" : "s"}</b></div><p>${esc(report.summary)}</p><div class="price-confidence-facts"><span>${esc(contextLabel)}</span><span>${esc(agreement)}</span><span>${esc(freshness)}</span></div></section>`;
}

function renderGradedPriceLadder(item) {
  if (item.cardState === "sealed") return "";
  const rows = gradedPriceLadder(item.quotes, item.variant, "USD");
  const showcaseAmount =
    item.gradingCompany && !rows.length && usesShowcaseFallback(item)
      ? showcaseReference(item)
      : null;
  const ownedGrade = item.gradingCompany
    ? `${String(item.gradingCompany).toUpperCase()}:${item.grade}`
    : "";
  const content = rows.length
    ? `<div class="grade-ladder">${rows.map((row) => `<div class="grade-ladder-row${ownedGrade === `${row.grader}:${row.grade}` ? " current" : ""}"><div><strong>${esc(row.grader)} ${esc(row.grade)}</strong><span>${esc(row.priceType)} · ${esc(row.provider)}${row.observedAt ? ` · ${esc(String(row.observedAt).slice(0, 10))}` : ""}</span></div><b>${money(row.amount, row.currency)}</b></div>`).join("")}</div>`
    : showcaseAmount !== null
      ? `<div class="grade-ladder"><div class="grade-ladder-row current"><div><strong>${esc(String(item.gradingCompany).toUpperCase())} ${esc(item.grade)}</strong><span>Demo price · not live</span></div><b>${money(showcaseAmount, item.currency || "USD")}</b></div></div><div class="pro-data-empty"><strong>All professional grades are ready</strong><p>PkmnPrices Pro will replace this demo price and fill in matching grades automatically.</p></div>`
      : `<div class="pro-data-empty"><strong>Ready for professionally graded prices</strong><p>When PkmnPrices Pro is connected, matching PSA, BGS, and CGC prices will appear here. Mica will not use a different card version or grade.</p></div>`;
  return `<section class="detail-section advanced-workspace"><div class="detail-section-head"><h2>Prices by professional grade</h2><span>${rows.length ? `${rows.length} matching grade price${rows.length === 1 ? "" : "s"}` : showcaseAmount !== null ? "Demo price · Pro-ready" : "PkmnPrices-ready"}</span></div>${content}</section>`;
}

function renderCardMetadata(item) {
  const data = item.metadata || {};
  const facts = [
    ["Hit points (HP)", data.hp],
    ["Evolution stage", data.stage],
    ["Card type", data.cardType],
    ["Weakness", data.weakness],
    ["Resistance", data.resistance],
    ["Retreat cost", data.retreatCost],
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
    ? "These are prices sellers want for ungraded copies. They are not comparisons for this professionally graded card."
    : "These are prices sellers are asking, not completed sales or a guaranteed value.";
  return `<section class="detail-section advanced-workspace"><div class="detail-section-head"><h2>Cards currently for sale</h2><span>Lowest asking prices first</span></div>${item.offersStatus === "loading" ? '<div class="unavailable-panel">Loading prices for this card version…</div>' : item.offersStatus === "unconfigured" ? '<div class="pro-data-empty"><strong>Ready for cards currently for sale</strong><p>Connect PkmnPrices Pro to show matching TCGplayer and Cardmarket listings.</p></div>' : item.offersStatus === "error" ? '<div class="unavailable-panel">Seller prices are temporarily unavailable.<br><button class="inline-retry" id="retryOffersButton" type="button">Try again</button></div>' : `<div class="offer-grid">${groups}</div>`}<p class="offer-disclaimer">${context}</p></section>`;
}

function historySeriesForItem(item) {
  const finish = finishForVariant(item.variant);
  let exact = (item.priceHistory || []).filter((point) => {
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
  const showcaseAmount = showcaseReference(item);
  if (exact.length < 2 && showcaseAmount !== null) {
    const today = new Date();
    const multipliers = [0.74, 0.79, 0.77, 0.84, 0.88, 0.86, 0.94, 1];
    exact = multipliers.map((multiplier, index) => {
      const observed = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth() - (multipliers.length - index - 1),
          15,
        ),
      );
      return {
        provider: "Showcase sample",
        providerVariantId: `showcase:${item.uid || item.id}`,
        amount: Number((showcaseAmount * multiplier).toFixed(2)),
        currency: item.currency || "USD",
        finish,
        condition: item.gradingCompany ? null : item.condition,
        gradingCompany: item.gradingCompany || null,
        grade: item.gradingCompany ? String(item.grade) : null,
        recordedAt: observed.toISOString(),
        quality: { sample: true },
      };
    });
  }
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
    return `<div class="unavailable-panel"><strong>Price history needs PkmnPrices Pro.</strong><br>Today’s matching price still works. Mica will not draw a line until real past prices are connected.</div>`;
  if (history.length < 2)
    return `<div class="unavailable-panel">Mica needs matching prices from at least two different days before it can draw this chart.</div>`;
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
  return `<div class="history-summary"><div><span>Typical recorded price</span><strong>${money(average, last.currency)}</strong></div><div><span>Lowest to highest</span><strong>${money(min, last.currency)}–${money(max, last.currency)}</strong></div><div><span>Days with prices</span><strong>${history.length}</strong></div></div>
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
  return `<section class="entry-points" aria-label="Your purchases"><div class="entry-points-head"><div><span>Your purchases</span><strong>${entries.length} recorded</strong></div><div><span>Matching price today</span><strong>${current === null ? "Unavailable" : `${money(current, currency)} each`}</strong></div></div><div class="entry-point-list">${entries.map((entry) => `<div class="entry-point-row"><div><strong>${esc(entry.date || "Date not recorded")}</strong><span>${entry.quantity} ${noun}${entry.quantity === 1 ? "" : "s"} · ${money(entry.totalCostMinor / 100, currency)} total</span></div><div><span>You paid per ${noun}</span><strong>${money(entry.unitCostMinor / 100, currency)}</strong></div><div><span>Change per ${noun}</span><strong>${entry.changeMinor === null ? "Unavailable" : `${entry.changeMinor >= 0 ? "Up " : "Down "}${money(Math.abs(entry.changeMinor) / 100, currency)}`}</strong>${workspaceMode === "guided" ? "" : `<small>${entry.returnPercent === null ? "" : `${entry.returnPercent >= 0 ? "+" : ""}${entry.returnPercent.toFixed(1)}%`}</small>`}</div></div>`).join("")}</div></section>`;
}

function renderInteractiveHistory(item, currentPrice = item.price) {
  const history = historyForItem(item);
  const showcaseHistory = history.some((point) => point.quality?.sample);
  const entryPoints = renderEntryPoints(item, currentPrice);
  if (item.historyStatus === "plan_required" && history.length < 2)
    return `${entryPoints}<div class="unavailable-panel"><strong>Price history needs PkmnPrices Pro.</strong><br>Today’s matching price and your recorded purchases still work.</div>`;
  if (history.length < 2)
    return `${entryPoints}<div class="unavailable-panel">Mica needs prices from at least two days for this same ${item.gradingCompany ? `${esc(item.gradingCompany)} grade ${esc(item.grade)}` : esc(conditionLabel(item.condition))} card before it can draw a chart.</div>`;
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
    ? `${item.gradingCompany} grade ${item.grade}`
    : conditionLabel(item.condition);
  return `${entryPoints}<div class="history-summary"><div><span>${showcaseHistory ? "Typical demo price" : "Typical recorded price"}</span><strong>${money(average, last.currency)}</strong></div><div><span>Lowest to highest</span><strong>${money(min, last.currency)}–${money(max, last.currency)}</strong></div><div><span>${showcaseHistory ? "Demo days shown" : "Days with prices"}</span><strong>${history.length}</strong></div>${saleCount ? `<div><span>Reported sales</span><strong>${saleCount}</strong></div>` : ""}</div>
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
    <p class="chart-context">${showcaseHistory ? "Demo price line" : "Matching price line"}: ${esc(item.variant)} · ${esc(context)} · ${esc(last.currency)}. ${showcaseHistory ? "These made-up demo days only show how the chart works; they are not real market prices." : "Each price source stays separate so unlike prices are never mixed."}</p>
    <div class="chart-wrap"><canvas id="positionChart" role="img" aria-label="${esc(context)} prices over time with the dates you bought this card"></canvas></div>`;
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
      label: "When you bought it",
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
      label: "What you paid per card",
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
    return `<div class="unavailable-panel">Checking recent sales for this exact card…</div>`;
  const sales = comparableSales(item);
  if (!sales.length) {
    const copy =
      item.salesStatus === "unconfigured"
        ? "Recent sale prices are not connected yet. Cards that are merely listed for sale are not counted as completed sales."
        : item.salesStatus === "plan_required"
          ? "Recent sale prices are ready, but they need the PkmnPrices Pro plan."
          : item.salesStatus === "error"
            ? "Recent sales could not be checked. That does not mean the card has never sold."
            : "No recent sales matched this exact card and condition. Mica will not use a different card as a substitute.";
    return `<div class="unavailable-panel">${copy}${item.salesStatus === "error" ? '<br><button class="inline-retry" id="retrySalesButton" type="button">Try sales again</button>' : ""}</div>`;
  }
  return `<div class="sales-list">${sales
    .slice(0, 5)
    .map(
      (sale) =>
        `<a class="sale-row" href="${esc(sale.sourceUrl)}" target="_blank" rel="noreferrer"><div><strong>${esc(sale.title)}</strong><span>${esc(sale.soldAt)} · ${esc(sale.gradingCompany ? `${sale.gradingCompany} grade ${sale.grade}` : "Ungraded")}</span></div><b>${money(sale.amount, sale.currency)}</b></a>`,
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
  const canTrackPlan =
    Boolean(item.uid) &&
    item.cardState !== "sealed" &&
    !item.gradingCompany &&
    !item.activeGradingSubmission;
  const initialQuantity = item.uid ? Number(item.quantity) || 1 : 1;
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
    <div class="detail-section-head"><h2 id="gradingEstimatorTitle">Should I get this card graded?</h2><span>Cost and value estimate</span></div>
    <p class="estimator-intro">See what professional grading may cost and whether it may be worth it.</p>
    <div class="estimator-grid">
      <div class="field"><label for="estimateGrader">Grading company</label><select id="estimateGrader">${Object.keys(
        gradingServices,
      )
        .map((value) => `<option>${value}</option>`)
        .join("")}</select></div>
      <div class="field"><label for="estimateService">Speed and price option</label><select id="estimateService">${gradingServices.PSA.map((service, index) => `<option value="${index}">${esc(service.name)} · ${money(service.fee)}</option>`).join("")}</select></div>
      <div class="field"><label for="estimateQuantity">How many cards are you sending?</label><input id="estimateQuantity" type="number" inputmode="numeric" min="1" max="99999" step="1" value="${initialQuantity}"></div>
    </div>
    <details class="estimate-trip-costs"><summary>Add optional costs</summary><div class="estimator-grid"><div class="field"><label for="estimateShipping">Shipping there and back</label><input id="estimateShipping" type="number" inputmode="decimal" min="0" step="0.01" value="0.00"></div><div class="field"><label for="estimateInsurance">Shipping insurance</label><input id="estimateInsurance" type="number" inputmode="decimal" min="0" step="0.01" value="0.00"></div><div class="field"><label for="estimateSellingCosts">Fees if you sell it</label><input id="estimateSellingCosts" type="number" inputmode="decimal" min="0" step="0.01" value="0.00"></div></div></details>
    <div class="estimate-result" aria-live="polite"><div><span>Estimated total cost</span><strong id="estimateTotal">${money(defaultService.fee)}</strong></div><div><span>Estimated cost for each card</span><strong id="estimatePerCard">${money(defaultService.fee)}</strong></div></div>
    <p class="estimate-note" id="estimateNote">${esc(defaultService.note || "No listed submission minimum")}</p>
    ${canTrackPlan ? `<button class="planner-record" id="useGradingPlanButton" type="button" disabled>Save this estimate and track my cards</button><p class="planner-fee-note" id="useGradingPlanHelp">Mica will remember this estimate while the cards are away. All ${item.quantity} card${item.quantity === 1 ? "" : "s"} in this saved entry must be included.</p>` : ""}
    <div class="grading-decision">
      <div class="decision-heading"><div><span>Simple comparison</span><h3>Could grading be worth it?</h3></div><p>Compare the card’s value now with what it may be worth after grading.</p></div>
      <div class="estimator-grid decision-inputs">
        <div class="field"><label for="estimateRawValue">What it may sell for now</label><div class="money-input"><span>$</span><input id="estimateRawValue" type="number" inputmode="decimal" min="0" step="0.01" value="${currencyInputValue(rawQuote?.amount)}" placeholder="Enter current value"></div></div>
        <div class="field"><label for="estimateTargetGrade">Grade you think it may receive</label><select id="estimateTargetGrade">${["10", "9.5", "9", "8.5", "8", "7", "6"].map((value) => `<option ${value === "10" ? "selected" : ""}>${value}</option>`).join("")}</select></div>
        <div class="field"><label for="estimateGradedValue">What it may sell for after grading</label><div class="money-input"><span>$</span><input id="estimateGradedValue" type="number" inputmode="decimal" min="0" step="0.01" value="${currencyInputValue(gradedQuote?.amount)}" placeholder="Enter expected value"></div></div>
      </div>
      <p class="decision-source" id="decisionSource">${gradedQuote ? `Using a matching price for ${esc(gradedQuote.gradingCompany)} grade ${esc(gradedQuote.grade)}. You can change either value.` : "No matching PSA grade 10 price is available. Enter a realistic amount yourself."}</p>
      <div class="decision-verdict neutral" id="decisionVerdict" aria-live="polite"><span>Complete the values above</span><strong>Then Mica will compare both paths.</strong></div>
      <div class="decision-metrics advanced-workspace"><div><span>Minimum graded value to cover the cost</span><strong id="decisionBreakEven">—</strong></div><div><span>Possible value gained by grading</span><strong id="decisionValueAdded">—</strong></div><div><span>Possible money gained after what you paid</span><strong id="decisionProfit">—</strong></div></div>
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
  const trackingButton = $("#useGradingPlanButton");
  let latestSubmissionPlan = null;
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
    const tracksWholePosition =
      Boolean(item.uid) && count === Number(item.quantity);
    latestSubmissionPlan =
      total !== null &&
      !(entry.minimum && count < entry.minimum) &&
      tracksWholePosition
        ? {
            grader: grader.value,
            estimatedTotalCost: (total / 100).toFixed(2),
            notes: `${entry.name} service estimate from Mica`,
          }
        : null;
    if (trackingButton) trackingButton.disabled = !latestSubmissionPlan;
    if ($("#useGradingPlanHelp") && !tracksWholePosition)
      $("#useGradingPlanHelp").textContent =
        `This tracker covers all ${item.quantity} card${item.quantity === 1 ? "" : "s"} in this saved entry. Use that number, or separate the copies before sending fewer cards.`;
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
        "<span>Add realistic values now and after grading</span><strong>Then Mica will compare both choices.</strong>";
      $("#decisionBreakEven").textContent = "—";
      $("#decisionValueAdded").textContent = "—";
      $("#decisionProfit").textContent = "—";
      return;
    }
    const favorable = decision.valueAddedMinor >= 0;
    verdict.className = `decision-verdict ${favorable ? "positive" : "negative"}`;
    verdict.innerHTML = favorable
      ? `<span>Grading may be worth it</span><strong>The graded card may be worth about ${money(decision.valueAddedMinor / 100)} more after estimated costs.</strong>`
      : `<span>Keeping it ungraded may be better</span><strong>After estimated costs, grading may leave you about ${money(Math.abs(decision.valueAddedMinor) / 100)} worse off.</strong>`;
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
    gradedValue.value = currencyInputValue(quote?.amount);
    $("#decisionSource").textContent = quote
      ? `Using a matching price for ${quote.gradingCompany} grade ${quote.grade}. You can change either value.`
      : `No matching price for ${grader.value} grade ${targetGrade.value} is available. Enter a realistic amount yourself.`;
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
      "Using the amount you entered. Choose a realistic value and include any selling fees.";
    update();
  });
  [service, quantity, shipping, insurance, selling, rawValue].forEach((input) =>
    input.addEventListener("input", update),
  );
  trackingButton?.addEventListener("click", () => {
    if (!latestSubmissionPlan) return;
    openGradingSubmissionSheet(item, null, latestSubmissionPlan);
  });
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
      `<div class="sheet-heading"><div><h2 id="sheetTitle">Grade several cards</h2><p>Estimate the cost and possible value before sending ungraded cards.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="find-empty"><strong>No ungraded cards in your library</strong><span>Add an ungraded card first. Then Mica can compare keeping it ungraded with sending it for professional grading.</span></div><div class="sheet-actions"><button class="primary" id="batchAddRawCard" type="button">Add an ungraded card</button></div>`,
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
      return `<article class="batch-grade-row${preselected.has(index) ? " selected" : ""}" data-batch-index="${index}"><label class="batch-grade-select"><input data-batch-selected type="checkbox" ${preselected.has(index) ? "checked" : ""}><img src="${esc(item.thumb || "./icons/icon.svg")}" alt=""><span><strong>${esc(item.name)}</strong><small>${esc(item.set)} · ${esc(item.number)} · ${esc(conditionLabel(item.condition || "Near Mint"))}</small></span></label><div class="batch-grade-values"><label>How many?<input data-batch-quantity type="number" inputmode="numeric" min="1" max="${Number(item.quantity)}" step="1" value="1"></label><label>Value now<div class="money-input"><span>$</span><input data-batch-raw type="number" inputmode="decimal" min="0" step="0.01" value="${item.price ?? ""}" placeholder="0.00"></div></label><label>Value after grading<div class="money-input"><span>$</span><input data-batch-expected type="number" inputmode="decimal" min="0" step="0.01" value="${graded?.amount ?? ""}" placeholder="Enter value"></div></label></div></article>`;
    })
    .join("");
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Grade several cards</h2><p>Compare keeping them ungraded with sending them for professional grading.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="batch-grade-controls"><div class="field"><label for="batchGrader">Grading company</label><select id="batchGrader">${Object.keys(
      gradingServices,
    )
      .map((value) => `<option>${value}</option>`)
      .join(
        "",
      )}</select></div><div class="field"><label for="batchService">Speed and price option</label><select id="batchService"></select></div><div class="field"><label for="batchTargetGrade">Grade you think they may receive</label><select id="batchTargetGrade">${["10", "9.5", "9", "8.5", "8", "7", "6"].map((value) => `<option>${value}</option>`).join("")}</select></div></div><details class="estimate-trip-costs"><summary>Add optional costs</summary><div class="batch-grade-controls"><div class="field"><label for="batchShipping">Shipping there and back</label><input id="batchShipping" type="number" inputmode="decimal" min="0" step="0.01" value="0.00"></div><div class="field"><label for="batchInsurance">Shipping insurance</label><input id="batchInsurance" type="number" inputmode="decimal" min="0" step="0.01" value="0.00"></div><div class="field"><label for="batchSelling">Fees if you sell them</label><input id="batchSelling" type="number" inputmode="decimal" min="0" step="0.01" value="0.00"></div></div></details><div class="batch-grade-head"><strong>Choose ungraded cards</strong><span id="batchSelectedCount">0 cards selected</span></div><div class="batch-grade-list">${rows}</div><p class="estimate-note" id="batchServiceNote"></p><div id="batchGradeOutput" aria-live="polite"></div><p class="estimate-disclaimer">This is only an estimate. Grades, prices, and fees can change. Check the grading company’s current rules and prices before sending your cards.</p>`,
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
        '<div class="unavailable-panel"><strong>Check the selected cards.</strong><br>Do not enter more cards than you own. Add a current value and a realistic value after grading for each card.</div>';
      return;
    }
    const favorable = plan.valueAddedMinor >= 0;
    $("#batchGradeOutput").innerHTML =
      `<div class="decision-verdict ${favorable ? "positive" : "negative"}"><span>${favorable ? "Grading may be worth it" : "Keeping them ungraded may be better"}</span><strong>${favorable ? `The cards may be worth ${money(plan.valueAddedMinor / 100)} more after estimated costs.` : `After estimated costs, grading may leave you ${money(Math.abs(plan.valueAddedMinor) / 100)} worse off.`}</strong></div><div class="batch-grade-summary advanced-workspace"><div><span>Value now</span><strong>${money(plan.rawValueTotalMinor / 100)}</strong></div><div><span>Possible value after grading</span><strong>${money(plan.expectedGradedValueTotalMinor / 100)}</strong></div><div><span>Estimated grading cost</span><strong>${money(plan.gradingCostMinor / 100)}</strong></div><div><span>Average value needed to cover the cost</span><strong>${money(plan.breakEvenAverageMinor / 100)}</strong></div><div><span>Possible value gained by grading</span><strong>${plan.valueAddedMinor >= 0 ? "+" : ""}${money(plan.valueAddedMinor / 100)}</strong></div><div><span>Possible money gained after what you paid</span><strong>${plan.potentialProfitMinor === null ? "Add what you paid first" : `${plan.potentialProfitMinor >= 0 ? "+" : ""}${money(plan.potentialProfitMinor / 100)}`}</strong></div></div>`;
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
  if (options.sidebarTarget) state.sidebarTarget = options.sidebarTarget;
  else if (route !== "detail")
    state.sidebarTarget =
      {
        collection: "dashboard",
        scan: "add",
        insights: "analytics",
        trade: "trades",
        profile: "settings",
      }[route] || state.sidebarTarget;
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
    scan: ["Add items", "Find cards and unopened products"],
    insights: ["Prices", "Price changes and clear next steps"],
    trade: ["Trade check", "Compare both sides before you agree"],
    profile: ["Settings", "Account, appearance, and preferences"],
    detail: ["Card details", "Identity, price, and your purchase"],
  }[route] || ["Mica", "Your collection workspace"];
  if ($("#headerSection")) $("#headerSection").textContent = headerCopy[0];
  if ($("#headerSubtitle")) $("#headerSubtitle").textContent = headerCopy[1];
  syncWorkspaceChrome();
  if (route === "profile") void refreshCapabilityStatus();
  if (route === "detail") renderDetail();
  // A newly selected workspace should never inherit the previous page's
  // scroll position. Smooth scrolling exposed half-rendered transitions.
  window.scrollTo({ top: 0, behavior: "auto" });
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

const workspaceCopy = Object.freeze({
  dashboard: ["Dashboard", "Welcome back", "Here’s your collection overview."],
  collection: [
    "Collection",
    "My Collection",
    "Browse, filter, and manage every item you own.",
  ],
  sets: ["Sets", "All Sets", "Track exact set progress and missing cards."],
  sealed: [
    "Unopened Products",
    "Unopened Products",
    "Booster boxes, Elite Trainer Boxes, tins, and bundles.",
  ],
  graded: [
    "Graded Cards",
    "Graded Cards",
    "Cards checked and sealed in a case by a professional grading company.",
  ],
  watchlist: [
    "Watching",
    "Cards You’re Watching",
    "Cards and unopened products you may want to buy.",
  ],
});

function syncWorkspaceChrome() {
  document.body.dataset.sidebarTarget = state.sidebarTarget;
  $$("[data-sidebar-target]").forEach((button) => {
    const active = button.dataset.sidebarTarget === state.sidebarTarget;
    button.classList.toggle("active", active);
    if (button.classList.contains("sidebar-item")) {
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
  });
  if (state.route !== "collection") return;
  const copy = workspaceCopy[state.sidebarTarget] || workspaceCopy.collection;
  if ($("#headerSection")) $("#headerSection").textContent = copy[0];
  if ($("#headerSubtitle")) $("#headerSubtitle").textContent = copy[2];
  if ($("#collectionTitle")) $("#collectionTitle").textContent = copy[1];
  if ($(".collection-subtitle"))
    $(".collection-subtitle").textContent = copy[2];
}

function openWorkspaceShortcut(target) {
  const collectionTarget = (ledgerView, condition = "") => {
    state.sidebarTarget = target;
    state.ledgerView = ledgerView;
    state.conditionFilter = condition;
    state.setFilter = "";
    state.labelFilter = "";
    syncTabs();
    renderCollection();
    routeTo("collection", { sidebarTarget: target });
  };
  if (target === "dashboard") return collectionTarget("all");
  if (target === "collection") {
    collectionTarget("all");
    return;
  }
  if (target === "sets") return collectionTarget("sets");
  if (target === "sealed") return collectionTarget("all", "Sealed");
  if (target === "graded") return collectionTarget("graded");
  if (target === "watchlist" || target === "alerts")
    return collectionTarget("watchlist");
  if (["add", "search", "photo"].includes(target)) {
    routeTo("scan", { sidebarTarget: target === "photo" ? "add" : target });
    if (target === "photo") void openCardCamera();
    else if (target === "search") $("#quickCardSearch")?.focus();
    return;
  }
  if (target === "trades") {
    renderTrade();
    routeTo("trade", { sidebarTarget: target });
    return;
  }
  if (["portfolio"].includes(target)) {
    collectionTarget("all");
    requestAnimationFrame(() =>
      $("#portfolioHistory")?.scrollIntoView({ block: "center" }),
    );
    return;
  }
  if (["analytics", "sales", "purchases", "seller"].includes(target)) {
    if (["sales", "purchases"].includes(target) && workspaceMode === "guided")
      applyWorkspaceMode("growth", { announce: true });
    renderInsights();
    void refreshMovementHistory();
    routeTo("insights", { sidebarTarget: target });
    const selector =
      target === "sales"
        ? "#businessReportTitle"
        : target === "purchases"
          ? "#recentActivity"
          : target === "seller"
            ? "#liquidationTitle"
            : "#view-insights .insight-feature";
    requestAnimationFrame(() =>
      $(selector)?.scrollIntoView({ block: "start" }),
    );
    return;
  }
  if (target === "business") {
    if (workspaceMode === "guided")
      applyWorkspaceMode("growth", { announce: true });
    renderInsights();
    void refreshMovementHistory();
    routeTo("insights", { sidebarTarget: target });
    requestAnimationFrame(() =>
      $("#businessReportTitle")?.scrollIntoView({ block: "start" }),
    );
    return;
  }
  if (["reports", "import", "settings"].includes(target)) {
    routeTo("profile", { sidebarTarget: target });
    const selector =
      target === "reports"
        ? "#insuranceReportButton"
        : target === "import"
          ? "#importButton"
          : ".appearance-settings";
    requestAnimationFrame(() =>
      $(selector)?.scrollIntoView({ block: "center" }),
    );
  }
}

function watchContextLabel(item) {
  return item.cardState === "sealed"
    ? "Unopened product"
    : item.cardState === "graded"
      ? `${item.gradingCompany} grade ${item.grade}`
      : conditionLabel(item.condition || "Near Mint");
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
    state.sort === "value-desc" ? "Most valuable first " : "Name, A to Z ";
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
        ? `${performance.changeMinor >= 0 ? "Up " : "Down "}${money(Math.abs(performance.changeMinor) / 100, item.currency)} since you started watching`
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
    ? "You are not watching any cards yet"
    : "No watched items match";
  $("#collectionEmptyCopy").textContent = trulyEmpty
    ? "Find a card or unopened product and choose Watch. Mica can tell you when it reaches the price you want."
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
    state.sort === "value-desc" ? "Closest to complete " : "Name, A to Z ";
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
  return `<div class="sheet-heading"><div><h2 id="sheetTitle">${esc(catalog.name)}</h2><p>You have ${group.ownedCount} of ${catalog.totalCount} different cards · ${group.percent?.toFixed(1) || 0}% complete</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="set-sheet-progress"><span>Your progress</span><strong>${catalog.totalCount - group.ownedCount} cards left</strong><div class="set-progress-track"><i style="width:${group.percent || 0}%"></i></div></div><div class="set-share-action"><div><strong>Cards you still need</strong><span>Copy card names and the numbers printed at the bottom without sharing private collection data.</span></div><button id="copyMissingList" type="button" ${catalog.totalCount === group.ownedCount ? "disabled" : ""}>${catalog.totalCount === group.ownedCount ? "Set complete" : "Copy list"}</button></div><div class="set-check-tools"><label class="search-field"><span class="sr-only">Search this set</span><input id="setChecklistSearch" type="search" placeholder="Search this set"></label><label class="missing-toggle"><input id="missingOnly" type="checkbox" checked> Show only cards I need</label></div><div class="set-checklist" id="setChecklist" aria-live="polite"></div>`;
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
    `<div class="sheet-heading"><div><h2 id="sheetTitle">${esc(group.name)}</h2><p>Loading the card list…</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="searching-cards"><i></i><span>Checking every card number…</span></div>`,
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
  $("#bulkShareButton").disabled = selectedCount === 0;
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
    toast("Select at least one saved card");
    return;
  }
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Organize ${selected.length} saved card${selected.length === 1 ? "" : "s"}</h2><p>Only the choices below will change. Card details, grade, what you paid, and purchase history stay the same.</p></div><button class="sheet-close" aria-label="Close">×</button></div><form id="bulkOrganizeForm"><div class="form-grid"><div class="field"><label for="bulkLabelMode">Label</label><select id="bulkLabelMode" name="labelMode"><option value="keep">Keep current labels</option><option value="add">Add a label</option><option value="remove">Remove a label</option></select></div><div class="field" id="bulkLabelField" hidden><label for="bulkLabel">Label name</label><input id="bulkLabel" name="label" maxlength="40" placeholder="Trade binder"></div><div class="field"><label for="bulkLocationMode">Where they are stored</label><select id="bulkLocationMode" name="locationMode"><option value="keep">Keep current locations</option><option value="set">Use one location</option><option value="clear">Remove locations</option></select></div><div class="field" id="bulkLocationField" hidden><label for="bulkLocation">Location</label><input id="bulkLocation" name="location" maxlength="250" placeholder="Binder 2 · Shelf A"></div><div class="field full"><label for="bulkStatus">Keep these in your main collection?</label><select id="bulkStatus" name="status"><option value="keep">No change</option><option value="owned">Yes, keep them here</option><option value="archived">No, move them to archived</option></select><small>Cards for sale are reviewed one at a time so Mica never guesses a selling price.</small></div><p class="form-error" id="bulkOrganizeError" role="alert"></p></div><div class="sheet-actions"><button class="secondary" type="button" id="bulkOrganizeCancel">Cancel</button><button class="primary" type="submit">Save changes</button></div></form>`,
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
        `${selected.length} saved card${selected.length === 1 ? "" : "s"} organized`,
      );
    } catch (error) {
      submit.disabled = false;
      $("#bulkOrganizeError").textContent =
        `Could not organize these saved cards: ${error.message || "Unknown error"}`;
    }
  });
}

function openSelectedShareSheet() {
  if (!requireAccountData()) return;
  const selected = state.items.filter((item) =>
    state.bulkSelected.has(item.uid),
  );
  if (!selected.length) {
    toast("Select at least one saved card");
    return;
  }
  const defaultMode = workspaceMode === "guided" ? "showcase" : "asking";
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Share selected cards</h2><p>${selected.length} saved card${selected.length === 1 ? "" : "s"} selected · preview exactly what will be shared</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="field"><label for="selectedShareMode">What should the list show?</label><select id="selectedShareMode"><option value="showcase" ${defaultMode === "showcase" ? "selected" : ""}>Card list · no prices</option><option value="asking" ${defaultMode === "asking" ? "selected" : ""}>For sale · my selling prices</option><option value="market">Price check · today’s matching prices</option></select><small>Missing prices stay blank. Mica never uses the price of a different card, wear level, or grade.</small></div>${selected.some((item) => item.gradingCompany && item.certificationNumber) ? '<label class="share-performance"><input id="selectedShareCertifications" type="checkbox"> Include graded-card certification numbers</label>' : ""}<div class="share-list-status" id="selectedShareStatus" aria-live="polite"></div><pre class="share-preview" id="selectedSharePreview"></pre><div class="simple-note"><strong>Your private details stay private.</strong><br>What you paid, money gained, purchase dates, notes, storage, account details, and purchase or sale history are never included. Certification numbers are excluded unless you choose to include them.</div><div class="sheet-actions share-list-actions"><button class="secondary" id="downloadSelectedList" type="button">Download spreadsheet</button><button class="secondary" id="copySelectedList" type="button">Copy list</button>${navigator.share ? '<button class="primary" id="nativeShareSelectedList" type="button">Share…</button>' : ""}</div>`,
  );
  const shareRows = selected.map((item) => {
    const quote = selectReferenceQuote(
      item.quotes,
      item.variant,
      item.currency || "USD",
      item,
    );
    return {
      ...item,
      referenceProvider: quote?.provider || "",
      referenceObservedAt:
        quote?.observedAt || quote?.retrievedAt || item.pricingUpdatedAt || "",
    };
  });
  const create = () =>
    selectedInventoryShare(shareRows, {
      mode: $("#selectedShareMode").value,
      includeCertification: Boolean($("#selectedShareCertifications")?.checked),
      date: localIsoDate(),
    });
  const update = () => {
    const share = create();
    $("#selectedSharePreview").textContent = share.text;
    $("#selectedShareStatus").textContent =
      share.mode === "showcase"
        ? `${share.units} item${share.units === 1 ? "" : "s"} · prices excluded`
        : `${share.pricedPositions} of ${share.positions} saved cards have the selected price`;
  };
  $("#selectedShareMode").addEventListener("change", update);
  $("#selectedShareCertifications")?.addEventListener("change", update);
  $("#copySelectedList").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(create().text);
      toast("Selected card list copied");
    } catch {
      toast("Copy is unavailable in this browser");
    }
  });
  $("#downloadSelectedList").addEventListener("click", () => {
    const share = create();
    downloadTextFile(
      share.csv,
      "text/csv;charset=utf-8",
      `mica-selected-${share.mode}-${localIsoDate()}.csv`,
    );
    toast("Complete selected list downloaded");
  });
  $("#nativeShareSelectedList")?.addEventListener("click", async () => {
    const button = $("#nativeShareSelectedList");
    button.disabled = true;
    try {
      await navigator.share({
        title: "Selected Pokémon cards",
        text: create().text,
      });
      toast("Selected card list shared");
    } catch (error) {
      if (error?.name !== "AbortError")
        toast("Sharing is unavailable right now");
    } finally {
      button.disabled = false;
    }
  });
  update();
}

function portfolioTransactions() {
  return state.items.flatMap((item) => item.transactions || []);
}

function destroyPortfolioHistoryChart() {
  portfolioChartMountVersion += 1;
  portfolioChartInstance?.destroy();
  portfolioChartInstance = null;
}

function portfolioHistoryRangePoints(points, range) {
  if (range === "all" || points.length < 3) return points;
  const latestTime = new Date(`${points.at(-1).date}T00:00:00Z`).getTime();
  if (!Number.isFinite(latestTime)) return points;
  const latestDate = new Date(latestTime);
  const cutoff =
    range === "ytd"
      ? Date.UTC(latestDate.getUTCFullYear(), 0, 1)
      : latestTime - ({ "1m": 31, "3m": 93 }[range] || 93) * 86_400_000;
  const filtered = points.filter(
    (point) => new Date(`${point.date}T00:00:00Z`).getTime() >= cutoff,
  );
  return filtered.length >= 2 ? filtered : points.slice(-2);
}

function shortPortfolioDate(value, includeYear = false) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(date);
}

async function mountPortfolioHistoryChart({
  points,
  values,
  currency,
  marketMode,
  showcase,
}) {
  const version = ++portfolioChartMountVersion;
  portfolioChartInstance?.destroy();
  portfolioChartInstance = null;
  const canvas = $("#portfolioHistoryChart");
  if (!canvas || points.length < 2) return;
  const { default: Chart } = await import("chart.js/auto");
  if (version !== portfolioChartMountVersion || !canvas.isConnected) return;
  const styles = getComputedStyle(document.body);
  const accent = styles.getPropertyValue("--pine-2").trim() || "#a78bfa";
  const muted = styles.getPropertyValue("--muted").trim() || "#98a3b3";
  const line = styles.getPropertyValue("--line").trim() || "#1b2735";
  const paper = styles.getPropertyValue("--paper").trim() || "#0d151f";
  const ink = styles.getPropertyValue("--ink").trim() || "#f7f8fc";
  const firstValue = values[0];
  const compactCurrency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const crosshair = {
    id: "portfolioCrosshair",
    afterDatasetsDraw(chart) {
      const active = chart.tooltip?.getActiveElements?.() || [];
      if (!active.length) return;
      const x = active[0].element.x;
      const { ctx, chartArea } = chart;
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = muted;
      ctx.lineWidth = 1;
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
      ctx.restore();
    },
  };
  portfolioChartInstance = new Chart(canvas, {
    type: "line",
    plugins: [crosshair],
    data: {
      labels: points.map((point) => point.date),
      datasets: [
        {
          label: marketMode
            ? "Price change without purchases or sales"
            : "Collection value",
          data: values,
          borderColor: accent,
          borderWidth: 2.25,
          backgroundColor(context) {
            const { chart } = context;
            const { ctx, chartArea } = chart;
            if (!chartArea) return "rgba(139, 92, 246, 0.16)";
            const gradient = ctx.createLinearGradient(
              0,
              chartArea.top,
              0,
              chartArea.bottom,
            );
            gradient.addColorStop(0, `${accent}45`);
            gradient.addColorStop(1, `${accent}00`);
            return gradient;
          },
          fill: true,
          tension: 0.28,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: accent,
          pointHoverBorderColor: paper,
          pointHoverBorderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: motionPreference === "reduce" ? false : { duration: 380 },
      interaction: { mode: "index", intersect: false },
      layout: { padding: { top: 10, right: 4, bottom: 0, left: 0 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          backgroundColor: paper,
          borderColor: line,
          borderWidth: 1,
          titleColor: muted,
          bodyColor: ink,
          padding: 11,
          callbacks: {
            title(items) {
              return shortPortfolioDate(items[0]?.label || "", true);
            },
            label(context) {
              const value = Number(context.parsed.y);
              const delta = value - firstValue;
              return [
                `${marketMode ? "Market move" : "Value"}: ${money(value, currency)}`,
                `Selected range: ${delta >= 0 ? "+" : ""}${money(delta, currency)}`,
              ];
            },
            afterBody() {
              return showcase ? ["Showcase sample history"] : [];
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: muted,
            autoSkip: true,
            maxTicksLimit: 6,
            maxRotation: 0,
            padding: 8,
            font: { size: 9, weight: 600 },
            callback(index) {
              return shortPortfolioDate(points[index]?.date || "");
            },
          },
        },
        y: {
          position: "right",
          grace: "10%",
          grid: { color: line, drawTicks: false },
          border: { display: false },
          ticks: {
            color: muted,
            maxTicksLimit: 5,
            padding: 8,
            font: { size: 9, weight: 600 },
            callback(value) {
              return compactCurrency.format(value);
            },
          },
        },
      },
    },
  });
}

function renderPortfolioHistory() {
  const root = $("#portfolioHistory");
  if (!root) return;
  const showcase = isShowcaseAccount();
  const showcaseTotal = showcase ? calculateTotals(state.items).value : null;
  const snapshots = showcase
    ? rebasePortfolioSnapshots(state.portfolioHistory, showcaseTotal)
    : state.portfolioHistory;
  const history = marketAdjustedPortfolioHistory(
    snapshots,
    portfolioTransactions(),
    "USD",
  );
  if (!history.points.length) {
    destroyPortfolioHistoryChart();
    const failed = state.portfolioHistoryStatus === "error";
    root.innerHTML = `<div class="portfolio-history-empty"><strong>${failed ? "Performance history is temporarily unavailable" : "Tracking starts today"}</strong><span>${failed ? "Your collection and ledger are unchanged. Mica will retry after the next live price refresh." : "After current prices load, Mica saves today’s starting value. Your first real trend appears after another daily valuation."}</span></div>`;
    return;
  }
  const baseline = history.points[0];
  if (history.points.length === 1) {
    destroyPortfolioHistoryChart();
    root.innerHTML = `<div class="portfolio-history-head"><div><strong>Value tracking started</strong><span>${esc(baseline.date)} · prices for the same card version and condition</span></div></div><div class="portfolio-history-metrics"><div><span>Starting value</span><strong>${money(baseline.totalMinor / 100, history.currency)}</strong></div><div><span>Cards with current prices</span><strong>${baseline.freshItems} of ${baseline.pricedItems}</strong></div><div><span>Missing prices</span><strong>${baseline.unpricedItems}</strong></div></div><p class="portfolio-history-note"><strong>Why there is no line yet:</strong> Mica needs a value from another day. Buying more cards will count as money you added, not as profit.</p>`;
    return;
  }
  const marketRequested =
    workspaceMode !== "guided" && state.portfolioHistoryMode === "return";
  const marketAvailable = history.status === "ready";
  const marketPoints = history.points.filter(
    (point) => point.marketChangeMinor !== null,
  );
  const marketSeriesAvailable = marketPoints.length >= 2;
  const marketMode = marketRequested && marketSeriesAvailable;
  const compatible = marketMode ? marketPoints : history.points;
  const plotted = portfolioHistoryRangePoints(
    compatible,
    state.portfolioHistoryRange,
  );
  const values = plotted.map((point) =>
    marketMode ? point.marketChangeMinor / 100 : point.totalMinor / 100,
  );
  const rangeBaseline = plotted[0];
  const rangeLatest = plotted.at(-1);
  const rangeChange = values.at(-1) - values[0];
  const rangePercent = rangeBaseline.totalMinor
    ? (rangeChange / (rangeBaseline.totalMinor / 100)) * 100
    : null;
  const rangeCashFlow =
    (rangeLatest.netContributionMinor - rangeBaseline.netContributionMinor) /
    100;
  const ranges = [
    ["1m", "1 month"],
    ["3m", "3 months"],
    ["ytd", "This year"],
    ["all", "All"],
  ];
  const rangeButtons = ranges
    .map(([value, label]) => {
      const redundant =
        value !== "all" &&
        portfolioHistoryRangePoints(compatible, value).length ===
          compatible.length;
      return `<button type="button" data-portfolio-history-range="${value}" aria-pressed="${String(state.portfolioHistoryRange === value)}" ${redundant ? 'disabled title="No additional history in this range yet"' : ""}>${label}</button>`;
    })
    .join("");
  const historyMetrics = marketMode
    ? `<div><span>Price change</span><strong class="${rangeChange >= 0 ? "positive" : "negative"}">${rangeChange >= 0 ? "Up " : "Down "}${money(Math.abs(rangeChange), history.currency)}</strong></div><div><span>Percent change</span><strong class="${rangeChange >= 0 ? "positive" : "negative"}">${rangePercent === null ? "—" : `${rangePercent >= 0 ? "+" : ""}${rangePercent.toFixed(1)}%`}</strong></div><div><span>Money you added or removed</span><strong>${rangeCashFlow >= 0 ? "+" : ""}${money(rangeCashFlow, history.currency)}</strong></div>`
    : `<div><span>Value now</span><strong>${money(rangeLatest.totalMinor / 100, history.currency)}</strong></div><div><span>Change during this time</span><strong class="${rangeChange >= 0 ? "positive" : "negative"}">${rangeChange >= 0 ? "Up " : "Down "}${money(Math.abs(rangeChange), history.currency)}</strong></div>${workspaceMode === "guided" ? "" : `<div><span>Percent change</span><strong class="${rangeChange >= 0 ? "positive" : "negative"}">${rangePercent === null ? "—" : `${rangePercent >= 0 ? "+" : ""}${rangePercent.toFixed(1)}%`}</strong></div>`}`;
  const historyNote = showcase
    ? '<p class="portfolio-history-note"><strong>Demo line:</strong> these made-up daily values only show how the chart will work. They are not real market prices.</p>'
    : !marketSeriesAvailable
      ? '<p class="portfolio-history-note"><strong>Price-only change is not ready yet.</strong> Mica needs more complete prices and purchase history. Your total value is still shown.</p>'
      : marketMode && !marketAvailable
        ? '<p class="portfolio-history-note"><strong>Price-only percentage is hidden.</strong> At least one day has a missing price or purchase amount, so Mica will not guess.</p>'
        : `<p class="portfolio-history-note"><strong>${marketMode ? "Buying more cards is not profit." : "This line includes cards you bought or sold."}</strong> ${marketMode ? "Mica removes recorded buying, selling, and grading money to show price change only." : "Choose Price change in More tools to remove money added or taken out."}</p>`;
  root.innerHTML = `<div class="portfolio-history-head"><div><strong>Collection value</strong><span>${showcase ? "Demo history for this showcase account" : `${history.points.length} day${history.points.length === 1 ? "" : "s"} with saved values`} · ${shortPortfolioDate(plotted[0].date, true)}–${shortPortfolioDate(plotted.at(-1).date, true)}</span></div><div class="portfolio-history-toggle advanced-workspace" role="group" aria-label="Choose what the value chart shows"><button type="button" data-portfolio-history-mode="return" aria-pressed="${String(marketMode)}" ${marketSeriesAvailable ? "" : "disabled"}>Price change</button><button type="button" data-portfolio-history-mode="value" aria-pressed="${String(!marketMode)}">Total value</button></div></div><div class="portfolio-history-metrics">${historyMetrics}</div><div class="portfolio-chart-toolbar"><span class="portfolio-chart-status"><i aria-hidden="true"></i>${showcase ? "Demo history" : marketAvailable ? "Prices checked" : "Some prices are missing"}</span><div class="portfolio-chart-ranges" role="group" aria-label="Time shown on chart">${rangeButtons}</div></div><div class="portfolio-chart-shell"><canvas class="portfolio-history-canvas" id="portfolioHistoryChart" role="img" aria-label="Interactive ${marketMode ? "price change" : "collection value"} chart from ${esc(plotted[0].date)} to ${esc(plotted.at(-1).date)}" aria-describedby="portfolioChartSummary"></canvas></div><p class="sr-only" id="portfolioChartSummary">${plotted.map((point, index) => `${shortPortfolioDate(point.date, true)}: ${money(values[index], history.currency)}`).join("; ")}</p><div class="portfolio-chart-foot"><span>Hover or tap for the date and value</span><span>${plotted.length} day${plotted.length === 1 ? "" : "s"} shown</span></div>${historyNote}`;
  $$("[data-portfolio-history-mode]", root).forEach((button) =>
    button.addEventListener("click", () => {
      state.portfolioHistoryMode = button.dataset.portfolioHistoryMode;
      renderPortfolioHistory();
    }),
  );
  $$("[data-portfolio-history-range]", root).forEach((button) =>
    button.addEventListener("click", () => {
      state.portfolioHistoryRange = button.dataset.portfolioHistoryRange;
      renderPortfolioHistory();
    }),
  );
  requestAnimationFrame(
    () =>
      void mountPortfolioHistoryChart({
        points: plotted,
        values,
        currency: history.currency,
        marketMode,
        showcase,
      }),
  );
}

async function capturePortfolioValuation() {
  if (
    !state.session ||
    isShowcaseAccount() ||
    !state.items.length ||
    !["live", "partial"].includes(state.pricingStatus)
  )
    return;
  const ownerId = state.session.user.id;
  const loadVersion = sessionLoadVersion;
  const totals = calculateTotals(state.items);
  if (!totals.priced) return;
  const freshItems = state.items.reduce(
    (sum, item) =>
      sum +
      (item.price != null && item.pricingStatus === "live"
        ? Number(item.quantity || 0)
        : 0),
    0,
  );
  state.portfolioHistoryStatus = "saving";
  try {
    await recordPortfolioValuationSnapshot(supabase, {
      total: totals.value,
      currency: "USD",
      pricedItems: totals.priced,
      unpricedItems: totals.unpriced,
      freshItems,
    });
    const history = await loadPortfolioValuationHistory(supabase, ownerId);
    if (!accountRequestIsCurrent(ownerId, loadVersion)) return;
    state.portfolioHistory = history;
    state.portfolioHistoryStatus = "ready";
  } catch {
    if (!accountRequestIsCurrent(ownerId, loadVersion)) return;
    state.portfolioHistoryStatus = "error";
  }
  if (!accountRequestIsCurrent(ownerId, loadVersion)) return;
  renderPortfolioHistory();
}

function renderCollection() {
  $("#filterButton").classList.remove("hidden");
  const sellerDesk = $("#sellerDesk");
  sellerDesk.classList.toggle("hidden", state.ledgerView !== "for-sale");
  const accountUnavailable = accountDataUnavailable();
  $$(
    '[data-route="scan"],[data-sidebar-target="add"],[data-sidebar-target="photo"]',
  ).forEach((button) => {
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
      : navigator.onLine
        ? "Your saved data was not changed. Check your connection and try again."
        : "You’re offline. For privacy, the installed shell does not keep a readable copy of your collection on this device. Reconnect to load it.";
    $("#firstCardGuide").classList.add("hidden");
    $("#emptyAddCard").classList.remove("hidden");
    $("#emptyAddCard").disabled = state.accountLoading;
    $("#emptyAddCard").textContent = state.accountLoading
      ? "Reconnecting…"
      : "Try again";
    $("#clearFilters").classList.add("hidden");
    const syncState = $("#syncState");
    if (syncState) {
      syncState.querySelector("span:last-child").textContent =
        state.accountLoading ? "Reconnecting…" : "Cloud unavailable";
      syncState.setAttribute(
        "aria-label",
        state.accountLoading
          ? "Reconnecting to your saved collection."
          : "Your saved collection could not load. Select to try again.",
      );
    }
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
      ? "Change in value"
      : "Known change in value";
  $("#ownedCount").textContent = totals.quantity.toLocaleString();
  $("#gradedOwnedCount").textContent = gradedCount.toLocaleString();
  $("#sealedOwnedCount").textContent = sealedCount.toLocaleString();
  $("#gradedShare").textContent = totals.quantity
    ? `${((gradedCount / totals.quantity) * 100).toFixed(1)}% of collection`
    : "0% of collection";
  $("#sealedShare").textContent = totals.quantity
    ? `${((sealedCount / totals.quantity) * 100).toFixed(1)}% of collection`
    : "0% of collection";
  $("#portfolioReturn").textContent =
    portfolioReturn === null
      ? "—"
      : `${portfolioReturn >= 0 ? "+" : ""}${portfolioReturn.toFixed(1)}%`;
  $("#realizedGain").textContent = knownRealized.length
    ? `${realized >= 0 ? "+" : ""}${money(realized)}`
    : "—";
  $("#realizedGain").title =
    soldPositions.length - knownRealized.length
      ? `${soldPositions.length - knownRealized.length} sold entr${soldPositions.length - knownRealized.length === 1 ? "y has" : "ies have"} no purchase cost`
      : "Profit from completed sales with a recorded purchase cost";
  $("#allocationSummary").textContent =
    `${rawCount} / ${gradedCount} / ${sealedCount}`;
  const hasProviderPricing = ["live", "partial"].includes(state.pricingStatus);
  const showcase = isShowcaseAccount();
  $("#freshCoverage").textContent =
    `${totals.priced.toLocaleString()} of ${totals.quantity.toLocaleString()} ${showcase ? "demo prices" : hasProviderPricing ? "prices found" : "demo prices"}`;
  const partial = totals.unpriced
    ? ` · ${totals.unpriced} unpriced item${totals.unpriced === 1 ? "" : "s"} excluded`
    : "";
  const costCoverage = totals.unknownCost
    ? ` · ${totals.unknownCost} missing purchase cost`
    : "";
  $("#portfolioChange").textContent = showcase
    ? `Demo account · live ungraded prices and clearly labeled demo graded prices${costCoverage}`
    : hasProviderPricing
      ? `Prices for the same card version and condition${partial}${costCoverage}`
      : `Demo collection values${partial}${costCoverage}`;
  $("#valuationNote").firstChild.textContent =
    totals.gainCoverage === totals.quantity
      ? "Based on matching market prices. "
      : `Change in value uses ${totals.gainCoverage} of ${totals.quantity} cards that have both a current price and the amount paid. `;
  $("#allCount").textContent = totals.quantity.toLocaleString();
  $("#rawCount").textContent = rawCount.toLocaleString();
  $("#gradedCount").textContent = gradedCount.toLocaleString();
  $("#sealedCount").textContent = sealedCount.toLocaleString();
  $("#favoritesCount").textContent = state.items
    .filter((item) =>
      (item.tags || []).some(
        (tag) => String(tag).toLowerCase() === "favorites",
      ),
    )
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    .toLocaleString();
  $("#forSaleCount").textContent = state.items.filter(
    (item) => item.status === "listed",
  ).length;
  $("#watchlistCount").textContent = state.watchlist.length;
  $("#setCount").textContent = collectionSetGroups().length;
  const pricedCount = state.items.filter((item) => item.price != null).length;
  const pricingLabel = showcase
    ? "Showcase prices · Pro-ready"
    : state.pricingStatus === "loading"
      ? "Updating live prices…"
      : state.pricingStatus === "live"
        ? `${pricedCount} of ${state.items.length} live prices`
        : state.pricingStatus === "partial"
          ? `${pricedCount} live · ${state.items.length - pricedCount} awaiting matching prices`
          : state.pricingStatus === "error"
            ? "Live source unavailable · demo values shown"
            : `${pricedCount} of ${state.items.length} demo values`;
  $(".status-label").innerHTML = `<i></i> ${pricingLabel}`;
  const syncLabels = {
    loading: "Prices updating",
    live: "Prices current",
    partial: "Some prices missing",
    error: "Pricing unavailable",
    demo: "Demo values",
  };
  const syncLabel =
    state.storageStatus === "error"
      ? "Session only"
      : `Cloud saved · ${syncLabels[state.pricingStatus] || "Prices ready"}`;
  const syncState = $("#syncState");
  if (syncState) {
    syncState.querySelector("span:last-child").textContent = syncLabel;
    syncState.setAttribute(
      "aria-label",
      state.storageStatus === "error"
        ? "Session only. Changes may be lost when this page closes."
        : `Collection saved to your account. ${syncLabels[state.pricingStatus] || "Prices ready"}.`,
    );
  }
  renderPortfolioHistory();
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
    sellerDesk.innerHTML = `<div class="seller-desk-head"><div><span>Cards for sale</span><strong>${readiness.units} item${readiness.units === 1 ? "" : "s"} listed</strong></div><b>${readiness.needsReview ? `${readiness.needsReview} need review` : "Ready"}</b></div><div class="seller-desk-grid"><div><span>Total price you are asking</span><strong>${money(readiness.askingValueMinor / 100)}</strong></div><div><span>Total matching price</span><strong>${readiness.pricedPositions ? money(readiness.marketValueMinor / 100) : "Unavailable"}</strong></div><div><span>Difference</span><strong>${readiness.pricedPositions ? `${gap >= 0 ? "Above by " : "Below by "}${money(Math.abs(gap) / 100)}` : "—"}</strong></div><div><span>Missing details</span><strong>${readiness.missingAsk} price · ${readiness.missingVenue} place to sell</strong></div></div><p>Mica asks you to check a listing when its price differs from the matching price by 10% or more, details are missing, or its price has not been checked in 7 days.</p>`;
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
    state.sidebarTarget,
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
  const dashboardLimit =
    state.sidebarTarget === "dashboard" ? 8 : state.visibleLimit;
  const windowed = collectionWindow(visible, dashboardLimit);
  const displayed = windowed.displayed;
  state.visiblePositionIds = displayed.map((item) => item.uid);
  const visibleCopies = visible.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  );
  const groupedLabel = `${windowed.total} saved entr${windowed.total === 1 ? "y" : "ies"} · ${visibleCopies} card${visibleCopies === 1 ? "" : "s"}`;
  $("#resultCount").textContent =
    state.sidebarTarget === "dashboard"
      ? `Top cards · showing ${displayed.length} of ${windowed.total} saved entries`
      : windowed.remaining
        ? `Showing ${displayed.length} of ${windowed.total} saved entries · ${visibleCopies} cards total`
        : groupedLabel;
  const remaining = windowed.remaining;
  $("#loadMorePositions").hidden = remaining <= 0;
  $("#loadMorePositions").textContent =
    state.sidebarTarget === "dashboard"
      ? `View full collection · ${remaining} more saved entr${remaining === 1 ? "y" : "ies"}`
      : `Show ${Math.min(100, remaining)} more · ${remaining} remaining`;
  $("#sortButton").firstChild.textContent =
    state.sort === "value-desc" ? "Most valuable first " : "Name, A to Z ";
  $("#cardLedger").innerHTML = displayed
    .map((item) => {
      const total = itemValue(item);
      const showcaseValue = isShowcaseAccount() && item.demoPrice != null;
      const moveClass =
        showcaseValue || item.move == null
          ? "none"
          : item.move >= 0
            ? "up"
            : "down";
      const hasMovement = !showcaseValue && Number.isFinite(Number(item.move));
      const movementLabel = showcaseValue
        ? "Demo price"
        : item.price != null && hasMovement
          ? workspaceMode === "guided"
            ? item.move >= 0
              ? "Price is up over the last 30 days"
              : "Price is down over the last 30 days"
            : `${item.move >= 0 ? "↑" : "↓"} ${Math.abs(item.move).toFixed(1)}% · 30 days`
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
          ? "Unopened"
          : item.gradingCompany
            ? `${item.gradingCompany} grade ${item.grade}`
            : conditionLabel(item.condition),
        listingTag || statusTag,
        ...(item.tags || []).slice(0, listingTag || statusTag ? 0 : 1),
      ].filter(Boolean);
      const selected = state.bulkSelected.has(item.uid);
      return `<article class="ledger-row${state.bulkMode ? " bulk-mode" : ""}${selected ? " selected" : ""}" ${state.bulkMode ? `tabindex="0" role="checkbox" aria-checked="${selected}" aria-label="${selected ? "Deselect" : "Select"} ${esc(item.name)}, ${total == null ? "price unavailable" : money(total)}"` : `aria-label="${esc(item.name)}, ${total == null ? "price unavailable" : money(total)}"`} data-id="${esc(item.uid)}">
      ${state.bulkMode ? `<span class="bulk-select-indicator" aria-hidden="true">${selected ? "✓" : ""}</span>` : ""}
      ${state.bulkMode ? "" : `<button class="ledger-open-overlay" type="button" data-open-position="${esc(item.uid)}" aria-label="Open ${esc(item.name)} details"></button>`}
      <img class="card-thumb" src="${esc(item.thumb || item.image || "./icons/icon.svg")}" data-fallback="${esc(item.image || "./icons/icon.svg")}" alt="${esc(item.name)} from ${esc(item.set)}" loading="lazy">
      <div class="card-main"><div class="card-name-line"><span class="card-name">${esc(item.name)}</span><span class="quantity">×${Number(item.quantity) || 0}</span></div><span class="card-set">${esc(item.set)} · ${esc(item.number)}</span>${item.location ? `<span class="card-location" title="Storage location">${esc(item.location)}</span>` : ""}<div class="card-tags">${tags.map((tag, i) => `<span class="micro-tag ${i === 0 && item.gradingCompany ? "graded" : ""} ${item.price == null ? "warn" : ""}">${esc(tag)}</span>`).join("")}</div></div>
      <div class="price-cell"><span class="row-value">${total == null ? "—" : money(total)}</span><span class="row-total-label">Total value</span><span class="row-unit">${item.price == null ? (item.gradingCompany ? "graded price not connected" : "matching price unavailable") : `${money(item.price)} for each card`}</span><span class="row-move ${moveClass}">${esc(movementLabel)}</span></div>${state.bulkMode ? "" : `<button class="ledger-quick-add" type="button" data-add-purchase="${esc(item.uid)}" aria-label="Add another ${esc(item.name)}">Add copy</button>`}
    </article>`;
    })
    .join("");
  $("#collectionEmpty").classList.toggle("hidden", visible.length > 0);
  const trulyEmpty = state.items.length === 0;
  $("#collectionEmptyTitle").textContent = trulyEmpty
    ? "Your library is empty"
    : "No items match this view";
  $("#collectionEmptyCopy").textContent = trulyEmpty
    ? "Start with one card or unopened product. Mica only asks for the details that apply."
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
    if (!state.bulkMode) return;
    row.addEventListener("click", () => toggleBulkPosition(row.dataset.id));
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleBulkPosition(row.dataset.id);
    });
  });
  $$("[data-open-position]").forEach((button) =>
    button.addEventListener("click", () =>
      openCardDetail(
        state.items.find((item) => item.uid === button.dataset.openPosition),
        true,
      ),
    ),
  );
  $$("[data-add-purchase]").forEach((button) =>
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const item = state.items.find(
        (candidate) => candidate.uid === button.dataset.addPurchase,
      );
      if (item) openPurchaseLotSheet(item);
    }),
  );
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
    <div class="field"><label for="planSalePrice">Expected selling price for each</label><div class="money-input"><span>$</span><input id="planSalePrice" type="number" inputmode="decimal" min="0" step="0.01" value="${displayPrice == null ? "" : Number(displayPrice).toFixed(2)}" placeholder="0.00"></div></div>
    <div class="field"><label for="planFeePercent">Selling site fee (%)</label><input id="planFeePercent" type="number" inputmode="decimal" min="0" max="99.99" step="0.01" value="${currencyInputValue(state.preferences.sellingFeePercent || 0)}" placeholder="Enter the current fee"></div>
    <div class="field"><label for="planShipping">Shipping you pay</label><div class="money-input"><span>$</span><input id="planShipping" type="number" inputmode="decimal" min="0" step="0.01" value="0.00"></div></div>
    <div class="field"><label for="planOtherCosts">Other selling costs</label><div class="money-input"><span>$</span><input id="planOtherCosts" type="number" inputmode="decimal" min="0" step="0.01" value="0.00"></div></div>
    <div class="field"><label for="planTargetProfit">Money you hope to make <span class="optional-label">Optional</span></label><div class="money-input"><span>$</span><input id="planTargetProfit" type="number" inputmode="decimal" min="0" step="0.01" placeholder="50.00"></div></div>
  </div><p class="planner-fee-note">Starts with your saved selling-fee setting. Confirm the current fee where you plan to sell.</p><div class="sale-plan-output" id="salePlanOutput" aria-live="polite"><div class="unavailable-panel">Enter an expected selling price to calculate the plan.</div></div><button class="planner-record" id="planRecordSaleButton" type="button" disabled>Use this plan to record a sale</button></section>`;
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
      `<div><span>Total sale price</span><strong>${money(latest.grossMinor / 100, item.currency)}</strong></div><div><span>Selling site fees</span><strong>${latest.marketplaceFeesMinor ? `−${money(latest.marketplaceFeesMinor / 100, item.currency)}` : money(0, item.currency)}</strong></div><div><span>Money left after selling costs</span><strong>${money(latest.netProceedsMinor / 100, item.currency)}</strong></div><div><span>What you paid for the cards sold</span><strong>${money(latest.costBasisMinor / 100, item.currency)}</strong></div><div class="${profitClass}"><span>Estimated money gained</span><strong>${latest.profitMinor >= 0 ? "+" : ""}${money(latest.profitMinor / 100, item.currency)}</strong></div><div class="advanced-workspace"><span>Percent gained compared with what you paid</span><strong>${latest.roiPercent === null ? "—" : `${latest.roiPercent >= 0 ? "+" : ""}${latest.roiPercent.toFixed(1)}%`}</strong></div><div class="advanced-workspace"><span>Minimum price needed to avoid losing money</span><strong>${money(latest.breakEvenPriceEachMinor / 100, item.currency)}</strong></div>${latest.targetPriceEachMinor === null ? "" : `<div class="target"><span>Price each to make the amount you want</span><strong>${money(latest.targetPriceEachMinor / 100, item.currency)}</strong></div>`}`;
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
    return `<section class="detail-section deal-planner"><div class="detail-section-head"><h2>What should I pay?</h2><span>Matching price needed</span></div><div class="unavailable-panel">Mica needs a current price for this exact card before it can suggest a highest price to pay.</div></section>`;
  return `<section class="detail-section deal-planner" aria-labelledby="buyPlannerTitle"><div class="detail-section-head"><h2 id="buyPlannerTitle">What should I pay?</h2><span>Buying helper</span></div><p class="planner-intro">Mica starts with today’s matching price and subtracts likely selling costs. The result is a helpful limit—not a guarantee of value.</p><div class="sale-planner-inputs">
    <div class="field"><label for="buyPlanQuantity">How many?</label><input id="buyPlanQuantity" type="number" inputmode="numeric" min="1" max="99999" step="1" value="1"></div>
    <div class="field"><label for="buyPlanResale">What each card may sell for</label><div class="money-input"><span>$</span><input id="buyPlanResale" type="number" inputmode="decimal" min="0" step="0.01" value="${Number(displayPrice).toFixed(2)}"></div></div>
    <div class="field"><label for="buyPlanFees">Selling site fee (%)</label><input id="buyPlanFees" type="number" inputmode="decimal" min="0" max="99.99" step="0.01" value="${currencyInputValue(state.preferences.sellingFeePercent || 0)}" placeholder="Enter the current fee"></div>
    <div class="field"><label for="buyPlanCosts">Other selling costs</label><div class="money-input"><span>$</span><input id="buyPlanCosts" type="number" inputmode="decimal" min="0" step="0.01" value="0.00"></div></div>
    <div class="field advanced-workspace"><label for="buyPlanRoi">Percent you hope to make</label><input id="buyPlanRoi" type="number" inputmode="decimal" min="0" step="0.1" value="20"></div>
    <div class="field"><label for="buyPlanOffer">Price the seller wants for each <span class="optional-label">Optional</span></label><div class="money-input"><span>$</span><input id="buyPlanOffer" type="number" inputmode="decimal" min="0" step="0.01" placeholder="Compare an offer"></div></div>
  </div><p class="planner-fee-note">Buying it only for your collection? Set the percent you hope to make to 0. Add selling fees only if you expect to resell it.</p><div class="sale-plan-output" id="buyPlanOutput" aria-live="polite"></div><div class="planner-actions"><button class="secondary" id="buyPlanWatchButton" type="button">Watch for this price</button><button class="planner-record" id="buyPlanPurchaseButton" type="button" disabled>${item.uid ? "Add this purchase" : "Buy & add to library"}</button></div><p class="planner-fee-note" id="buyPlanPurchaseHelp">Enter the seller’s price to carry it into your purchase record.</p></section>`;
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
    const purchaseButton = $("#buyPlanPurchaseButton");
    button.disabled = !latest;
    purchaseButton.disabled = !latest || latest.plannedOfferTotalMinor === null;
    if (!latest) {
      $("#buyPlanOutput").innerHTML =
        '<div class="unavailable-panel">Check the prices, costs, number of cards, and percent you hope to make.</div>';
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
        : `<div><span>Total price the seller wants</span><strong>${money(latest.plannedOfferTotalMinor / 100, item.currency || "USD")}</strong></div><div class="${offerClass}"><span>Possible money gained at that price</span><strong>${latest.projectedProfitMinor >= 0 ? "+" : ""}${money(latest.projectedProfitMinor / 100, item.currency || "USD")}</strong></div><div class="${offerClass} advanced-workspace"><span>Possible percent gained</span><strong>${latest.projectedRoiPercent === null ? "—" : `${latest.projectedRoiPercent >= 0 ? "+" : ""}${latest.projectedRoiPercent.toFixed(1)}%`}</strong></div>`;
    $("#buyPlanOutput").innerHTML =
      `<div><span>What the cards may sell for</span><strong>${money(latest.grossMinor / 100, item.currency || "USD")}</strong></div><div><span>Selling fees and other costs</span><strong>−${money((latest.marketplaceFeesMinor + latest.otherSellingCostsMinor) / 100, item.currency || "USD")}</strong></div><div class="target"><span>Highest suggested price for each</span><strong>${money(latest.maxOfferEachMinor / 100, item.currency || "USD")}</strong></div><div class="target"><span>Highest suggested total price</span><strong>${money(latest.maxAcquisitionMinor / 100, item.currency || "USD")}</strong></div>${offerRows}`;
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
  $("#buyPlanPurchaseButton").addEventListener("click", () => {
    if (!latest || latest.plannedOfferTotalMinor === null) return;
    const input = values();
    const defaults = {
      quantity: input.quantity,
      totalAcquisitionCost: (latest.plannedOfferTotalMinor / 100).toFixed(2),
    };
    if (item.uid) {
      openPurchaseLotSheet(item, defaults);
      return;
    }
    openPositionSheet(item, {
      prefill: {
        ...defaults,
        cardState: item.gradingCompany ? "graded" : "raw",
        rawCondition:
          normalizeRawCondition(item.condition || "Near Mint").normalized ||
          "near_mint",
        grader: item.gradingCompany || "",
        grade: item.grade || "",
        variant: item.variant,
      },
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
      ? `<div class="unavailable-panel"><strong>${item.gradingCompany ? "A matching graded price is not connected yet." : "A matching price is not available for this printing yet."}</strong><br>Your card stays in the collection and is excluded from estimated totals. Mica will not substitute a raw, different-grade, or different-printing value.</div>`
      : item.pricingStatus === "live"
        ? `${renderQuoteRow(tcgQuote, tcgQuote?.provider === "justtcg" ? "JustTCG price" : "TCGplayer price")}${renderQuoteRow(cardmarketQuote, "Cardmarket price")}`
        : `<div class="price-source"><div><strong>Demo price</strong><span>${esc(item.variant)} · USD</span><span>The live price check has not finished.</span></div><div class="source-value"><b>${money(item.price)}</b><small>Demo only · not live</small></div></div>`;
  $("#detailContent").innerHTML =
    `<button class="detail-back" id="detailBack" type="button"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>Collection</button>
    <div class="detail-identity"><img src="${esc(item.image || item.thumb || "./icons/icon.svg")}" data-fallback="${esc(item.thumb || "./icons/icon.svg")}" alt="${esc(item.name)} from ${esc(item.set)}"><div><p class="eyebrow">${esc(item.rarity)}</p><h1 id="detailTitle">${esc(item.name)}</h1><p class="detail-set">${esc(item.set)} · ${esc(item.number)}</p><div class="detail-meta"><div><span>Printing</span><strong>${esc(item.variant)}</strong></div><div><span>Language</span><strong>English</strong></div><div><span>Released</span><strong>${esc(item.release)}</strong></div><div><span>Artist</span><strong>${esc(item.artist)}</strong></div></div></div></div>
    <div class="owned-banner"><div><span>In your library</span><strong>${item.quantity} owned · ${total == null ? "Price unavailable" : money(total)}</strong></div><button id="editCopyButton" type="button">Edit details</button></div>
    <section class="detail-section"><div class="detail-section-head"><h2>Matching prices</h2><span>${item.price == null ? "No matching price" : item.pricingStatus === "live" ? "Live price" : "Demo only · not live"}</span></div>${sourceRows}<p class="legal-copy">Prices are estimates, not guaranteed sale amounts. Wear and where you sell can change what someone will pay.</p></section>
    <section class="detail-section"><div class="detail-section-head"><h2>Your copy</h2><span>${esc(item.location)}</span></div><div class="copy-row"><div><strong>${item.gradingCompany ? `${esc(item.gradingCompany)} grade ${esc(item.grade)}` : esc(conditionLabel(item.condition))}</strong><span>Bought ${esc(item.purchaseDate || "date not recorded")} · ${money(item.cost)} each</span></div><b>×${item.quantity}</b></div>${item.notes ? `<div class="unavailable-panel">${esc(item.notes)}</div>` : ""}</section>
    <section class="detail-section"><div class="detail-section-head"><h2>Price over time</h2><span>Recorded matching prices</span></div>${renderInteractiveHistory(item)}</section>
    <section class="detail-section"><div class="detail-section-head"><h2>Recent completed sales</h2><span>${item.salesStatus === "live" ? "Completed sale links" : "Needs a connected price source"}</span></div>${renderSales(item)}</section>`;
  $("#detailBack").addEventListener("click", () => routeTo("collection"));
  $("#editCopyButton").addEventListener("click", () =>
    openPositionEditSheet(item),
  );
  void loadSales(item);
}

function positionTransactionRow(transaction, unitNoun) {
  if (transaction.type === "purchase")
    return `<div class="transaction-row"><div><strong>Bought ${esc(transaction.date || "date not recorded")}</strong><span>${transaction.quantity} ${unitNoun}${transaction.quantity === 1 ? "" : "s"} · total paid${transaction.marketplace ? ` · ${esc(transaction.marketplace)}` : ""}</span></div><b>${transaction.totalCost == null ? "Not recorded" : money(transaction.totalCost, transaction.currency)}</b></div>`;
  if (transaction.type === "sale")
    return `<div class="transaction-row"><div><strong>Sold ${esc(transaction.date || "date not recorded")}</strong><span>${transaction.quantity} at ${money(transaction.unitPrice, transaction.currency)}${transaction.marketplace ? ` · ${esc(transaction.marketplace)}` : ""}</span></div><b>${money(transaction.netProceeds, transaction.currency)}</b></div>`;
  if (transaction.type === "grading_submission")
    return `<div class="transaction-row"><div><strong>Sent for professional grading ${esc(transaction.date || "date not recorded")}</strong><span>${transaction.quantity} ${unitNoun}${transaction.quantity === 1 ? "" : "s"} · ${esc(transaction.gradingCompany || transaction.marketplace || "grading company")} · estimated cost is not counted as money paid yet</span></div><b>Tracking</b></div>`;
  if (transaction.type === "grading_return") {
    const prior = String(transaction.previousRawCondition || "raw")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
    return `<div class="transaction-row"><div><strong>Returned from grading ${esc(transaction.date || "date not recorded")}</strong><span>${transaction.quantity} ${unitNoun}${transaction.quantity === 1 ? "" : "s"} · ${esc(transaction.gradingCompany)} grade ${esc(transaction.grade)} · previously ${esc(conditionLabel(prior))}${transaction.certificationNumber ? ` · certification number ${esc(transaction.certificationNumber)}` : ""}</span></div><b>Added ${money(transaction.gradingFees, transaction.currency)} to amount paid</b></div>`;
  }
  if (transaction.type === "position_split")
    return `<div class="transaction-row"><div><strong>Copies separated ${esc(transaction.date || "date not recorded")}</strong><span>${transaction.quantity} ${unitNoun}${transaction.quantity === 1 ? "" : "s"} · their original purchase cost moved with them</span></div><b>No money moved</b></div>`;
  const label = String(transaction.type || "adjustment")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return `<div class="transaction-row"><div><strong>${esc(label)} ${esc(transaction.date || "date not recorded")}</strong><span>${transaction.quantity} ${unitNoun}${transaction.quantity === 1 ? "" : "s"}${transaction.notes ? ` · ${esc(transaction.notes)}` : ""}</span></div><b>${transaction.totalCost ? money(transaction.totalCost, transaction.currency) : "Recorded"}</b></div>`;
}

function renderCertificationVerification(item) {
  if (!item.gradingCompany) return "";
  const lookup = graderCertificationLookup(
    item.gradingCompany,
    item.certificationNumber,
  );
  if (!lookup.certification) {
    return `<section class="detail-section certification-trust" aria-labelledby="certificationTrustTitle"><div class="detail-section-head"><h2 id="certificationTrustTitle">Check the graded card</h2><span>Certification number not recorded</span></div><div class="certification-empty"><strong>Add the number printed on the ${esc(lookup.graderName)} label.</strong><p>Mica will open the grading company’s official record and show a short checklist. A matching number alone does not prove the card or case is authentic.</p><button id="addCertificationButton" type="button">Add certification number</button></div></section>`;
  }
  const lookupAction = lookup.lookupUrl
    ? `<a class="certification-lookup" href="${esc(lookup.lookupUrl)}" target="_blank" rel="noopener noreferrer">${lookup.direct ? "Open official record" : `Open ${esc(lookup.graderName)} lookup`}</a>`
    : `<span class="certification-lookup unavailable">Official lookup not configured</span>`;
  const formatNote = lookup.formatRecognized
    ? `${esc(lookup.graderName)} format recognized`
    : `Check the label format · expected ${esc(lookup.expectedFormat)}`;
  const multipleCopyNote =
    Number(item.quantity) > 1
      ? `<div class="warning-panel"><strong>Each graded card should have its own certification number.</strong><p>This saved entry contains ${Number(item.quantity)} copies. Separate the copies before adding a different number to each one.</p></div>`
      : "";
  return `<section class="detail-section certification-trust" aria-labelledby="certificationTrustTitle"><div class="detail-section-head"><h2 id="certificationTrustTitle">Check the graded card</h2><span>Official grading-company record</span></div><div class="certification-record"><div><span>${esc(lookup.graderName)} certification</span><strong>${esc(lookup.certification)}</strong><small>${formatNote}</small></div><button id="copyCertificationButton" type="button">Copy number</button>${lookupAction}</div>${multipleCopyNote}<ol class="certification-checklist"><li>Confirm the official record shows the same card and grade.</li><li>Compare the label, barcode, card details, and official photos when available.</li><li>Check the physical case for signs it was opened or changed.</li></ol><p class="certification-disclaimer">Mica opens the official record but cannot prove the card or case is authentic. A matching database record does not remove counterfeit risk.</p></section>`;
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
  const providerPricingStatus =
    item.pricingStatus ||
    (state.pricingStatus === "error"
      ? "error"
      : item.price != null
        ? "preview"
        : "loading");
  const showcaseFallback = usesShowcaseFallback(item, providerPricingStatus);
  const pricingStatus = showcaseFallback ? "showcase" : providerPricingStatus;
  const livePrice = ["live", "stale"].includes(pricingStatus)
    ? (tcgQuote?.amount ?? null)
    : null;
  const previewPrice =
    pricingStatus === "showcase"
      ? showcaseReference(item)
      : ["preview", "error"].includes(pricingStatus)
        ? (item.demoPrice ?? item.price ?? null)
        : null;
  const displayPrice = livePrice ?? previewPrice;
  const showcaseHistory = historyForItem(item).some(
    (point) => point.quality?.sample,
  );
  const marketLabel =
    pricingStatus === "live"
      ? "Matching price today"
      : pricingStatus === "stale"
        ? "Older matching price"
        : pricingStatus === "showcase"
          ? "Demo price"
          : previewPrice != null
            ? "Demo price"
            : "Matching price today";
  const statusCopy =
    pricingStatus === "live"
      ? `Updated ${esc(friendlyObservedAt(item.pricingUpdatedAt))}`
      : pricingStatus === "stale"
        ? `Last price from ${esc(friendlyObservedAt(item.pricingUpdatedAt))} · needs refresh`
        : pricingStatus === "showcase"
          ? "Made-up demo price · replaced when PkmnPrices Pro connects"
          : pricingStatus === "preview"
            ? "Demo only · not a live price"
            : pricingStatus === "error"
              ? "Could not check a live price · demo shown"
              : pricingStatus === "rate_limited"
                ? "Price source is busy · try again shortly"
                : pricingStatus === "unavailable"
                  ? "No price found for this card version"
                  : "Checking this card version";
  const sourceRows = ["live", "stale"].includes(pricingStatus)
    ? `${renderQuoteRow(tcgQuote, sealed ? "TCGplayer sealed market" : tcgQuote?.provider === "justtcg" ? "JustTCG market" : "TCGplayer market")}${renderQuoteRow(cardmarketQuote, sealed ? "Cardmarket sealed market" : "Cardmarket")}`
    : pricingStatus === "showcase"
      ? `<div class="price-source"><div><strong>Demo price</strong><span>${esc(item.variant || "Card version unknown")} · ${esc(item.currency || "USD")}</span><span>Made-up data for the demo account only.</span></div><div class="source-value"><b>${money(previewPrice, item.currency || "USD")}</b><small>Demo · not live</small></div></div>`
      : pricingStatus === "preview" ||
          (pricingStatus === "error" && previewPrice != null)
        ? `<div class="price-source"><div><strong>Demo price</strong><span>${esc(item.variant || "Card version unknown")} · USD</span><span>${pricingStatus === "error" ? "The live price source could not be reached." : "The live price check is not finished."}</span></div><div class="source-value"><b>${money(previewPrice)}</b><small>Demo · not live</small></div></div>`
        : `<div class="unavailable-panel">${pricingStatus === "unavailable" ? (item.gradingCompany ? "A price for this exact grading company and grade is not connected yet. Mica did not use an ungraded price or another grade." : "No price is available for this card version and wear level yet. Mica did not use a different card.") : pricingStatus === "rate_limited" ? "The price source is busy. Mica is not guessing a value." : pricingStatus === "error" ? "The price source could not be reached. Mica is not guessing a value." : "Loading the latest matching price…"}${["error", "rate_limited"].includes(pricingStatus) ? '<br><button class="inline-retry" id="retryPricingButton" type="button">Try pricing again</button>' : ""}</div>`;
  const backLabel =
    {
      collection: "My library",
      insights: "Prices",
      trade: "Trade check",
      profile: "Profile",
    }[state.detailReturnRoute] || "Find cards";
  const activeSubmission = owned?.activeGradingSubmission || null;
  const gradingStatusLabel = activeSubmission
    ? {
        submitted: "Sent to grader",
        received: "Received by grader",
        grading: "Grading in progress",
        assembly: "Being sealed in its case",
        shipped: "Return shipped",
      }[activeSubmission.status] || "At grader"
    : "";
  const gradingSubmissionSection = activeSubmission
    ? `<section class="detail-section grading-submission-status"><div class="detail-section-head"><h2>Cards sent for grading</h2><span>${esc(activeSubmission.grader)} · ${esc(gradingStatusLabel)}</span></div><div class="position-summary"><div><span>Cards away</span><strong>${activeSubmission.quantity}</strong></div><div><span>Date sent</span><strong>${esc(activeSubmission.submittedAt)}</strong></div><div><span>Last update</span><strong>${esc(activeSubmission.statusUpdatedAt)}</strong></div><div><span>Expected back</span><strong>${esc(activeSubmission.expectedReturnDate || "Not estimated")}</strong></div><div><span>Order number</span><strong>${esc(activeSubmission.submissionReference || "Not added")}</strong></div><div><span>Estimated cost</span><strong>${activeSubmission.estimatedTotalCost === null ? "Not estimated" : money(activeSubmission.estimatedTotalCost, item.currency)}</strong></div></div><p class="legal-copy">You update this status yourself; it is not connected to ${esc(activeSubmission.grader)}. Mica adds grading cost only after you enter the amount you actually paid.</p><div class="sheet-actions"><button class="secondary" id="updateGradingSubmissionButton" type="button">Update status</button><button class="primary" id="recordGradingResultButton" type="button">Add returned grade</button></div></section>`
    : "";
  const ownedSection = owned
    ? `<section class="detail-section"><div class="detail-section-head"><h2>Your copy</h2><span>${esc(item.location || "Location not set")}</span></div><div class="copy-row"><div><strong>${item.gradingCompany ? `${esc(item.gradingCompany)} ${esc(item.grade)}` : esc(conditionLabel(item.condition))}</strong><span>${item.purchaseDate ? `Bought ${esc(item.purchaseDate)}` : "Purchase date not added"}${item.cost !== null && item.cost !== undefined ? ` · ${money(item.cost)} each` : " · Amount paid not recorded"}</span></div><b>×${item.quantity}</b></div>${item.notes ? `<div class="unavailable-panel">${esc(item.notes)}</div>` : ""}${!sealed && !item.gradingCompany && item.status === "owned" && !activeSubmission ? '<button class="position-new-state" id="startGradingSubmissionButton" type="button">Send to professional grading</button><button class="position-new-state" id="recordGradingResultButton" type="button">Record a grade already returned</button>' : ""}${sealed ? "" : '<button class="position-new-state" id="correctPositionMatchButton" type="button">Choose a different card version</button>'}<button class="record-remove" id="removeCopyButton" type="button">Remove this saved entry</button></section>`
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
    ? `<section class="detail-section"><div class="detail-section-head"><h2>Your purchase &amp; value</h2><span>${item.lots?.length || 0} purchase${item.lots?.length === 1 ? "" : "s"} recorded</span></div><div class="position-summary"><div><span>Total you paid</span><strong>${item.costBasis == null ? "Not recorded" : money(item.costBasis, item.currency)}</strong></div><div><span>Value today</span><strong>${performance.currentValueMinor === null ? "Unavailable" : money(performance.currentValueMinor / 100, item.currency)}</strong></div><div><span>Change in value</span><strong>${performance.unrealizedGainMinor === null ? "Needs the amount you paid" : `${performance.unrealizedGainMinor >= 0 ? "Up " : "Down "}${money(Math.abs(performance.unrealizedGainMinor) / 100, item.currency)}`}</strong></div>${workspaceMode === "guided" ? "" : `<div><span>Percent change since purchase</span><strong>${performance.returnPercent === null ? "Unavailable" : `${performance.returnPercent >= 0 ? "+" : ""}${performance.returnPercent.toFixed(1)}%`}</strong></div>`}<div><span>First bought</span><strong>${esc(item.purchaseDate || "Not recorded")}</strong></div><div><span>Price source</span><strong>${esc(showcaseFallback ? "Demo price" : tcgQuote?.provider || "Unavailable")}</strong></div></div>${incompleteLot ? `<div class="warning-panel"><strong>Add the missing purchase details</strong><p>Enter the total paid or original date you know. Until then, Mica hides profit instead of pretending the card cost $0.</p><button class="inline-retry" id="completePurchaseHistoryButton" type="button">Add missing details</button></div>` : ""}<div class="transaction-list">${(item.transactions || []).map((transaction) => positionTransactionRow(transaction, unitNoun)).join("")}</div>${activeSubmission ? `<div class="simple-note" id="gradingInventoryLock"><strong>This saved entry is at the grading company.</strong><br>${incompleteLot ? "Add every missing purchase amount and date before separating returned grades." : "You can separate copies if they return with different grades."} Adding purchases and recording sales are paused.</div>` : ""}<div class="sheet-actions"><button class="secondary" id="recordPurchaseButton" type="button" ${activeSubmission ? 'disabled aria-describedby="gradingInventoryLock"' : ""}>Add another purchase</button><button class="secondary" id="recordSaleButton" type="button" ${activeSubmission ? 'disabled aria-describedby="gradingInventoryLock"' : ""}>Record sale</button></div>${item.quantity > 1 && !incompleteLot && ["owned", "archived"].includes(item.status) ? '<button class="position-new-state" id="separateCopiesButton" type="button">Separate these copies</button>' : ""}<button class="position-new-state" id="addDifferentPositionButton" type="button">${sealed ? "Add as a separate unopened item" : "Add this card with a different wear level or grade"}</button></section>`
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
    ? ` · ${watchedPerformance.changeMinor >= 0 ? "up " : "down "}${money(Math.abs(watchedPerformance.changeMinor) / 100, watched.currency)} since you started watching`
    : "";
  const watchedSection =
    watched && !owned
      ? `<section class="watch-banner"><div><span>You’re watching this · ${esc(watchContextLabel(watched))}</span><strong>${watched.targetPrice === null ? "No target price set" : `Tell me at ${money(watched.targetPrice, watched.currency)}`}</strong><small>${watched.currentPrice === null ? "Matching price unavailable" : `Matching price now ${money(watched.currentPrice, watched.currency)}${esc(watchedMovement)}`}</small></div><button id="editWatchButton" type="button">Edit alert</button></section>`
      : "";
  const listingSection =
    owned && item.status === "listed"
      ? `<section class="detail-section listing-status advanced-workspace"><div class="detail-section-head"><h2>Currently listed for sale</h2><span>Price checked ${esc(item.priceReviewedAt || "not yet")}</span></div><div class="position-summary"><div><span>Your price per card</span><strong>${item.askingPrice === null ? "Missing" : money(item.askingPrice, item.currency)}</strong></div><div><span>Matching price today</span><strong>${displayPrice === null ? "Unavailable" : money(displayPrice, item.currency)}</strong></div><div><span>Where it is listed</span><strong>${esc(item.listingVenue || "Missing")}</strong></div><div><span>Listed on</span><strong>${esc(item.listedAt || "Not recorded")}</strong></div></div><button class="planner-record" id="manageListingButton" type="button">Review or update sale listing</button></section>`
      : "";
  const matchDetails =
    !owned && item.match?.reasons?.length
      ? `<section class="match-explanation" aria-label="Why this card matched"><strong>Why Mica chose this card</strong><span>${esc(item.match.reasons.join(" · "))}</span><small class="advanced-workspace">Card database ID ${esc(item.externalIds?.tcgdex || item.id)}</small></section>`
      : "";
  const productType = String(item.productType || "sealed product")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const detailMeta = sealed
    ? `<div><span>Product type</span><strong>${esc(productType)}</strong></div><div><span>Language</span><strong>${esc(languageName(item.language))}</strong></div><div class="advanced-workspace"><span>Catalog ID</span><strong>${esc(item.externalIds?.pkmnpricesSealed || "—")}</strong></div><div><span>Package</span><strong>Unopened</strong></div>`
    : `<div><span>Card version</span><strong>${esc(item.variant || "Unknown")}</strong></div><div><span>Language</span><strong>${esc(languageName(item.language))}</strong></div><div><span>Released</span><strong>${esc(item.release || "—")}</strong></div><div><span>Artist</span><strong>${esc(item.artist || "—")}</strong></div>`;
  $("#detailContent").innerHTML =
    `<button class="detail-back" id="detailBack" type="button"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>${backLabel}</button>
    <div class="detail-identity"><img src="${esc(item.image || item.thumb || "./icons/icon.svg")}" data-fallback="${esc(item.thumb || "./icons/icon.svg")}" alt="${esc(item.name)} from ${esc(item.set)}"><div><p class="eyebrow">${esc(sealed ? "Unopened product" : item.rarity || "Pokémon card")}</p><h1 id="detailTitle">${esc(item.name)}</h1><p class="detail-set">${esc(item.set)}${item.number ? ` · card ${esc(item.number)}` : ""}</p><div class="detail-meta">${detailMeta}</div></div></div>
    ${matchDetails}
    ${renderPriceEvidence(item, conditionContext)}
    <section class="market-hero" role="status"><span>${marketLabel}</span><strong>${displayPrice == null ? (pricingStatus === "loading" ? "Checking…" : "Price unavailable") : money(displayPrice)}</strong><small>${statusCopy}</small></section>
    ${watchedSection}
    ${action}
    ${listingSection}
    ${gradingSubmissionSection}
    <section class="detail-section"><div class="detail-section-head"><h2>Matching prices</h2><span>Same card version only</span></div>${sourceRows}</section>
    <section class="detail-section"><div class="detail-section-head"><h2>Price over time</h2><span>${showcaseHistory ? "Made-up demo days" : "Recorded prices"}</span></div>${renderInteractiveHistory(item, displayPrice)}</section>
    <details class="detail-tool-group advanced-workspace"><summary><span><strong>Buying &amp; selling calculator</strong><small>Plan an offer${owned ? " or estimate what you keep after selling" : " or set a target price"}</small></span><b>Open</b></summary><div class="detail-tool-content">${renderBuyPlanner(item, displayPrice)}${owned ? renderSalePlanner(item, displayPrice) : ""}</div></details>
    ${sealed ? "" : `<details class="detail-tool-group advanced-workspace"><summary><span><strong>Professional grading calculator</strong><small>Compare grading cost with possible graded prices</small></span><b>Open</b></summary><div class="detail-tool-content">${renderGradedPriceLadder(item)}${renderGradingEstimator(item)}</div></details>`}
    <details class="detail-tool-group advanced-workspace"><summary><span><strong>More price proof</strong><small>Cards currently for sale and completed-sale links</small></span><b>Open</b></summary><div class="detail-tool-content">${renderMarketplaceOffers(item)}${sealed ? '<section class="detail-section"><div class="detail-section-head"><h2>Recent sales</h2><span>Not available for unopened products</span></div><div class="unavailable-panel">PkmnPrices has a current unopened-product price, but its sold links only support individual cards. Mica does not use unrelated sales.</div></section>' : `<section class="detail-section"><div class="detail-section-head"><h2>Recent completed sales</h2><span>${item.salesStatus === "live" ? "Completed listings" : "Verified links when available"}</span></div>${renderSales(item)}</section>`}</div></details>
    ${renderCardMetadata(item) ? `<details class="detail-tool-group"><summary><span><strong>Card information</strong><small>Character, artist, moves, and set details</small></span><b>Open details</b></summary><div class="detail-tool-content">${renderCardMetadata(item)}</div></details>` : ""}
    ${owned ? `<details class="detail-tool-group"><summary><span><strong>Purchases &amp; notes</strong><small>What you paid, sales, grading, storage, and copies</small></span><b>Open</b></summary><div class="detail-tool-content">${owned ? renderCertificationVerification(item) : ""}${positionSection}${ownedSection}</div></details>` : ""}
    <p class="legal-copy">Prices are estimates, not guaranteed sale amounts. ${sealed ? "The box and seal" : "Wear on the card"} can change what someone will pay.</p>`;
  $("#detailBack").addEventListener("click", () =>
    state.detailCanPop
      ? history.back()
      : routeTo(state.detailReturnRoute || (owned ? "collection" : "scan")),
  );
  $("#editCopyButton")?.addEventListener("click", () =>
    openPositionEditSheet(item),
  );
  $("#addCertificationButton")?.addEventListener("click", () =>
    openPositionEditSheet(item),
  );
  $("#copyCertificationButton")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(item.certificationNumber);
      toast("Certification number copied");
    } catch {
      toast("Copy is unavailable in this browser");
    }
  });
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
  $("#separateCopiesButton")?.addEventListener("click", () =>
    openSeparateCopiesSheet(item),
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
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Find unopened products</h2><p>Search the PkmnPrices product list.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="form-grid"><label class="search-field full"><span class="sr-only">Search unopened products</span><input id="sealedQuery" type="search" placeholder="Crown Zenith Elite Trainer Box" autocomplete="off"></label><div class="field"><label for="sealedLanguage">Language</label><select id="sealedLanguage"><option value="en">English</option><option value="ja">Japanese</option></select></div></div><div class="manual-results" id="sealedResults" aria-live="polite"><div class="find-empty"><strong>Search unopened products</strong><span>Try a set name plus booster box, Elite Trainer Box, tin, bundle, or collection.</span></div></div><p class="legal-copy">Product details and prices come from PkmnPrices. Confirm the exact product and language before adding it.</p>`,
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
        '<div class="find-empty"><strong>Search unopened products</strong><span>Type at least two characters.</span></div>';
      return;
    }
    results.innerHTML =
      '<div class="searching-cards"><i></i><span>Finding unopened products…</span></div>';
    try {
      const response = await fetch(
        `/api/sealed?q=${encodeURIComponent(query)}&language=${encodeURIComponent(language.value)}`,
        { headers: { Accept: "application/json" } },
      );
      const payload = await response.json().catch(() => ({}));
      if (current !== requestId) return;
      if (response.status === 403) {
        results.innerHTML =
          '<div class="pro-data-empty"><strong>Unopened-product search is ready to connect</strong><p>The current PkmnPrices plan cannot search these products. After the plan upgrade, results will appear here without another app change.</p></div>';
        return;
      }
      if (!response.ok) throw new Error(payload.error || "Search unavailable");
      products = payload.products || [];
      results.innerHTML = products.length
        ? products
            .map(
              (product) =>
                `<button class="quick-card-result" type="button" data-sealed-id="${esc(product.externalIds?.pkmnpricesSealed)}"><img src="${esc(product.thumb || "./icons/icon.svg")}" alt="${esc(product.name)}"><span><strong>${esc(product.name)}</strong><small>${esc(product.set)}</small><em>${esc(languageName(product.language))} · Unopened product</em></span><b>View</b></button>`,
            )
            .join("")
        : '<div class="find-empty"><strong>No unopened products found</strong><span>Try the set name or a simpler product description.</span></div>';
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
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Add unopened product</h2><p>${esc(product.name)} · ${esc(product.set)}</p></div><button class="sheet-close" aria-label="Close">×</button></div><form id="sealedPositionForm"><div class="form-grid"><div class="field full acquisition-field"><label for="sealedTotalCost">Total paid</label><div class="money-input"><span>$</span><input id="sealedTotalCost" name="totalAcquisitionCost" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" required></div><small>Include the item, tax, shipping, and fees in one total.</small><label class="field-choice"><input id="sealedCostUnknown" type="checkbox"> I don't know what I paid</label></div><details class="full intake-more"><summary id="sealedMoreSummary">More purchase details · 1 product · ${today}</summary><div class="form-grid"><div class="field"><label for="sealedQuantity">How many?</label><input id="sealedQuantity" name="quantity" type="number" inputmode="numeric" min="1" max="99999" step="1" value="1" required></div><div class="field"><label for="sealedPurchaseDate">When did you buy it?</label><input id="sealedPurchaseDate" name="transactionDate" type="date" max="${today}" value="${today}" required><label class="field-choice"><input id="sealedDateUnknown" type="checkbox"> I don't know the date</label></div><div class="field full"><label for="sealedLocation">Where is it stored? <span class="optional-label">Optional</span></label><input id="sealedLocation" name="location" maxlength="250" placeholder="Closet shelf · Bin 2"></div><div class="field full"><label for="sealedNotes">Notes <span class="optional-label">Optional</span></label><textarea id="sealedNotes" name="notes" maxlength="10000" placeholder="Condition of the box, source, or reminder…"></textarea></div></div></details><p class="form-error" id="sealedPositionError" role="alert"></p></div><div class="position-total"><span id="sealedCostSummary">Total for 1 product</span><strong id="sealedPositionTotal">$0.00</strong></div><p class="unknown-basis-note" id="sealedUnknownBasisNote" hidden>Value tracking still works, but Mica cannot show money gained until you add what you paid.</p><div class="sheet-actions rapid-intake-actions"><button class="secondary" type="button" id="sealedPositionCancel">Cancel</button><button class="secondary" type="submit" name="saveMode" value="continue">Save + add another</button><button class="primary" type="submit" name="saveMode" value="view">Save & view</button></div></form>`,
  );
  const form = $("#sealedPositionForm");
  const values = () => Object.fromEntries(new FormData(form).entries());
  const update = () => {
    const input = values();
    const costUnknown = $("#sealedCostUnknown").checked;
    const dateUnknown = $("#sealedDateUnknown").checked;
    const breakdown = costUnknown
      ? acquisitionFromTotal(0, input.quantity)
      : acquisitionFromTotal(input.totalAcquisitionCost, input.quantity);
    const count = Number(input.quantity) || 0;
    $("#sealedPositionTotal").textContent = costUnknown
      ? "Not recorded"
      : breakdown === null
        ? "Enter an amount"
        : money(breakdown.totalMinor / 100);
    $("#sealedCostSummary").textContent =
      `Total for ${count || 0} product${count === 1 ? "" : "s"}`;
    $("#sealedMoreSummary").textContent =
      `Purchase details · ${count || 0} product${count === 1 ? "" : "s"} · ${dateUnknown ? "date not recorded" : input.transactionDate || today}`;
    $("#sealedUnknownBasisNote").hidden = !costUnknown && !dateUnknown;
  };
  const syncKnownFacts = () => {
    const costUnknown = $("#sealedCostUnknown").checked;
    const dateUnknown = $("#sealedDateUnknown").checked;
    $("#sealedTotalCost").disabled = costUnknown;
    $("#sealedTotalCost").required = !costUnknown;
    $("#sealedPurchaseDate").disabled = dateUnknown;
    $("#sealedPurchaseDate").required = !dateUnknown;
    update();
  };
  form.addEventListener("input", update);
  $("#sealedCostUnknown").addEventListener("change", syncKnownFacts);
  $("#sealedDateUnknown").addEventListener("change", syncKnownFacts);
  $("#sealedPositionCancel").addEventListener("click", closeSheet);
  update();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const continueAdding = event.submitter?.value === "continue";
    const data = values();
    const acquisitionCostKnown = !$("#sealedCostUnknown").checked;
    const acquisitionDateKnown = !$("#sealedDateUnknown").checked;
    data.transactionDate = data.transactionDate || today;
    const breakdown = acquisitionFromTotal(
      acquisitionCostKnown ? data.totalAcquisitionCost : 0,
      data.quantity,
    );
    if (!breakdown) {
      $("#sealedPositionError").textContent = "Enter a valid total paid.";
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
        identity: {
          ...identitySnapshot(product, "Sealed product"),
          acquisitionCostKnown,
          acquisitionDateKnown,
        },
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
    ? `<div class="simple-note"><strong>${esc(existing.variant)} · ${esc(watchContextLabel(existing))}</strong><br>Mica always checks this same card version and wear level or grade so your alert stays accurate.</div>`
    : sealed
      ? `<input type="hidden" name="cardState" value="sealed"><input type="hidden" name="variant" value="${esc(card.variant || "Unopened product")}"><div class="simple-note"><strong>Unopened product · ${esc(languageName(card.language || "en"))}</strong><br>Mica will track this exact product and will not substitute a card or another unopened product.</div>`
      : `<div class="form-grid">
      <div class="field full"><label for="watchVariant">Card version</label><select id="watchVariant" name="variant" required>${variants.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}</select></div>
      <div class="field"><label for="watchState">Is it sealed in a case by a professional grading company?</label><select id="watchState" name="cardState"><option value="raw">No · ungraded card</option><option value="graded">Yes · professionally graded</option></select></div>
      <div class="field raw-watch"><label for="watchCondition">How much wear does it have?</label><select id="watchCondition" name="rawCondition"><option value="near_mint">Like new (Near Mint)</option><option value="lightly_played">Light wear (Lightly Played)</option><option value="moderately_played">Noticeable wear (Moderately Played)</option><option value="heavily_played">Heavy wear (Heavily Played)</option><option value="damaged">Damaged</option></select></div>
      <div class="field graded-watch" hidden><label for="watchGrader">Grading company</label><select id="watchGrader" name="grader"><option value="">Choose grader</option>${["PSA", "BGS", "CGC", "TAG", "SGC"].map((value) => `<option>${value}</option>`).join("")}</select></div>
      <div class="field graded-watch" hidden><label for="watchGrade">Grade</label><input id="watchGrade" name="grade" type="number" inputmode="decimal" min="1" max="10" step="0.5" placeholder="10"></div>
    </div>`;
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">${existing ? "Edit price alert" : sealed ? "Watch this product" : "Watch this card"}</h2><p>${esc(card.name)} · ${esc(card.set)}${card.number ? ` ${esc(card.number)}` : ""}</p></div><button class="sheet-close" aria-label="Close">×</button></div>
    <form id="watchlistForm">${context}<div class="field acquisition-field"><label for="watchTarget">Tell me when the price reaches <span class="optional-label">Optional</span></label><div class="money-input"><span>$</span><input id="watchTarget" name="targetPrice" type="number" inputmode="decimal" min="0" step="0.01" value="${defaults.targetPrice ?? existing?.targetPrice ?? ""}" placeholder="Leave blank to just follow it"></div><small>Mica will flag this exact ${sealed ? "product" : "card"} when its matching price is at or below this amount.</small></div><div class="field"><label for="watchNotes">Notes <span class="optional-label">Optional</span></label><textarea id="watchNotes" name="notes" maxlength="2000" placeholder="Why you want it, preferred seller, trade idea…">${esc(existing?.notes || "")}</textarea></div><p class="form-error" id="watchError" role="alert"></p><div class="sheet-actions">${existing ? '<button class="danger-action" id="deleteWatchButton" type="button">Remove</button>' : '<button class="secondary" id="watchCancel" type="button">Cancel</button>'}<button class="primary" type="submit">${existing ? "Save alert" : sealed ? "Watch this product" : "Watch this card"}</button></div></form>`);
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
  const prefill = options.prefill || {};
  const initialVariant = variants.includes(prefill.variant)
    ? prefill.variant
    : variants[0];
  const initialState = prefill.cardState === "graded" ? "graded" : "raw";
  const initialQuantity = Number(prefill.quantity) > 0 ? prefill.quantity : 1;
  const initialDate = prefill.transactionDate || today;
  const initialTotal = prefill.totalAcquisitionCost ?? "";
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">Add to your library</h2><p>${esc(card.name)} · ${esc(card.set)} ${esc(card.number)} · ${esc(languageName(card.language || "en"))}</p></div><button class="sheet-close" aria-label="Close">×</button></div>
    <form id="positionForm"><div class="form-grid">
      ${variants.length === 1 ? `<input id="positionVariant" name="variant" type="hidden" value="${esc(initialVariant)}"><div class="simple-note full"><strong>${esc(initialVariant)}</strong><br>This card version was selected from your match.</div>` : `<div class="field full"><label for="positionVariant">Card version</label><select id="positionVariant" name="variant" required>${variants.map((value) => `<option value="${esc(value)}" ${value === initialVariant ? "selected" : ""}>${esc(value)}</option>`).join("")}</select></div>`}
      <div class="field"><label for="positionState">Is it sealed in a case by a professional grading company?</label><select id="positionState" name="cardState"><option value="raw" ${initialState === "raw" ? "selected" : ""}>No · ungraded card</option><option value="graded" ${initialState === "graded" ? "selected" : ""}>Yes · professionally graded</option></select></div>
      <div class="field raw-position"><label for="positionCondition">How much wear does it have?</label><select id="positionCondition" name="rawCondition">${options.visionAnalysis && !prefill.rawCondition ? '<option value="" selected>Choose after looking closely</option>' : ""}<option value="near_mint" ${prefill.rawCondition === "near_mint" ? "selected" : ""}>Like new (Near Mint)</option><option value="lightly_played" ${prefill.rawCondition === "lightly_played" ? "selected" : ""}>Light wear (Lightly Played)</option><option value="moderately_played" ${prefill.rawCondition === "moderately_played" ? "selected" : ""}>Noticeable wear (Moderately Played)</option><option value="heavily_played" ${prefill.rawCondition === "heavily_played" ? "selected" : ""}>Heavy wear (Heavily Played)</option><option value="damaged" ${prefill.rawCondition === "damaged" ? "selected" : ""}>Damaged</option></select></div>
      <div class="field graded-position" hidden><label for="positionGrader">Grading company</label><select id="positionGrader" name="grader"><option value="">Choose grader</option>${["PSA", "BGS", "CGC", "TAG", "SGC"].map((value) => `<option ${value === prefill.grader ? "selected" : ""}>${value}</option>`).join("")}</select></div>
      <div class="field graded-position" hidden><label for="positionGrade">Grade</label><input id="positionGrade" name="grade" type="number" inputmode="decimal" min="1" max="10" step="0.5" value="${esc(prefill.grade || "")}" placeholder="10"></div>
      <div class="field full graded-position" hidden><label for="positionCertification">Number printed on the grading label <span class="optional-label">Optional</span></label><input id="positionCertification" name="certificationNumber" maxlength="120" autocomplete="off" value="${esc(prefill.certificationNumber || "")}"><small>Use the certification number on the graded case. Check it on the grading company’s official website after saving.</small></div>
      ${options.visionAnalysis ? `<div class="vision-prefill-note full"><strong>AI suggestion · confirm before saving</strong><span>${options.visionAnalysis.mode === "grade" ? `Possible professional grade ${esc(options.visionAnalysis.gradeRange || "unclear")} · ` : ""}${esc(conditionLabel(options.visionAnalysis.condition))} · ${esc(confidenceLabel(options.visionAnalysis.confidence))}. This is not an official grade or condition guarantee.</span></div>` : ""}
      ${options.receiptSource ? `<div class="vision-prefill-note full"><strong>Check the details read from your receipt</strong><span>${esc(options.receiptSource.vendor || "Store unclear")}${options.receiptSource.orderNumber ? ` · order ${esc(options.receiptSource.orderNumber)}` : ""}. ${options.receiptSource.needsCostReview ? "Enter the final total paid in US dollars; Mica left it blank instead of guessing." : "Confirm the suggested total paid in US dollars."}${options.receiptSource.needsDateReview ? " Check the purchase date too." : ""}</span></div>` : ""}
      <div class="field full acquisition-field"><label for="positionTotalCost">Total paid</label><div class="money-input"><span>$</span><input id="positionTotalCost" name="totalAcquisitionCost" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(initialTotal)}" placeholder="0.00" required></div><small>Include the card, tax, shipping, and fees in one total.</small><label class="field-choice"><input id="positionCostUnknown" type="checkbox"> I don't know what I paid</label></div>
      <details class="full intake-more"><summary id="positionMoreSummary">More purchase details · ${initialQuantity} card${Number(initialQuantity) === 1 ? "" : "s"} · ${initialDate}</summary><div class="form-grid"><div class="field"><label for="positionQuantity">How many cards?</label><input id="positionQuantity" name="quantity" type="number" inputmode="numeric" min="1" max="99999" step="1" value="${esc(initialQuantity)}" required></div><div class="field"><label for="positionDate">When did you buy it?</label><input id="positionDate" name="transactionDate" type="date" max="${today}" value="${esc(initialDate)}" required><label class="field-choice"><input id="positionDateUnknown" type="checkbox"> I don't know the date</label></div></div></details>
      <p class="form-error" id="positionError" role="alert"></p>
    </div><div class="position-total"><span id="positionCostSummary">Total for 1 card</span><strong id="positionTotal">$0.00</strong></div><p class="unknown-basis-note" id="positionUnknownBasisNote" hidden>The card is still saved and valued, but Mica cannot show money gained until you add what you paid.</p>
    <div class="sheet-actions rapid-intake-actions"><button class="secondary" type="button" id="positionCancel">Cancel</button><button class="secondary" type="submit" name="saveMode" value="continue">Save + add another</button><button class="primary" type="submit" name="saveMode" value="view">Save & view</button></div></form>`);
  const form = $("#positionForm");
  const syncState = () => {
    const graded = $("#positionState").value === "graded";
    $$(".graded-position", form).forEach((node) => (node.hidden = !graded));
    $$(".raw-position", form).forEach((node) => (node.hidden = graded));
    $("#positionGrader").required = graded;
    $("#positionGrade").required = graded;
    $("#positionCondition").required = !graded;
    $("#positionCondition").disabled = graded;
    $("#positionGrader").disabled = !graded;
    $("#positionGrade").disabled = !graded;
    $("#positionCertification").disabled = !graded;
  };
  const values = () => {
    const data = new FormData(form);
    return Object.fromEntries(data.entries());
  };
  const updateTotal = () => {
    const input = values();
    const costUnknown = $("#positionCostUnknown").checked;
    const dateUnknown = $("#positionDateUnknown").checked;
    const breakdown = costUnknown
      ? acquisitionFromTotal(0, input.quantity)
      : acquisitionFromTotal(input.totalAcquisitionCost, input.quantity);
    const count = Number(input.quantity) || 0;
    $("#positionTotal").textContent = costUnknown
      ? "Not recorded"
      : breakdown === null
        ? "Enter an amount"
        : money(breakdown.totalMinor / 100);
    $("#positionCostSummary").textContent =
      `Total for ${count || 0} card${count === 1 ? "" : "s"}`;
    $("#positionMoreSummary").textContent =
      `Purchase details · ${count || 0} card${count === 1 ? "" : "s"} · ${dateUnknown ? "date not recorded" : input.transactionDate || today}`;
    $("#positionUnknownBasisNote").hidden = !costUnknown && !dateUnknown;
  };
  const syncKnownFacts = () => {
    const costUnknown = $("#positionCostUnknown").checked;
    const dateUnknown = $("#positionDateUnknown").checked;
    $("#positionTotalCost").disabled = costUnknown;
    $("#positionTotalCost").required = !costUnknown;
    $("#positionDate").disabled = dateUnknown;
    $("#positionDate").required = !dateUnknown;
    updateTotal();
  };
  $("#positionState").addEventListener("change", () => {
    syncState();
    updateTotal();
  });
  form.addEventListener("input", updateTotal);
  $("#positionCostUnknown").addEventListener("change", syncKnownFacts);
  $("#positionDateUnknown").addEventListener("change", syncKnownFacts);
  $("#positionCancel").addEventListener("click", closeSheet);
  syncState();
  updateTotal();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const continueAdding = event.submitter?.value === "continue";
    const formInput = values();
    const acquisitionCostKnown = !$("#positionCostUnknown").checked;
    const acquisitionDateKnown = !$("#positionDateUnknown").checked;
    formInput.transactionDate = formInput.transactionDate || today;
    const breakdown = acquisitionFromTotal(
      acquisitionCostKnown ? formInput.totalAcquisitionCost : 0,
      formInput.quantity,
    );
    if (!breakdown) {
      $("#positionError").textContent = "Enter a valid total paid.";
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
        identity: {
          ...identitySnapshot(card, input.variant),
          acquisitionCostKnown,
          acquisitionDateKnown,
        },
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

function openPurchaseLotSheet(item, defaults = {}) {
  const today = localIsoDate();
  const sealed = item.cardState === "sealed";
  const noun = sealed ? "product" : "card";
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">Add another ${noun}</h2><p>${esc(item.name)} · ${esc(item.gradingCompany ? `${item.gradingCompany} grade ${item.grade}` : conditionLabel(item.condition))}</p></div><button class="sheet-close" aria-label="Close">×</button></div>
    <form id="purchaseLotForm"><div class="form-grid">
      <div class="field full acquisition-field"><label for="lotTotalCost">Total paid</label><div class="money-input"><span>$</span><input id="lotTotalCost" name="totalAcquisitionCost" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(defaults.totalAcquisitionCost ?? "")}" placeholder="0.00" required></div><small>Include the card, tax, shipping, and fees in one total.</small></div>
      <details class="full intake-more"><summary id="purchaseLotSummary">1 ${noun} · bought today</summary><div class="form-grid"><div class="field"><label for="lotQuantity">How many ${noun}s?</label><input id="lotQuantity" name="quantity" type="number" inputmode="numeric" min="1" max="99999" step="1" value="${esc(defaults.quantity || 1)}" required></div><div class="field"><label for="lotDate">When did you buy them?</label><input id="lotDate" name="transactionDate" type="date" max="${today}" value="${esc(defaults.transactionDate || today)}" required></div></div><section class="blended-purchase advanced-workspace" aria-labelledby="blendedPurchaseTitle"><div class="blended-purchase-head"><span>After this purchase</span><strong id="blendedPurchaseTitle">Updated totals</strong></div><div class="blended-purchase-grid" id="blendedPurchaseGrid" aria-live="polite"></div><small>Mica keeps this purchase separate so future sales use the right purchase amount.</small></section></details>
      <p class="form-error" id="purchaseLotError" role="alert"></p>
    </div><div class="position-total"><span>Total paid</span><strong id="purchaseLotTotal">$0.00</strong></div>
    <div class="sheet-actions"><button class="secondary" type="button" id="purchaseLotCancel">Cancel</button><button class="primary" type="submit">Add to collection</button></div></form>`);
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
      `${count || 0} ${noun}${count === 1 ? "" : "s"} · ${input.transactionDate === today ? "purchased today" : input.transactionDate}`;
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
      ? `<div><span>${sealed ? "Products" : "Cards"} owned</span><strong>${preview.quantity}</strong><small>was ${Number(item.quantity)}</small></div><div><span>Total paid</span><strong>${money(preview.costBasisMinor / 100, currency)}</strong><small>includes this purchase</small></div><div><span>Average paid for each</span><strong>${money(preview.averageCostMinor / 100, currency)}</strong><small>${preview.averageChangeMinor === 0 ? "unchanged" : `${preview.averageChangeMinor < 0 ? "down" : "up"} ${money(Math.abs(preview.averageChangeMinor) / 100, currency)} per ${noun}`}</small></div><div><span>Change in value now</span><strong>${preview.unrealizedGainMinor === null ? "Price unavailable" : `${preview.unrealizedGainMinor >= 0 ? "Up " : "Down "}${money(Math.abs(preview.unrealizedGainMinor) / 100, currency)}`}</strong><small>${preview.marketValueMinor === null ? "needs a matching price" : `${money(preview.marketValueMinor / 100, currency)} current value`}</small></div>`
      : `<div class="blended-purchase-empty">${item.costBasis === null || item.costBasis === undefined ? "What you paid before is incomplete, so Mica cannot calculate an average yet." : "Enter how many and the total paid to preview the updated collection."}</div>`;
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
      $("#purchaseLotError").textContent = "Enter a valid total paid.";
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
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Add missing purchase details</h2><p>${esc(item.name)} · ${lot.quantityAcquired} originally bought</p></div><button class="sheet-close" aria-label="Close">×</button></div><form id="completePurchaseHistoryForm"><div class="form-grid">${needsCost ? `<div class="field full acquisition-field"><label for="missingAcquisitionCost">Total paid <span class="optional-label">Add if known</span></label><div class="money-input"><span>$</span><input id="missingAcquisitionCost" name="totalAcquisitionCost" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00"></div><small>Enter everything paid for all ${lot.quantityAcquired} cards in this purchase. Mica will update cards you still own and cards already sold.</small></div>` : ""}${needsDate ? `<div class="field full"><label for="missingAcquisitionDate">When did you buy them? <span class="optional-label">Add if known</span></label><input id="missingAcquisitionDate" name="acquiredAt" type="date" max="${today}"><small>Until you add the real date, Mica uses the import date only to keep purchases in a consistent order.</small></div>` : ""}<p class="form-error" id="completePurchaseHistoryError" role="alert"></p></div><div class="info-copy"><p>Add only details you know. You can save one now and return for the other later.</p></div><div class="sheet-actions"><button class="secondary" type="button" id="completePurchaseHistoryCancel">Cancel</button><button class="primary" type="submit">Save details</button></div></form>`,
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
          "Add the total paid or the original purchase date.";
        return;
      }
      if (
        totalAcquisitionCost !== null &&
        (!Number.isFinite(totalAcquisitionCost) || totalAcquisitionCost < 0)
      ) {
        $("#completePurchaseHistoryError").textContent =
          "Enter a valid total paid.";
        return;
      }
      if (acquiredAt && acquiredAt > today) {
        $("#completePurchaseHistoryError").textContent =
          "Purchase dates cannot be later than today.";
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

function openGradingSubmissionSheet(item, submission = null, defaults = {}) {
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
    ["assembly", "Card case being prepared"],
    ["shipped", "Return shipped"],
  ];
  const currentIndex = Math.max(
    0,
    statuses.findIndex(([value]) => value === submission?.status),
  );
  const availableStatuses = statuses.slice(currentIndex);
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">${editing ? "Update cards sent for grading" : "Send cards for grading"}</h2><p>${esc(item.name)} · ${item.quantity} ungraded card${item.quantity === 1 ? "" : "s"} · update the status yourself</p></div><button class="sheet-close" aria-label="Close">×</button></div><form id="gradingSubmissionForm"><div class="form-grid">
    ${editing ? `<div class="field"><label for="submissionStatus">Current stage</label><select id="submissionStatus" name="status" required>${availableStatuses.map(([value, label]) => `<option value="${value}" ${value === submission.status ? "selected" : ""}>${label}</option>`).join("")}<option value="cancelled">Cancel submission</option></select></div><div class="field"><label for="submissionStatusDate">Status date</label><input id="submissionStatusDate" name="statusUpdatedAt" type="date" min="${esc(submission.submittedAt)}" max="${today}" value="${today}" required></div>` : `<div class="field"><label for="submissionGrader">Grading company</label><select id="submissionGrader" name="grader" required><option value="">Choose grader</option>${["PSA", "BGS", "CGC", "TAG", "SGC"].map((value) => `<option ${value === defaults.grader ? "selected" : ""}>${value}</option>`).join("")}</select></div><div class="field"><label for="submissionSentDate">Date sent</label><input id="submissionSentDate" name="submittedAt" type="date" min="${esc(latestAcquisition)}" max="${today}" value="${esc(defaults.submittedAt || today)}" required></div>`}
    <div class="field"><label for="submissionExpectedDate">Expected return <span class="optional-label">Optional</span></label><input id="submissionExpectedDate" name="expectedReturnDate" type="date" min="${esc(editing ? submission.submittedAt : latestAcquisition || today)}" value="${esc(submission?.expectedReturnDate || defaults.expectedReturnDate || "")}"></div>
    ${editing ? "" : `<div class="field"><label for="submissionEstimatedCost">Estimated all-in cost <span class="optional-label">Planning only</span></label><div class="money-input"><span>$</span><input id="submissionEstimatedCost" name="estimatedTotalCost" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(defaults.estimatedTotalCost || "")}" placeholder="0.00"></div></div>`}
    <div class="field full"><label for="submissionReference">Order number <span class="optional-label">Optional</span></label><input id="submissionReference" name="submissionReference" maxlength="120" value="${esc(submission?.submissionReference || "")}" autocomplete="off" placeholder="Order or grading number"></div>
    <div class="field full"><label for="submissionNotes">Notes <span class="optional-label">Optional</span></label><textarea id="submissionNotes" name="notes" maxlength="10000" placeholder="Shipping, service speed, or anything you want to remember">${esc(submission?.notes || defaults.notes || "")}</textarea></div>
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

function openSeparateCopiesSheet(item) {
  const maximum = Number(item.quantity) - 1;
  if (!Number.isInteger(maximum) || maximum < 1) return;
  const activeSubmission = item.activeGradingSubmission || null;
  const idempotencyKey = crypto.randomUUID();
  const noun = item.cardState === "sealed" ? "product" : "card";
  const gradedCertificationNote =
    item.cardState === "graded" && item.certificationNumber
      ? "The original group keeps its certification number. Add the other graded card’s number after separating it."
      : "Wear level, grade, labels, location, notes, and card version stay with both groups.";
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">Separate copies</h2><p>${esc(item.name)} · move some copies into their own saved entry</p></div><button class="sheet-close" aria-label="Close">×</button></div><form id="separateCopiesForm"><div class="form-grid">
    <div class="field"><label for="separateCopiesQuantity">Copies to separate</label><input id="separateCopiesQuantity" name="quantity" type="number" inputmode="numeric" min="1" max="${maximum}" step="1" value="1" required><small>Up to ${maximum}; at least one ${noun} stays here.</small></div>
    <div class="field"><label for="separateCopiesOrder">Which purchases should move?</label><select id="separateCopiesOrder" name="lotOrder"><option value="oldest">Oldest purchases first</option><option value="newest">Newest purchases first</option></select><small>Choose whether the older or newer purchase amounts move with these cards.</small></div>
    <p class="form-error" id="separateCopiesError" role="alert"></p>
  </div><div class="warning-panel"><strong>The original purchase amounts move with the cards.</strong><p>No new purchase or sale is created. ${esc(activeSubmission ? "The active grading record and its estimated cost are also divided, so each group can receive a different grade." : gradedCertificationNote)}</p></div><div class="sheet-actions"><button class="secondary" type="button" id="separateCopiesCancel">Cancel</button><button class="primary" type="submit">Separate copies</button></div></form>`);
  $("#separateCopiesCancel").addEventListener("click", closeSheet);
  $("#separateCopiesForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const quantity = Number(data.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > maximum) {
      $("#separateCopiesError").textContent =
        `Enter a whole number from 1 to ${maximum}.`;
      return;
    }
    const submit = event.currentTarget.querySelector('[type="submit"]');
    submit.disabled = true;
    $("#separateCopiesError").textContent =
      "Moving the original purchase details with these cards…";
    try {
      const newPositionId = await splitCollectionPosition(supabase, {
        collectionItemId: item.uid,
        quantity,
        lotOrder: data.lotOrder,
        idempotencyKey,
      });
      closeSheet({ discardHistory: true });
      await reloadPortfolio(newPositionId);
      toast(
        activeSubmission
          ? "Copies separated · record each returned grade separately"
          : "Copies separated · original purchase details preserved",
      );
    } catch (error) {
      const message = String(error.message || "");
      $("#separateCopiesError").textContent = message.includes(
        "invalid_split_quantity",
      )
        ? "That quantity is no longer available. Refresh and try again."
        : message.includes("position_cannot_be_split")
          ? "End the active sale listing or restore this saved entry before separating copies."
          : message.includes("fifo_lots_incomplete")
            ? "The purchase details for this saved entry need review before copies can be separated."
            : message.includes("split_requires_complete_acquisition_history")
              ? "Complete every missing purchase amount and date before separating copies."
              : message.includes("grading_submission_quantity_mismatch")
                ? "The grading record no longer matches this saved entry. Refresh before retrying."
                : `Could not separate copies: ${message || "Unknown error"}`;
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
      ? "Every card in this saved entry must have the same grading company and grade. If the results differ, cancel and use Separate copies first. Leave the certification number blank unless one number represents the whole group."
      : "The original purchase stays in place. This adds only the grading cost and returned graded-card details.";
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">Record the returned grade</h2><p>${esc(item.name)} · update the card without creating a sale</p></div><button class="sheet-close" aria-label="Close">×</button></div><form id="gradingResultForm"><div class="form-grid">
    <div class="field"><label for="gradingResultGrader">Grading company</label><select id="gradingResultGrader" name="grader" required>${activeSubmission ? `<option>${esc(activeSubmission.grader)}</option>` : `<option value="">Choose grader</option>${["PSA", "BGS", "CGC", "TAG", "SGC"].map((value) => `<option>${value}</option>`).join("")}`}</select></div>
    <div class="field"><label for="gradingResultGrade">Returned grade</label><input id="gradingResultGrade" name="grade" type="number" inputmode="decimal" min="1" max="10" step="0.1" placeholder="10" required></div>
    <div class="field"><label for="gradingResultDate">Return date</label><input id="gradingResultDate" name="transactionDate" type="date" min="${esc(earliestReturn)}" max="${today}" value="${today}" required></div>
    <div class="field"><label for="gradingResultCost">Total grading cost</label><div class="money-input"><span>$</span><input id="gradingResultCost" name="totalGradingCost" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" required></div><small>Include fees, shipping, insurance, and supplies for these ${item.quantity} card${item.quantity === 1 ? "" : "s"} as one total.</small></div>
    <div class="field full"><label for="gradingResultCert">Certification number <span class="optional-label">Optional</span></label><input id="gradingResultCert" name="certificationNumber" maxlength="120" autocomplete="off"><small>${item.quantity === 1 ? "Printed on the returned graded case." : "If the numbers are different, keep each graded card in a separate saved entry."}</small></div>
    <div class="field full"><label for="gradingResultNotes">Notes <span class="optional-label">Optional</span></label><textarea id="gradingResultNotes" name="notes" maxlength="10000" placeholder="Submission or return details"></textarea></div>
    <p class="form-error" id="gradingResultError" role="alert">${basisReady ? "" : "Add the missing amount paid first so Mica can keep an honest purchase history."}</p>
  </div><div class="warning-panel"><strong>All ${item.quantity} current card${item.quantity === 1 ? "" : "s"} will become professionally graded.</strong><p>${esc(batchNote)} Old ungraded prices are cleared, and the total grading cost is divided across the remaining cards to the cent.</p></div><div class="sheet-actions"><button class="secondary" type="button" id="gradingResultCancel">Cancel</button><button class="primary" type="submit" ${basisReady ? "" : "disabled"}>Save returned grade</button></div></form>`);
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
      "Preserving the purchase history and updating the card…";
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
        ? "Add the missing amount paid first."
        : message.includes("submission_grader_mismatch")
          ? "Use the same grader recorded on the active submission."
          : message.includes("position_not_raw")
            ? "This saved card is already graded."
            : message.includes("position_not_owned")
              ? "Return this card to your main collection before recording grading."
              : message.includes("grading_before_acquisition")
                ? "The grading date cannot be before a known purchase date."
                : `Could not record the graded result: ${message || "Unknown error"}`;
      submit.disabled = false;
    }
  });
}

function openSaleSheet(item, defaults = {}) {
  const today = localIsoDate();
  const suggestedUnitPrice = defaults.unitPrice ?? item.askingPrice ?? "";
  const suggestedMarketplace =
    defaults.marketplace ??
    item.listingVenue ??
    workflowDefault("sale-marketplace");
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Record a sale</h2><p>${esc(item.name)} · ${esc(item.gradingCompany ? `${item.gradingCompany} grade ${item.grade}` : conditionLabel(item.condition))} · ${item.quantity} owned</p></div><button class="sheet-close" aria-label="Close">×</button></div><form id="saleForm"><div class="form-grid"><div class="field"><label for="saleQuantity">How many did you sell?</label><input id="saleQuantity" name="quantity" type="number" min="1" max="${item.quantity}" step="1" value="${esc(defaults.quantity || 1)}" required></div><div class="field"><label for="saleDate">When did you sell them?</label><input id="saleDate" name="transactionDate" type="date" max="${today}" value="${esc(defaults.transactionDate || today)}" required></div><div class="field"><label for="salePrice">Selling price for each</label><input id="salePrice" name="unitPrice" type="number" min="0" step="0.01" value="${esc(suggestedUnitPrice)}" required>${item.askingPrice != null && defaults.unitPrice == null ? "<small>Filled from this card’s sale listing.</small>" : ""}</div><div class="field"><label for="saleFees">Selling site fees</label><input id="saleFees" name="marketplaceFees" type="number" min="0" step="0.01" value="${esc(defaults.marketplaceFees ?? "0.00")}"></div><div class="field"><label for="saleShipping">Shipping you paid</label><input id="saleShipping" name="shipping" type="number" min="0" step="0.01" value="${esc(defaults.shipping ?? "0.00")}"></div><div class="field"><label for="saleOther">Other selling costs</label><input id="saleOther" name="otherCosts" type="number" min="0" step="0.01" value="${esc(defaults.otherCosts ?? "0.00")}"></div><div class="field full"><label for="saleMarketplace">Where did you sell it?</label><input id="saleMarketplace" name="marketplace" value="${esc(suggestedMarketplace)}" placeholder="eBay, TCGplayer, card show…"></div><div class="field full"><label for="saleNotes">Notes <span class="optional-label">Optional</span></label><textarea id="saleNotes" name="notes">${esc(defaults.notes || "")}</textarea></div><p class="form-error" id="saleError" role="alert"></p></div><div class="simple-note"><strong>Mica uses your oldest recorded purchase first.</strong><br>This keeps the amount you made from the sale consistent and leaves a clear history.</div><div class="sheet-actions"><button class="secondary" type="button" id="saleCancel">Cancel</button><button class="primary" type="submit">Record sale</button></div></form>`,
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
      rememberWorkflowDefault("sale-marketplace", data.marketplace);
      closeSheet({ discardHistory: true });
      await reloadPortfolio(item.uid);
      toast("Sale recorded · oldest purchase used first");
    } catch (error) {
      $("#saleError").textContent =
        `Could not record sale: ${error.message || "Unknown error"}`;
      submit.disabled = false;
    }
  });
}

async function reloadPortfolio(focusId = null) {
  const ownerId = state.session?.user?.id;
  const loadVersion = sessionLoadVersion;
  if (!ownerId) return;
  const items = await loadPortfolio(supabase, ownerId);
  if (!accountRequestIsCurrent(ownerId, loadVersion)) return;
  state.items = items;
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
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Remove this saved card?</h2><p>${esc(item.name)} · ${esc(item.set)} ${esc(item.number)}</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="warning-panel"><strong>This removes the card and all of its purchase, sale, and grading history.</strong><p>This cannot be undone. The collection value chart will restart so removed history is not shown as a real price change.</p></div><div class="sheet-actions"><button class="secondary" id="keepCloudPosition" type="button">Keep card</button><button class="danger-action" id="removeCloudPosition" type="button">Remove card</button></div>`,
  );
  $("#keepCloudPosition").addEventListener("click", closeSheet);
  $("#removeCloudPosition").addEventListener("click", async () => {
    const button = $("#removeCloudPosition");
    button.disabled = true;
    try {
      await deletePosition(supabase, item.uid);
      state.portfolioHistory = [];
      state.portfolioHistoryStatus = "idle";
      closeSheet({ discardHistory: true });
      state.detailId = null;
      state.detailCard = null;
      state.detailCanPop = false;
      routeTo("collection");
      await reloadPortfolio();
      toast("Card and its history removed");
    } catch (error) {
      button.disabled = false;
      toast(`Could not remove this card: ${error.message || "Unknown error"}`);
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
  const suggestedAsk =
    item.askingPrice ??
    (item.pricingStatus === "live" &&
    item.price != null &&
    Number.isFinite(Number(item.price))
      ? Number(item.price).toFixed(2)
      : "");
  const suggestedVenue = item.listingVenue || workflowDefault("listing-venue");
  const statusOptions = atGrader
    ? '<option value="owned" selected>At grader · keep owned</option>'
    : `<option value="owned" ${editableStatus === "owned" ? "selected" : ""}>Keeping it</option><option value="listed" ${editableStatus === "listed" ? "selected" : ""}>Listed for sale</option><option value="archived" ${editableStatus === "archived" ? "selected" : ""}>Archived</option>`;
  const statusHelp = atGrader
    ? "This card stays in your collection while it is at the grading company. Record its return or cancel the grading record before listing or archiving it."
    : "Choose Listed for sale to add selling details. Recording a completed sale is a separate step.";
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Edit card details</h2><p>${esc(item.name)} · purchases and sales stay unchanged</p></div><button class="sheet-close" aria-label="Close">×</button></div><form id="positionEditForm"><div class="form-grid"><div class="field full"><label for="editStatus">What are you doing with it?</label><select id="editStatus" name="status">${statusOptions}</select><small>${statusHelp}</small></div><div class="listing-edit-fields full" id="listingEditFields"><div class="form-grid"><div class="field"><label for="editAskingPrice">Your selling price for each</label><div class="money-input"><span>$</span><input id="editAskingPrice" name="askingPrice" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(suggestedAsk)}" placeholder="0.00"></div>${item.askingPrice == null && suggestedAsk !== "" ? "<small>Suggested from today’s matching price. Confirm it before listing.</small>" : ""}</div><div class="field"><label for="editListedAt">When did you list it?</label><input id="editListedAt" name="listedAt" type="date" max="${today}" value="${esc(item.listedAt || today)}"></div><div class="field full"><label for="editListingVenue">Where is it listed?</label><input id="editListingVenue" name="listingVenue" maxlength="100" value="${esc(suggestedVenue)}" placeholder="eBay, TCGplayer, card show table…">${!item.listingVenue && suggestedVenue ? "<small>Filled from your last listing. Change it if needed.</small>" : ""}</div></div><p>Mica compares your selling price with today’s matching price and asks you to check it again after 7 days.</p></div>${item.gradingCompany ? `<div class="field full"><label for="editCertification">Certification number</label><input id="editCertification" name="certificationNumber" maxlength="120" autocomplete="off" value="${esc(item.certificationNumber || "")}"><small>Use the number printed on this ${esc(item.gradingCompany)} graded case. You can check it on the grading company’s official website after saving.</small></div>` : ""}<div class="field full"><label for="editLocation">Where is it stored?</label><input id="editLocation" name="location" maxlength="250" value="${esc(item.location || "")}" placeholder="Binder 1 · Page 4"></div><div class="field full"><label for="editTags">Labels <span class="optional-label">Optional</span></label><input id="editTags" name="tags" maxlength="500" value="${esc(labels.join(", "))}" placeholder="Trade binder, Grade next, Show case"><small>Separate labels with commas. Favorites is managed from the card page.</small></div><div class="field full"><label for="editNotes">Notes <span class="optional-label">Optional</span></label><textarea id="editNotes" name="notes" maxlength="10000">${esc(item.notes || "")}</textarea></div><p class="form-error" id="editError" role="alert"></p></div><div class="sheet-actions"><button class="secondary" type="button" id="editCancel">Cancel</button><button class="primary" type="submit">Save details</button></div></form>`,
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
      if (listing) rememberWorkflowDefault("listing-venue", data.listingVenue);
      closeSheet({ discardHistory: true });
      await reloadPortfolio(item.uid);
      toast(
        listing
          ? "Listing saved and price marked reviewed"
          : "Card details updated",
      );
    } catch (error) {
      $("#editError").textContent =
        `Could not update this card: ${error.message || "Unknown error"}`;
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
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Choose a different card version</h2><p>Only the matched card changes. Purchases, sales, grade, wear, and number owned stay the same.</p></div><button class="sheet-close" aria-label="Close">×</button></div><form id="remapPositionForm"><div class="form-grid"><label class="search-field full"><span class="sr-only">Search for the correct card</span><input id="remapQuery" type="search" value="${esc(`${item.name} ${item.number || ""}`.trim())}" placeholder="Card name and bottom number" autocomplete="off"></label><div class="field full"><label for="remapLanguage">Language on the card</label><select id="remapLanguage">${["en", "ja", "fr", "de", "es", "it", "pt", "zh-tw", "id", "th"].map((code) => `<option value="${code}" ${code === (item.language || "en") ? "selected" : ""}>${esc(languageName(code))}</option>`).join("")}</select></div></div><div class="manual-results" id="remapResults" aria-live="polite"></div><div class="simple-note" id="remapChoice" hidden></div><p class="form-error" id="remapError" role="alert"></p><div class="warning-panel"><strong>Your purchase and sale history stays with the card.</strong><p>Only the matched card version changes. Old prices are cleared, and the collection value chart restarts so the correction is not shown as a real price change.</p></div><div class="sheet-actions"><button class="secondary" id="remapCancel" type="button">Cancel</button><button class="primary" id="remapSave" type="submit" disabled>Use selected card</button></div></form>`,
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
      : '<div class="unavailable-panel">No matching cards were found. Try fewer words or check the language.</div>';
    $$("[data-remap-result]", $("#remapResults")).forEach((button) =>
      button.addEventListener("click", () => {
        selected = cards[Number(button.dataset.remapResult)];
        const variants = catalogVariants(selected);
        $("#remapChoice").hidden = false;
        $("#remapChoice").innerHTML =
          `<strong>Selected: ${esc(selected.name)} · ${esc(selected.set)} ${esc(selected.number)}</strong><br><label for="remapVariant">Card version</label><select id="remapVariant">${variants.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}</select>`;
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
      '<div class="searching-cards"><i></i><span>Finding matching cards…</span></div>';
    try {
      const result = await searchCatalog(query, $("#remapLanguage").value, 12);
      if (current !== requestId) return;
      renderResults(result.items);
    } catch {
      if (current === requestId)
        $("#remapResults").innerHTML =
          '<div class="unavailable-panel">Card search is temporarily unavailable. Your saved card is unchanged.</div>';
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
    $("#remapError").textContent = "Updating the card match…";
    const variant = $("#remapVariant").value;
    try {
      await remapCollectionPosition(supabase, {
        collectionItemId: item.uid,
        identity: identitySnapshot(selected, variant),
        cardId: selected.cardId || null,
        variantId: selected.variantId || null,
      });
      state.portfolioHistory = [];
      state.portfolioHistoryStatus = "idle";
      closeSheet({ discardHistory: true });
      await reloadPortfolio(item.uid);
      toast("Card match corrected · price history restarted");
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
  const sensitive = $("#bottomSheet").dataset.sensitive === "true";
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
  stopAutoCaptureCamera();
  $("#bottomSheet").dataset.lockClose = "false";
  delete $("#bottomSheet").dataset.visionOperation;
  delete $("#bottomSheet").dataset.cameraOperation;
  if (sensitive) {
    if ($("#bottomSheet").dataset.sensitivePreviewUrl)
      URL.revokeObjectURL($("#bottomSheet").dataset.sensitivePreviewUrl);
    $("#sheetContent").replaceChildren();
    delete $("#bottomSheet").dataset.sensitive;
    delete $("#bottomSheet").dataset.sensitivePreviewUrl;
    $("#capturePreview").innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5h3l1.3-2h7.4l1.3 2h3v10H4z"/><circle cx="12" cy="13" r="3.2"/></svg><strong>Position one card inside the frame</strong><span>Use a plain background and avoid glare</span>';
    $("#qualityChip").innerHTML = "<span></span> Ready for a clear photo";
  }
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
    <div class="field"><label for="sheetView">Show</label><select id="sheetView"><option value="all">All items</option><option value="favorites">Favorites only</option><option value="graded">Professionally graded only</option><option value="unpriced">Missing a matching price</option><option value="for-sale">For sale</option><option value="watchlist">Cards I’m watching</option><option value="sets">Set progress</option></select></div>
    <div class="field"><label for="sheetSet">Set</label><select id="sheetSet"><option value="">Every set</option>${sets.map((set) => `<option value="${esc(set)}">${esc(set)}</option>`).join("")}</select></div>
    <div class="field"><label for="sheetCondition">Card type or wear</label><select id="sheetCondition"><option value="">Every type and condition</option><option value="Raw">Ungraded cards</option><option value="Graded">Professionally graded cards</option><option value="Sealed">Unopened products</option><option value="Near Mint">Like new</option><option value="Lightly Played">Light wear</option><option value="Moderately Played">Noticeable wear</option><option value="Heavily Played">Heavy wear</option><option value="Damaged">Damaged</option></select></div>
    <div class="field"><label for="sheetLabel">Label</label><select id="sheetLabel"><option value="">Every label</option>${labels.map((label) => `<option value="${esc(label)}">${esc(label)}</option>`).join("")}</select></div>
    <div class="field"><label for="sheetSort">Sort by</label><select id="sheetSort"><option value="value-desc">Most valuable first</option><option value="name">Name, A to Z</option></select></div>
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

function stopAutoCaptureCamera() {
  if (activeCameraTimer) clearInterval(activeCameraTimer);
  activeCameraTimer = null;
  activeCameraStream?.getTracks().forEach((track) => track.stop());
  activeCameraStream = null;
}

function autoCaptureImage(video) {
  if (!video?.videoWidth || !video?.videoHeight) return null;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d", { alpha: false }).drawImage(video, 0, 0);
  return new Promise((resolve) =>
    canvas.toBlob(
      (blob) =>
        resolve(
          blob
            ? new File([blob], `mica-auto-capture-${Date.now()}.jpg`, {
                type: "image/jpeg",
              })
            : null,
        ),
      "image/jpeg",
      0.9,
    ),
  );
}

function cameraErrorMessage(error) {
  if (error?.name === "NotAllowedError")
    return "Camera access was blocked. Allow camera access for this site in your browser settings, then try again.";
  if (error?.name === "NotFoundError")
    return "No camera was found on this device. You can choose a saved photo instead.";
  if (error?.name === "NotReadableError")
    return "Another app may be using the camera. Close it, then try again.";
  if (!window.isSecureContext)
    return "Live camera access requires a secure HTTPS connection.";
  return "The live camera could not start. You can retry or choose a saved photo.";
}

async function openDeviceCamera({
  kind = "card",
  automatic = false,
  onPhoto = null,
} = {}) {
  const copy = {
    card: {
      title: automatic ? "Automatic card capture" : "Scan a card",
      description: automatic
        ? "Hold steady and Mica will take the photo."
        : "Center one card, then press the shutter.",
      instruction: "Keep the entire card visible and avoid glare.",
      guide: "card",
      alt: "Captured Pokémon card",
    },
    back: {
      title: "Scan the card back",
      description: "Capture the full back for a raw grade estimate.",
      instruction: "Remove sleeves when safe and avoid reflected light.",
      guide: "card",
      alt: "Captured Pokémon card back",
    },
    receipt: {
      title: "Scan receipt or order",
      description: "Capture the full document inside the frame.",
      instruction: "Keep the vendor, date, line items, and total readable.",
      guide: "receipt",
      alt: "Captured receipt or order",
    },
  }[kind];
  const operationId = crypto.randomUUID();
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">${esc(copy.title)}</h2><p>${esc(copy.description)}</p></div><button class="sheet-close" aria-label="Close camera">×</button></div><div class="device-camera" data-camera-kind="${esc(copy.guide)}"><div class="auto-capture-stage"><video id="deviceCameraVideo" autoplay playsinline muted aria-label="Live device camera preview"></video><img id="deviceCameraReview" alt="${esc(copy.alt)}" hidden><div class="auto-capture-guide" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="camera-top-actions"><button id="deviceCameraSwitch" type="button" hidden>Switch camera</button><button id="deviceCameraTorch" type="button" aria-pressed="false" hidden>Light</button></div><div class="auto-capture-state" id="deviceCameraState" role="status" aria-live="polite">Requesting camera permission…</div></div><p class="automation-privacy"><strong>${esc(copy.instruction)}</strong> The browser will ask whether Mica may use this device’s camera. No photo is saved until you choose to continue.</p><div class="camera-permission-help" id="deviceCameraHelp" hidden></div><div class="camera-capture-actions"><label class="camera-upload-fallback" for="deviceCameraUpload">Choose saved photo<input id="deviceCameraUpload" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden></label><button class="secondary" id="deviceCameraRetry" type="button" hidden>Try camera again</button><button class="secondary" id="deviceCameraRetake" type="button" hidden>Retake</button><button class="camera-shutter" id="deviceCameraCapture" type="button" disabled aria-label="Take photo"><i aria-hidden="true"></i></button><button class="primary camera-use-photo" id="deviceCameraUse" type="button" hidden>Use photo</button></div></div>`,
  );
  $("#bottomSheet").dataset.sensitive = "true";
  $("#bottomSheet").dataset.cameraOperation = operationId;
  const video = $("#deviceCameraVideo");
  const review = $("#deviceCameraReview");
  const status = $("#deviceCameraState");
  const help = $("#deviceCameraHelp");
  const captureButton = $("#deviceCameraCapture");
  const useButton = $("#deviceCameraUse");
  const retakeButton = $("#deviceCameraRetake");
  const retryButton = $("#deviceCameraRetry");
  const switchButton = $("#deviceCameraSwitch");
  const torchButton = $("#deviceCameraTorch");
  let cameras = [];
  let currentCameraId = "";
  let capturedFile = null;
  let previewUrl = "";
  let torchEnabled = false;

  const operationIsCurrent = () =>
    $("#bottomSheet").dataset.cameraOperation === operationId &&
    !$("#bottomSheet").hidden;

  const clearMonitor = () => {
    if (activeCameraTimer) clearInterval(activeCameraTimer);
    activeCameraTimer = null;
  };

  const releasePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if ($("#bottomSheet").dataset.sensitivePreviewUrl === previewUrl)
      delete $("#bottomSheet").dataset.sensitivePreviewUrl;
    previewUrl = "";
  };

  const deliverPhoto = (file) => {
    if (!validateImageFile(file)) return;
    releasePreview();
    closeSheet({ discardHistory: true, force: true });
    if (typeof onPhoto === "function") onPhoto(file);
    else if (kind === "receipt") void showReceiptProcessing(file);
    else validateImage(file);
  };

  const setReviewMode = (reviewing) => {
    video.hidden = reviewing;
    review.hidden = !reviewing;
    captureButton.hidden = reviewing;
    useButton.hidden = !reviewing;
    retakeButton.hidden = !reviewing;
    switchButton.hidden = reviewing || cameras.length < 2;
    torchButton.hidden = reviewing || torchButton.dataset.supported !== "true";
  };

  const captureFrame = async () => {
    if (capturedFile || !video.videoWidth) return;
    clearMonitor();
    captureButton.disabled = true;
    status.textContent = "Photo captured · review before continuing";
    capturedFile = await autoCaptureImage(video);
    if (!capturedFile || !operationIsCurrent()) {
      capturedFile = null;
      captureButton.disabled = false;
      status.textContent = "The camera could not capture a photo. Try again.";
      return;
    }
    previewUrl = URL.createObjectURL(capturedFile);
    $("#bottomSheet").dataset.sensitivePreviewUrl = previewUrl;
    review.src = previewUrl;
    video.pause();
    setReviewMode(true);
  };

  const startAutomaticCapture = () => {
    if (!automatic) return;
    const motionCanvas = document.createElement("canvas");
    motionCanvas.width = 40;
    motionCanvas.height = 56;
    const motionContext = motionCanvas.getContext("2d", {
      alpha: false,
      willReadFrequently: true,
    });
    let previousFrame = null;
    let stableFrames = 0;
    clearMonitor();
    activeCameraTimer = setInterval(() => {
      if (
        capturedFile ||
        document.hidden ||
        video.readyState < 2 ||
        !operationIsCurrent()
      ) {
        stableFrames = 0;
        return;
      }
      const sourceRatio = video.videoWidth / video.videoHeight;
      const guideRatio = 40 / 56;
      const sourceWidth =
        sourceRatio > guideRatio
          ? video.videoHeight * guideRatio
          : video.videoWidth;
      const sourceHeight =
        sourceRatio > guideRatio
          ? video.videoHeight
          : video.videoWidth / guideRatio;
      motionContext.drawImage(
        video,
        (video.videoWidth - sourceWidth) / 2,
        (video.videoHeight - sourceHeight) / 2,
        sourceWidth,
        sourceHeight,
        0,
        0,
        40,
        56,
      );
      const pixels = motionContext.getImageData(0, 0, 40, 56).data;
      const sample = new Uint8Array(40 * 56);
      let lightTotal = 0;
      let lightSquaredTotal = 0;
      let differenceTotal = 0;
      let sharpnessTotal = 0;
      let sharpnessSamples = 0;
      let glarePixels = 0;
      for (let index = 0, pixel = 0; index < pixels.length; index += 4) {
        const light = Math.round(
          pixels[index] * 0.299 +
            pixels[index + 1] * 0.587 +
            pixels[index + 2] * 0.114,
        );
        sample[pixel] = light;
        lightTotal += light;
        lightSquaredTotal += light * light;
        if (light > 250) glarePixels += 1;
        if (pixel % 40 && pixel >= 40) {
          sharpnessTotal +=
            Math.abs(light - sample[pixel - 1]) +
            Math.abs(light - sample[pixel - 40]);
          sharpnessSamples += 2;
        }
        if (previousFrame)
          differenceTotal += Math.abs(light - previousFrame[pixel]);
        pixel += 1;
      }
      const brightness = lightTotal / sample.length;
      const contrast = lightSquaredTotal / sample.length - brightness ** 2;
      const sharpness = sharpnessSamples
        ? sharpnessTotal / sharpnessSamples
        : 0;
      const glareRatio = glarePixels / sample.length;
      const movement = previousFrame
        ? differenceTotal / sample.length
        : Number.POSITIVE_INFINITY;
      previousFrame = sample;
      if (brightness < 35 || brightness > 235) {
        stableFrames = 0;
        status.textContent =
          brightness < 35
            ? "More light needed"
            : "Reduce glare or direct light";
        return;
      }
      if (contrast < 120) {
        stableFrames = 0;
        status.textContent = "Move the card into the frame";
        return;
      }
      if (glareRatio > 0.14) {
        stableFrames = 0;
        status.textContent = "Tilt the card slightly to remove glare";
        return;
      }
      if (sharpness < 5.5) {
        stableFrames = 0;
        status.textContent = "Tap the card to focus, then hold steady";
        return;
      }
      stableFrames = movement < 7 ? stableFrames + 1 : 0;
      const remaining = Math.max(0, 4 - stableFrames);
      status.textContent = stableFrames
        ? `Hold steady · ${remaining}`
        : "Center the card and hold steady";
      if (stableFrames >= 4) void captureFrame();
    }, 450);
  };

  const startCamera = async (deviceId = "") => {
    clearMonitor();
    activeCameraStream?.getTracks().forEach((track) => track.stop());
    activeCameraStream = null;
    captureButton.disabled = true;
    retryButton.hidden = true;
    help.hidden = true;
    status.textContent = "Requesting camera permission…";
    try {
      activeCameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1440 },
            },
      });
      if (!operationIsCurrent()) {
        stopAutoCaptureCamera();
        return;
      }
      video.srcObject = activeCameraStream;
      await video.play();
      if (!operationIsCurrent()) {
        stopAutoCaptureCamera();
        return;
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      cameras = devices.filter((device) => device.kind === "videoinput");
      const track = activeCameraStream.getVideoTracks()[0];
      currentCameraId = track.getSettings?.().deviceId || deviceId;
      switchButton.hidden = cameras.length < 2;
      const capabilities = track.getCapabilities?.() || {};
      torchButton.dataset.supported = String(Boolean(capabilities.torch));
      torchButton.hidden = !capabilities.torch;
      torchEnabled = false;
      torchButton.setAttribute("aria-pressed", "false");
      torchButton.textContent = "Light";
      captureButton.disabled = false;
      status.textContent = automatic
        ? "Center the card and hold steady"
        : kind === "receipt"
          ? "Center the full receipt, then press the shutter"
          : "Center the card, then press the shutter";
      startAutomaticCapture();
    } catch (error) {
      activeCameraStream?.getTracks().forEach((track) => track.stop());
      activeCameraStream = null;
      if (!operationIsCurrent()) return;
      status.textContent = cameraErrorMessage(error);
      help.hidden = false;
      help.innerHTML =
        error?.name === "NotAllowedError"
          ? "Select the camera icon near the address bar, allow camera access for Mica, then choose <strong>Try camera again</strong>."
          : "The saved-photo option remains available and never grants ongoing camera access.";
      retryButton.hidden = false;
    }
  };

  captureButton.addEventListener("click", () => void captureFrame());
  useButton.addEventListener("click", () =>
    capturedFile ? deliverPhoto(capturedFile) : null,
  );
  retakeButton.addEventListener("click", async () => {
    releasePreview();
    capturedFile = null;
    setReviewMode(false);
    captureButton.disabled = false;
    await video.play();
    status.textContent = automatic
      ? "Center the card and hold steady"
      : "Ready for another photo";
    startAutomaticCapture();
  });
  retryButton.addEventListener(
    "click",
    () => void startCamera(currentCameraId),
  );
  switchButton.addEventListener("click", () => {
    if (cameras.length < 2) return;
    const currentIndex = Math.max(
      0,
      cameras.findIndex((camera) => camera.deviceId === currentCameraId),
    );
    const next = cameras[(currentIndex + 1) % cameras.length];
    void startCamera(next.deviceId);
  });
  torchButton.addEventListener("click", async () => {
    const track = activeCameraStream?.getVideoTracks?.()[0];
    if (!track) return;
    try {
      torchEnabled = !torchEnabled;
      await track.applyConstraints({ advanced: [{ torch: torchEnabled }] });
      torchButton.setAttribute("aria-pressed", String(torchEnabled));
      torchButton.textContent = torchEnabled ? "Light on" : "Light";
    } catch {
      torchEnabled = false;
      torchButton.hidden = true;
    }
  });
  $("#deviceCameraUpload").addEventListener("change", (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (file) deliverPhoto(file);
  });

  if (!navigator.mediaDevices?.getUserMedia) {
    status.textContent =
      "This browser does not support a live in-app camera. Choose a saved photo instead.";
    help.hidden = false;
    help.textContent =
      "Try the latest Safari, Chrome, or Edge on an HTTPS connection.";
    return;
  }
  await startCamera();
}

function openAutoCapture() {
  return openDeviceCamera({ kind: "card", automatic: true });
}

function openCardCamera() {
  return openDeviceCamera({ kind: "card" });
}

function openReceiptCamera() {
  return openDeviceCamera({ kind: "receipt" });
}

function openMethodSheet() {
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">How your collection value works</h2><p>Simple and transparent.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="info-copy"><p><strong>Estimated collection value</strong> is each card’s matching price multiplied by how many you own.</p><p><strong>Change in value</strong> is shown only when Mica knows both today’s matching price and what you paid. A missing purchase amount is never treated as $0.</p><p>Ungraded cards, professionally graded cards, and unopened products stay separate. Mica also matches the card version and wear level whenever the price source supports it.</p><p>Cards without a reliable matching price stay in your library but are left out of the total.</p></div>`,
  );
}

const visionLanguageCodes = {
  english: "en",
  japanese: "ja",
  french: "fr",
  german: "de",
  spanish: "es",
  italian: "it",
  portuguese: "pt",
  "traditional chinese": "zh-tw",
  indonesian: "id",
  thai: "th",
};

function visionLanguage(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return [
    "en",
    "ja",
    "fr",
    "de",
    "es",
    "it",
    "pt",
    "zh-tw",
    "id",
    "th",
  ].includes(normalized)
    ? normalized
    : visionLanguageCodes[normalized] ||
        $("#quickSearchLanguage")?.value ||
        "en";
}

function confidenceLabel(value) {
  const number = Number(value) || 0;
  if (number >= 0.85) return "Clear result";
  if (number >= 0.6) return "Check this result";
  return "Unclear result";
}

function conditionLabel(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_");
  return (
    {
      near_mint: "Like new",
      lightly_played: "Light wear",
      moderately_played: "Noticeable wear",
      heavily_played: "Heavy wear",
      damaged: "Damaged",
      unknown: "Needs in-person review",
    }[key] || "Needs in-person review"
  );
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("image_read_failed"));
    reader.readAsDataURL(blob);
  });
}

function canvasBlob(canvas, quality) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("image_encode_failed")),
      "image/jpeg",
      quality,
    ),
  );
}

async function decodeVisionImage(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {}
  }
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image_decode_failed"));
    };
    image.src = url;
  });
}

function sampledImageQuality(context, width, height) {
  const sample = document.createElement("canvas");
  sample.width = 96;
  sample.height = 96;
  const sampleContext = sample.getContext("2d", { willReadFrequently: true });
  sampleContext.drawImage(context.canvas, 0, 0, width, height, 0, 0, 96, 96);
  const pixels = sampleContext.getImageData(0, 0, 96, 96).data;
  const luminance = [];
  for (let index = 0; index < pixels.length; index += 4)
    luminance.push(
      pixels[index] * 0.2126 +
        pixels[index + 1] * 0.7152 +
        pixels[index + 2] * 0.0722,
    );
  const average =
    luminance.reduce((sum, value) => sum + value, 0) / luminance.length;
  const deviation = Math.sqrt(
    luminance.reduce((sum, value) => sum + (value - average) ** 2, 0) /
      luminance.length,
  );
  const warnings = [];
  const blockers = [];
  let edgeTotal = 0;
  let edgeSamples = 0;
  for (let y = 1; y < 96; y += 1) {
    for (let x = 1; x < 96; x += 1) {
      const index = y * 96 + x;
      edgeTotal +=
        Math.abs(luminance[index] - luminance[index - 1]) +
        Math.abs(luminance[index] - luminance[index - 96]);
      edgeSamples += 2;
    }
  }
  const sharpness = edgeSamples ? edgeTotal / edgeSamples : 0;
  if (average < 24)
    blockers.push(
      "The photo is too dark to read. Add indirect light and retake.",
    );
  if (average > 245)
    blockers.push(
      "The photo is too overexposed to read. Turn off flash and retake.",
    );
  if (sharpness < 3.2)
    blockers.push(
      "The photo is too soft to read reliably. Hold steady, tap to focus, and retake.",
    );
  if (average < 40)
    warnings.push(
      "The image looks dark; brighter indirect light will improve the estimate.",
    );
  if (average > 225)
    warnings.push(
      "The image looks overexposed; move away from direct light or flash.",
    );
  if (deviation < 22)
    warnings.push(
      "The image has low contrast; use a plain background and steadier focus.",
    );
  if (sharpness < 7 && sharpness >= 3.2)
    warnings.push(
      "Fine print may be soft; hold the card closer and tap to focus for a better match.",
    );
  return { warnings, blockers, metrics: { average, deviation, sharpness } };
}

function containedRect(sourceWidth, sourceHeight, x, y, width, height) {
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  return {
    x: x + (width - drawWidth) / 2,
    y: y + (height - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  };
}

function centeredCardBounds(width, height) {
  const ratio = 63 / 88;
  const maximumWidth = width * 0.92;
  const maximumHeight = height * 0.92;
  const cardHeight = Math.min(maximumHeight, maximumWidth / ratio);
  const cardWidth = cardHeight * ratio;
  return {
    x: (width - cardWidth) / 2,
    y: (height - cardHeight) / 2,
    width: cardWidth,
    height: cardHeight,
  };
}

async function identityEvidenceDataUrl(source) {
  const evidence = document.createElement("canvas");
  evidence.width = 1536;
  evidence.height = 1024;
  const context = evidence.getContext("2d", { alpha: false });
  context.fillStyle = "#0b1018";
  context.fillRect(0, 0, evidence.width, evidence.height);
  context.fillStyle = "#f6f8fc";
  context.font = "600 24px system-ui, sans-serif";
  context.fillText("FULL CARD", 34, 38);
  context.fillText("NAME + SET", 748, 38);
  context.fillText("COLLECTOR NUMBER", 748, 550);

  const full = containedRect(source.width, source.height, 28, 58, 670, 938);
  context.drawImage(source, full.x, full.y, full.width, full.height);

  const card = centeredCardBounds(source.width, source.height);
  context.drawImage(
    source,
    card.x,
    card.y,
    card.width,
    card.height * 0.25,
    734,
    58,
    774,
    410,
  );
  context.drawImage(
    source,
    card.x,
    card.y + card.height * 0.7,
    card.width,
    card.height * 0.3,
    734,
    570,
    774,
    410,
  );

  let quality = 0.88;
  let blob = await canvasBlob(evidence, quality);
  while (blob.size > 1_250_000 && quality > 0.64) {
    quality -= 0.06;
    blob = await canvasBlob(evidence, quality);
  }
  if (blob.size > 1_350_000) return null;
  return readBlobAsDataUrl(blob);
}

async function prepareVisionImage(file) {
  const decoded = await decodeVisionImage(file);
  const sourceWidth = decoded.width || decoded.naturalWidth;
  const sourceHeight = decoded.height || decoded.naturalHeight;
  if (
    !sourceWidth ||
    !sourceHeight ||
    Math.min(sourceWidth, sourceHeight) < 600
  ) {
    decoded.close?.();
    throw new Error("image_resolution_low");
  }
  const scale = Math.min(1, 2048 / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(decoded, 0, 0, width, height);
  decoded.close?.();
  const qualityCheck = sampledImageQuality(context, width, height);
  const identityDataUrl = await identityEvidenceDataUrl(canvas);
  let quality = 0.9;
  let blob = await canvasBlob(canvas, quality);
  while (blob.size > 1_250_000 && quality > 0.66) {
    quality -= 0.06;
    blob = await canvasBlob(canvas, quality);
  }
  if (blob.size > 1_350_000) throw new Error("image_encode_large");
  return {
    dataUrl: await readBlobAsDataUrl(blob),
    width,
    height,
    bytes: blob.size,
    warnings: qualityCheck.warnings,
    blockers: qualityCheck.blockers,
    qualityMetrics: qualityCheck.metrics,
    identityDataUrl,
  };
}

async function requestVisionAnalysis(mode, preparedImages, candidates = []) {
  if (!state.session?.access_token)
    throw new Error("Sign in again before using AI analysis.");
  const response = await fetch("/api/vision", {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${state.session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode,
      images: preparedImages.map((image) => image.dataUrl),
      ...(mode === "match" ? { candidates } : {}),
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.error || "AI analysis is temporarily unavailable.");
  return payload;
}

function openVisionSearchFallback(query = "", language = "en") {
  closeSheet({ discardHistory: true, force: true });
  routeTo("scan");
  const input = $("#quickCardSearch");
  $("#quickSearchLanguage").value = visionLanguage(language);
  input.value = query;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.focus();
}

function visionPrefill(analysis, mode) {
  const identity = analysis.identity || {};
  const graded = mode !== "grade" && identity.cardState === "graded";
  const grader = normalizeGrader(identity.grader).normalized;
  const suggestedCondition = analysis.condition?.rawCondition;
  const conditionReliable =
    analysis.quality?.usable && Number(analysis.condition?.confidence) >= 0.6;
  return {
    cardState: graded ? "graded" : "raw",
    rawCondition:
      conditionReliable &&
      suggestedCondition &&
      suggestedCondition !== "unknown"
        ? suggestedCondition
        : "",
    grader:
      graded && ["PSA", "BGS", "CGC", "TAG", "SGC"].includes(grader)
        ? grader
        : "",
    grade: graded && identity.grade != null ? String(identity.grade) : "",
    certificationNumber: graded ? identity.certificationNumber || "" : "",
    aiEstimate:
      mode === "grade" && analysis.condition?.estimatedGradeLow != null
        ? `${analysis.condition.estimatedGradeLow}–${analysis.condition.estimatedGradeHigh}`
        : "",
  };
}

function renderVisionResult(payload, mode, preparedImages) {
  const analysis = payload.analysis;
  const identity = analysis.identity || {};
  const condition = analysis.condition || {};
  const issues = analysis.quality?.issues || [];
  const gradeRange =
    condition.estimatedGradeLow == null
      ? "Not reliable from these photos"
      : `${condition.estimatedGradeLow}–${condition.estimatedGradeHigh}`;
  const qualityMarkup = issues.length
    ? `<div class="vision-quality ${analysis.quality.usable ? "warning" : "blocking"}"><strong>${analysis.quality.usable ? "Photo limitations" : "Retake recommended"}</strong>${issues.map((issue) => `<span>${esc(issue.message)}</span>`).join("")}</div>`
    : '<div class="vision-quality ready"><strong>Photos are clear enough</strong><span>Compare the result with the card in your hand before saving.</span></div>';
  const conditionMarkup =
    mode === "grade"
      ? `<section class="vision-grade" aria-labelledby="visionGradeTitle"><div><span>Grade it may receive</span><strong id="visionGradeTitle">${esc(gradeRange)}</strong><small>${esc(confidenceLabel(condition.confidence))} · estimate only</small></div><div><span>Visible wear</span><strong>${esc(conditionLabel(condition.rawCondition))}</strong><small>Check the card in person before saving</small></div></section><div class="vision-subscore-grid advanced-workspace">${(condition.subscores || []).map((item) => `<div><span>${esc(item.category)}</span><strong>${item.scoreLow == null ? "Check" : `${esc(item.scoreLow)}–${esc(item.scoreHigh)}`}</strong><small>${esc(item.summary)}</small></div>`).join("")}</div>${condition.defects?.length ? `<div class="vision-defects"><strong>Things to check closely</strong>${condition.defects.map((defect) => `<span><b>${esc(defect.side)} · ${esc(defect.area)}</b>${esc(defect.evidence)}</span>`).join("")}</div>` : ""}<p class="vision-disclaimer">A photo can hide dents, scratches, print lines, and other damage. Use this as a helpful estimate—not a promise of the grade a company will give.</p>`
      : `<div class="vision-identity-summary"><div><span>Card found in the photo</span><strong>${esc(identity.name || "Card name unclear")}</strong><small>${esc([identity.setName, identity.collectorNumber, identity.language].filter(Boolean).join(" · ") || "Printed details need review")}</small></div><div><span>Card type</span><strong>${identity.cardState === "graded" ? `${esc(identity.grader || "Grading company unclear")} grade ${esc(identity.grade ?? "")}` : "Ungraded card"}</strong><small>${esc(confidenceLabel(identity.confidence))}</small></div></div>`;

  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Scan complete</h2><p>Your photos were not saved</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="vision-result-head"><img src="${preparedImages[0].previewDataUrl || preparedImages[0].dataUrl}" alt="Analyzed card front"><div><span>Words and number found</span><strong>${esc(analysis.searchQuery || "Printed details are unclear")}</strong><small>Choose the card that matches your photo. Nothing is added until you confirm.</small></div></div>${qualityMarkup}${conditionMarkup}<div class="manual-results" id="visionCatalogResults" aria-live="polite"><div class="searching-cards"><i></i><span>Finding matching cards…</span></div></div><div class="sheet-actions"><button class="secondary" id="visionRetake" type="button">Take another photo</button><button class="secondary" id="visionManualSearch" type="button">Search myself</button></div>`,
  );
  $("#bottomSheet").dataset.lockClose = "false";
  $("#visionRetake").addEventListener("click", () =>
    closeSheet({ force: true }),
  );
  $("#visionManualSearch").addEventListener("click", () =>
    openVisionSearchFallback(analysis.searchQuery, identity.language),
  );
  const renderCandidates = async () => {
    let cards = (payload.catalogResolution?.cards || []).map(catalogItem);
    const resolution = payload.catalogResolution?.resolution || null;
    if (cards.length) rememberCatalogItems(cards);
    if (!cards.length) {
      try {
        if (analysis.searchQuery?.length >= 2) {
          const result = await searchCatalog(
            analysis.searchQuery,
            visionLanguage(identity.language),
            12,
          );
          cards = result.items;
        }
      } catch {}
    }
    const node = $("#visionCatalogResults");
    if (!node) return;
    const recommendedId = resolution?.recommendedId || null;
    const guidance =
      resolution?.status === "exact"
        ? "<strong>One card looks like the best match</strong><span>The name and bottom number point to this result. Make sure the picture looks the same.</span>"
        : resolution?.ambiguity?.includes("collector_number_not_unique")
          ? "<strong>More than one card uses this number</strong><span>Compare the card name and picture to choose the right one.</span>"
          : "<strong>Choose the card that matches</strong><span>Compare the picture, name, bottom number, language, and shiny finish.</span>";
    const comparableCandidates = cards
      .filter((card) => card.image || card.thumb)
      .slice(0, 4);
    const comparisonAction =
      resolution?.status !== "exact" && comparableCandidates.length >= 2
        ? '<div class="vision-compare-action"><span id="visionCompareStatus">Still unsure? Mica can compare your photo with the closest results.</span><button id="visionCompareCandidates" type="button">Compare with AI</button><small>Optional · uses one more AI scan · you still choose the final card</small></div>'
        : "";
    node.innerHTML = cards.length
      ? `<div class="vision-match-instruction">${guidance}${comparisonAction}</div>${cards.map((card) => `<button class="catalog-result${card.id === recommendedId ? " recommended" : ""}" type="button" data-vision-card="${esc(card.id)}"><img src="${esc(card.thumb || card.image || "./icons/icon.svg")}" alt=""><span><strong>${esc(card.name)}</strong>${esc(card.set)} · ${esc(card.number)}<small>${esc(languageName(card.language))} · ${esc(card.variant || "Version unknown")}</small>${matchReason(card)}</span><b>${card.id === recommendedId ? "Best match" : "Choose this"}</b></button>`).join("")}`
      : '<div class="unavailable-panel">No reliable catalog match was found. Retake the card closer or search the printed details manually.</div>';
    $("#visionCompareCandidates")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const status = $("#visionCompareStatus");
      button.disabled = true;
      button.textContent = "Comparing visible details…";
      if (status)
        status.textContent =
          "Checking artwork and printed evidence without changing your library.";
      try {
        const comparison = await requestVisionAnalysis(
          "match",
          [preparedImages[0]],
          comparableCandidates.map((card) => ({
            id: card.id,
            name: card.name,
            set: card.set,
            number: card.number,
            rarity: card.rarity,
            variant: card.variant,
            image: card.image || card.thumb,
          })),
        );
        const visual = comparison.analysis || {};
        const reliable =
          visual.selectedCandidateId && Number(visual.confidence) >= 0.72;
        if (reliable) {
          $$("[data-vision-card]", node).forEach((candidateButton) => {
            const selected =
              candidateButton.dataset.visionCard === visual.selectedCandidateId;
            candidateButton.classList.toggle("recommended", selected);
            const label = candidateButton.querySelector("b");
            if (label)
              label.textContent = selected ? "Best photo match" : "Choose this";
          });
          if (status)
            status.textContent = `One card looks closest (${confidenceLabel(visual.confidence)}). ${visual.reason} Check it yourself before continuing.`;
        } else if (status) {
          status.textContent = `${visual.reason || "The photo does not reliably separate these candidates."} Compare them manually or retake the card closer.`;
        }
        button.remove();
      } catch (error) {
        if (status)
          status.textContent =
            error.message || "Visual comparison is temporarily unavailable.";
        button.disabled = false;
        button.textContent = "Try visual comparison again";
      }
    });
    $$("[data-vision-card]", node).forEach((button) =>
      button.addEventListener("click", () => {
        const card = catalog.find(
          (item) => item.id === button.dataset.visionCard,
        );
        if (!card) return;
        const prefill = visionPrefill(analysis, mode);
        closeSheet({ discardHistory: true, force: true });
        if (state.visionDestination === "trade") {
          state.visionDestination = null;
          addTradeCard(card, state.trade.addingTo);
          routeTo("trade");
          return;
        }
        openPositionSheet(card, {
          prefill,
          visionAnalysis: {
            mode,
            gradeRange: prefill.aiEstimate,
            condition: condition.rawCondition,
            confidence: condition.confidence,
          },
        });
      }),
    );
  };
  void renderCandidates();
}

async function analyzeCardImages(mode, preparedImages) {
  $("#bottomSheet").dataset.lockClose = "true";
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Checking your card</h2><p>Reading the name, bottom number, and visible wear</p></div></div><div class="vision-processing" role="status" aria-live="polite"><i></i><strong>${mode === "grade" ? "Comparing the front and back…" : "Reading the card or graded case…"}</strong><span>The photos are sent once for this scan and are not saved in your collection.</span></div>`,
  );
  try {
    const payload = await requestVisionAnalysis(mode, preparedImages);
    renderVisionResult(payload, mode, preparedImages);
  } catch (error) {
    $("#bottomSheet").dataset.lockClose = "false";
    openSheet(
      `<div class="sheet-heading"><div><h2 id="sheetTitle">AI scan did not finish</h2><p>Your photo was not saved</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="unavailable-panel">${esc(error.message || "The analysis service is temporarily unavailable.")}</div><div class="sheet-actions"><button class="secondary" id="visionErrorClose" type="button">Choose another</button><button class="primary" id="visionErrorSearch" type="button">Search manually</button></div>`,
    );
    $("#visionErrorClose").addEventListener("click", () =>
      closeSheet({ force: true }),
    );
    $("#visionErrorSearch").addEventListener("click", () =>
      openVisionSearchFallback(),
    );
  }
}

async function showProcessing(file, initialBackFile = null) {
  const operationId = crypto.randomUUID();
  const previewUrl = URL.createObjectURL(file);
  $("#capturePreview").innerHTML =
    `<img src="${previewUrl}" alt="Selected card photograph">`;
  $("#qualityChip").innerHTML = "<span></span> Preparing photo";
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">What would you like to do?</h2><p>Find the card, or take a back photo to estimate its grade.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="photo-assist vision-photo"><img id="photoAssistImage" src="${previewUrl}" alt="Selected card front"><p><strong>Nothing is saved automatically.</strong> Mica makes a smaller copy on this device, sends it once for analysis, and asks you to confirm the result.</p></div><div class="vision-local-check" id="visionLocalCheck" aria-live="polite">Checking photo quality…</div><div class="vision-choice-grid"><button id="visionIdentify" type="button" disabled><strong>Find this card</strong><span>Read the name and bottom number, then show matching cards.</span></button><button id="visionBackCamera" type="button"><strong>Estimate its grade</strong><span>Open the camera and take a photo of the card’s back.</span></button></div><div class="vision-back-preview" id="visionBackPreview" hidden></div><div class="sheet-actions"><button class="secondary" id="photoAssistSearch" type="button">Search myself</button><button class="primary" id="visionGrade" type="button" disabled>Check front and back</button></div>`,
  );
  $("#bottomSheet").dataset.sensitive = "true";
  $("#bottomSheet").dataset.visionOperation = operationId;
  $("#bottomSheet").dataset.sensitivePreviewUrl = previewUrl;
  const releasePreview = () => {
    URL.revokeObjectURL(previewUrl);
    if ($("#bottomSheet").dataset.sensitivePreviewUrl === previewUrl)
      delete $("#bottomSheet").dataset.sensitivePreviewUrl;
  };
  $("#photoAssistImage").addEventListener("load", releasePreview, {
    once: true,
  });
  let front;
  let back;
  let frontReady = false;
  let backReady = false;
  try {
    front = await prepareVisionImage(file);
    if (
      !$("#visionIdentify") ||
      $("#bottomSheet").dataset.visionOperation !== operationId
    )
      return;
    $("#capturePreview").innerHTML =
      `<img src="${front.dataUrl}" alt="Selected card photograph">`;
    frontReady = !front.blockers.length;
    $("#qualityChip").innerHTML = frontReady
      ? "<span></span> Ready for AI review"
      : "<span></span> Retake needed";
    $("#visionLocalCheck").innerHTML = front.blockers.length
      ? `<strong>Retake before AI review</strong>${front.blockers.map((blocker) => `<span>${esc(blocker)}</span>`).join("")}<span>This check prevents spending an AI scan on unreadable evidence.</span>`
      : front.warnings.length
        ? `<strong>Improve accuracy if possible</strong>${front.warnings.map((warning) => `<span>${esc(warning)}</span>`).join("")}`
        : `<strong>Local quality check passed</strong><span>${front.width} × ${front.height} prepared · original is not uploaded</span>`;
    $("#visionIdentify").disabled = !frontReady;
  } catch (error) {
    if (!$("#visionLocalCheck")) return;
    $("#visionLocalCheck").innerHTML =
      `<strong>Could not prepare this image</strong><span>${error.message === "image_resolution_low" ? "Move closer and use a higher-resolution photo." : "This device could not decode the file. Try JPEG, PNG, or WebP."}</span>`;
  }
  $("#visionIdentify")?.addEventListener(
    "click",
    () =>
      frontReady &&
      front &&
      void analyzeCardImages("identify", [
        {
          ...front,
          previewDataUrl: front.dataUrl,
          dataUrl: front.identityDataUrl || front.dataUrl,
        },
      ]),
  );
  $("#photoAssistSearch")?.addEventListener("click", () =>
    openVisionSearchFallback(),
  );
  const prepareBackPhoto = async (selected) => {
    if (!selected) return;
    $("#visionBackPreview").hidden = false;
    $("#visionBackPreview").innerHTML =
      '<div class="searching-cards"><i></i><span>Preparing the back photo…</span></div>';
    try {
      back = await prepareVisionImage(selected);
      if (
        !$("#visionBackPreview") ||
        $("#bottomSheet").dataset.visionOperation !== operationId
      )
        return;
      $("#visionBackPreview").innerHTML =
        `<img src="${back.dataUrl}" alt="Selected card back"><div><strong>${back.blockers.length ? "Retake the back photo" : "Back photo ready"}</strong><span>${back.blockers.length ? esc(back.blockers.join(" ")) : back.warnings.length ? esc(back.warnings.join(" ")) : "Local quality check passed."}</span></div>`;
      backReady = !back.blockers.length;
      $("#visionGrade").disabled = !(frontReady && backReady);
    } catch {
      if ($("#visionBackPreview"))
        $("#visionBackPreview").innerHTML =
          '<div class="unavailable-panel">The back photo could not be prepared. Retake it as JPEG, PNG, or WebP.</div>';
    }
  };
  $("#visionBackCamera")?.addEventListener("click", () => {
    void openDeviceCamera({
      kind: "back",
      onPhoto: (selected) => void showProcessing(file, selected),
    });
  });
  if (initialBackFile) {
    await prepareBackPhoto(initialBackFile);
    if (
      frontReady &&
      backReady &&
      front &&
      back &&
      $("#bottomSheet").dataset.visionOperation === operationId
    ) {
      await analyzeCardImages("grade", [front, back]);
      return;
    }
  }
  $("#visionGrade")?.addEventListener("click", () =>
    frontReady && backReady && front && back
      ? void analyzeCardImages("grade", [front, back])
      : null,
  );
}

function receiptLinePrefill(receipt, line) {
  const singleLine = receipt.lineItems.length === 1;
  const exactLineTotals = Number(receipt.unallocatedAmount) === 0;
  const compatibleCurrency = receipt.currency === "USD";
  const safeDate =
    /^\d{4}-\d{2}-\d{2}$/.test(String(receipt.purchaseDate || "")) &&
    receipt.purchaseDate <= localIsoDate()
      ? receipt.purchaseDate
      : localIsoDate();
  return {
    quantity: line.quantity || 1,
    transactionDate: safeDate,
    totalAcquisitionCost:
      compatibleCurrency && singleLine && receipt.totalAmount != null
        ? receipt.totalAmount.toFixed(2)
        : compatibleCurrency && exactLineTotals && line.lineTotal != null
          ? line.lineTotal.toFixed(2)
          : "",
  };
}

function receiptMoney(value, currency) {
  if (value == null) return "Not readable";
  if (currency) return money(value, currency);
  return `${Number(value).toFixed(2)} · currency unclear`;
}

function renderReceiptAnalysis(payload, matched = new Map()) {
  const receipt = payload.analysis;
  const currency = receipt.currency;
  const uncertainTotal =
    receipt.unallocatedAmount != null && receipt.unallocatedAmount > 0.009;
  const incompatibleCurrency = currency !== "USD";
  const needsCostReview = uncertainTotal || incompatibleCurrency;
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Check this purchase</h2><p>${esc(receipt.vendor || "Store unclear")} · ${esc(receipt.purchaseDate || "Date unclear")} · image not saved</p></div><button class="sheet-close" aria-label="Close">×</button></div><section class="receipt-summary"><div><span>Total on the receipt</span><strong>${receiptMoney(receipt.totalAmount, currency)}</strong></div><div><span>Card lines found</span><strong>${receipt.lineItems.length}</strong></div><div><span>Amount not tied to a card</span><strong>${receipt.unallocatedAmount == null ? "Unknown" : receiptMoney(receipt.unallocatedAmount, currency)}</strong></div></section>${incompatibleCurrency ? `<div class="vision-quality warning"><strong>${currency ? `${esc(currency)} purchase needs review` : "Purchase currency is unclear"}</strong><span>Mica saves what you paid in US dollars and will not guess the exchange rate. Enter the final US-dollar amount yourself before saving.</span></div>` : ""}${uncertainTotal ? `<div class="vision-quality warning"><strong>Check the total paid for each card</strong><span>${receiptMoney(receipt.unallocatedAmount, currency)} from tax, shipping, fees, discounts, or another part of the order has not been tied to a card. Mica will not guess how to divide it.</span></div>` : ""}<div class="receipt-lines">${receipt.lineItems.length ? receipt.lineItems.map((line, index) => `<article><div><strong>${esc(line.description)}</strong><span>${line.quantity} item${line.quantity === 1 ? "" : "s"} · ${line.lineTotal == null ? "price unclear" : receiptMoney(line.lineTotal, currency)} · ${esc(confidenceLabel(line.confidence))}</span></div><button type="button" data-receipt-line="${index}" ${matched.has(index) ? "disabled" : ""}>${matched.has(index) ? "Matched ✓" : "Find this card"}</button></article>`).join("") : '<div class="unavailable-panel">No Pokémon card lines were readable. Take a closer photo or use a clear order screenshot.</div>'}</div><p class="vision-disclaimer">A receipt can show what you bought and paid, but it cannot show the card’s wear or exact version. Confirm the matching card and total paid before saving.</p><div class="sheet-actions"><button class="secondary" id="receiptRetake" type="button">Choose another</button><button class="primary" id="receiptReviewQueue" type="button" ${matched.size ? "" : "disabled"}>Review ${matched.size} card${matched.size === 1 ? "" : "s"}</button></div>`,
  );
  $("#bottomSheet").dataset.lockClose = "false";
  $("#receiptRetake").addEventListener("click", () =>
    closeSheet({ force: true }),
  );
  $("#receiptReviewQueue").addEventListener("click", () => {
    closeSheet({ discardHistory: true, force: true });
    openIntakeQueueSheet();
  });
  $$("[data-receipt-line]", $("#sheetContent")).forEach((button) =>
    button.addEventListener("click", async () => {
      const index = Number(button.dataset.receiptLine);
      const line = receipt.lineItems[index];
      openSheet(
        `<div class="sheet-heading"><div><h2 id="sheetTitle">Find the card on this line</h2><p>${esc(line.description)}</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="manual-results" id="receiptMatchResults"><div class="searching-cards"><i></i><span>Finding matching cards…</span></div></div><div class="sheet-actions"><button class="secondary" id="receiptMatchBack" type="button">Back to receipt</button><button class="secondary" id="receiptMatchSearch" type="button">Search myself</button></div>`,
      );
      $("#receiptMatchBack").addEventListener("click", () =>
        renderReceiptAnalysis(payload, matched),
      );
      $("#receiptMatchSearch").addEventListener("click", () =>
        openVisionSearchFallback(line.searchQuery, "en"),
      );
      let cards = [];
      try {
        cards = (await searchCatalog(line.searchQuery, "en", 12)).items;
      } catch {}
      if (!$("#receiptMatchResults")) return;
      $("#receiptMatchResults").innerHTML = cards.length
        ? cards
            .map(
              (card) =>
                `<button class="catalog-result" type="button" data-receipt-card="${esc(card.id)}"><img src="${esc(card.thumb || card.image || "./icons/icon.svg")}" alt=""><span><strong>${esc(card.name)}</strong>${esc(card.set)} · ${esc(card.number)}<small>${esc(card.variant || "Version unknown")}</small>${matchReason(card)}</span><b>Choose this</b></button>`,
            )
            .join("")
        : '<div class="unavailable-panel">No matching card was found. Search the printed name and bottom number yourself.</div>';
      $$("[data-receipt-card]", $("#receiptMatchResults")).forEach(
        (cardButton) =>
          cardButton.addEventListener("click", () => {
            const card = catalog.find(
              (item) => item.id === cardButton.dataset.receiptCard,
            );
            if (!card) return;
            queueIntakeCard(card, receiptLinePrefill(receipt, line), {
              vendor: receipt.vendor,
              orderNumber: receipt.orderNumber,
              currency: receipt.currency,
              needsCostReview,
              needsDateReview:
                !receipt.purchaseDate || receipt.purchaseDate > localIsoDate(),
            });
            matched.set(index, card.id);
            renderReceiptAnalysis(payload, matched);
          }),
      );
    }),
  );
}

async function showReceiptProcessing(file) {
  const operationId = crypto.randomUUID();
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Preparing receipt</h2><p>Nothing will be saved automatically</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="vision-processing" role="status"><i></i><strong>Checking the image on this device…</strong><span>Orders and receipts are sent once for extraction and are not written to Mica storage.</span></div>`,
  );
  $("#bottomSheet").dataset.sensitive = "true";
  $("#bottomSheet").dataset.visionOperation = operationId;
  try {
    const prepared = await prepareVisionImage(file);
    if (
      $("#bottomSheet").hidden ||
      $("#bottomSheet").dataset.visionOperation !== operationId
    )
      return;
    if (prepared.blockers.length) {
      openSheet(
        `<div class="sheet-heading"><div><h2 id="sheetTitle">Retake this receipt</h2><p>No AI credit was used</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="vision-quality blocking"><strong>The document is not readable enough yet</strong>${prepared.blockers.map((blocker) => `<span>${esc(blocker)}</span>`).join("")}</div><div class="sheet-actions"><button class="primary" id="receiptQualityClose" type="button">Choose another photo</button></div>`,
      );
      $("#receiptQualityClose").addEventListener("click", () =>
        closeSheet({ force: true }),
      );
      return;
    }
    $("#bottomSheet").dataset.lockClose = "true";
    openSheet(
      `<div class="sheet-heading"><div><h2 id="sheetTitle">Reading the receipt</h2><p>Finding the purchase date, total, and card names</p></div></div><div class="vision-processing" role="status"><i></i><strong>Preparing the cards for your review…</strong><span>Mica will not guess unclear costs or add cards without your confirmation.</span></div>`,
    );
    const payload = await requestVisionAnalysis("receipt", [prepared]);
    renderReceiptAnalysis(payload);
  } catch (error) {
    $("#bottomSheet").dataset.lockClose = "false";
    openSheet(
      `<div class="sheet-heading"><div><h2 id="sheetTitle">Receipt scan did not finish</h2><p>The image was not saved</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="unavailable-panel">${esc(error.message || "Try a clearer JPEG, PNG, or WebP image.")}</div><div class="sheet-actions"><button class="primary" id="receiptErrorClose" type="button">Choose another</button></div>`,
    );
    $("#receiptErrorClose").addEventListener("click", () =>
      closeSheet({ force: true }),
    );
  }
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
  return `<small class="match-reason"><strong>Why this may be the right card</strong> · ${esc(item.match.reasons.slice(0, 3).join(" · "))}</small>`;
}

function ownedSearchStatus(item) {
  const owned = ownedCardSummary(item, state.items);
  if (!owned.quantity) return "";
  return `<small class="owned-search-status"><strong>In your library</strong> · ${owned.quantity} card${owned.quantity === 1 ? "" : "s"}${owned.positions > 1 ? ` with ${owned.positions} different wear levels or grades` : ""}</small>`;
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
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Find a card</h2><p>Type the card name and the number printed at the bottom, such as 4/102.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="form-grid"><label class="search-field"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg><input id="catalogQuery" type="search" placeholder="Charizard 4/102" aria-label="Search by card name and bottom number"></label><div class="field"><label for="catalogLanguage">Language on the card</label><select id="catalogLanguage"><option value="en">English</option><option value="ja">Japanese</option><option value="fr">French</option><option value="de">German</option><option value="es">Spanish</option><option value="it">Italian</option><option value="pt">Portuguese</option><option value="zh-tw">Traditional Chinese</option><option value="id">Indonesian</option><option value="th">Thai</option></select></div></div><div class="manual-results" id="manualResults" aria-live="polite"><div class="unavailable-panel">Type at least two characters to search.</div></div>`,
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
      '<div class="unavailable-panel">Finding matching cards…</div>';
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
      `<div class="sheet-heading"><div><h2 id="sheetTitle">Privacy & account deletion</h2><p>Your collection belongs to you.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="info-copy"><p>Your cards, purchases, sales, watched cards, labels, and account details are private to your signed-in account.</p><p>Download a backup first if you want to keep a copy. Deleting your account permanently removes the account and its collection data.</p></div><div class="sheet-actions"><button class="secondary" id="privacyBackup" type="button">Download backup</button><button class="danger-action" id="startAccountDeletion" type="button">Delete account…</button></div>`,
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
      "Mica checks connected card-price services without showing them your private collection. Each price stays attached to the exact card version, wear level or professional grade, currency, date, and source. A price for a different card is never used as a substitute.",
    retention:
      "Mica makes a smaller copy of your photo on your device and sends it once for analysis. The photo and AI result are not saved with your collection, and no card is added until you confirm it.",
    privacy:
      "Your collection is private to your signed-in account. You can download your data or permanently delete the account from Settings.",
  }[kind];
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">${kind === "sources" ? "Data sources" : kind === "retention" ? "Scan retention" : "Privacy & deletion"}</h2></div><button class="sheet-close" aria-label="Close">×</button></div><p class="info-copy">${esc(content)}</p>`,
  );
}

async function refreshCapabilityStatus() {
  const setStatus = (id, copy, stateName) => {
    const node = $(`#${id}`);
    if (!node) return;
    node.textContent = copy;
    node.dataset.connectionState = stateName;
  };
  try {
    const response = await fetch("/api/capabilities", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const capabilities = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error("Connection check unavailable");
    setStatus("catalogConnectionState", "Active", "active");
    setStatus(
      "pricingConnectionState",
      capabilities.pricing?.status === "connected"
        ? `${String(capabilities.pricing.plan || "free").toUpperCase()} plan connected`
        : "Basic public prices only",
      capabilities.pricing?.status === "connected" ? "active" : "limited",
    );
    setStatus(
      "visionConnectionState",
      capabilities.vision?.status === "connected"
        ? "AI scans ready"
        : capabilities.vision?.status === "vercel_managed"
          ? "Checked when you scan"
          : "AI connection needed",
      capabilities.vision?.status === "connected" ? "active" : "limited",
    );
    setStatus("pushConnectionState", "Ready after app-store setup", "limited");
    $("#connectionStatusNote").textContent =
      "A tool that still needs a connection will explain what is missing when you open it.";
  } catch {
    [
      "catalogConnectionState",
      "pricingConnectionState",
      "visionConnectionState",
      "pushConnectionState",
    ].forEach((id) => setStatus(id, "Check unavailable", "limited"));
    $("#connectionStatusNote").textContent =
      "Mica could not inspect this deployment. Existing collection data is unchanged.";
  }
}

function openAutomationInfo(kind) {
  const features = {
    capture: {
      title: "Automatic photo capture",
      state: "Ready now",
      summary:
        "No paid service is required. The live camera uses the device browser, waits for a steady card, and sends the captured photo into Mica's existing review flow.",
      connection:
        "The user only needs to allow camera access. HTTPS is required, which the Vercel deployment already provides.",
    },
    identify: {
      title: "AI card identification",
      state: "Code complete · connection required",
      summary:
        "Mica already accepts a photo, extracts visible identity details, searches the catalog, and requires the user to confirm the exact printing before anything is saved.",
      connection:
        "Finish Vercel AI Gateway billing verification. Vercel OIDC supplies server authentication in production; local development can use the server-only AI_GATEWAY_API_KEY. No key is exposed to the browser.",
    },
    grading: {
      title: "Raw grade estimate",
      state: "Code complete · connection required",
      summary:
        "Mica already accepts front and back photos and returns a conservative grade range, confidence, visible evidence, and photo-quality warnings. It remains an estimate, not an official grade.",
      connection:
        "Use the same Vercel AI Gateway connection as card identification. One connection activates both features; a separate ChatGPT console or separate Claude account is not needed.",
    },
    pricing: {
      title: "Automatic market data",
      state: "Provider adapter complete · upgrade required",
      summary:
        "The pricing adapter already keeps raw, graded, sealed, grader, grade, printing, condition, currency, timestamp, and provider evidence separate. Unsupported data stays unavailable instead of being guessed.",
      connection:
        "Upgrade PkmnPrices, keep PKMNPRICES_API_KEY server-only, and set PKMNPRICES_PLAN=pro in Vercel. The prepared graded ladder, 365-day history, offers, sealed, Japanese, and eBay sold-evidence paths activate without a product rebuild.",
    },
  };
  const feature = features[kind];
  if (!feature) return;
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">${esc(feature.title)}</h2><p>${esc(feature.state)}</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="connection-explainer"><div><span>What is already built</span><p>${esc(feature.summary)}</p></div><div><span>What activates it</span><p>${esc(feature.connection)}</p></div></div><p class="legal-copy">Developer-mode status is intentionally explicit. Mica will not label a connector as live until a real request succeeds.</p>`,
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

function targetAlertStorageKey() {
  return `mica-target-alert-hits-${state.session?.user?.id || "guest"}`;
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
      localStorage.getItem(targetAlertStorageKey()) || "{}",
    );
  } catch {}
  const { notifications, next } = targetAlertChanges(state.watchlist, previous);
  try {
    localStorage.setItem(targetAlertStorageKey(), JSON.stringify(next));
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
      localStorage.removeItem(targetAlertStorageKey());
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
    localStorage.removeItem(targetAlertStorageKey());
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
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Install Mica</h2><p>Keep your collection one tap away.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="info-copy">${steps}<p>Once installed, Mica can open without an internet connection. Current prices and saved changes still need internet access.</p></div><div class="sheet-actions"><button class="primary" id="installStepsDone" type="button">Got it</button></div>`,
  );
  $("#installStepsDone").addEventListener("click", closeSheet);
}

function openAccountDeletionSheet() {
  const email = state.session?.user?.email || "";
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Permanently delete account?</h2><p>This cannot be undone.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="warning-panel"><strong>Your account and saved collection will be permanently removed.</strong><p>Type your account email to confirm. You can cancel without changing anything.</p></div><form id="deleteAccountForm"><div class="field"><label for="deleteAccountEmail">Type ${esc(email)}</label><input id="deleteAccountEmail" type="email" autocomplete="off" autocapitalize="none" spellcheck="false" required></div><p class="form-error" id="deleteAccountError" role="alert"></p><div class="sheet-actions"><button class="secondary" id="cancelAccountDeletion" type="button">Keep my account</button><button class="danger-action" id="confirmAccountDeletion" type="submit" disabled>Delete permanently</button></div></form>`,
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
      "Deleting your account and saved collection…";
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
        ? `${item.gradingCompany} grade ${item.grade}`
        : conditionLabel(item.condition || "Near Mint");
      const basis =
        item.costBasis === null || item.costBasis === undefined
          ? null
          : Number(item.costBasis);
      const value =
        item.price === null || item.price === undefined
          ? null
          : Number(item.price) * Number(item.quantity || 0);
      return `<article class="insurance-row"><img src="${esc(item.thumb || item.image || "./icons/icon.svg")}" alt="${esc(item.name)} reference image"><div class="insurance-card-main"><strong>${esc(item.name)}</strong><span>${esc(item.set)} · ${esc(item.number)} · ${esc(item.variant || "Version unknown")}</span><small>${esc(context)} · ${Number(item.quantity) || 0} owned</small>${item.certificationNumber ? `<small>Certification number ${esc(item.certificationNumber)}</small>` : ""}${item.location ? `<small>Stored at ${esc(item.location)}</small>` : ""}${item.notes ? `<p>${esc(item.notes)}</p>` : ""}</div><div class="insurance-values"><span>What you paid<strong>${basis === null ? "Not recorded" : money(basis, item.currency)}</strong></span><span>Estimated value today<strong>${value === null ? "Unavailable" : money(value, item.currency)}</strong></span></div></article>`;
    })
    .join("");
  openSheet(
    `<div class="insurance-report"><div class="sheet-heading"><div><h2 id="sheetTitle">Insurance collection report</h2><p>Private account record · ${date}</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="insurance-owner"><span>Prepared for</span><strong>${esc(state.session?.user?.email || "Mica account holder")}</strong><small>${documentation.cards} card${documentation.cards === 1 ? "" : "s"} in ${documentation.positions} saved entr${documentation.positions === 1 ? "y" : "ies"}</small></div><div class="insurance-summary"><div><span>Estimated value today</span><strong>${money(totals.value)}</strong><small>${totals.unpriced ? `${totals.unpriced} card${totals.unpriced === 1 ? "" : "s"} left out because no matching price was found` : "Every card has a matching price"}</small></div><div><span>Total amount recorded as paid</span><strong>${totals.costKnown ? money(totals.cost) : "Unavailable"}</strong><small>${totals.unknownCost ? `${totals.unknownCost} card${totals.unknownCost === 1 ? "" : "s"} missing the amount paid` : "Amount paid recorded for every card"}</small></div></div><div class="insurance-documentation"><strong>Details to complete</strong><span>${documentation.missingLocation} saved entr${documentation.missingLocation === 1 ? "y" : "ies"} missing a storage location · ${documentation.missingCertification} graded entr${documentation.missingCertification === 1 ? "y" : "ies"} missing a certification number · ${documentation.missingPrice} missing a current price</span></div><div class="insurance-list">${rows || '<div class="find-empty"><strong>No cards to report</strong><span>Add a card to your library before creating an insurance report.</span></div>'}</div><p class="insurance-disclaimer">Card images help identify the card but do not prove ownership, authenticity, condition, or possession. Prices are estimates, not official appraisals. Add your own photos, receipts, and professional valuations if your insurer asks for them.</p><div class="sheet-actions insurance-actions"><button class="secondary" id="insuranceClose" type="button">Close</button><button class="primary" id="printInsuranceReport" type="button" ${state.items.length ? "" : "disabled"}>Print / Save PDF</button></div></div>`,
  );
  $("#insuranceClose").addEventListener("click", closeSheet);
  $("#printInsuranceReport").addEventListener("click", () => window.print());
}

function openSharePortfolioSheet() {
  if (!requireAccountData()) return;
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Share a collection summary</h2><p>Preview exactly what will be shared.</p></div><button class="sheet-close" aria-label="Close">×</button></div><label class="share-performance"><input id="sharePerformance" type="checkbox"> Include what I paid and the known change in value</label><pre class="share-preview" id="sharePreview"></pre><div class="simple-note"><strong>Private by default.</strong><br>Notes, storage locations, certification numbers, purchase dates, account details, and buying or selling history are never included.</div><div class="sheet-actions"><button class="secondary" id="copyPortfolioSnapshot" type="button">Copy summary</button>${navigator.share ? '<button class="primary" id="nativeSharePortfolio" type="button">Share…</button>' : ""}</div>`,
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
      toast("Collection summary copied");
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
      toast("Collection summary shared");
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
        ? `<div class="simple-note"><strong>Mica will not guess missing purchase details.</strong><br>${unknownCostRows ? `${unknownCostRows.toLocaleString()} row${unknownCostRows === 1 ? " has" : "s have"} no amount paid, so Mica cannot show money gained for those cards. ` : ""}${unknownDateRows ? `${unknownDateRows.toLocaleString()} row${unknownDateRows === 1 ? " has" : "s have"} no purchase date; the date below only keeps purchases in a consistent order and will still be shown as “not recorded.”` : ""}</div>`
        : "";
    openSheet(
      `<div class="sheet-heading"><div><h2 id="sheetTitle">Import ${records.length.toLocaleString()} card record${records.length === 1 ? "" : "s"}?</h2><p>${esc(source)} spreadsheet found · private collection</p></div><button class="sheet-close" aria-label="Close">×</button></div>${errorCopy}${unknownCopy}<div class="info-copy"><p>Mica keeps each card’s type, professional grade, version, known purchase history, certification number, labels, location, and notes. Cards already in your account are not overwritten. Importing the same rows again will reuse the copies already saved when it can do so safely.</p></div><div class="field"><label for="importFallbackDate">Temporary date for rows missing a purchase date</label><input id="importFallbackDate" type="date" max="${today}" value="${today}" required><small>This only keeps purchases in a consistent order. Mica will still show the real purchase date as not recorded.</small></div><section class="import-progress" id="importProgress" aria-labelledby="importProgressTitle" hidden><div><strong id="importProgressTitle">Preparing import…</strong><span id="importProgressCount">0 of ${records.length.toLocaleString()}</span></div><progress id="importProgressBar" max="${records.length}" value="0">0%</progress><small id="importProgressHelp">You can pause after the current secure saves finish.</small></section><p class="form-error" id="importStatus" role="status" aria-live="polite"></p><div class="sheet-actions import-actions"><button class="secondary" id="cancelCsvImport" type="button">Cancel</button><button class="secondary" id="pauseCsvImport" type="button" hidden>Pause</button><button class="primary" id="addCsvImport" type="button">Add to my account</button></div>`,
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
          error: `Row ${index + 2}: purchase price or total paid is invalid`,
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
          : `${done.toLocaleString()} saved entr${done === 1 ? "y" : "ies"}. Safe to close.`;
      toast(
        remaining
          ? `Import paused · ${done.toLocaleString()} saved`
          : issues.length
            ? `${done.toLocaleString()} saved · ${issues.length.toLocaleString()} need review`
            : `${done.toLocaleString()} saved entr${done === 1 ? "y" : "ies"} added to your account`,
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
  const ownerId = state.session?.user?.id;
  const loadVersion = sessionLoadVersion;
  if (!ownerId) return;
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
      if (!accountRequestIsCurrent(ownerId, loadVersion)) return;
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
          if (!accountRequestIsCurrent(ownerId, loadVersion)) return null;
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
          price: demoPrice ?? null,
          move: null,
          quotes: [],
          pricingStatus: demoPrice == null ? "unavailable" : "preview",
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
        price: quote?.amount ?? demoPrice ?? null,
        quotes: card.quotes,
        historyStatus: card.historyStatus || null,
        priceHistory: quote
          ? recordPriceObservation(
              item,
              quote,
              mergePriceHistory(item.priceHistory || [], card.history || []),
            )
          : mergePriceHistory(item.priceHistory || [], card.history || []),
        pricingStatus: quote
          ? quoteStatus(quote)
          : demoPrice == null
            ? "unavailable"
            : "preview",
        pricingUpdatedAt:
          quote?.observedAt || quote?.retrievedAt?.slice(0, 10) || null,
      };
      const movement = movementForItem(updated);
      return { ...updated, move: movement?.changePercent ?? null, movement };
    };
    if (!accountRequestIsCurrent(ownerId, loadVersion)) return;
    state.items = state.items.map(applyPricing);
    catalog = catalog.map((item) =>
      cards.has(item.id) ? applyPricing(item) : item,
    );
    state.pricingStatus = partial ? "partial" : "live";
    state.pricingRetrievedAt = retrievedAt;
    await capturePortfolioValuation();
    renderCollection();
    renderInsights();
    if (state.route === "detail") renderDetail();
    if (state.route === "insights") void refreshMovementHistory();
  } catch {
    if (!accountRequestIsCurrent(ownerId, loadVersion)) return;
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
  const ownerId = state.session?.user?.id;
  const loadVersion = sessionLoadVersion;
  if (
    !ownerId ||
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
      if (!accountRequestIsCurrent(ownerId, loadVersion)) return;
      (payload.cards || []).forEach((card) => {
        cards.set(card.providerCardId, card);
        if (card.historyStatus === "plan_required") planLimited = true;
      });
    }
    if (!accountRequestIsCurrent(ownerId, loadVersion)) return;
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
    if (!accountRequestIsCurrent(ownerId, loadVersion)) return;
    state.movementStatus = "error";
  }
  renderCollection();
  renderInsights();
  if (state.route === "detail") renderDetail();
}

async function refreshWatchlistPricing() {
  const ownerId = state.session?.user?.id;
  const loadVersion = sessionLoadVersion;
  if (!ownerId) return;
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
      if (!accountRequestIsCurrent(ownerId, loadVersion)) return;
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
          if (!accountRequestIsCurrent(ownerId, loadVersion)) return null;
          sealedProcessed.add(item.id);
          return { item, product: payload.product };
        }),
      );
      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value?.product)
          sealedProducts.set(result.value.item.id, result.value.product);
      });
    }
    if (!accountRequestIsCurrent(ownerId, loadVersion)) return;
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
    if (!accountRequestIsCurrent(ownerId, loadVersion)) return;
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
  if (!$("#businessReview")) return;
  const review = portfolioReview(state.items, state.watchlist);
  const actions = portfolioActions(state.items, state.watchlist);
  const briefButton = $("#portfolioBriefButton");
  const briefResult = $("#portfolioBriefResult");
  briefButton.disabled = !actions.length;
  briefButton.textContent = actions.length
    ? "Explain my priorities"
    : "Nothing needs explanation";
  briefResult.classList.add("hidden");
  briefResult.replaceChildren();
  const signalCount = actions.reduce(
    (sum, action) => sum + action.items.length,
    0,
  );
  if (!state.items.length && !state.watchlist.length) {
    $("#businessReview").innerHTML =
      '<div class="action-center-empty"><span>Start here</span><strong>Add your first card</strong><small>Search for a card or unopened product, then enter the total paid. Mica will build a simple checklist from your collection.</small><button id="actionCenterAdd" type="button">Find a card →</button></div>';
    $("#actionCenterAdd").addEventListener("click", () => routeTo("scan"));
    return;
  }
  if (!actions.length) {
    $("#businessReview").innerHTML =
      '<div class="action-center-clear"><span>Today</span><strong>You’re caught up</strong><small>No watched prices have been reached, and no cards need a price or purchase review.</small><b>✓</b></div>';
    return;
  }
  $("#businessReview").innerHTML =
    `<div class="action-center-summary"><span>Today’s checklist</span><strong>${signalCount} item${signalCount === 1 ? "" : "s"} need attention</strong><small>${actions.length} clear next step${actions.length === 1 ? "" : "s"}, with the most useful one first.</small></div>${actions.map((action, index) => `<button type="button" data-business-review="${action.key}" class="${index === 0 ? "recommended" : ""}"><span>${index === 0 ? "Do this first" : `Next ${index + 1}`}</span><strong>${esc(action.title === "Price gaps" ? "Missing prices" : action.title)}</strong><small>${action.items.length} item${action.items.length === 1 ? "" : "s"} · ${esc(action.copy)}</small><b>Review ${action.items.length} →</b></button>`).join("")}`;
  $$("[data-business-review]").forEach((button) =>
    button.addEventListener("click", () => {
      const key = button.dataset.businessReview;
      const items = businessReviewItems(key, review);
      openBusinessReviewQueue(key, items);
    }),
  );
}

function businessReviewItems(
  key,
  review = portfolioReview(state.items, state.watchlist),
) {
  return key === "listings"
    ? listingReviewItems(state.items)
    : {
        pricing: review.needsPricing,
        "below-cost": review.belowCost,
        older: review.olderInventory,
        targets: review.reachedTargets,
      }[key] || [];
}

function advisorExperienceLevel() {
  return (
    {
      beginner: "beginner",
      familiar: "seller",
      professional: "pro",
    }[state.preferences.experienceLevel] || "beginner"
  );
}

async function requestPortfolioBrief(actions) {
  if (!state.session?.access_token)
    throw new Error("Sign in again before requesting an AI explanation.");
  const response = await fetch("/api/vision", {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${state.session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "advisor",
      experienceLevel: advisorExperienceLevel(),
      workspace: workspaceMode,
      portfolio: {
        positionCount: state.items.length,
        watchlistCount: state.watchlist.length,
      },
      signals: actions.map((action) => ({
        key: action.key,
        itemCount: action.items.length,
      })),
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      payload.error || "AI priorities are temporarily unavailable.",
    );
  return payload.brief;
}

async function explainPortfolioPriorities() {
  const actions = portfolioActions(state.items, state.watchlist);
  if (!actions.length) return;
  const button = $("#portfolioBriefButton");
  const result = $("#portfolioBriefResult");
  button.disabled = true;
  button.textContent = "Preparing explanation…";
  result.classList.remove("hidden");
  result.setAttribute("aria-busy", "true");
  result.innerHTML =
    '<div class="portfolio-brief-loading"><i></i><span>Explaining your checklist without sending card names, prices, notes, or photos…</span></div>';
  try {
    const brief = await requestPortfolioBrief(actions);
    result.innerHTML = `<div class="portfolio-brief-head"><span>AI explanation · based only on this checklist</span><h3>${esc(brief.headline)}</h3><p>${esc(brief.summary)}</p></div><div class="portfolio-brief-priorities">${brief.priorities
      .map((priority, index) => {
        const action = actions.find(
          (candidate) => candidate.key === priority.actionKey,
        );
        if (!action) return "";
        return `<article><span>${index === 0 ? "Start here" : `Then ${index + 1}`}</span><strong>${esc(action.title === "Price gaps" ? "Missing prices" : action.title)}</strong><p>${esc(priority.why)}</p><small>${esc(priority.nextStep)}</small><button type="button" data-advisor-review="${esc(priority.actionKey)}">Open ${action.items.length} item${action.items.length === 1 ? "" : "s"} →</button></article>`;
      })
      .join(
        "",
      )}</div>${brief.caveats.length ? `<p class="portfolio-brief-caveats">${brief.caveats.map((caveat) => esc(caveat)).join(" · ")}</p>` : ""}<p class="portfolio-brief-privacy">No card names, prices, photos, notes, certification numbers, or purchase details were sent. This explanation cannot edit your account.</p>`;
    $$("[data-advisor-review]", result).forEach((reviewButton) =>
      reviewButton.addEventListener("click", () => {
        const key = reviewButton.dataset.advisorReview;
        openBusinessReviewQueue(key, businessReviewItems(key));
      }),
    );
  } catch (error) {
    result.innerHTML = `<div class="portfolio-brief-error"><strong>The automatic checklist still works.</strong><span>${esc(error.message || "AI explanation is unavailable.")}</span><small>If setup is required, connect Vercel AI Gateway; no further app build is needed.</small></div>`;
  } finally {
    result.removeAttribute("aria-busy");
    button.disabled = false;
    button.textContent = "Refresh explanation";
  }
}

function openBusinessReviewQueue(key, items) {
  const config = {
    pricing: {
      title: "Missing prices",
      copy: "Saved cards that do not have a matching price today",
    },
    "below-cost": {
      title: "Worth less than you paid",
      copy: "Cards whose current value is below the amount you paid",
    },
    older: {
      title: "Owned for a long time",
      copy: "Cards you have owned for at least 180 days",
    },
    targets: {
      title: "Reached buy targets",
      copy: "Watchlist prices at or below your target",
    },
    listings: {
      title: "Active listings to repair",
      copy: "Missing details, stale reviews, or asks far from current market",
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
            ? `${item.gradingCompany} grade ${item.grade}`
            : conditionLabel(item.condition),
        );
      } else if (key === "listings") {
        metric =
          item.askingPrice === null || item.askingPrice === undefined
            ? "Ask missing"
            : money(item.askingPrice, item.currency);
        detail = esc(
          (item.listingReviewReasons || []).join(" · ") ||
            "Listing needs review",
        );
      } else if (key === "below-cost") {
        const value = Number(item.price || 0) * Number(item.quantity || 0);
        const gap = value - Number(item.costBasis || 0);
        metric = `${gap >= 0 ? "+" : ""}${money(gap, item.currency)}`;
        detail = `${money(value, item.currency)} value · ${money(item.costBasis, item.currency)} paid`;
      } else if (key === "older") {
        const days = holdingDays(item.purchaseDate);
        metric = days === null ? "Date missing" : `${days} days`;
        detail = `First bought ${esc(item.purchaseDate || "date not recorded")}`;
      } else {
        metric =
          item.currentPrice === null
            ? "Price missing"
            : money(item.currentPrice, item.currency);
        detail = `Your target ${money(item.targetPrice, item.currency)} · ${esc(item.gradingCompany ? `${item.gradingCompany} grade ${item.grade}` : conditionLabel(item.condition))}`;
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
      else if (key === "listings") openPositionEditSheet(item);
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
      '<div class="data-boundary"><strong>No buying or selling in this time period</strong><p>Record purchases and sales to see money in, money out, and money gained here.</p></div>';
    $("#businessReportNote").textContent =
      "This report uses only purchases and sales you record. Changes in card prices are shown separately.";
    return;
  }
  const cashClass = summary.cashFlowMinor >= 0 ? "positive" : "negative";
  const profitClass =
    summary.realizedProfitMinor >= 0 ? "positive" : "negative";
  $("#businessReportMetrics").innerHTML =
    `<div><span>Money received from sales</span><strong>${money(summary.netSalesMinor / 100, summary.currency)}</strong><small>${summary.unitsSold} card${summary.unitsSold === 1 ? "" : "s"} sold · after selling costs</small></div><div><span>Money spent buying cards</span><strong>${money(summary.acquisitionSpendMinor / 100, summary.currency)}</strong><small>${summary.unitsPurchased} card${summary.unitsPurchased === 1 ? "" : "s"} bought</small></div><div class="${cashClass}"><span>Money in minus money out</span><strong>${summary.cashFlowMinor >= 0 ? "+" : ""}${money(summary.cashFlowMinor / 100, summary.currency)}</strong><small>Sales received minus purchases paid</small></div><div class="${profitClass}"><span>${summary.realizedCoverage === summary.saleCount ? "Money gained from sold cards" : "Known money gained from sold cards"}</span><strong>${summary.realizedProfitMinor >= 0 ? "+" : ""}${money(summary.realizedProfitMinor / 100, summary.currency)}</strong><small>Uses what you paid for ${summary.realizedCoverage} of ${summary.saleCount} sales</small></div><div><span>Selling costs</span><strong>${money(summary.sellingCostsMinor / 100, summary.currency)}</strong><small>Total sale prices minus the money you received</small></div><div><span>Recorded activity</span><strong>${summary.transactionCount}</strong><small>${summary.purchaseCount} purchase${summary.purchaseCount === 1 ? "" : "s"} · ${summary.saleCount} sale${summary.saleCount === 1 ? "" : "s"}</small></div>`;
  $("#businessReportNote").textContent = summary.skippedCurrencyCount
    ? `${summary.skippedCurrencyCount} transaction${summary.skippedCurrencyCount === 1 ? " was" : "s were"} excluded to avoid mixing currencies. USD is shown separately.`
    : "Only US-dollar purchases and sales are shown. A card’s price change is not counted as money received until you sell it.";
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
      '<div class="data-boundary"><strong>No cards with US-dollar prices yet</strong><p>Add a card and load its matching price to estimate how much money you could keep after selling.</p></div>';
    note.textContent = plan.unpricedUnits
      ? `${plan.unpricedUnits} unpriced card${plan.unpricedUnits === 1 ? " is" : "s are"} excluded, not valued at zero.`
      : "Shown prices are estimates, not guaranteed sale prices.";
    return;
  }
  const profitClass =
    plan.profitMinor === null
      ? ""
      : plan.profitMinor >= 0
        ? "positive"
        : "negative";
  output.innerHTML = `<div><span>Current value of included cards</span><strong>${money(plan.referenceValueMinor / 100, plan.currency)}</strong><small>${plan.pricedUnits} priced item${plan.pricedUnits === 1 ? "" : "s"}</small></div><div><span>Expected total sale prices</span><strong>${money(plan.expectedGrossMinor / 100, plan.currency)}</strong><small>Using ${Number(liquidationInputs().referencePercent).toFixed(1)}% of today’s prices</small></div><div><span>Fees and other costs</span><strong>−${money((plan.marketplaceFeesMinor + plan.totalSellingCostsMinor) / 100, plan.currency)}</strong><small>${money(plan.marketplaceFeesMinor / 100, plan.currency)} selling-site fee · ${money(plan.totalSellingCostsMinor / 100, plan.currency)} other</small></div><div class="take-home"><span>Estimated money you keep</span><strong>${money(plan.netProceedsMinor / 100, plan.currency)}</strong><small>Sale prices minus the costs above</small></div><div class="${profitClass}"><span>${plan.profitMinor === null ? "Money gained unavailable" : "Estimated money gained"}</span><strong>${plan.profitMinor === null ? "Add what you paid" : `${plan.profitMinor >= 0 ? "+" : ""}${money(plan.profitMinor / 100, plan.currency)}`}</strong><small>${plan.profitMinor === null ? `${plan.unknownBasisUnits} priced item${plan.unknownBasisUnits === 1 ? " is" : "s are"} missing the amount paid` : "Compared with what you paid for the cards sold"}</small></div><div><span>Lowest sale level that avoids losing money</span><strong>${plan.breakEvenReferencePercent === null ? "—" : `${plan.breakEvenReferencePercent.toFixed(1)}%`}</strong><small>Of today’s shown prices after fees and costs</small></div>`;
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
      `${plan.unknownBasisUnits} item${plan.unknownBasisUnits === 1 ? "" : "s"} missing the amount paid`,
    );
  note.textContent = omissions.length
    ? `${omissions.join(" · ")}. Missing values are never treated as zero.`
    : "Every included item has a matching US-dollar price and a recorded amount paid. This is still an estimate, not a guaranteed sale.";
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
      "Price shown for each",
      "Expected sale each",
      "Expected total sale amount",
      "Estimated percentage fee",
      "Amount originally paid",
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
      `Scenario: ${liquidationInputs().referencePercent}% of the shown price`,
      `Fee: ${liquidationInputs().feePercent}%`,
      `Other selling costs: ${dollars(plan.totalSellingCostsMinor)}`,
      `Estimated take-home: ${dollars(plan.netProceedsMinor)}`,
      plan.profitMinor === null
        ? "Estimated money gained: unavailable — amount paid is missing"
        : `Estimated money gained: ${dollars(plan.profitMinor)}`,
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
      '<div class="data-boundary"><strong>No cards to review yet</strong><p>Add a purchase and Mica will show whether too much of your money is tied up in a few cards and how long you have owned them.</p></div>';
    $("#inventoryHealthNote").textContent =
      "Cards are counted from your oldest recorded purchase first.";
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
      return `<div class="inventory-age-row ${bucket.key === "181+" ? "aged" : ""}"><div><strong>${esc(bucket.label)}</strong><span>${bucket.quantity} card${bucket.quantity === 1 ? "" : "s"} · ${basisScale ? `${money(bucket.costBasis, health.currency)} originally paid` : "purchase amount unavailable"}</span></div><div class="inventory-age-track" aria-label="${esc(bucket.label)} ${width.toFixed(1)} percent of ${basisScale ? "money originally paid" : "cards owned"}"><i style="width:${width}%"></i></div></div>`;
    })
    .join("");
  $("#inventoryHealth").innerHTML =
    `<div class="inventory-health-metrics"><div><span>Card with the most value</span><strong>${top ? `${top.sharePercent.toFixed(1)}%` : "—"}</strong><small>${top ? esc(top.name) : "Needs a price"}</small></div><div><span>Value held in your top 3 cards</span><strong>${health.topThreeSharePercent === null ? "—" : `${health.topThreeSharePercent.toFixed(1)}%`}</strong><small>Of cards with matching prices</small></div><div><span>Cards with matching prices</span><strong>${coverage.toFixed(0)}%</strong><small>${health.pricedQuantity} of ${health.totalQuantity} cards</small></div></div><div class="inventory-aging"><div class="inventory-aging-title"><strong>How long you have owned these cards</strong><span>${basisScale ? "Grouped by what you paid" : "Grouped by card count"}</span></div>${bucketRows}</div>`;
  $("#inventoryHealthNote").textContent = health.unknownBasisQuantity
    ? `${health.unknownBasisQuantity} card${health.unknownBasisQuantity === 1 ? " is" : "s are"} missing the amount paid, so this view uses card count and cannot show money gained.`
    : health.skippedCurrencyPositions
      ? `${health.skippedCurrencyPositions} saved card entr${health.skippedCurrencyPositions === 1 ? "y was" : "ies were"} bought in another currency and kept separate.`
      : "Uses your oldest recorded purchases first. Cards without a matching price are left out instead of being counted as $0.";
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
            `<div class="mover"><img src="${esc(item.thumb)}" alt=""><div><strong>${esc(item.name)}</strong><span>${esc(item.gradingCompany ? `${item.gradingCompany} grade ${item.grade}` : conditionLabel(item.condition))} · ${item.quantity} owned</span></div><b>${value === null ? "Unavailable" : `${money(value)}${gain === null ? "" : ` · ${gain >= 0 ? "up " : "down "}${money(Math.abs(gain))}`}`}</b></div>`,
        )
        .join("")
    : '<div class="data-boundary"><strong>No cards yet</strong><p>Add a card and what you paid to start seeing collection insights.</p></div>';
  renderInventoryHealth();
  const rawCount = state.items
    .filter((item) => item.cardState !== "sealed" && !item.gradingCompany)
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  $("#batchGradingCount").textContent = rawCount
    ? `${rawCount} ungraded card${rawCount === 1 ? "" : "s"} available`
    : "Add an ungraded card to begin";
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
              ? "Bought"
              : transaction.type === "sale"
                ? "Sold"
                : transaction.type === "grading_submission"
                  ? "Sent to grading"
                  : transaction.type === "grading_return"
                    ? "Returned graded"
                    : transaction.type === "position_split"
                      ? "Copies separated"
                      : String(transaction.type).replaceAll("_", " ");
          const detail =
            transaction.type === "purchase"
              ? transaction.unitPrice == null
                ? "cost not recorded"
                : `${money(transaction.totalCost, transaction.currency)} total`
              : transaction.type === "sale"
                ? `${money(transaction.netProceeds, transaction.currency)} received after selling costs`
                : transaction.type === "grading_return"
                  ? `${transaction.gradingCompany} grade ${transaction.grade} · ${money(transaction.gradingFees, transaction.currency)} added to what you paid`
                  : transaction.type === "grading_submission"
                    ? `${transaction.gradingCompany || transaction.marketplace} · manual tracking`
                    : transaction.type === "position_split"
                      ? "Original purchase amount moved with the cards · no money moved"
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
    if (movements.length) {
      $(".insight-feature").innerHTML =
        `<div class="insight-kicker">Price changes over 30 days</div><strong>${comparable.length ? `${change >= 0 ? "Up " : "Down "}${money(Math.abs(change))}` : `${movements.length} cards with matching past prices`}</strong><span>${comparable.length} card${comparable.length === 1 ? "" : "s"} compared using the number you own now</span><div class="unavailable-panel">Only the same card version, wear level or professional grade, currency, and price source are compared. A higher price is not money earned until a card is sold.</div>`;
    } else {
      $(".insight-feature").innerHTML =
        `<div class="insight-kicker">${state.pricingStatus === "partial" ? "Some prices found" : "Prices connected"}</div><strong>${priced} of ${state.items.length} saved cards have prices</strong><span>${state.items.length - priced} need a matching price</span><div class="unavailable-panel">${isShowcaseAccount() ? "The Dashboard has clearly labeled demo history. This page waits for real prices so demo movement is never mistaken for market evidence." : state.movementStatus === "loading" ? "Checking past prices for the same cards…" : state.movementStatus === "plan_required" ? "Past prices are ready after PkmnPrices Pro is connected. Today’s prices still work." : state.movementStatus === "error" ? "Past prices could not be refreshed. Today’s collection value is unchanged." : "Price changes appear after Mica has matching prices from at least 30 days apart."}</div>`;
    }
    $("#moversList").innerHTML = movements.length
      ? movements
          .slice(0, 6)
          .map(({ item, movement }) => {
            const context = item.gradingCompany
              ? `${item.gradingCompany} grade ${item.grade}`
              : conditionLabel(item.condition);
            const provider =
              movement.provider === "ebay"
                ? "eBay sold"
                : movement.provider === "tcgplayer"
                  ? "TCGplayer"
                  : movement.provider === "cardmarket"
                    ? "Cardmarket"
                    : movement.provider;
            const dollarChange = movement.toAmount - movement.fromAmount;
            return `<button type="button" class="mover mover-button" data-mover-id="${esc(item.uid)}"><img src="${esc(item.thumb)}" alt=""><div><strong>${esc(item.name)}</strong><span>${esc(context)} · ${esc(provider)} · ${money(movement.fromAmount, movement.currency)} to ${money(movement.toAmount, movement.currency)}</span></div><b class="${dollarChange < 0 ? "negative" : ""}">${dollarChange >= 0 ? "Up " : "Down "}${money(Math.abs(dollarChange), movement.currency)}</b></button>`;
          })
          .join("")
      : isShowcaseAccount()
        ? '<div class="data-boundary"><strong>Demo price changes are on the Dashboard</strong><p>This page waits for real prices from the same card version so demo movement is never mistaken for evidence.</p></div>'
        : '<div class="data-boundary"><strong>Price history is still building</strong><p>A 30-day comparison needs an older price for the same card version and wear level or grade. Mica will not mix different cards.</p></div>';
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
    `<div class="insight-kicker">Past prices</div><strong>Tracking starts when live prices connect</strong><span>Demo prices are never used to claim a real price change.</span><div class="unavailable-panel">Connect matching past prices to see real changes. Mica never turns demo prices into a market trend.</div>`;
  $("#moversList").innerHTML =
    '<div class="data-boundary"><strong>No verified price changes yet</strong><p>Changes appear after Mica has past prices for the same card version, wear level or grade, currency, and source.</p></div>';
}

function tradeItemMarkup(item, side) {
  const max = item.maxQuantity ? ` max="${item.maxQuantity}"` : "";
  const status =
    item.pricingStatus === "live"
      ? `Suggested trade value · ${esc(item.context)}`
      : item.pricingStatus === "loading"
        ? "Checking matching market price…"
        : `Price needs review · ${esc(item.context)}`;
  return `<article class="trade-item" data-trade-item="${esc(item.tradeId)}" data-trade-item-side="${side}"><img src="${esc(item.thumb || "./icons/icon.svg")}" data-fallback="./icons/icon.svg" alt=""><div class="trade-item-main"><strong>${esc(item.name)}</strong><span>${esc(item.set)} · ${esc(item.number)} · ${esc(item.variant || "Version unknown")}</span><small>${status}</small></div><div class="trade-item-value"><strong>${String(item.valuePerCard).trim() ? money(Number(item.valuePerCard)) : "—"}</strong><label>How many?<input data-trade-quantity type="number" inputmode="numeric" min="1"${max} step="1" value="${item.quantity}"></label><details><summary>Change value</summary><label>Value for each card<div class="money-input"><span>$</span><input data-trade-value type="number" inputmode="decimal" min="0" step="0.01" value="${esc(item.valuePerCard)}" placeholder="0.00"></div></label></details></div><button class="trade-remove" data-trade-remove type="button" aria-label="Remove ${esc(item.name)} from trade">×</button></article>`;
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
  copyButton.disabled =
    !analysis || !state.trade.give.length || !state.trade.receive.length;
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
      '<span>Add both sides</span><strong>Add at least one card to each side.</strong><small id="tradeBalanceHelp">Use the matching prices or type the value both people agreed on.</small>';
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
  verdict.innerHTML = `<span>${copy.label}</span><strong>${copy.headline}</strong><small id="tradeBalanceHelp">${balance}</small>`;
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
  bindTradeItemRows();
  updateTradeSummary();
}

function renderTradeSearchResults() {
  const node = $("#tradeSearchResults");
  if (!node) return;
  const results = state.trade.searchResults;
  node.innerHTML = results.length
    ? results
        .map(
          (item) =>
            `<button class="quick-card-result" type="button" data-trade-card="${esc(item.id)}"><img src="${esc(item.thumb || item.image || "")}" alt=""><span><strong>${esc(item.name)}</strong><small>${esc(item.set)} · ${esc(item.number)}</small><em>${esc(item.variant || "Version unknown")} · ${esc(languageName(item.language || "en"))}</em>${ownedSearchStatus(item)}</span><b>Add</b></button>`,
        )
        .join("")
    : '<div class="find-empty"><strong>No matching cards</strong><span>Try the card name with its set or collector number.</span></div>';
  $$("[data-trade-card]", node).forEach((button) =>
    button.addEventListener("click", () => {
      addTradeCard(
        state.trade.searchResults.find(
          (item) => item.id === button.dataset.tradeCard,
        ),
        state.trade.addingTo,
      );
      closeSheet({ discardHistory: true });
    }),
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
      tradeItem.valuePerCard = (
        Number(quote.amount) *
        (Number(state.preferences.tradeValuePercent) / 100)
      ).toFixed(2);
      tradeItem.referencePrice = Number(quote.amount);
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
    : `Ungraded · ${conditionLabel(card.condition || "Near Mint")}`;
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
    valuePerCard:
      card.price == null
        ? ""
        : (
            Number(card.price) *
            (Number(state.preferences.tradeValuePercent) / 100)
          ).toFixed(2),
    referencePrice: card.price == null ? null : Number(card.price),
    pricingStatus: card.price == null ? "loading" : "live",
  };
  state.trade[side].push(tradeItem);
  renderTrade();
  toast(
    `${card.name} added to ${side === "give" ? "You give" : "You receive"}`,
  );
  if (card.price == null) void priceTradeCard(tradeItem, card);
}

function openTradeCardPicker(side) {
  state.trade.addingTo = side;
  state.trade.searchResults = [];
  const label = side === "give" ? "What you're giving" : "What they're giving";
  const owned = state.items.filter((item) => item.quantity > 0).slice(0, 8);
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Add a card</h2><p>${label}</p></div><button class="sheet-close" aria-label="Close">×</button></div><button class="trade-camera" id="tradeCameraButton" type="button">Use camera</button><label class="find-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg><input id="tradeCardSearch" type="search" placeholder="Search name, set, or number" autocomplete="off" aria-label="Search for a card to add to the trade"></label><div class="trade-search-results" id="tradeSearchResults"><div class="find-empty compact"><strong>Find the exact card</strong><span>Mica fills its matching trade estimate when pricing is available.</span></div></div><div class="trade-owned" id="tradeOwned">${owned.length ? `<div class="trade-owned-head"><strong>Your library</strong><span>Tap once to add</span></div><div class="trade-owned-list">${owned.map((item) => `<button type="button" data-trade-owned="${esc(item.uid)}"><img src="${esc(item.thumb)}" alt=""><span><strong>${esc(item.name)}</strong><small>${esc(item.gradingCompany ? `${item.gradingCompany} ${item.grade}` : item.condition)} · ${item.price == null ? "Value needed" : money(item.price)}</small></span><b>Add</b></button>`).join("")}</div>` : ""}</div>`,
  );
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
          '<div class="find-empty"><strong>Find a card</strong><span>Choose the card that matches the picture and bottom number. Mica fills in a suggested trade value.</span></div>';
        return;
      }
      $("#tradeSearchResults").innerHTML =
        '<div class="searching-cards"><i></i><span>Finding matching cards…</span></div>';
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
  $$("[data-trade-owned]").forEach((button) =>
    button.addEventListener("click", () => {
      addTradeCard(
        state.items.find((item) => item.uid === button.dataset.tradeOwned),
        side,
        true,
      );
      closeSheet({ discardHistory: true });
    }),
  );
  $("#tradeCameraButton").addEventListener("click", () => {
    closeSheet({ discardHistory: true });
    state.visionDestination = "trade";
    void openAutoCapture();
  });
  requestAnimationFrame(() => input.focus());
}

function bindTradeUI() {
  $$("[data-trade-add-side]").forEach((button) =>
    button.addEventListener("click", () =>
      openTradeCardPicker(button.dataset.tradeAddSide),
    ),
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
    renderTrade();
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
    const active =
      tab.dataset.ledgerView === state.ledgerView &&
      (tab.dataset.conditionFilter || "") === state.conditionFilter;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-pressed", String(active));
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
    `${state.intakeQueue.length} card${state.intakeQueue.length === 1 ? "" : "s"} ready to review`;
}

function queueIntakeCard(card, prefill = null, source = null) {
  if (!card) return;
  if (state.intakeQueue.some((entry) => entry.card.id === card.id)) {
    toast(`${card.name} is already ready to review`);
    return;
  }
  state.intakeQueue.push({
    queueEntryId: crypto.randomUUID(),
    card,
    prefill,
    source,
  });
  renderIntakeQueueBar();
  toast(`${card.name} added for review`);
}

function openBatchIntakeSheet() {
  if (!state.intakeQueue.length) {
    toast("Your intake queue is empty");
    return;
  }
  if (state.intakeQueue.some((entry) => entry.prefill || entry.source)) {
    toast("Receipt cards need individual cost and condition confirmation");
    openIntakeQueueSheet();
    return;
  }
  const today = localIsoDate();
  const entries = [...state.intakeQueue];
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Add ungraded cards together</h2><p>Use one wear level and purchase date. Mica keeps each card version separate.</p></div><button class="sheet-close" aria-label="Close">×</button></div><form id="batchIntakeForm"><div class="form-grid batch-shared-fields"><div class="field"><label for="batchCondition">Wear level for every card</label><select id="batchCondition"><option value="near_mint">Like new (Near Mint)</option><option value="lightly_played">Light wear (Lightly Played)</option><option value="moderately_played">Noticeable wear (Moderately Played)</option><option value="heavily_played">Heavy wear (Heavily Played)</option><option value="damaged">Damaged</option></select></div><div class="field"><label for="batchDate">Purchase date</label><input id="batchDate" type="date" max="${today}" value="${today}" required></div></div><div class="batch-intake-list">${entries
      .map((entry, index) => {
        const variants =
          Array.isArray(entry.card.variants) && entry.card.variants.length
            ? entry.card.variants
            : [entry.card.variant || "Unknown"];
        return `<article class="batch-intake-row" data-batch-index="${index}"><img src="${esc(entry.card.thumb || entry.card.image || "./icons/icon.svg")}" alt=""><div class="batch-intake-identity"><strong>${esc(entry.card.name)}</strong><span>${esc(entry.card.set)} · ${esc(entry.card.number)} · ${esc(languageName(entry.card.language || "en"))}</span><label>Card version<select data-batch-variant>${variants.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}</select></label></div><div class="batch-intake-values"><label>How many?<input data-batch-quantity type="number" inputmode="numeric" min="1" max="99999" step="1" value="1" required></label><label>Total paid for these cards<div class="money-input"><span>$</span><input data-batch-cost type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" required></div></label></div></article>`;
      })
      .join(
        "",
      )}</div><p class="form-error" id="batchIntakeStatus" role="status">Nothing is saved until every row is ready.</p><div class="sheet-actions"><button class="secondary" id="batchIntakeBack" type="button">Back to cards</button><button class="primary" type="submit">Add ${entries.length} ungraded card${entries.length === 1 ? "" : "s"}</button></div></form>`,
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
        `${saved.size} ungraded card${saved.size === 1 ? "" : "s"} added to your library`,
      );
    }
  });
}

function openIntakeQueueSheet() {
  if (!state.intakeQueue.length) {
    toast("Your intake queue is empty");
    return;
  }
  const hasReceiptDrafts = state.intakeQueue.some(
    (entry) => entry.prefill || entry.source,
  );
  openSheet(
    `<div class="sheet-heading"><div><h2 id="sheetTitle">Cards ready to add</h2><p>Check the card version, visible wear or professional grade, and total paid for each card.</p></div><button class="sheet-close" aria-label="Close">×</button></div>${hasReceiptDrafts ? '<div class="vision-quality warning"><strong>Check the details read from your receipt</strong><span>Open each card to confirm its wear and total paid. Any amount Mica could not tie to a card stays blank instead of being guessed.</span></div>' : '<div class="intake-batch-choice"><div><strong>Adding ungraded cards with the same wear?</strong><span>Review the card versions, number of cards, and total paid together.</span></div><button id="batchRawIntake" type="button">Add as ungraded cards</button></div>'}<div class="intake-list">${state.intakeQueue.map((entry) => `<div class="intake-row"><img src="${esc(entry.card.thumb || entry.card.image || "./icons/icon.svg")}" alt=""><div><strong>${esc(entry.card.name)}</strong><span>${esc(entry.card.set)} · ${esc(entry.card.number)}<br>${esc(entry.card.variant || "Version unknown")} · ${esc(languageName(entry.card.language || "en"))}${entry.source?.vendor ? `<br>Receipt: ${esc(entry.source.vendor)}${entry.prefill?.totalAcquisitionCost ? ` · ${money(Number(entry.prefill.totalAcquisitionCost))}` : " · total paid needs review"}` : ""}</span></div><div class="intake-row-actions"><button type="button" data-intake-prepare="${esc(entry.queueEntryId)}">Review</button><button class="remove" type="button" data-intake-remove="${esc(entry.queueEntryId)}">Remove</button></div></div>`).join("")}</div><p class="legal-copy">Mica never combines search results or accepts an AI suggestion without asking. Confirm the card version, visible wear or professional grade, and purchase details before saving.</p><div class="sheet-actions"><button class="secondary" id="clearIntakeQueue" type="button">Clear all</button><button class="primary" id="intakeDone" type="button">Back to search</button></div>`,
  );
  $("#batchRawIntake")?.addEventListener("click", () => {
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
      openPositionSheet(entry.card, {
        queueEntryId: entry.queueEntryId,
        prefill: entry.prefill || {},
        receiptSource: entry.source || null,
      });
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
            const queued = state.intakeQueue.some(
              (entry) => entry.card.id === item.id,
            );
            const addLabel = queued
              ? "Added"
              : owned.quantity
                ? "Add another"
                : "Add";
            return `<div class="quick-card-result-wrap"><button class="quick-card-result" type="button" data-quick-card="${esc(item.id)}" aria-label="View ${esc(item.name)} from ${esc(item.set)}, number ${esc(item.number)}${owned.quantity ? `, ${owned.quantity} already owned` : ""}"><img src="${esc(item.thumb || item.image || "")}" alt="${esc(item.name)} card"><span><strong>${esc(item.name)}</strong><small>${esc(item.set || "Set unavailable")} · ${esc(item.number || "Number unavailable")}</small><em>${esc(item.rarity || "Rarity unavailable")} · ${esc(languageName(item.language || language.value))} · ${esc(item.variant || "Version unknown")}</em>${ownedSearchStatus(item)}${matchReason(item)}</span><b>${owned.quantity ? "Owned" : "View"}</b></button><button class="queue-card-button${queued ? " queued" : ""}" type="button" data-queue-card="${esc(item.id)}" aria-label="${queued ? "Already added" : owned.quantity ? "Add another" : "Add"} ${esc(item.name)} card" ${queued ? "disabled" : ""}>${addLabel}</button></div>`;
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
      button.addEventListener("click", () => {
        queueIntakeCard(
          catalog.find((card) => card.id === button.dataset.queueCard),
        );
        showResults();
      }),
    );
  };
  const search = async () => {
    const q = input.value.trim();
    const current = ++requestId;
    if (q.length < 2) {
      resultsNode.innerHTML =
        '<div class="find-empty"><strong>Find the right card</strong><span>Results show the picture, set, and bottom number so you can choose the matching version.</span></div>';
      return;
    }
    resultsNode.setAttribute("aria-busy", "true");
    resultsNode.innerHTML =
      '<div class="searching-cards"><i></i><span>Finding matching cards…</span></div>';
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

function approvedImageProxyPath(value) {
  try {
    const source = new URL(value, location.href);
    if (
      source.protocol !== "https:" ||
      !["assets.tcgdex.net", "images.pokemontcg.io"].includes(source.hostname)
    )
      return null;
    return `/api/card-image?url=${encodeURIComponent(source.href)}`;
  } catch {
    return null;
  }
}

function imageAttempts(image) {
  try {
    const values = JSON.parse(image.dataset.imageAttempts || "[]");
    return new Set(Array.isArray(values) ? values : []);
  } catch {
    return new Set();
  }
}

function nextImageSource(image) {
  const attempted = imageAttempts(image);
  const current = new URL(image.currentSrc || image.src, location.href).href;
  attempted.add(current);
  const fallback = image.dataset.fallback || "";
  const candidates = [
    approvedImageProxyPath(current),
    approvedImageProxyPath(fallback),
    fallback,
    "./icons/icon.svg",
  ].filter(Boolean);
  const next = candidates.find((candidate) => {
    const absolute = new URL(candidate, location.href).href;
    return !attempted.has(absolute);
  });
  image.dataset.imageAttempts = JSON.stringify([...attempted]);
  if (!next) return false;
  image.src = next;
  return true;
}

function bindEvents() {
  document.addEventListener(
    "error",
    (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      nextImageSource(image);
    },
    true,
  );
  $$("[data-sidebar-target]").forEach((button) =>
    button.addEventListener("click", () =>
      openWorkspaceShortcut(button.dataset.sidebarTarget),
    ),
  );
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
      state.conditionFilter = tab.dataset.conditionFilter || "";
      state.sidebarTarget = "collection";
      syncTabs();
      renderCollection();
      syncWorkspaceChrome();
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
    if (state.sidebarTarget === "dashboard") {
      openWorkspaceShortcut("collection");
      return;
    }
    state.visibleLimit += 100;
    renderCollection();
  });
  $("#selectPositionsButton").addEventListener("click", () =>
    setBulkMode(!state.bulkMode),
  );
  $("#bulkDoneButton").addEventListener("click", () => setBulkMode(false));
  $("#bulkOrganizeButton").addEventListener("click", openBulkOrganizeSheet);
  $("#bulkShareButton").addEventListener("click", openSelectedShareSheet);
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
  $("#syncState")?.addEventListener("click", () => {
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
  $("#autoCaptureButton").addEventListener(
    "click",
    () => void openAutoCapture(),
  );
  $("#receiptCameraButton").addEventListener(
    "click",
    () => void openReceiptCamera(),
  );
  $("#legacyCameraButton").addEventListener(
    "click",
    () => void openCardCamera(),
  );
  $("#sealedSearchButton").addEventListener("click", openSealedSearch);
  $("#reviewIntakeQueue").addEventListener("click", openIntakeQueueSheet);
  renderIntakeQueueBar();
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
  $("#portfolioBriefButton").addEventListener(
    "click",
    explainPortfolioPriorities,
  );
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
      applyWorkspaceMode(button.dataset.workspaceMode, {
        announce: true,
        userSelected: true,
      }),
    ),
  );
  $$("[data-ui-theme-option]").forEach((button) =>
    button.addEventListener("click", () =>
      applyUiTheme(button.dataset.uiThemeOption, { announce: true }),
    ),
  );
  $("#themeQuickSwitch")?.addEventListener("click", () =>
    applyUiTheme(uiTheme === "clean" ? "analytics" : "clean", {
      announce: true,
    }),
  );
  $("#workspaceExpand")?.addEventListener("click", () =>
    applyWorkspaceMode("growth", { announce: true, userSelected: true }),
  );
  $("#csvInput").addEventListener("change", (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (file) handleCsv(file);
  });
  $$("[data-info]").forEach((button) =>
    button.addEventListener("click", () => openInfo(button.dataset.info)),
  );
  $$("[data-automation]").forEach((button) =>
    button.addEventListener("click", () =>
      openAutomationInfo(button.dataset.automation),
    ),
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
  $("#saveWorkflowDefaults")?.addEventListener(
    "click",
    () => void persistWorkflowDefaults(),
  );
  $("#moreButton").addEventListener("click", () => {
    if (!requireAccountData()) return;
    openSheet(
      `<div class="sheet-heading"><div><h2 id="sheetTitle">Library options</h2><p>Keep copies of your card data.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="settings-group"><button type="button" id="sheetAccountBackup"><span>Complete account backup<small>Cards, purchases, sales, and watched cards</small></span><b>›</b></button><button type="button" id="sheetCollectionCsv"><span>Collection spreadsheet<small>A copy you can import again later</small></span><b>›</b></button></div>`,
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

function validateImageFile(file) {
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
    return false;
  }
  if (file.size > 12 * 1024 * 1024) {
    toast("Image is over the 12 MB capture limit");
    return false;
  }
  return true;
}

function validateImage(file) {
  if (!validateImageFile(file)) return;
  void showProcessing(file);
}

let appEventsBound = false;

function authMessage(message, error = false) {
  const node = $("#authMessage");
  node.textContent = message;
  node.style.color = error ? "var(--danger)" : "var(--pine-2)";
}

function friendlyAuthError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  if (message.includes("invalid login credentials"))
    return "The email or password is incorrect.";
  if (message.includes("email not confirmed"))
    return "Confirm your email first, then sign in.";
  if (message.includes("rate") || message.includes("too many"))
    return "Too many attempts. Wait a moment and try again.";
  if (message.includes("password"))
    return "Use a password with at least 8 characters.";
  return "Mica could not complete that sign-in request. Please try again.";
}

function openAuthLegal(kind) {
  const dialog = $("#authLegalDialog");
  const title = $("#authLegalTitle");
  const content = $("#authLegalContent");
  if (kind === "privacy") {
    title.textContent = "Privacy notice";
    content.innerHTML =
      "<p>Mica stores your account, collection, purchases, sales, watched cards, and value history so its private collection tools can work.</p><p>Your collection belongs only to your signed-in account. Card photos sent for AI help are used for that one request and are not intentionally saved by Mica’s scan service.</p><p>Mica may ask connected price services for matching card prices. Do not put payment-card details or other sensitive information in notes.</p><p>Before public launch, the owner must add the final legal entity, support contact, data-retention period, and location-specific legal notices.</p>";
  } else {
    title.textContent = "Mica terms";
    content.innerHTML =
      "<p>Mica is a collection and decision-support tool. Prices, grading estimates, sale plans, and trade comparisons are references—not appraisals, guarantees, or financial advice.</p><p>You are responsible for confirming card identity, condition, authenticity, provider prices, fees, and transaction details before acting.</p><p>Do not use Mica to violate marketplace, data-provider, or intellectual-property terms. Public-release entity, jurisdiction, and dispute language must be approved by the owner before launch.</p>";
  }
  dialog.showModal();
}

function openPasswordResetDialog() {
  const dialog = $("#passwordResetDialog");
  if (!dialog.open) dialog.showModal();
  requestAnimationFrame(() => $("#newAccountPassword")?.focus());
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
    if (error) authMessage(friendlyAuthError(error), true);
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
    if (error) authMessage(friendlyAuthError(error), true);
    else
      authMessage(
        result.session
          ? "Account created. Loading your collection…"
          : "Check your email to confirm your account, then sign in.",
      );
  });
  $("#magicLinkForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email")).trim();
    authMessage("Sending your secure magic link…");
    const { error } = await sendMagicLink(supabase, email);
    authMessage(
      error ? friendlyAuthError(error) : "Magic link sent. Check your email.",
      Boolean(error),
    );
  });
  $("#toggleAuthPassword").addEventListener("click", (event) => {
    const input = $("#authPassword");
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    event.currentTarget.textContent = showing ? "Show" : "Hide";
    event.currentTarget.setAttribute("aria-pressed", String(!showing));
    event.currentTarget.setAttribute(
      "aria-label",
      showing ? "Show password" : "Hide password",
    );
  });
  $("#forgotPassword").addEventListener("click", async () => {
    const email = $("#authEmail");
    if (!email.reportValidity()) return;
    authMessage("Sending password reset instructions…");
    const { error } = await sendPasswordReset(supabase, email.value.trim());
    authMessage(
      error
        ? friendlyAuthError(error)
        : "If that email has an account, password reset instructions are on the way.",
      Boolean(error),
    );
  });
  $$("[data-auth-legal]").forEach((button) =>
    button.addEventListener("click", () =>
      openAuthLegal(button.dataset.authLegal),
    ),
  );
  $$("[data-close-auth-dialog]").forEach((button) =>
    button.addEventListener("click", () => $("#authLegalDialog").close()),
  );
  $("#authLegalDialog").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });
  $("#passwordResetForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = $("#newAccountPassword");
    if (!event.currentTarget.reportValidity()) return;
    const status = $("#passwordResetMessage");
    status.textContent = "Updating password…";
    const { error } = await updateAccountPassword(supabase, password.value);
    if (error) {
      status.textContent = friendlyAuthError(error);
      return;
    }
    password.value = "";
    status.textContent = "Password updated.";
    setTimeout(() => $("#passwordResetDialog").close(), 500);
  });
  $("[data-close-reset-dialog]").addEventListener("click", () =>
    $("#passwordResetDialog").close(),
  );
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
            `<div class="transaction-row"><div><strong>${esc(mapping.provider)} · ${esc(mapping.match_status)}</strong><span>Match quality: ${esc(mapping.match_confidence ?? "Unknown")} · Updated: ${esc(mapping.updated_at || "Unknown")}</span></div></div>`,
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
  const profileName = String(
    state.session?.user?.user_metadata?.full_name || email.split("@")[0],
  )
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
  const initials =
    profileName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("") || "ME";
  if ($("#sidebarAccountName"))
    $("#sidebarAccountName").textContent = profileName || "Collector";
  if ($("#sidebarAccountPlan"))
    $("#sidebarAccountPlan").textContent = isShowcaseAccount()
      ? "Showcase account"
      : "Mica account";
  if ($("#sidebarAvatar")) $("#sidebarAvatar").textContent = initials;
  if ($(".avatar")) $(".avatar").textContent = initials;
  if ($(".profile-avatar")) $(".profile-avatar").textContent = initials;
  const heading = $("#profileTitle");
  if (heading) heading.textContent = "Your collection account";
  const profile = $(".profile-card");
  const strong = profile?.querySelector("strong");
  const span = profile?.querySelector("span");
  if (strong) strong.textContent = email;
  if (span)
    span.textContent =
      "Collection and purchase history sync securely across devices";
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

function profileDisplayName() {
  const email = state.session?.user?.email || "";
  return String(
    state.profile?.displayName ||
      state.session?.user?.user_metadata?.full_name ||
      email.split("@")[0],
  )
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function renderWorkflowDefaults() {
  if ($("#defaultTradePercent"))
    $("#defaultTradePercent").value = state.preferences.tradeValuePercent;
  if ($("#defaultQuickSalePercent"))
    $("#defaultQuickSalePercent").value = state.preferences.quickSalePercent;
  if ($("#defaultSellingFeePercent"))
    $("#defaultSellingFeePercent").value = state.preferences.sellingFeePercent;
  if ($("#liquidationReferencePercent"))
    $("#liquidationReferencePercent").value =
      state.preferences.quickSalePercent;
  if ($("#liquidationFeePercent"))
    $("#liquidationFeePercent").value = state.preferences.sellingFeePercent;
  if ($("#liquidationSellingCosts"))
    $("#liquidationSellingCosts").value = Number(
      state.preferences.otherSellingCosts,
    ).toFixed(2);
}

async function persistWorkflowDefaults() {
  const button = $("#saveWorkflowDefaults");
  const status = $("#workflowDefaultsStatus");
  const preferences = {
    ...state.preferences,
    tradeValuePercent: Number($("#defaultTradePercent").value),
    quickSalePercent: Number($("#defaultQuickSalePercent").value),
    sellingFeePercent: Number($("#defaultSellingFeePercent").value),
  };
  button.disabled = true;
  status.textContent = "Saving…";
  try {
    state.profile = await saveProfile(supabase, {
      displayName: profileDisplayName(),
      preferences,
    });
    state.preferences = state.profile.preferences;
    renderWorkflowDefaults();
    renderTrade();
    renderLiquidationPlanner();
    status.textContent = "Saved to your Mica account.";
  } catch (error) {
    status.textContent = error.message || "Could not save these defaults.";
  } finally {
    button.disabled = false;
  }
}

function openOnboarding() {
  if ($("#onboardingDialog")) return;
  const dialog = document.createElement("section");
  dialog.id = "onboardingDialog";
  dialog.className = "onboarding-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "onboardingTitle");
  dialog.innerHTML = `<form class="onboarding-card" id="onboardingForm"><p class="eyebrow">A simpler Mica from day one</p><h1 id="onboardingTitle">What will you use Mica for?</h1><p>Two quick choices set sensible defaults. You can change them later.</p><fieldset><legend>Main goal</legend><label><input type="radio" name="goal" value="collecting" checked><span><strong>Build my collection</strong><small>Track cards, sets, and value</small></span></label><label><input type="radio" name="goal" value="trading"><span><strong>Trade smarter</strong><small>Compare both sides quickly</small></span></label><label><input type="radio" name="goal" value="selling"><span><strong>Sell cards</strong><small>Track take-home and profit</small></span></label></fieldset><fieldset><legend>Experience</legend><label><input type="radio" name="experience" value="beginner" checked><span><strong>New collector</strong><small>Plain language and more guidance</small></span></label><label><input type="radio" name="experience" value="familiar"><span><strong>Familiar</strong><small>I know sets, condition, and grades</small></span></label><label><input type="radio" name="experience" value="professional"><span><strong>Full-time seller</strong><small>I manage inventory every day</small></span></label></fieldset><button class="primary" type="submit">Continue</button><p class="form-error" id="onboardingError" role="alert"></p></form>`;
  document.body.append(dialog);
  $("#onboardingForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector("button");
    button.disabled = true;
    try {
      state.preferences = {
        ...state.preferences,
        collectorGoal: data.get("goal"),
        experienceLevel: data.get("experience"),
      };
      applyWorkspaceMode(recommendedWorkspace(state.preferences), {
        userSelected: true,
      });
      dialog.querySelector(".onboarding-card").innerHTML =
        `<p class="eyebrow">Your 60-second tour</p><h1 id="onboardingTitle">Mica does the busywork</h1><ol class="onboarding-tour"><li><b>1</b><span><strong>Add a card</strong><small>Take a photo or search by name and the number printed at the bottom.</small></span></li><li><b>2</b><span><strong>Confirm only what matters</strong><small>Professionally graded or not, quantity, and the total amount you paid.</small></span></li><li><b>3</b><span><strong>Use simple next steps</strong><small>Mica explains prices, trades, grading, and selling in plain language.</small></span></li></ol><button class="primary" id="finishOnboarding" type="button">Start using Mica</button>`;
      $("#finishOnboarding").addEventListener("click", async () => {
        const finish = $("#finishOnboarding");
        finish.disabled = true;
        finish.textContent = "Saving…";
        try {
          state.profile = await saveProfile(supabase, {
            displayName: profileDisplayName(),
            preferences: state.preferences,
            completeOnboarding: true,
          });
          state.preferences = state.profile.preferences;
          renderWorkflowDefaults();
          dialog.remove();
          $("#main").focus();
        } catch (error) {
          finish.disabled = false;
          finish.textContent = error.message || "Try again";
        }
      });
    } catch (error) {
      $("#onboardingError").textContent = error.message || "Try again.";
      button.disabled = false;
    }
  });
}

async function retryAccountLoad() {
  if (state.accountLoading || !state.session) return;
  const ownerId = state.session.user.id;
  const loadVersion = ++sessionLoadVersion;
  state.accountLoading = true;
  renderCollection();
  try {
    const [items, watchlist, history, profile] = await Promise.all([
      loadPortfolio(supabase, ownerId),
      loadWatchlist(supabase, ownerId),
      loadPortfolioValuationHistory(supabase, ownerId)
        .then((data) => ({ data, error: null }))
        .catch((error) => ({ data: [], error })),
      loadProfile(supabase),
    ]);
    if (!accountRequestIsCurrent(ownerId, loadVersion)) return;
    state.items = items;
    state.watchlist = watchlist;
    state.portfolioHistory = history.data;
    state.profile = profile;
    state.preferences = profile.preferences;
    applyProfileDetailDefault();
    state.portfolioHistoryStatus = history.error ? "error" : "ready";
    state.storageStatus = "cloud";
    state.accountLoadError = "";
    state.accountLoading = false;
    renderCollection();
    renderInsights();
    renderTrade();
    toast("Your saved collection is available again");
    await Promise.all([refreshLivePricing(), refreshWatchlistPricing()]);
  } catch (error) {
    if (!accountRequestIsCurrent(ownerId, loadVersion)) return;
    state.items = [];
    state.watchlist = [];
    state.storageStatus = "error";
    state.accountLoadError = error.message || "Saved collection unavailable";
    state.accountLoading = false;
    renderCollection();
    renderInsights();
    renderTrade();
    toast("Your saved data is unchanged · Mica still cannot reach it");
  }
}

async function applySession(session) {
  const loadVersion = ++sessionLoadVersion;
  const ownerId = session?.user?.id || "";
  const previousOwnerId = state.session?.user?.id || "";
  state.session = session;
  if (previousOwnerId !== ownerId) {
    state.portfolioHistoryRange =
      session?.user?.app_metadata?.account_type === "showcase" ? "all" : "3m";
    state.intakeQueue = [];
    state.bulkSelected.clear();
    state.bulkMode = false;
    state.trade = {
      give: [],
      receive: [],
      giveCash: "0.00",
      receiveCash: "0.00",
      addingTo: "give",
      searchResults: [],
    };
  }
  state.portfolioHistoryMode =
    session?.user?.app_metadata?.account_type === "showcase"
      ? "value"
      : "return";
  $("#skipLink").setAttribute("href", session ? "#main" : "#authGate");
  document.body.classList.toggle("authenticated", Boolean(session));
  $("#authGate").hidden = Boolean(session);
  if (!session) {
    state.items = [];
    state.watchlist = [];
    state.portfolioHistory = [];
    state.portfolioHistoryStatus = "idle";
    state.detailId = null;
    state.detailCard = null;
    state.movementStatus = "idle";
    state.accountLoading = false;
    state.accountLoadError = "";
    state.profile = null;
    state.preferences = {
      tradeValuePercent: 90,
      quickSalePercent: 80,
      sellingFeePercent: 0,
      otherSellingCosts: 0,
      collectorGoal: "collecting",
      experienceLevel: "beginner",
    };
    state.trade = {
      give: [],
      receive: [],
      giveCash: "0.00",
      receiveCash: "0.00",
      addingTo: "give",
      searchResults: [],
    };
    chartInstance?.destroy();
    destroyPortfolioHistoryChart();
    return;
  }
  if (!appEventsBound) {
    bindEvents();
    appEventsBound = true;
  }
  ensureProfileAccount();
  state.items = [];
  state.watchlist = [];
  state.portfolioHistory = [];
  state.portfolioHistoryStatus = "loading";
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
    const [items, watchlist, history, profile] = await Promise.all([
      loadPortfolio(supabase, ownerId),
      loadWatchlist(supabase, ownerId),
      loadPortfolioValuationHistory(supabase, ownerId)
        .then((data) => ({ data, error: null }))
        .catch((error) => ({ data: [], error })),
      loadProfile(supabase),
    ]);
    if (!accountRequestIsCurrent(ownerId, loadVersion)) return;
    state.items = items;
    state.watchlist = watchlist;
    state.portfolioHistory = history.data;
    state.profile = profile;
    state.preferences = profile.preferences;
    applyProfileDetailDefault();
    state.portfolioHistoryStatus = history.error ? "error" : "ready";
    state.storageStatus = "cloud";
    state.accountLoading = false;
    state.accountLoadError = "";
    ensureProfileAccount();
    renderWorkflowDefaults();
    renderCollection();
    renderInsights();
    renderTrade();
    if (!profile.onboardingCompletedAt) openOnboarding();
    await Promise.all([refreshLivePricing(), refreshWatchlistPricing()]);
  } catch (error) {
    if (!accountRequestIsCurrent(ownerId, loadVersion)) return;
    state.items = [];
    state.watchlist = [];
    state.storageStatus = "error";
    state.accountLoading = false;
    state.accountLoadError = error.message || "Saved collection unavailable";
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
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION") return;
    setTimeout(async () => {
      await applySession(session);
      if (event === "PASSWORD_RECOVERY") openPasswordResetDialog();
    }, 0);
  });
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    authMessage(error.message, true);
    return;
  }
  await applySession(data.session);
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
window.addEventListener("online", () => {
  if (state.session && state.accountLoadError) void retryAccountLoad();
});
window
  .matchMedia("(display-mode: standalone)")
  .addEventListener?.("change", updateInstallControl);

applyUiTheme(uiTheme);
applyMotionPreference();
void bootstrap();
