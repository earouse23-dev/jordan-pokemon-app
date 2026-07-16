# Codex handoff: fix card search and run full friction audit

Use this prompt to hand the work to Codex.

```text
You are working in:
C:\Users\ellio\Documents\Codex\jordan-pokemon-app

Goal:
Turn Mica into a Pokemon collector tool that is dramatically easier to use than competing trackers. Start by fixing catalog search so users can type any real-world card detail and get the exact printing quickly. Then perform a full product/friction audit and implement high-impact improvements.

Current product setup:
- TCGdex is the free catalog/search source.
- PkmnPrices is the chosen paid pricing provider.
- `.env` has `PKMNPRICES_API_KEY` locally. Do not print, commit, or expose it.
- `api/cards.js` now prefers PkmnPrices for pricing/history and falls back to TCGdex.
- `api/catalog.js` currently calls TCGdex search with only `q` as a `name` query.
- The app is a dependency-free static PWA with Vercel serverless API routes.

Important constraints:
- Do not scrape marketplaces.
- Keep all provider keys server-side only.
- Do not weaken truthful pricing states. Missing price remains unknown, not $0.
- Do not silently substitute a different card, finish, condition, language, or grade.
- Preserve the provider-neutral normalized quote schema.
- Follow the existing app style: mobile-first, dense but calm collector ledger, no marketing landing page.
- Use `npm.cmd ...` on Windows if PowerShell blocks `npm.ps1`.

Primary bug:
Search only works when the user types a simple card name. It fails for natural Pokemon collector searches such as collector number, set name, set number, or mixed detail queries.

Evidence collected on 2026-07-15:
- Current `searchTcgdexCards(query, language, limit)` sends `search.searchParams.set('name', query)`.
- API checks:
  - `Mew ex` returned 12 TCGdex results, but the desired 151/165 card was not near the top.
  - `151/165` returned 0 through the current app search path.
  - `Mew ex 151/165` returned 0 through the current app search path.
  - `Pikachu 151` returned 0 through the current app search path.
  - `Charizard 4/102` returned 0 through the current app search path.
  - `Greninja 214/167` returned 0 through the current app search path.
- TCGdex can find exact Mew ex 151/165 if searched correctly:
  - `https://api.tcgdex.net/v2/en/cards?name=Mew%20ex&localId=151&pagination:itemsPerPage=12` returns 1 result.
  - Exact result id is `sv03.5-151`, localId `151`, name `Mew ex`, set `151`.
  - The local seed/demo id `sv3pt5-151` is not the same as TCGdex provider id `sv03.5-151`; normalize provider IDs instead of guessing.
- In the local static browser fallback, seeded cards can be found by `Mew ex 151/165`, `151/165`, `Charizard 4/102`, and `Greninja 214/167` because offline matching searches local fields. That masks the live/provider-backed search problem.

Code pointers:
- `api/catalog.js`: validates query and calls `searchTcgdexCards(query, language, limit)`.
- `lib/providers/tcgdex.js`: `searchTcgdexCards` currently only passes `name=query`.
- `app.js`: `bindQuickCardSearch()` and `openManualSearch()` call `/api/catalog?q=...`.
- `lib/core.js`: `matchesSearch()` already searches local name/set/number/variant/rarity/tags and can inspire token matching.
- `index.html`: Add flow copy currently says "or search by name", which reinforces the bad behavior.

Required search improvements:
1. Replace name-only search with smart catalog search.
2. Parse natural queries into useful parts:
   - Pokemon/card name terms: `mew ex`, `charizard`, `greninja ex`.
   - Collector/local number: `151`, `151/165`, `4/102`, `214/167`, `GG44/GG70`.
   - Set names and aliases: `151`, `Base Set`, `Evolving Skies`, `Crown Zenith`, `Twilight Masquerade`.
   - Set codes/provider ids when present.
   - Rarity/finish hints: holo, reverse, full art, SIR, promo, 1st edition, shadowless.
   - Language selection.
3. For TCGdex:
   - Use `localId` when collector number is present.
   - Use `name` only for the name part, not the full mixed query.
   - Fetch enough candidates, then rank locally using name, set, localId, full number, image availability, rarity, and language.
   - When query includes a set name/alias, score cards from that set higher.
   - When query is number-only, return number matches with enough set/name context to choose.
4. Increase result quality:
   - Exact localId + matching name should rank first.
   - Exact set + exact localId should outrank broad name matches.
   - Exact name + set alias should outrank newer unrelated printings.
   - Do not hide viable results just because the first provider call returned a small page.
5. Update both search surfaces:
   - Main Add Card search.
   - Manual Search sheet.
6. Improve user-facing copy:
   - Replace "or search by name" with copy that invites name, set, number, or details.
   - Placeholder examples should include `Mew ex 151/165`, `Charizard Base Set 4/102`, and `Pikachu 151`.
7. Add tests:
   - `Mew ex 151/165` returns TCGdex `sv03.5-151` first.
   - `151/165` returns cards with localId 151 and includes Mew ex from 151.
   - `Charizard 4/102` returns Base Set Charizard first or near first.
   - `Greninja 214/167` returns Twilight Masquerade Greninja ex first or near first.
   - `Pikachu 151` behaves as `Pikachu` in set `151`, not localId 151.
   - Japanese/language dropdown still works.
   - No provider secrets are serialized.

Full app friction audit:
After search is fixed, run a full product scan. Use browser automation on local and deployed app if possible. Test at mobile widths around 320x700, 390x844, tablet, and desktop.

Audit and improve:
1. Add-card journey:
   - Can a collector get from physical card to saved record in under a minute?
   - Are scan, photo upload, manual search, result review, and add/save flows obvious?
   - Are ownership fields optional until needed?
   - Does the user always understand whether they are viewing a card, adding a copy, or editing an owned copy?
2. Search and discovery:
   - Search should support name, set, number, language, rarity, finish, and mixed queries.
   - Results should show enough identifying details: image, name, set, collector number, rarity, language, finish, provider id when useful.
   - Avoid forcing users to search through dozens of Mews/Charizards manually.
   - Provide filters or chips for set, language, finish, and era when results are broad.
3. Pricing trust:
   - Fix confusing states where a large preview price appears while market panel says loading.
   - Clearly separate preview/demo, live, loading, unavailable, provider-error, stale, and plan-limited states.
   - Show source, timestamp, condition/finish, and why a price is unavailable.
   - Avoid showing "Synced" if provider pricing/catalog sync is not actually current.
4. PkmnPrices integration:
   - Verify current-price, history, and sales endpoints with the real local key without exposing it.
   - If sold listings require a higher plan, show an honest plan-limited state.
   - Store/return PkmnPrices IDs when found so repeated searches avoid fuzzy matching.
5. Mobile ergonomics:
   - Increase all practical tap targets to at least 44px high/wide where possible.
   - Quick audit found small targets: sync status, avatar, detail back, Edit.
   - Verify no horizontal overflow at 320px and 390px.
   - Ensure sticky nav, sheets, and bottom controls do not cover content.
6. Accessibility:
   - Inactive views are hidden by `display:none` but do not use `hidden`/`aria-hidden`; verify keyboard and screen-reader behavior.
   - Ensure dynamic search results and provider states announce correctly.
   - Add explicit accessible names where buttons rely on visual text/icons.
7. Navigation/context:
   - Test detail -> Add card -> back behavior.
   - Test bottom nav from detail and sheets.
   - Make sure users do not lose search text/results when opening and backing out of a detail.
8. Collection management:
   - Inline edit, duplicate copy, condition/grade editing, sort/filter, saved views, export/import should be smooth.
   - CSV import currently looks validation-only; decide if MVP needs real import or clearer "preview only" copy.
9. Competitive edge:
   - Add features that make this feel like a serious Pokemon tool:
     - exact-printing confidence and "why this match" details;
     - set/number-first search;
     - owned vs wishlist/watchlist separation;
     - price coverage health per card;
     - recently added/search history;
     - favorites/watchlist;
     - provider freshness badges;
     - collection value breakdown by set, era, rarity, graded/raw;
     - card detail links to source pages where licensed;
     - "needs review" bucket for uncertain matches/unpriced cards.
10. QA:
   - Run `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`.
   - Add targeted unit tests for search parsing/ranking.
   - Add browser/E2E checks for search, result selection, card detail, add-to-library, and pricing states.
   - Document any provider plan limitations.

Deliverables:
- Implement the search and high-impact friction fixes.
- Update docs/runbooks where provider/search behavior changes.
- Provide a concise summary of what changed, what was verified, and any remaining blockers.
- Do not commit or push unless explicitly asked.
```
