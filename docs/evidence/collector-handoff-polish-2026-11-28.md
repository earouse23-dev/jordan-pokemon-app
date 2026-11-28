# Collector interface polish

The scan result and purchase form use the prepared photo from the current scan. The matched name and grade remain visible alongside it. Confirmed grader, grade, qualifier and certificate values remain editable under **Edit card details**. The purchase amount and date appear first. When the scan requires a printing decision, the dialog names and focuses the first unresolved field.

Collection rows pair the holding value with the collector’s dollar gain or loss. The card’s recorded market trend has its own period and change. Portfolio shows a saved valuation and its date when available during a refresh. The time controls run from 1D through All, with All selected initially.

## Verification

- Browser fixtures cover a Japanese PSA 10 Charizard with a resolved price, raw-card comparison pricing, and a PSA 9 Ninetales that needs an edition choice.
- Mobile WebKit and desktop Chromium exercise both appearances and responsive layouts. The portfolio refresh fixture checks the saved total during an outstanding request and recovery after failure.
- On-device camera behavior and elapsed recognition time are outside this interface change.
