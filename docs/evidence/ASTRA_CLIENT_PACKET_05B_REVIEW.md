# Astra CLIENT-05B review — preflight stop upheld

The live gate remains blocked; this is not a valuation failure or proof of unavailable provider coverage. Sol correctly obeyed the packet's requirement to establish canonical context before a paid-quota request. Reported live use: zero requests and zero reserved credits. Astra independently reran `node --test tests/client-05b-guard.test.js`: 4/4 passed. Source inspection confirms ordered URL allowlisting, reservation before transport and redirect rejection. The guard tests use intercepted responses; they do not prove the live endpoint honors the requested row limit. Astra did not repeat the reported browser replay.

Two preflight issues need resolution rather than another unchanged live attempt:

1. The prior packet unnecessarily required a pre-existing saved local canonical record. A source-backed temporary mapping built through the existing normalization path can be adequate for this read-only experiment; it need not already be persisted. Missing edition/promo facts must still remain unknown. Existing normalization defaults (`unlimited`/`none`) are not independent evidence that those facts were established.
2. Current official rate-limit documentation mentions `per_page` as the list-size control, while this endpoint's harness uses `limit=10`. That is a question to verify against the endpoint-specific documentation, not proof the current endpoint is wrong. Post-response rejection of more than ten rows cannot undo credits already charged. Verify the effective endpoint limit before resuming a live request.

Sources checked on 2026-09-24: [PkmnPrices rate limits](https://www.pkmnprices.com/docs/rate-limits) and [published terms](https://www.pkmnprices.com/terms). The terms describe subscription-limited API access but do not expressly settle the retention/redistribution questions recorded in repository docs. Separate internal evaluation from public display, redistribution and production storage; do not turn an unresolved production permission into an invented blanket prohibition or an invented license.

Issue CLIENT-05C for bounded source/mapping/terms/limit research. No new live API request, credit reservation, production change or CLIENT-06 work is granted by this review.
