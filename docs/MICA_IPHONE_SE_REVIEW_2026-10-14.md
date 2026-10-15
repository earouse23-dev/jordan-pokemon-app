# iPhone SE recording review — 14 October 2026

Owner device: iPhone SE (3rd generation); owner reports latest iOS, exact version not supplied. Scope: core-app client demo. Legal/email/public rollout and App Store submission remain deferred.

## Evidence and causes

The supplied 107.8-second recording was inspected locally at five-second intervals after native AVFoundation conversion. No video-analysis skill was found in the available skill locations; no video/image was uploaded to an external processor or committed. Around 20–25 seconds the current price waits behind history loading; around 95–105 seconds a just-saved copy returns to Checking despite its preview having a price. The portrait image, full-size listing title, source paragraph and secondary controls crowd out the graph on a 375-pixel phone.

The detail endpoint awaited complete history before returning its current quote. Portfolio pricing also requested a USD-only provider URL while preview pricing requested the full Pro card, creating separate durable cache entries. Finally, a new owned copy did not inherit its already validated preview quotes. The related backend cache is already durable; an application API request is not automatically a paid provider request. Current response expiry now uses a rolling 24 hours rather than midnight UTC. Historical records remain retained, never deleted with current-quote expiry.

## Changes

- Return/display current preview pricing first, then load retained history separately; a failed history request preserves the current price.
- Share the Pro full-card request across detail and portfolio paths. Keep currency/printing/condition/grade selection exact.
- Reuse owner/context-scoped preview prices and carry validated quotes into a newly saved copy. Fresh complete owned pricing skips another detail request. Durable provider responses and saved portfolio pricing remain the server persistence layer; the 50-entry preview handoff map is a UI accelerator, not a replacement database.
- On mobile, place a smaller photo beside the name and large green price. Keep the full copyable listing title with secondary typography. Reduce page side margins, enlarge both card and portfolio charts to 300px, remove double bottom padding, and put statistics, provenance, printing and grading tools behind existing disclosures. Preserve source/condition/currency warnings and secondary capabilities.
- Show the earliest available chart date. The [provider history endpoint](https://www.pkmnprices.com/docs/price-history) supplies raw daily aggregates over at most 365 days; it does not guarantee a full year of source coverage. Read-only retained-cache inspection found complete retained series beginning April 13, matching the recording's displayed boundary, but hashed cache keys do not independently establish which card each series belongs to. No paid backfill was run to manufacture a stronger coverage claim. All time continues to mean all available matching records.

## Verification

Added checks cover current price appearing while history is held, no duplicate request on reopen, owner-isolated preview caches, real save/reload handoff before portfolio refresh, 375×667 layout and chart width, and 24-hour expiry across midnight with historical data preserved. Focused new browser checks: nine passes across desktop/mobile Chromium and mobile WebKit. The first complete run passed 340 browser checks with twelve failures caused by moved metadata hooks and shortened explanatory copy; those were corrected with the facts preserved inside disclosures. All twelve corrected cases subsequently passed. Final whole-candidate checks and publication are recorded below when complete.

Automatic capture did not pass the owner's physical-phone check. The owner accepts manual capture for this milestone. A native wrapper does not automatically provide Apple document scanning; native automatic capture needs a separately implemented and physically tested capture integration. No native platform change or App Store action occurred.

UI references: [Apple adaptive layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout). No dependency, paid service or provider-budget increase was introduced.

## Published verification

Source `1902cc48c0f5b263dd2fcfa9d11758e7b4443b12` is live at https://jordan-pokemon-app.vercel.app, deployment `dpl_91t2wBoUJXpSYf1o7r5weXkTdbKc`. Frozen local and [independent Linux CI](https://github.com/earouse23-dev/jordan-pokemon-app/actions/runs/38679538788) gates both passed: 583 unit checks, 352 core browser checks, three large-inventory checks, zero browser retries. Three unit environment skips and eight browser skips remain explicit. Lint, release build and routing checks passed.

Light/dark synthetic layout checks passed at 320, 375 and 430 pixels with no horizontal overflow: portfolio chart widths 304, 359 and 414 pixels respectively, each 300 pixels high. The SE detail layout and current-price-before-history/save-reopen flow passed in all three browser projects. These fixture checks do not replace a physical-device retest.

The authenticated isolated demo saved chart returned before 25 deliberately held inventory reads: 75 ms staged, 198 ms canonical. Both checks had zero uncaught errors and zero customer writes; paid provider/image requests and refresh writes were blocked. Canonical health reports the expected release and healthy database/Auth/provider probes. Staged free ECB conversion returned HTTP 200. No new paid PkmnPrices or AI requests were used in this follow-up. Evidence: `docs/evidence/iphone-se-review-2026-10-14/`.

Next physical acceptance is the same Zoroark GX scan/add/reopen sequence on the owner's SE, confirming current-price timing, fresh-price reuse and the larger graphs. Earlier commercial-capacity and native-capture limitations remain; this is a core-app demo publication, not commercial launch qualification.
