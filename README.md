# CardVault — Pokémon Inventory

Snap a photo of your Pokémon cards, build a digital binder, and check **live market pricing** before you sell. Built as an installable, mobile-first **PWA** so it runs on an iPhone (Safari → Share → *Add to Home Screen*) and deploys anywhere static — no build step, no API keys.

## Why a PWA (and not native iOS)

The mission asked for an iPhone App Store app. Native Swift/SwiftUI requires a Mac + Xcode + a paid Apple Developer account, none of which exist in this build environment. A PWA delivers the **exact same vendor workflow today** — installable, full-screen, camera access, offline binder — and can be wrapped for the App Store later (e.g. via a WKWebView shell or Capacitor) without rewriting the product.

## Features

- **📸 Snap & save** — capture a card with the phone camera; the photo is downscaled and saved with the card.
- **☁️ Cloud sync (Supabase)** — your binder is stored in Supabase and synced across sessions; IndexedDB is kept as an offline cache so the app keeps working with no connection and reconciles when you're back online.
- **🗂️ Digital binder** — every card you add is saved to your binder (cloud + on-device).
- **🔎 Instant inventory search** — filter your binder by name, set, or card number; live totals (count, est. value, sets).
- **💲 Live pricing** — market / low / high pulled from [pokemontcg.io](https://pokemontcg.io), which returns real **TCGPlayer** prices.
- **✅ Price-matched comps** — recent listings are filtered to **within ±15% of the market average**, so out-of-place prices are excluded (the core vendor requirement).
- **📈 Demand signal** + last-sold (market proxy) + direct TCGPlayer listing links.

### Honest limitations
- **Last sold** uses the current market price as a proxy — no free API exposes true sold comps.
- **Population** (PSA) has no free API and is marked *Coming soon*.
- **Card recognition** from the photo is not automated; you snap the photo, then find the exact card in the catalog (always reliable, even on worn/foil cards).

## Run locally

It's a static site — just serve the folder over HTTP (the camera + service worker need `http://localhost` or HTTPS, not `file://`):

```bash
npx serve .
# or
python -m http.server 8000
```

Then open the URL on your phone (same network) or desktop.

## Deploy

Zero-config static deploy. On **Vercel**: import the repo and deploy — no settings needed. Works the same on GitHub Pages or Netlify. HTTPS (which all three provide) is required for the camera on iOS Safari.

## Files

| File | Purpose |
|---|---|
| `index.html` | App shell & views (binder / add / detail) |
| `styles.css` | Visual design (dark, mobile-first) |
| `app.js` | Logic: Supabase cloud sync + IndexedDB cache, camera capture, pokemontcg.io search, pricing, ±15% comp filter |
| `index.html` | App shell; also boots the Supabase client (public RLS-protected key, hard-coded — no env vars needed on Vercel) |
| `manifest.webmanifest` | PWA install metadata |
| `sw.js` | Service worker — caches the shell, always fetches pricing fresh |
| `icons/icon.svg` | App icon |
| `supabase/schema.sql` | Cloud schema (`app_c14bef07_cards`) with RLS — see below |

## Supabase backend

The app is wired to Supabase. The connection values in `index.html` are **public** and protected by Row Level Security, so they're safe to ship and require no Vercel configuration.

- **Schema:** a single table `app_c14bef07_cards` (namespaced to keep this app's data isolated from others sharing the project). RLS is enabled.
- **How a binder is owned (secure):** there is no login screen, but the app uses **Supabase Anonymous Sign-Ins** — each device silently gets a real auth user, and the RLS policy keys every row to `auth.uid()`. Ownership is enforced **server-side**, so one device can never read or write another's rows. The session is persisted, so a device keeps the same binder across visits. To add full accounts later (email/social), no schema change is needed — just add a login UI; the same `auth.uid()` policy keeps working.
- **⚠️ One dashboard toggle required:** enable **Authentication → Sign In / Providers → Anonymous Sign-ins**. Until that's on, the app runs **local-only** (IndexedDB) and never exposes data — it just won't sync to the cloud.
- **Apply the schema:** ACE applies `supabase/schema.sql` automatically after a build. To run it manually, open the Supabase dashboard → **SQL Editor**, paste the file, and run it (it's idempotent — safe to re-run). Tables may not exist until this is applied.

No tracking. Your cards and photos sync to your Supabase project under your device's own auth user, and are cached on-device for offline use.
