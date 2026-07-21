import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import accountHandler from "../api/account.js";
import priceSyncHandler, {
  compatibleHistory,
  positionObservationRow,
  positionHistoryRows,
} from "../api/price-sync.js";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260716201558_portfolio_tracking.sql",
    import.meta.url,
  ),
  "utf8",
);
const watchlistMigration = await readFile(
  new URL(
    "../supabase/migrations/20260717190209_add_card_watchlist.sql",
    import.meta.url,
  ),
  "utf8",
);
const collectionTagsMigration = await readFile(
  new URL(
    "../supabase/migrations/20260717213000_add_collection_tags.sql",
    import.meta.url,
  ),
  "utf8",
);
const sealedMigration = await readFile(
  new URL(
    "../supabase/migrations/20260720195924_support_sealed_products.sql",
    import.meta.url,
  ),
  "utf8",
);
const sealedWatchlistMigration = await readFile(
  new URL(
    "../supabase/migrations/20260720201731_support_sealed_watchlist.sql",
    import.meta.url,
  ),
  "utf8",
);
const positionHistoryMigration = await readFile(
  new URL(
    "../supabase/migrations/20260720203942_add_position_price_history.sql",
    import.meta.url,
  ),
  "utf8",
);
const bulkOrganizeMigration = await readFile(
  new URL(
    "../supabase/migrations/20260720224500_bulk_organize_collection_items.sql",
    import.meta.url,
  ),
  "utf8",
);
const unknownBasisMigration = await readFile(
  new URL(
    "../supabase/migrations/20260720235900_support_unknown_acquisition_basis.sql",
    import.meta.url,
  ),
  "utf8",
);
const completeUnknownBasisMigration = await readFile(
  new URL(
    "../supabase/migrations/20260721000500_complete_unknown_acquisition_basis.sql",
    import.meta.url,
  ),
  "utf8",
);
const serviceWorker = await readFile(
  new URL("../sw.js", import.meta.url),
  "utf8",
);
const accountEndpoint = await readFile(
  new URL("../api/account.js", import.meta.url),
  "utf8",
);
const manifest = JSON.parse(
  await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8"),
);
const styles = await readFile(
  new URL("../styles.css", import.meta.url),
  "utf8",
);
const themes = await readFile(
  new URL("../themes.css", import.meta.url),
  "utf8",
);
const appShell = await readFile(
  new URL("../index.html", import.meta.url),
  "utf8",
);
const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");

test("offline runtime caching is bounded and APIs remain network-only", () => {
  assert.match(serviceWorker, /RUNTIME_LIMIT\s*=\s*80/);
  assert.match(serviceWorker, /keys\.slice\(0,keys\.length-RUNTIME_LIMIT\)/);
  assert.match(
    serviceWorker,
    /pathname\.startsWith\('\/api\/'\)[\s\S]{0,100}respondWith\(fetch\(event\.request\)\)/,
  );
  assert.match(
    serviceWorker,
    /request\.mode\s*===\s*'navigate'[\s\S]{0,400}caches\.match\('\.\/index\.html'\)/,
  );
});

test("installable app metadata uses a scoped standalone shell", () => {
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.orientation, "any");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.ok(manifest.icons.some((icon) => icon.purpose.includes("maskable")));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
});

test("motion preferences support device defaults and explicit reduction", () => {
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(
    styles,
    /body\[data-motion="reduce"\][\s\S]+animation-duration: \.01ms!important/,
  );
  assert.match(
    styles,
    /body\[data-motion="full"\] \.view[\s\S]+animation-duration: \.22s!important/,
  );
});

test("clean modern and analytics focused interfaces are selectable and persistent", () => {
  assert.match(appShell, /data-ui-theme-option="clean"/);
  assert.match(appShell, /data-ui-theme-option="analytics"/);
  assert.match(appShell, /themes\.css\?v=69/);
  assert.match(appSource, /localStorage\.setItem\('mica-ui-theme',theme\)/);
  assert.match(themes, /body\[data-ui-theme="clean"\]/);
  assert.match(themes, /body\[data-ui-theme="analytics"\]/);
  assert.match(serviceWorker, /mica-shell-v71/);
  assert.match(serviceWorker, /themes\.css\?v=69/);
});

test("large CSV imports are bounded, resumable, and protected from duplicate retries", () => {
  assert.match(appShell, /Up to 5,000 positions/);
  assert.doesNotMatch(appSource, /records\.slice\(0,\s*100\)/);
  assert.match(appSource, /runBoundedTasks\(pending/);
  assert.match(appSource, /concurrency:\s*4/);
  assert.match(appSource, /shouldStop:\(\)=>pauseRequested/);
  assert.match(appSource, /createImportedPosition/);
  assert.match(appSource, /idempotencyKey=await importRecordKey/);
  assert.match(appSource, /dataset\.lockClose=value\?'true':'false'/);
});

test("cross-app imports preserve unknown basis through owner-scoped FIFO", () => {
  assert.match(
    unknownBasisMigration,
    /purchase_lots[\s\S]+cost_basis_known boolean not null default true/,
  );
  assert.match(
    unknownBasisMigration,
    /purchase_lots[\s\S]+acquired_at_known boolean not null default true/,
  );
  assert.match(
    unknownBasisMigration,
    /create_collection_position[\s\S]+security invoker[\s\S]+auth\.uid\(\)/,
  );
  assert.match(
    unknownBasisMigration,
    /acquisitionCostKnown'[\s\S]+insert into public\.purchase_lots[\s\S]+basis_known/,
  );
  assert.match(
    unknownBasisMigration,
    /fifo_lot_allocations[\s\S]+cost_basis_known[\s\S]+lot\.cost_basis_known/,
  );
});

test("owners can complete unknown acquisition history without losing FIFO cents", () => {
  assert.match(
    completeUnknownBasisMigration,
    /complete_unknown_purchase_lot[\s\S]+security invoker[\s\S]+auth\.uid\(\)/,
  );
  assert.match(
    completeUnknownBasisMigration,
    /purchase_lot_id=target_lot\.id[\s\S]+cost_basis_known=true/,
  );
  assert.match(
    completeUnknownBasisMigration,
    /sold_amount-allocated_so_far[\s\S]+allocated_cost=allocation_amount,cost_basis_known=true/,
  );
  assert.match(
    completeUnknownBasisMigration,
    /revoke all on function public\.complete_unknown_purchase_lot[\s\S]+from public,anon/,
  );
  assert.match(
    completeUnknownBasisMigration,
    /where lot\.id=p_purchase_lot_id and lot\.user_id=owner_id/,
  );
});

test("collection, transaction, lot, and allocation policies bind every row to auth.uid", () => {
  for (const policy of [
    "collection transactions own rows",
    "purchase lots own rows",
    "fifo allocations own rows",
  ]) {
    const expression = new RegExp(
      `create policy "${policy}"[\\s\\S]{0,220}auth\\.uid\\(\\)\\)=user_id[\\s\\S]{0,120}auth\\.uid\\(\\)\\)=user_id`,
      "i",
    );
    assert.match(migration, expression);
  }
});

test("portfolio mutation functions run as invoker and derive the owner from auth.uid", () => {
  assert.match(
    migration,
    /create or replace function public\.create_collection_position[\s\S]+?security invoker[\s\S]+?auth\.uid\(\)/i,
  );
  assert.match(
    migration,
    /create or replace function public\.record_collection_purchase[\s\S]+?security invoker[\s\S]+?auth\.uid\(\)/i,
  );
  assert.match(
    migration,
    /create or replace function public\.record_collection_sale[\s\S]+?security invoker[\s\S]+?auth\.uid\(\)/i,
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.(create_collection_position|record_collection_purchase|record_collection_sale)[\s\S]+?security definer/i,
  );
});

test("bulk organization is owner-scoped and cannot mutate financial or identity fields", () => {
  assert.match(
    bulkOrganizeMigration,
    /create or replace function public\.bulk_organize_collection_items[\s\S]+security invoker[\s\S]+item\.user_id=\(select auth\.uid\(\)\)/i,
  );
  assert.match(
    bulkOrganizeMigration,
    /revoke all on function public\.bulk_organize_collection_items[\s\S]+from public,anon/i,
  );
  const updateClause =
    bulkOrganizeMigration.match(
      /update public\.collection_items[\s\S]+?where item\.user_id/i,
    )?.[0] || "";
  for (const protectedField of [
    "quantity",
    "card_id",
    "variant_id",
    "grader",
    "grade",
    "currency",
    "manual_value",
  ])
    assert.doesNotMatch(updateClause, new RegExp(`\\b${protectedField}\\s*=`));
});

test("additional purchases preserve a separate lot and reject future dates", () => {
  assert.match(
    migration,
    /record_collection_purchase[\s\S]+?future_acquisition_date[\s\S]+?insert into public\.purchase_lots/i,
  );
});

test("watchlist rows are private, authenticated, and protected on every mutation", () => {
  for (const action of ["select", "insert", "update", "delete"]) {
    assert.match(
      watchlistMigration,
      new RegExp(
        `create policy "watchlist owners can ${action}"[\\s\\S]{0,180}to authenticated[\\s\\S]{0,180}auth\\.uid\\(\\)\\)=user_id`,
        "i",
      ),
    );
  }
  assert.match(
    watchlistMigration,
    /watchlist owners can update[\s\S]{0,260}using \(\(select auth\.uid\(\)\)=user_id\)[\s\S]{0,100}with check \(\(select auth\.uid\(\)\)=user_id\)/i,
  );
  assert.match(watchlistMigration, /revoke all[\s\S]+from anon/i);
  assert.match(
    watchlistMigration,
    /grant select,insert,update,delete[\s\S]+to authenticated/i,
  );
});

test("portfolio tags default safely and support indexed favorite filtering", () => {
  assert.match(
    collectionTagsMigration,
    /add column if not exists tags text\[\] not null default '\{\}'::text\[\]/i,
  );
  assert.match(
    collectionTagsMigration,
    /create index if not exists collection_items_tags_gin_idx[\s\S]+using gin\s*\(tags\)/i,
  );
});

test("sealed positions reuse the invoker-owned portfolio instead of a public side table", () => {
  assert.match(
    sealedMigration,
    /collection_items_card_state_check[\s\S]+card_state in \('raw','graded','sealed'\)/i,
  );
  assert.match(
    sealedMigration,
    /card_state='sealed' and raw_condition is null and grader is null and grade is null/i,
  );
  assert.match(
    sealedMigration,
    /create or replace function public\.create_collection_position[\s\S]+security invoker[\s\S]+auth\.uid\(\)/i,
  );
  assert.doesNotMatch(sealedMigration, /create table/i);
  assert.doesNotMatch(sealedMigration, /security definer/i);
});

test("sealed watch targets reuse the existing owner-protected watchlist", () => {
  assert.match(
    sealedWatchlistMigration,
    /card_watchlist_card_state_check[\s\S]+card_state in \('raw','graded','sealed'\)/i,
  );
  assert.match(
    sealedWatchlistMigration,
    /card_state='sealed' and raw_condition is null and grader is null and grade is null/i,
  );
  assert.doesNotMatch(sealedWatchlistMigration, /create table/i);
  assert.doesNotMatch(sealedWatchlistMigration, /grant |create policy/i);
});

test("durable position history is owner-readable and service-writable only", () => {
  assert.match(
    positionHistoryMigration,
    /alter table public\.position_price_observations enable row level security/i,
  );
  assert.match(
    positionHistoryMigration,
    /create policy "position price history owners can read"[\s\S]+to authenticated[\s\S]+\(select auth\.uid\(\)\)=user_id/i,
  );
  assert.match(
    positionHistoryMigration,
    /revoke all on public\.position_price_observations from public,anon,authenticated/i,
  );
  assert.match(
    positionHistoryMigration,
    /grant select on public\.position_price_observations to authenticated/i,
  );
  assert.match(
    positionHistoryMigration,
    /get_portfolio_price_history[\s\S]+security invoker/i,
  );
  assert.doesNotMatch(positionHistoryMigration, /security definer/i);
});

test("scheduled history keeps only the owned condition or grade context", () => {
  const raw = {
    id: "position-1",
    user_id: "user-1",
    identity_snapshot: { variant: "Holofoil" },
    card_state: "raw",
    raw_condition: "near_mint",
    grader: null,
    grade: null,
    currency: "USD",
  };
  const points = [
    {
      provider: "ebay",
      providerVariantId: "nm",
      currency: "USD",
      condition: "Near Mint",
      finish: "holofoil",
      gradingCompany: null,
      grade: null,
      amount: 100,
      recordedAt: "2026-07-01T00:00:00Z",
      granularity: "day",
    },
    {
      provider: "ebay",
      providerVariantId: "lp",
      currency: "USD",
      condition: "Lightly Played",
      finish: "holofoil",
      gradingCompany: null,
      grade: null,
      amount: 80,
      recordedAt: "2026-07-01T00:00:00Z",
      granularity: "day",
    },
    {
      provider: "ebay",
      providerVariantId: "psa10",
      currency: "USD",
      condition: null,
      finish: "holofoil",
      gradingCompany: "PSA",
      grade: "10",
      amount: 1000,
      recordedAt: "2026-07-01T00:00:00Z",
      granularity: "day",
    },
  ];
  assert.deepEqual(compatibleHistory(raw, points), [points[0]]);
  const row = positionObservationRow(raw, points[0]);
  assert.equal(row.user_id, "user-1");
  assert.equal(row.collection_item_id, "position-1");
  assert.equal(row.raw_condition, "near_mint");
  assert.equal(row.grader, "");
  assert.equal(row.amount, 100);
});

test("scheduled history persists current pricing without an internal catalog UUID", () => {
  const position = {
    id: "search-position",
    user_id: "user-1",
    card_id: null,
    variant_id: null,
    identity_snapshot: {
      providerCardId: "tcgdex:en:base1-4",
      variant: "Holofoil",
    },
    card_state: "raw",
    raw_condition: "near_mint",
    grader: null,
    grade: null,
    currency: "USD",
  };
  const normalized = {
    quotes: [
      {
        provider: "tcgplayer",
        providerVariantId: "4521:tcgplayer:Near Mint:Holofoil::",
        currency: "USD",
        condition: "Near Mint",
        finish: "holofoil",
        gradingCompany: null,
        grade: null,
        priceType: "market",
        amount: 285,
        observedAt: "2026-07-20T00:00:00Z",
        quality: { aggregator: "pkmnprices" },
      },
    ],
    history: [],
  };
  const result = positionHistoryRows(position, normalized);
  assert.equal(result.quote.amount, 285);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].collection_item_id, "search-position");
  assert.equal(result.rows[0].provider, "tcgplayer");
  assert.equal(result.rows[0].valuation_type, "market");
});

test("scheduled price synchronization rejects unauthenticated requests before provider access", async () => {
  const original = { ...process.env };
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "server-secret",
    PKMNPRICES_API_KEY: "provider-secret",
    PRICE_SYNC_SECRET: "cron-secret",
  });
  let body;
  const response = {
    setHeader() {},
    status(status) {
      this.statusCode = status;
      return this;
    },
    json(value) {
      body = value;
      return value;
    },
  };
  try {
    await priceSyncHandler({ method: "GET", headers: {} }, response);
    assert.equal(response.statusCode, 401);
    assert.equal(body.error, "Unauthorized");
  } finally {
    process.env = original;
  }
});

test("manual price synchronization requires an authenticated administrator", async () => {
  const original = { ...process.env };
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "server-secret",
    PKMNPRICES_API_KEY: "provider-secret",
    PRICE_SYNC_SECRET: "cron-secret",
  });
  let body;
  const response = {
    setHeader() {},
    status(status) {
      this.statusCode = status;
      return this;
    },
    json(value) {
      body = value;
      return value;
    },
  };
  try {
    await priceSyncHandler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 401);
    assert.equal(body.error, "Authentication required");
  } finally {
    process.env = original;
  }
});

test("account deletion rejects unauthenticated requests before user lookup", async () => {
  const original = { ...process.env };
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "server-secret",
  });
  let body;
  const response = {
    setHeader() {},
    status(status) {
      this.statusCode = status;
      return this;
    },
    json(value) {
      body = value;
      return value;
    },
  };
  try {
    await accountHandler({ method: "DELETE", headers: {} }, response);
    assert.equal(response.statusCode, 401);
    assert.equal(body.error, "Authentication required");
  } finally {
    process.env = original;
  }
});

test("account deletion verifies the bearer identity and matching email before admin deletion", () => {
  assert.match(
    accountEndpoint,
    /auth\.getUser\(bearerToken\)[\s\S]+confirmation[^]*identity\.user\.email[^]*auth\.admin\.deleteUser\(identity\.user\.id\)/,
  );
  assert.match(accountEndpoint, /request\.method !== "DELETE"/);
  assert.doesNotMatch(accountEndpoint, /supabaseSecretKey[^]*response\.json/);
});
