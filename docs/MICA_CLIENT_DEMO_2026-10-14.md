# Mica client demonstration — 14 October 2026

## Approved scope

Elliott clarified that this milestone is a functioning core-app demonstration to obtain the client's approval to begin App Store preparation. Legal/operator facts, support email, public signup delivery and commercial rollout setup are deferred. Their earlier launch requirements remain recorded; they are not blockers to demonstrating an existing test account. No App Store submission, new paid plan or platform change is authorized.

## Demonstration sequence

1. Sign in to the existing account on the client's phone. Show the saved portfolio value and chart, then reload to demonstrate that saved data appears before pricing work completes.
2. Search a specific card using name and set (for example, Blastoise Base Set). Open a result and check the complete title, image, finish, edition and printed number.
3. Scan a real English card, then a graded slab if available. Confirm the blue outline and automatic capture, correct identity and smooth transition into the card page. This is the remaining physical iPhone acceptance task; browser camera fixtures do not prove it.
4. Add a test copy with its purchase date and amount. Reopen it after signing out and back in. Verify the cost, date, grader and exact grade. Do not modify a customer's collection for acceptance testing.
5. Show a multi-copy position: total position value and the small copy count. Each slab keeps its own acquisition and certificate facts.
6. Open price history and switch ranges. Explain any source-coverage limit honestly: missing provider history cannot be invented. An older reported eBay comp is not a verified recent paid amount, and an active listing is not a sold comp.
7. Reopen the portfolio and confirm the acquisition belongs to the chosen purchase date. A failed refresh preserves the saved total/chart; completing background work publishes one replacement.

## Engineering acceptance for this follow-up

A real local large-inventory read exposed oversized related-record URL filters. The shared loader now caps UUID batches at 100 and reuses stable paginated reads, also preventing silent loss of related rows beyond the API's 1,000-row response cap. A regression covers 1,111 related history rows and explicit overlarge requested batches. Focused unit acceptance: 83 passes; complete unit acceptance: 582 passes and three environment skips. Database-volume and final publication results will be recorded after they finish.

The full 100-account physical-inventory stress attempt did not complete in the shared local environment and does not qualify production capacity. Its owned disposable stack was removed; customer data and unrelated development stacks were not changed. The subsequent 20-account demo-load run is a separate bounded qualification, not a substitute claim for the earlier 100-account commercial envelope.

## Required before calling the demonstration accepted

Elliott/client must complete the real iPhone capture/add/reopen walkthrough. Record the device/iOS version, card and slab examples, observed failures and successful retest. The software remains a web/PWA demonstration; passing it is an input to App Store preparation, not App Store approval or a public commercial release.

## Measured demo-load result

The separate local demo run passed with 20 authenticated accounts, 1,000 graded physical copies per account (20,000 total), retained purchase lots and transactions, and 20 simultaneous inventory readers. Every reader saw exactly its own 1,000 PSA 9 copies and $50,000 synthetic acquisition cost. Maximum inventory read: 1,836 ms. Sixty saved-summary HTTP reads at concurrency 20: p50 133 ms, p95 227 ms, maximum 230 ms, 13,746 bytes. Zero external/provider requests or customer writes. Fixture users and inventory were removed after the run. Evidence: `docs/evidence/beta-readiness-2026-10-12/step-7-physical-inventory-load.json`.

Inventory seeding grew the isolated database by about 93 MB. This is useful evidence for demo reliability, but also confirms that the full 100-account commercial capacity and long-term historical storage require separate qualification. It does not prove production latency, live daily pricing throughput or camera performance.

## Published software verification

Source `3cf1a2d` is live at https://jordan-pokemon-app.vercel.app, deployment `dpl_4oi1Sek4WqkfwRmrr6g1KwBiqUh2`. Frozen local and [remote Linux CI](https://github.com/earouse23-dev/jordan-pokemon-app/actions/runs/38662766128) gates both passed: 582 unit checks (three explicit environment skips), 343 core browser checks (eight explicit skips), three large-inventory checks, zero browser retries. Health reports the expected release and healthy database/Auth/provider probes. The saved chart reappeared before 25 held inventory reads in 69 ms staged / 192 ms canonical, with zero uncaught errors or customer writes. These are lab measurements, not production percentiles.

Staged EUR value/chart conversion completed with a successful free ECB response. This safety check blocks paid/image requests and update writes, so it does not establish live image/pricing completeness. Existing exact-match/provider evidence remains in the beta execution ledger. Physical iPhone acceptance is still pending; no App Store submission or commercial release was performed. Publication evidence: `docs/evidence/beta-readiness-2026-10-12/client-demo-publication-2026-10-14.json`.
