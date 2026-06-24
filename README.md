# CardVault — Pokémon Inventory

Snap a photo of your Pokémon cards, build a digital binder, and check **live market pricing** before you sell. Built as an installable, mobile-first **PWA** so it runs on an iPhone (Safari → Share → *Add to Home Screen*) and deploys anywhere static — no build step, no API keys.

## Why a PWA (and not native iOS)

The mission asked for an iPhone App Store app. Native Swift/SwiftUI requires a Mac + Xcode + a paid Apple Developer account, none of which exist in this build environment. A PWA delivers the **exact same vendor workflow today** — installable, full-screen, camera access, offline binder — and can be wrapped for the App Store later (e.g. via a WKWebView shell or Capacitor) without rewriting the product.

## Features

- **📸 Snap & save** — capture a card with the phone camera; the photo is downscaled and saved locally with the card.
- **🗂️ Digital binder** — every card you add is stored on-device (IndexedDB). Works offline.
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
| `app.js` | Logic: IndexedDB storage, camera capture, pokemontcg.io search, pricing, ±15% comp filter |
| `manifest.webmanifest` | PWA install metadata |
| `sw.js` | Service worker — caches the shell, always fetches pricing fresh |
| `icons/icon.svg` | App icon |

No tracking, no accounts, no secrets. All your cards and photos stay on your device.
