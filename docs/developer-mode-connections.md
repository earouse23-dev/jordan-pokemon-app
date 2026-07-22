# Developer-mode connections

Mica keeps incomplete external services honest: the product workflow can be visible before launch, but the interface must say what is connected and must never fabricate an identity, grade, price, sale, or alert.

## Ready without a paid provider

- **Built-in device camera** uses `navigator.mediaDevices.getUserMedia` over HTTPS for AI card scans, automatic card capture, card-back grading evidence, and receipt/order scans. The browser owns the Allow/Block permission prompt. Mica shows a live preview, prefers the rear camera, supports camera switching and compatible device lights, and stops every camera track when the user closes or continues.
- **Automatic photo capture** checks brightness, scene contrast, and frame-to-frame movement, then captures after the card is steady. Every camera path includes review, retake, and an explicitly labeled saved-photo fallback.

## Vercel AI Gateway

One server connection activates card identification, raw grade estimation, and receipt/order extraction.

- Production authentication: Vercel OIDC.
- Local/non-Vercel fallback: server-only `AI_GATEWAY_API_KEY`.
- Optional model override: `VISION_MODEL` (default `openai/gpt-5-mini`, verified against the live Gateway catalog).
- Required before use: complete Vercel AI Gateway billing verification.
- Privacy boundary: originals are sent once for analysis, `store: false` is used, and results require user confirmation.

A general ChatGPT-style console is not required for these workflows. The scanner provides a narrower interface, structured output, catalog confirmation, and clearer failure states.

## PkmnPrices Pro

The provider adapter and UI housing are already present. To activate the expanded paths:

1. Upgrade the PkmnPrices account.
2. Store `PKMNPRICES_API_KEY` only in server-side Vercel environment variables.
3. Set `PKMNPRICES_PLAN=pro` for Production, Preview, and Development.
4. Redeploy so the new environment configuration is loaded.

The Pro paths preserve raw, graded, sealed, grader, grade, variant, condition, currency, provider, and observation time. They include the prepared 365-day history, graded ladder, offers, sealed and Japanese coverage, and eBay sold evidence when returned by the licensed provider.

## Navigation consolidation

The desktop sidebar is intentionally limited to Dashboard, Collection, Add & Scan, Analytics, Trade Check, Business, and Settings. Former shortcuts remain inside these workspaces:

- Collection: raw, graded, sealed, favorites, needs review, for sale, watchlist, and sets.
- Add & Scan: automatic camera, AI scan, saved photo, receipt extraction, exact search, and sealed search.
- Analytics and Business: portfolio, market movement, sales/purchases, seller planning, and reports.
- Settings: appearance, workspace depth, import/export, reports, automation connections, alerts, and privacy.
