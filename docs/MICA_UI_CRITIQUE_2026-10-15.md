# Native simulator UI critique — 15 October 2026

Scope: owner-requested quality pass on the installed Capacitor app and shared web UI. Existing system font, green palette, native controls and dependencies are retained. No paid services or new platform integration.

## Findings and changes

1. Slab hero repeated grade, edition and currency, then showed an FX paragraph, sale paragraph, confidence/meter paragraph and three large actions before the graph. Keep the full listing identity in the title and a large value, a compact sale/date/uncertainty summary, an eBay action and Price details. Full status, confidence, conversion tools, refresh, screening and evidence remain in an accessible native disclosure. Stale, unverified, unavailable and refresh-failure states stay visible.
2. Portfolio repeated Portfolio value above and below the number and chart, with another coverage/FX paragraph underneath. Remove the repeated sentence prefix; keep missing-price/older-price/FX facts. Put expanded history coverage in History details, retaining the excluded-count and incomplete-update warning in its summary.
3. Library header/controls/image height pushed card names and values down the SE screen. Reduce header and control spacing; use smaller contained images on phones. Keep 44px interaction targets, readable text, filters and sorting.
4. Scan repeated its title with a name/number/photo sentence before controls that already describe each action. Remove that sentence and shorten the search heading. Login and purchase helper copy are shorter. Official certificate and exact-version fields remain.
5. A single physical copy showed disabled previous/next controls and a duplicate copy strip. Hide only these meaningless single-copy controls; preserve multi-copy navigation and all copy facts. Move duplicate display-currency explanation into the source disclosure.

References: [Apple layout and hierarchy](https://developer.apple.com/design/human-interface-guidelines/layout), [Apple human interface guidelines](https://developer.apple.com/design/human-interface-guidelines). Applied principles: content hierarchy, alignment, consistent type and progressive disclosure; no decorative dependency or new feature.

## Verification and limits

The first browser pass exposed sub-12px text, an obsolete assertion expecting the complete eBay URL label in visible link text, and a cache-isolation check. Text was restored to the 12px minimum; full eBay date/amount remain in its accessible name. The owned-price reuse guard now requires its owner/session/context history key, and the expiry check follows the requested 24h policy rather than the old 15-minute history cache. Fifteen corrected targeted checks passed across desktop/mobile Chromium and mobile WebKit, including source isolation, save/reopen pricing, full-width slab chart and layout floors. Broad final checks and publication are recorded after completion.

Installed SE visual review showed the slab graph on the initial screen, where the prior screen showed only evidence paragraphs and controls. This is one focused quality pass, not a claim that every secondary screen is perfect. The earlier collection-load retry and native keyboard/status-bar acceptance items remain separately recorded. Physical camera/automatic capture and App Store release remain outside this UI pass.
