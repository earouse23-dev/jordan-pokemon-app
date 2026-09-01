-- Step 3 reconciliation gate. Run against staging only after both canonical
-- identity migrations have been applied. This script returns aggregate counts;
-- it does not read record contents or mutate data.

begin transaction read only;

select identity_kind,identity_status,count(*) as identity_count
from public.collectible_identities
group by identity_kind,identity_status
order by identity_kind,identity_status;

select
  (select count(*) from public.collection_items where collectible_id is null)
    as collection_items_missing,
  (select count(*) from public.collection_transactions where collectible_id is null)
    as collection_transactions_missing,
  (select count(*) from public.purchase_lots where collectible_id is null)
    as purchase_lots_missing,
  (select count(*) from public.position_price_observations where collectible_id is null)
    as position_prices_missing,
  (select count(*) from public.card_watchlist where collectible_id is null)
    as watchlist_missing,
  (select count(*) from public.price_products where collectible_id is null)
    as price_products_missing,
  (select count(*) from public.price_observations where collectible_id is null)
    as price_observations_missing,
  (select count(*) from public.card_provider_mappings where collectible_id is null)
    as provider_mappings_missing,
  (select count(*) from public.scan_candidates where collectible_id is null)
    as scan_candidates_missing,
  (select count(*) from public.owned_copies where collectible_id is null)
    as owned_copies_missing,
  (select count(*) from public.digital_grade_assessments where collectible_id is null)
    as digital_grades_missing,
  (select count(*) from public.grading_scan_sessions where collectible_id is null)
    as grading_sessions_missing,
  (select count(*) from public.grading_predictions where collectible_id is null)
    as grading_predictions_missing,
  (select count(*) from public.grading_outcomes where collectible_id is null)
    as grading_outcomes_missing;

select
  (select count(*)
   from public.collection_transactions transaction
   join public.collection_items item
     on item.id=transaction.collection_item_id
    and item.user_id=transaction.user_id
   where transaction.collectible_id<>item.collectible_id)
    as collection_transaction_mismatches,
  (select count(*)
   from public.purchase_lots lot
   join public.collection_items item
     on item.id=lot.collection_item_id and item.user_id=lot.user_id
   where lot.collectible_id<>item.collectible_id)
    as purchase_lot_mismatches,
  (select count(*)
   from public.owned_copies copy
   join public.collection_items item
     on item.id=copy.collection_item_id and item.user_id=copy.user_id
   where copy.collectible_id<>item.collectible_id)
    as owned_copy_mismatches,
  (select count(*)
   from public.grading_scan_sessions session
   join public.grading_physical_cards physical
     on physical.id=session.physical_card_id and physical.user_id=session.user_id
   where session.collectible_id<>physical.collectible_id)
    as grading_lineage_mismatches,
  (select count(*)
   from public.grading_predictions prediction
   join public.grading_scan_sessions session
     on session.id=prediction.scan_session_id and session.user_id=prediction.user_id
   where prediction.collectible_id<>session.collectible_id)
    as grading_prediction_mismatches,
  (select count(*)
   from public.collection_items item
   where coalesce(item.identity_snapshot->>'collectibleId','')
     <>item.collectible_id::text)
    as collection_snapshot_mismatches;

select
  count(*) filter (
    where identity.identity_kind='card_variant'
      and variant.id is null
  ) as missing_variant_targets,
  count(*) filter (
    where identity.identity_kind='card_printing'
      and card.id is null
  ) as missing_card_targets,
  count(*) filter (
    where identity.identity_kind='sealed_product'
      and sealed.id is null
  ) as missing_sealed_targets,
  count(*) filter (
    where identity.identity_status='merged'
      and target.id is null
  ) as missing_merge_targets
from public.collectible_identities identity
left join public.card_variants variant on variant.id=identity.variant_id
left join public.cards card on card.id=identity.card_id
left join public.sealed_products sealed on sealed.id=identity.sealed_product_id
left join public.collectible_identities target on target.id=identity.merged_into_id;

with recursive merge_chain as (
  select identity.id as origin_id,identity.merged_into_id as next_id,
    array[identity.id] as visited,false as cycle
  from public.collectible_identities identity
  where identity.merged_into_id is not null
  union all
  select chain.origin_id,identity.merged_into_id,
    chain.visited||identity.id,identity.id=any(chain.visited)
  from merge_chain chain
  join public.collectible_identities identity on identity.id=chain.next_id
  where chain.next_id is not null and not chain.cycle
)
select count(*) filter (where cycle) as merge_cycles,
  coalesce(max(cardinality(visited)),0) as longest_merge_chain
from merge_chain;

select
  count(*) filter (where event_type='correction') as corrections,
  count(*) filter (where event_type='reversal') as reversals,
  count(*) filter (
    where event_type='reversal' and reverses_correction_id is null
  ) as orphan_reversals,
  count(*) filter (where reverses_correction_id is not null)
    -count(distinct reverses_correction_id)
      filter (where reverses_correction_id is not null)
    as duplicate_reversals
from public.identity_corrections;

select
  count(*) filter (where identity_status='needs_review') as identities_needing_review,
  count(*) filter (where identity_status='merged') as merge_aliases,
  count(*) filter (where identity_status='retired') as retired_identities
from public.collectible_identities;

rollback;
