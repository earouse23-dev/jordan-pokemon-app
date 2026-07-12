# Provider research

Research checked 2026-07-12 against official documentation.

| Provider | Confirmed capability | Launch position |
|---|---|---|
| [Pokémon TCG API](https://docs.pokemontcg.io/api-reference/cards/card-object/) | Card identity, set/number, images, TCGplayer USD price fields, Cardmarket EUR fields, provider URLs, and provider update dates. | Preferred catalog bridge and optional baseline price-field source after terms review. Keep price types/currencies separate. |
| [TCGdex](https://tcgdex.dev/rest) | Open REST catalog access with multi-language ecosystem. | Candidate secondary catalog for language/coverage evaluation; do not merge IDs without mapping. |
| [TCGplayer API](https://docs.tcgplayer.com/docs/getting-started) | Catalog/pricing API for existing credential holders. Official docs state new API access is not being granted. | Do not require for launch. Never expose private key or access token. |
| [Cardmarket API](https://help.cardmarket.com/de/cardmarket-api) | Official API for approved existing users. Applications are not currently accepted. | Do not require or ask customers to share account credentials. |
| [eBay Browse API](https://developer.ebay.com/api-docs/buy/static/api-browse.html) | Active purchasable listings and image/keyword search. | Optional outbound active-listing research only, clearly labeled asking prices. |
| [eBay Marketplace Insights](https://www.developer.ebay.com/api-docs/buy/static/ref-buy-browse-filters.html) | Completed-item filters exist in restricted Marketplace Insights; not open to new users. | Transaction history capability off unless separately approved. |
| [Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding) | Multimodal image input, detection, and supported structured workflows. | Optional server-side extraction/reranking; restrict selection to retrieved candidates. |

Gemini’s [retention documentation](https://ai.google.dev/gemini-api/docs/zdr) says paid-service training restrictions and zero-data-retention behavior depend on product features and project approval/configuration. Avoid File API persistence, grounding, and stored interactions for card scans; set storage off where supported and delete uploads.

## Recommended launch combination

1. Pokémon TCG API-backed catalog adapter, cached and normalized server-side.
2. Its TCGplayer/Cardmarket fields only where commercial terms permit, with direct attribution, original currency, price type, finish, and provider timestamp.
3. Gemini or maintained OCR only for extraction/reranking behind quotas, timeouts, structured validation, and candidate allowlists.
4. No completed sales or graded pricing until a licensed provider contract enables those capabilities.

## Reliability and caching

Provider clients require exponential backoff with jitter, response-schema validation, circuit/health events, deduplication by card/variant/window, provider-specific concurrency caps, and terms-based retention. One provider failure must not suppress other sources or the user’s collection.

