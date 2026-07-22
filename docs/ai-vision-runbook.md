# AI vision runbook

Updated: 2026-07-21

## What it does

Mica has one provider-neutral `/api/vision` boundary with three modes:

- `identify`: one card or slab photo suggests printed identity, raw/graded state, and visible slab fields.
- `grade`: front and back photos suggest raw condition, visible defects, centering, subscores, and a conservative grade range.
- `receipt`: one receipt, invoice, or order screenshot extracts vendor/date/order/total fields and Pokémon card line items.

The AI never creates a position. Identification becomes a normal catalog query, and the user chooses the exact printing. The existing intake form remains the authority for raw versus graded state, condition or grader/grade, certification, quantity, and one all-in acquisition cost.

## Configuration

Vercel deployments use `@vercel/oidc` to retrieve the project OIDC token from the active Function request context. The environment value remains a compatibility fallback. For local development or a non-Vercel runtime, set a server-only `AI_GATEWAY_API_KEY`.

The Vercel team must have billing verification completed before Gateway will process requests, including requests covered by free credits. If it is missing, Mica returns the safe `vision_billing_required` state instead of retrying or exposing the upstream response.

```text
VISION_MODEL=openai/gpt-5-mini
VISION_MAX_PER_HOUR=20
```

Do not expose either gateway credential through a `NEXT_PUBLIC_` variable. The model variable only accepts an `openai/…` identifier. The Supabase publishable key is sufficient to validate the caller's access token; a service credential is not required by this endpoint.

The default model was verified against Vercel AI Gateway's live `/v1/models` catalog and a successful authenticated Responses request. Recheck the live catalog before changing the model because availability can change independently of application deployments.

## Privacy and security boundary

Before upload, the client decodes the selected image, flattens transparency, limits the longest edge to 2,048 pixels, converts to JPEG, and keeps reducing quality until it fits the request limit. A lightweight device-side luminance/contrast check gives immediate retake guidance.

The server:

1. accepts only `POST` from an authenticated Supabase user;
2. permits exactly one image for identity/receipt or two for grading;
3. accepts bounded JPEG, PNG, or WebP data URLs only;
4. atomically claims a durable per-user hourly allowance in `usage_events`;
5. hashes the user ID into a provider safety identifier;
6. sends strict structured output with `store: false`;
7. validates and normalizes every returned field; and
8. returns `Cache-Control: no-store` without writing the image or result to the database, object storage, or application logs.

Visible text in images is explicitly treated as untrusted data. Provider errors are not returned verbatim, and credentials are never logged or sent to the client.

## Product guardrails

- A one-photo identity result is not proof of the exact printing.
- A raw grade estimate is not a professional grade and cannot rule out hidden surface damage, dents, indentations, print lines, or scratches.
- Slab transcription is not certification or authenticity verification. Users can separately open an allowlisted official grader lookup.
- Receipt text is purchase evidence, not proof of card condition or variant.
- Tax, shipping, fees, discounts, and unclear totals are not divided across cards. Unallocated value is shown and must be resolved by the owner.
- Model output never becomes market price, portfolio value, cost basis, or a saved position without confirmation.

## Verification

Run the standard project checks, including `tests/vision.test.js`. A live smoke test should cover:

1. logged-out calls return `401` without reaching the gateway;
2. one clear card photo returns a useful query and multiple catalog candidates;
3. front/back grading shows limitations and never claims an official grade;
4. a receipt with shipping or tax leaves that value unallocated;
5. choosing a match opens the existing intake form with editable suggestions;
6. closing a result saves neither an image nor a collection record; and
7. small mobile and desktop layouts have no horizontal overflow.

## Accuracy evaluation before public claims

Build a consented benchmark whose labels are independently verified. Stratify it by language, era, layout similarity, set/collector number visibility, first edition/unlimited, normal/reverse/holo/stamped variants, raw/slab state, grader, grade, sleeve/top-loader use, glare, crop, and camera quality. For condition, compare estimates to expert inspection and eventual grader results where available. Track exact-print top-1/top-3 accuracy, abstention quality, false-confidence rate, grade-range coverage, defect recall, latency, and cost per completed intake.

Until that benchmark exists, describe the feature as AI-assisted intake and a conservative grade estimate—not automatic grading or guaranteed identification.
