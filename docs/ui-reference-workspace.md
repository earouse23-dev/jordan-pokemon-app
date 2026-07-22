# Mica reference workspace

## Problem

The underlying collection, pricing, grading, trade, and seller workflows were stronger than their navigation. The previous five-item rail hid important capabilities and the collection home did not match the compact portfolio workspace supplied by the owner.

## Implementation

- Added a persistent desktop workspace rail for dashboard, collection, intake, discovery, sets, sealed, graded, watchlist, trades, portfolio, analytics, history, alerts, seller tools, reports, import/export, and settings.
- Routed every rail destination into an existing Mica workflow instead of creating placeholder screens or duplicate data paths.
- Rebuilt the collection home around four portfolio KPIs, exact-compatible performance history, coverage details, and recent additions.
- Added dedicated collection presentations for raw/combined inventory, graded cards, sealed products, sets, and watch targets.
- Added a responsive two-column mobile gallery with list treatments for sets and watch targets.
- Preserved both user-selectable concepts. Analytics-focused is the first-visit default and matches the supplied dark purple reference; clean-modern applies the same information architecture in a light system.

## Data and trust boundaries

The visual update does not alter card identity, valuation selection, FIFO cost basis, provider licensing, ownership policies, or Supabase writes. Raw, graded, sealed, grader, grade, condition, and variant values continue through the existing domain model.

## Verification

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:schema`, and `npm run build`. Desktop browser verification should cover a width of at least 1280px; mobile verification should cover 390px and confirm bottom navigation, two-column inventory, detail actions, and no horizontal overflow.
