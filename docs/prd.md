# Product requirements document

## Primary journey

As a collector, I can capture/upload a card, understand image issues, receive a narrow candidate set, compare exact printing details, confirm/correct the match, add ownership facts, and save even without pricing.

Acceptance: no uncertain match is silently saved; retake and manual search remain available; input survives recoverable failures; quote failure does not lose identity/ownership data; scan stages and errors are announced.

## Collection journey

As a collector, I can search, sort, filter, group, inline-edit, bulk-edit, control columns, save views, import/export, and open details while retaining list context.

Acceptance: quantity/cost/value math is exact; unpriced records are counted and excluded visibly; raw/graded and variant-incompatible values never mix; mobile uses a ledger list, not a squeezed table; keyboard users can perform every action.

## Business rules

- Canonical card, variant, collection item, and owned copy are separate.
- Default valuation basis is compatible provider market quote; otherwise unpriced. Manual value must be explicitly labeled.
- Original/source currency always persists. Conversions show rate timestamp.
- No price is an appraisal or guarantee. Stale data is labeled.
- Sales history capability is off unless a documented provider supplies it.

## Permissions

Users can access only their profile, collection, copies, scans, tags, views, imports, exports, and valuations. Canonical catalog/price snapshots are authenticated read-only. Administrative provider operations are server-only.

## States

Default, focus, pressed, selected, disabled, loading, empty, error, success, partial, stale, offline, permission denied, rate limited, provider unavailable, no match, multiple match, unsupported language/variant, missing pricing, destructive confirmation, undo, and partial import.

## Non-functional requirements

- WCAG 2.2 AA for primary journey; 44px practical mobile targets; semantic/live status.
- Responsive interactions under 100ms locally; useful collection paint before optional prices; thumbnails only in rows.
- Validate signatures/dimensions/decompression server-side; 12MB client gate; private signed storage; CSRF/IDOR/XSS/CSV protections.
- Thousands of items use server pagination plus row virtualization when measurement justifies it.
- Typed, privacy-conscious analytics; no photos, email, notes, location, or raw search strings.

## Analytics

Events: account_created, onboarding_completed, scan_started, scan_quality_failed, scan_identification_completed, scan_no_match, scan_candidate_corrected, manual_search_used, card_added, copy_added, collection_inline_edit_saved, bulk_edit_completed, collection_filter_applied, saved_view_created, price_source_opened, card_detail_opened, csv_import_started/completed, csv_export_completed, provider_error_encountered.

Funnels: account→first card; scan→confirmed match; confirmation→save; weekly return; source research→addition.

## Launch criteria / definition of done

All core journeys work against configured infrastructure; RLS cross-user tests, unit/integration/E2E, production build, keyboard/reader checks, mobile/desktop responsive review, provider rights approval, incident monitoring, retention cleanup, backups, and no critical design/security issues.

