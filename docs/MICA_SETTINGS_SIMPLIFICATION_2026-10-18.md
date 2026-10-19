# Settings simplification — 2026-10-18

Owner requested removal of Animations, Collection & data, This device, and Selling preferences from Settings. Those controls are hidden and inert; stored records, device behavior, accessibility preferences, import/export handlers, and existing selling defaults are preserved. The install-status renderer cannot expose the removed device group again. Saving the remaining display-currency preference cannot overwrite the stored selling fee from an unused hidden input.

Notifications now show Alerts with On/Off and a short description. Detailed delivery, quiet-hours and daily-limit controls remain under More options with plain-language labels. Existing channel preferences, errors, save/retry and device permission boundaries are retained.

Validation: lint passed; 583 unit checks passed with 3 explicit skips. Settings rendering, both appearances, hidden sections, stored preference preservation and display-currency persistence checked on desktop Chromium, phone Chromium and phone WebKit. Notification save/retry and unsubscribe failure/recovery checked against the production handler; fixture authentication context was repaired to reflect the handler's owner guard. No provider pricing calls, schema changes, dependencies, cron changes or new services were introduced.
