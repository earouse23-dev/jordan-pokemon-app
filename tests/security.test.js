import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import accountHandler from "../api/account.js";
import priceSyncHandler from "../api/price-sync.js";

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
