import { createClient } from "@supabase/supabase-js";
import { serverEnvironment } from "./env.js";

function delay(ms, signal) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const stop = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", stop);
      resolve();
    }, ms);
    signal?.addEventListener("abort", stop, { once: true });
  });
}

function denied(code, status = 503) {
  return Object.assign(new Error("Provider request allowance unavailable"), {
    code,
    status,
  });
}

export function requestCreditBound(input) {
  const url = new URL(input);
  if (url.origin !== "https://api.pkmnprices.com")
    throw denied("invalid_provider_url");
  if (/^\/v1\/(?:cards|sealed)\/\d+$/.test(url.pathname)) return 1;
  const history = /^\/v1\/(?:cards|sealed)\/\d+\/prices\/history$/.test(url.pathname);
  const list = /^\/v1\/(?:cards|sealed)$/.test(url.pathname);
  const listings =
    /^\/v1\/cards\/\d+\/listings\/(?:ebay|tcgplayer|cardmarket)$/.test(
      url.pathname,
    );
  const amount = Number(url.searchParams.get(list ? "per_page" : "limit"));
  if (
    (!history && !list && !listings) ||
    !Number.isInteger(amount) ||
    amount < 1 ||
    amount > (history ? 365 : 20)
  )
    throw denied("unbounded_provider_request");
  return amount;
}

export async function claimPkmnPricesCredits(database, credits, signal) {
  if (!Number.isInteger(credits) || credits < 1 || credits > 365)
    throw denied("invalid_provider_credit_bound");
  // ponytail: one slot per 1.25s with a 10s outbound deadline, leaving delivery-lag
  // headroom below the account-wide
  // 60/min ceiling. Reuse the existing ledger and compare-and-set rate fields.
  for (let attempt = 0; attempt < 30; attempt++) {
    signal?.throwIfAborted();
    const initialized = await database.rpc("reserve_provider_daily_credits", {
      p_provider: "pkmnprices",
      p_daily_budget: 20_000,
      p_requested: 0,
    });
    if (initialized.error) throw denied("provider_budget_unavailable");
    const read = await database
      .from("provider_sync_status")
      .select("updated_at,rate_limit_resets_at")
      .eq("provider", "pkmnprices")
      .single();
    if (read.error || !read.data)
      throw denied("provider_rate_limit_unavailable");
    const now = Date.parse(read.data.updated_at),
      reset = read.data.rate_limit_resets_at;
    if (
      !Number.isFinite(now) ||
      (reset !== null && !Number.isFinite(Date.parse(reset)))
    )
      throw denied("provider_rate_limit_unavailable");
    const wait = reset === null ? 0 : Date.parse(reset) - now;
    if (wait > 0) {
      await delay(Math.min(wait, 1250), signal);
      continue;
    }
    let update = database
      .from("provider_sync_status")
      .update({
        rate_limit_remaining: 0,
        rate_limit_resets_at: new Date(now + 1250).toISOString(),
      })
      .eq("provider", "pkmnprices");
    update =
      reset === null
        ? update.is("rate_limit_resets_at", null)
        : update.eq("rate_limit_resets_at", reset);
    const claimed = await update.select("provider");
    if (claimed.error) throw denied("provider_rate_limit_unavailable");
    if (claimed.data?.length !== 1) continue;
    signal?.throwIfAborted();
    const reserved = await database.rpc("reserve_provider_daily_credits", {
      p_provider: "pkmnprices",
      p_daily_budget: 20_000,
      p_requested: credits,
    });
    if (reserved.error || Number(reserved.data) !== credits)
      throw denied("provider_daily_budget_reached", 429);
    signal?.throwIfAborted();
    return;
  }
  throw denied("provider_rate_limited", 429);
}

export const pkmnPricesRequests = {
  cache: new Map(),
  pending: new Map(),
  async authenticate(request, response, config = serverEnvironment()) {
    response.setHeader("Cache-Control", "no-store");
    const token = String(request.headers?.authorization || "").match(
      /^Bearer (\S+)$/,
    )?.[1];
    if (!token) {
      response.status(401).json({ error: "Authentication required" });
      return false;
    }
    if (!config.supabaseUrl || !config.supabaseSecretKey) {
      response.status(503).json({ error: "Secure pricing unavailable" });
      return false;
    }
    try {
      const database = createClient(
        config.supabaseUrl,
        config.supabaseSecretKey,
        {
          auth: { persistSession: false, autoRefreshToken: false },
        },
      );
      const auth = await database.auth.getUser(token);
      if (!auth.error && auth.data?.user) return true;
    } catch {
      /* Fail closed without exposing authentication details. */
    }
    response.status(401).json({ error: "Authentication required" });
    return false;
  },
  async claim(url, signal, config = serverEnvironment()) {
    const credits = requestCreditBound(url);
    if (
      config.pkmnpricesPlan !== "pro" ||
      !config.supabaseUrl ||
      !config.supabaseSecretKey
    )
      throw denied("provider_budget_unconfigured");
    const database = createClient(
      config.supabaseUrl,
      config.supabaseSecretKey,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    await claimPkmnPricesCredits(database, credits, signal);
  },
};
