-- Filter before limiting: completed owners must never starve later accounts.
create function public.due_portfolio_refreshes(p_now timestamptz default now(), p_limit integer default 100)
returns table(user_id uuid)
language sql stable security invoker set search_path='' as $$
  select p.user_id from public.portfolio_views p
  where (p.refresh_until is null or p.refresh_until <= p_now)
    and not (
      coalesce(p.view->>'dailyVersion','') = '1'
      and coalesce(p.view->>'checkedDay','') = to_char(p_now at time zone 'UTC','YYYY-MM-DD')
      and coalesce(p.view->>'inventoryRevision','') = p.inventory_revision::text
      and coalesce(p.view->>'refreshIncomplete','false') = 'false'
      and coalesce(p.view->>'historyBackfillPending','false') = 'false'
    )
    and not (
      coalesce(p.view->>'attemptDay','') = to_char(p_now at time zone 'UTC','YYYY-MM-DD')
      and coalesce(p.view->>'attemptRevision','') = p.inventory_revision::text
      and (coalesce((p.view->>'attemptCount')::integer,0) >= 3
        or coalesce(p.attempted_at > p_now - interval '5 minutes',false))
    )
  order by p.attempted_at asc nulls first, p.user_id
  limit greatest(1,least(p_limit,100));
$$;
revoke all on function public.due_portfolio_refreshes(timestamptz,integer) from public,anon,authenticated;
grant execute on function public.due_portfolio_refreshes(timestamptz,integer) to service_role;
