# Performance review

The product slice has no runtime package dependency, uses one CSS and two JS requests, lazy thumbnail images, responsive low-resolution row images, local derived totals, and cached immutable catalog imagery. Optional remote data cannot block collection rendering.

Production targets: p75 LCP under 2.5s on mid-range mobile, INP under 200ms, local edit feedback under 100ms, paginated first collection result under 500ms server time, scan candidate response under 8s p50, provider timeout 4–6s, and no N+1 quote requests.

Scale path: indexed owner/collection and foreign-key queries; cursor pagination; virtualization after measured row threshold; catalog cache; shared normalized price snapshots; provider batch endpoints; idempotent scheduled sync; backpressure/concurrency caps; responsive images; rollup valuation snapshots rather than per-user duplicate provider data.

The live Supabase performance advisor reports no unindexed foreign keys after schema setup. Unused-index informational notices are expected on a newly created, empty database and should be reassessed after representative production traffic.

