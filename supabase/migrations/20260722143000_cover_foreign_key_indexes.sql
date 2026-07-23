-- Cover foreign keys used by cleanup, joins, and provider reconciliation.
-- These are additive and safe for the existing owner-scoped portfolio.

create index if not exists card_provider_mappings_variant_idx
  on public.card_provider_mappings(card_variant_id);

create index if not exists fifo_lot_allocations_purchase_lot_idx
  on public.fifo_lot_allocations(purchase_lot_id);

create index if not exists price_anomalies_card_idx
  on public.price_anomalies(card_id);

create index if not exists price_anomalies_observation_idx
  on public.price_anomalies(price_observation_id);

create index if not exists price_observations_variant_idx
  on public.price_observations(card_variant_id);
