-- Use stable provider keys for set identity and deterministic UTC daily price buckets.
alter table public.card_sets drop constraint if exists card_sets_name_language_key;

create or replace function public.refresh_price_daily_metrics(target_date date default current_date)
returns integer language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  insert into public.price_daily_metrics(product_id,price_type,metric_date,open_amount,high_amount,low_amount,close_amount,average_amount,sample_count,computed_at)
  select product_id, price_type, target_date,
    (array_agg(amount order by coalesce(observed_at,retrieved_at) asc, retrieved_at asc, id asc))[1], max(amount), min(amount),
    (array_agg(amount order by coalesce(observed_at,retrieved_at) desc, retrieved_at desc, id desc))[1], avg(amount), count(*)::integer, now()
  from public.price_snapshots
  where (coalesce(observed_at,retrieved_at) at time zone 'UTC')::date = target_date
  group by product_id,price_type
  on conflict(product_id,price_type,metric_date) do update set
    open_amount=excluded.open_amount, high_amount=excluded.high_amount, low_amount=excluded.low_amount,
    close_amount=excluded.close_amount, average_amount=excluded.average_amount, sample_count=excluded.sample_count, computed_at=excluded.computed_at;
  get diagnostics affected = row_count;
  return affected;
end $$;
revoke all on function public.refresh_price_daily_metrics(date) from public, anon, authenticated;
