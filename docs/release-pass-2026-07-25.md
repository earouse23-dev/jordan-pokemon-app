# Mica release pass — 2026-07-25

This pass converted the card-scanning plan into a catalog-first, evidence-first
workflow and completed a full interface and release critique.

## Completed gates

1. **Internal catalog activated.** The Vault-backed TCGdex scheduler is live,
   resumable, default-deny, and authenticated with a single-purpose token. At
   final verification the connected project contained 108,548 cards and 1,016
   sets; five language targets had completed a full cycle and the remaining
   targets continued incrementally.
2. **Lean AI extraction.** Identification mode now extracts only visible
   identity evidence. Condition estimation and receipt extraction remain
   separate tasks, so a normal lookup does not pay for or trust unnecessary
   model output.
3. **One request from photo to candidates.** The authenticated vision endpoint
   resolves extracted identity against the internal catalog before returning.
   Public TCGdex search remains a controlled fallback.
4. **Exact matching made deterministic.** Generated identity keys and dedicated
   indexes support name plus collector-number lookup, including zero-padded
   numbers. Unique exact matches, ambiguous matches, number-only matches, and
   weak alternatives remain visibly distinct.
5. **Device-side evidence and quality gates.** The browser creates a compact
   evidence sheet with the full card, name/set crop, and collector-number crop.
   Severe darkness, overexposure, glare, and blur stop locally without consuming
   an AI request.
6. **Conservative visual fallback.** When deterministic catalog evidence leaves
   two to four candidates, the user may explicitly ask AI to compare only those
   allowlisted candidate images. The model may abstain, cannot return an unknown
   catalog ID, and never saves without confirmation.
7. **Interface polish.** Both Clean Modern and Analytics Focused themes now keep
   a 12px text floor, 44px mobile controls, AA sign-in contrast, valid collection
   filter semantics, and contained layouts. The dead duplicate Settings entry
   was removed, mobile KPI wrapping was repaired, and the review queue was
   restored to the Market workspace.
8. **Durable browser regression.** Playwright now covers both themes,
   guided/growth/pro workspaces, five primary routes, signed-out state, desktop,
   and phone widths. Sixty rendered states enforce overflow, typography,
   touch-target, and filter-semantics invariants in CI.

## Additional automation

The Market review queue has an optional AI explanation. Mica still calculates
every signal deterministically. The Gateway receives only allowlisted signal
keys and counts—never card names, prices, costs, notes, photos, certifications,
or purchase details. Output is restricted to existing queue actions, cannot
write data, always requires confirmation, and uses a separate owner-bound atomic
rate limit. The deterministic checklist remains usable if Gateway billing,
availability, or the hourly budget blocks the explanation.

## Verification

- Formatting, custom lint, JavaScript syntax checks, and production build pass.
- 186 unit, integration, provider-boundary, security, and ownership tests pass.
- All 47 public tables have RLS enabled.
- Live ownership checks found zero ownerless collection items, zero mismatched
  purchase lots, and zero mismatched sale rows.
- Signed-out and authenticated Axe scans report zero WCAG A/AA violations. The
  remaining incomplete contrast checks are caused by backgrounds Axe cannot
  calculate through gradients and were manually reviewed.
- The complete Playwright desktop/mobile matrix passes.
- Production and development dependency audits report zero vulnerabilities.

## Owner-controlled launch gates

- Replace the PkmnPrices key currently rejected by the provider, upgrade to Pro,
  set `PKMNPRICES_PLAN=pro`, and rerun the live entitlement verifier.
- Upgrade Supabase and enable leaked-password protection if password sign-in
  remains available. Password recovery continues to work through the verified email address.
- Complete physical iOS/Android camera, permission, resume, and native push
  testing when app-store packaging begins.
- Approve final legal entity, privacy, provider-attribution, support, store
  listing, monitoring, backup, and incident-routing details before public
  registration.
