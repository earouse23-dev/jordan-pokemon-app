# Sol CLIENT-05G — verify the approved ECB source through the actual route

Use `ponytail:ponytail` in **full mode**, read its installed SKILL.md first and report unavailable honestly. Read AGENTS.md, both roadmaps, CLIENT-05F report and Astra acceptance. Reuse the accepted route, parser and browser harness. This is the sole active packet under Elliott's continuous-handoff instruction and approved ECB integration scope. Preserve dirty work.

## Bounded outcome

Verify current source compatibility for the locally accepted FX slice. Maximum **one outbound HTTP request** to the fixed public ECB daily XML URL, via the actual `api/fx.js` handler in an isolated local process. No paid-provider traffic, credentials, retries, redirects, history download or deployment. Before transport install a count/origin/path guard so a second request cannot leave the process. Native `fetch` still enforces the production timeout/redirect/size behavior.

1. Record implementation hashes, actual current time and expected route/parser contract before the run. Do not freeze the date to make a source rate fresh.
2. Invoke the current route with its normal GET request under the transport guard. Observe status, size, validated effective date, fetched time, rate reference/content hash and success/error cache headers. Do not run a replacement parser instead of the production path.
3. Capture that one public ECB response within the allowed transport for comparison; do not fetch it again independently. Verify the route's USD-per-EUR direction, date, rate and response-byte hash independently against the captured XML. Public ECB reference-rate evidence may be retained with source/date/attribution under the already reviewed terms; this does not authorize retaining PkmnPrices data. No secrets or owner data belong in evidence.
4. If successful/fresh, call the same handler once more inside the same process and verify it serves the identical accepted record from cache with no second outbound request and no new fetched timestamp. If the first result fails/stales, stop live transport; do not retry to obtain a pass.
5. Replay the captured accepted rate locally through the existing actual detail UI on desktop Chromium and mobile WebKit, with all external traffic blocked and **clearly synthetic** native-sale fixtures. Compute expected equivalents independently from the captured rate and synthetic native amount. Assert native estimate/evidence/currency unchanged, correct dated secondary equivalent and no inventory writes or extra sales fetch from toggling. Label this real-rate/synthetic-sales replay; it is not live valuation accuracy. If the source failed, verify honest unavailable behavior with its sanitized failure instead.

Use narrow harness/tests/docs only. Do not change application code, parser rules, freshness policy or source URL to force success. If actual feed structure differs, preserve the bounded evidence and propose the smallest repair for Astra review. No unrelated full-suite rerun is needed if implementation hashes are unchanged.

## Deliverable and stop

Write `docs/evidence/SOL_CLIENT_PACKET_05G_REPORT.md`: one-request ledger, source/route comparison, cache proof, replay screenshots/results, exact reproduction commands, source hashes and outstanding gates. Include a compact final Step 5 status table separating accepted local valuation, measured live insufficiency, accepted local FX, this live source proof, unresolved production mapping/retained numeric evidence/provider rights and deferred historical conversion. Do not call the whole step complete while those required gates remain open.

No new PkmnPrices or certificate calls, paid service, new dependency, database/profile/transaction write, platform change, deployment, commit or CLIENT-06. Stop for Astra review and the next concrete prompt.
