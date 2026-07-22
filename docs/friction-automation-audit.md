# Friction and automation audit

Updated: 2026-07-21

## Goal

Reduce repeated entry and decision-to-record handoffs without weakening exact card identity, raw condition, graded context, sealed identity, FIFO accounting, or user ownership boundaries.

## Repository and workflow scan

| Workflow                | Existing strength                                                                                    | Friction found                                                                                                              | Resolution or boundary                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Search and match        | Exact set, number, language, printing, and variant matching                                          | Manual search was still required after taking a card photo                                                                  | OpenAI vision now extracts printed identity into a catalog query; the owner must choose the exact printing before intake.                |
| Add raw card            | Only condition and one all-in acquisition total are required                                         | Single variants, quantity, and date received the same visual weight; unknown historical facts encouraged placeholder values | Hide the variant control when there is no choice, collapse purchase details, and allow cost/date to remain explicitly unknown.           |
| Add graded card         | Grader and grade are kept separate from raw condition                                                | Slab label details had to be retyped                                                                                        | Vision suggests grader, grade, and certification; the owner confirms them in the existing graded form.                                   |
| Add sealed product      | Uses the same private FIFO portfolio model                                                           | Location, notes, quantity, date, and cost appeared at once; historical facts could be missing                               | Collapse secondary details and preserve unknown cost/date honestly.                                                                      |
| Import and bulk intake  | Supports large, resumable imports and unknown history                                                | Exact matching still requires review when source records are incomplete                                                     | Preserve review; catalog-aware vision or source APIs could reduce unmatched rows.                                                        |
| Buy planner             | Calculates a maximum offer and compares a seller ask                                                 | The result could only become a watch target; a completed buy required re-entry                                              | Add a direct purchase action that carries quantity and the seller's total into a new or existing position.                               |
| Watchlist               | Exact raw, graded, and sealed context with target tracking                                           | Local alerts only work on the active device while the app is available                                                      | Background Web Push needs a server-side scheduler, permission flow, and push credentials.                                                |
| Grading estimator       | Models grader services, trip costs, expected grade value, and break-even                             | Starting a submission required re-entering grader and estimated cost                                                        | Carry the valid whole-position plan into the grading tracker.                                                                            |
| Grading tracking        | Private forward-only submission timeline and returned-grade conversion                               | Status and return information are manual; fee catalog will become stale                                                     | Grader or shipping integrations require approved data access. Until then, keep the verified manual state and dated fee warning.          |
| Listing                 | Compares ask to the exact market and flags stale/drifted listings                                    | Ask and venue always started blank for a new listing                                                                        | Suggest the exact current reference, remember the prior venue locally, and require confirmation.                                         |
| Sale planner            | Carries calculated fees and costs into the sale ledger                                               | Direct sale entry ignored an existing listing's ask and venue                                                               | Prefill the listing ask/venue and remember the last sale venue. FIFO remains automatic.                                                  |
| Sales history           | Auditable sales, fees, shipping, proceeds, and FIFO profit                                           | Seller orders and actual marketplace fees must be typed                                                                     | eBay Sell and Square Orders integrations could import completed orders after exact inventory mapping and user authorization.             |
| Trades                  | Both sides, cash, context, and fair-value balancing are supported                                    | Unowned raw cards default to a condition context that still requires judgment                                               | Never infer raw condition from price. Vision may suggest condition evidence; user confirmation remains required.                         |
| Portfolio and analytics | Entry points, gain/loss, valuation history, health, action center, reports, and liquidation planning | Results are only as complete as acquisition and sales records                                                               | Receipt/order scanning drafts dates, totals, and card lines; unclear allocation remains blank and unknown inputs never become zero.      |
| Organization            | Bulk labels, storage locations, favorites, sets, and checklists                                      | Physical binder/bin location remains manual                                                                                 | Remembering or suggesting recent locations is safe to add later; camera-based physical placement requires a separate inventory workflow. |
| Pricing                 | Raw/graded/sealed contexts, source trust, history, offers, and licensed sales are separated          | Provider plan limits and hard-coded grader fees are external dependencies                                                   | Keep entitlement and stale-data states explicit. Do not substitute another condition, grade, grader, or variant.                         |
| Account and security    | Supabase Auth, owner-scoped RLS, invoker RPCs, and private ledgers                                   | No automation issue found that justifies weakening ownership checks                                                         | No security model changes.                                                                                                               |

## Implemented automation pass

- Progressive raw, graded, and sealed intake.
- Explicit unknown acquisition cost and date states using the existing FIFO-safe database model.
- Buy decision to purchase-record handoff.
- Grading estimate to submission-tracker handoff.
- Listing to completed-sale prefill.
- Device-local memory for listing and sale venues.
- Current market suggestion for a new listing, clearly labeled for confirmation.
- Private card/slab identity suggestions linked into exact catalog confirmation.
- Two-photo raw condition and conservative grade-range assistance with visible limitations.
- Receipt/order extraction that queues confirmed catalog matches without inventing per-card costs.

## External decisions

- PkmnPrices Pro: the current $14.99/month plan lists 20,000 daily credits, English and Japanese cards, eBay sold listings, and commercial use. The app already has guarded housing for Pro history, sealed, and sold-data responses, so this is an entitlement/key change rather than another UI rebuild.
- AI quality evaluation: card identity, raw grade assistance, and receipt extraction now use one OpenAI structured-vision boundary through Vercel AI Gateway. Before marketing accuracy claims, build a consented, expert-labeled evaluation set across eras, languages, variants, slabs, image defects, and grade outcomes.
- Seller imports: eBay Sell Fulfillment and Square Orders can retrieve authorized seller orders. They require OAuth applications and exact listing-to-position mapping.
- Background alerts: Web Push requires VAPID keys, notification permission, a server-side schedule, and an owner decision about alert frequency.
- Grader status and fee refresh: no approved universal public integration was verified. Keep manual verified stages and dated fee data until access is approved.

## Remaining code-only opportunities

- Add remembered storage-location suggestions after observing real usage.
- Add a review queue that groups incomplete cost/date, stale listing, unmatched import, and grading-return actions without duplicating the existing action center.
- Centralize grading service fees in a remotely updateable, owner-controlled configuration after a trusted refresh process is chosen.
- Extend unknown-history support to later purchase lots if users regularly record additional purchases without cost or date.
