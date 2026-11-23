alter table public.organisations
  add column if not exists country_code text,
  add column if not exists region text;

alter table public.organisations
  add constraint organisations_country_code_format check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  add constraint organisations_region_length check (region is null or char_length(btrim(region)) between 1 and 60);

grant update (country_code, region) on public.organisations to authenticated;

create or replace function public.list_public_live_matches()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(jsonb_agg(item order by sort_key, at_time), '[]'::jsonb)
  from (
    select
      case when m.status in ('live', 'innings_break') then 0 when m.status = 'completed' then 1 else 2 end as sort_key,
      case when m.status = 'scheduled' then extract(epoch from m.scheduled_at) else -extract(epoch from m.updated_at) end as at_time,
      jsonb_strip_nulls(jsonb_build_object(
        'slug', s.slug,
        'matchId', m.id,
        'status', m.status,
        'scheduledAt', m.scheduled_at,
        'startedAt', m.started_at,
        'completedAt', m.completed_at,
        'updatedAt', m.updated_at,
        'homeTeam', jsonb_build_object('id', ht.id, 'name', ht.name, 'shortName', ht.short_name),
        'awayTeam', jsonb_build_object('id', at.id, 'name', at.name, 'shortName', at.short_name),
        'ground', g.name,
        'competition', case when c.id is null then null else jsonb_build_object('id', c.id, 'name', c.name, 'format', c.format) end,
        'organisation', o.name,
        'country', coalesce(o.country_code, co.country_code),
        'region', coalesce(o.region, co.region),
        'delayed', (m.updated_at + make_interval(secs => s.delay_seconds) > now()),
        'liveState', case
          when m.updated_at + make_interval(secs => s.delay_seconds) > now() or m.live_state is null then null
          else jsonb_strip_nulls(jsonb_build_object(
            'battingTeamId', m.live_state -> 'battingTeamId',
            'battingIsHome', m.live_state -> 'battingIsHome',
            'runs', m.live_state -> 'runs',
            'wickets', m.live_state -> 'wickets',
            'overs', m.live_state -> 'overs',
            'target', m.live_state -> 'target',
            'inningsNumber', m.live_state -> 'inningsNumber',
            'settings', m.live_state -> 'settings',
            'oversLimit', m.live_state -> 'oversLimit',
            'rain', m.live_state -> 'rain',
            'par', m.live_state -> 'par',
            'stoppage', m.live_state -> 'stoppage',
            'days', m.live_state -> 'days',
            'superOver', m.live_state -> 'superOver',
            'declared', m.live_state -> 'declared',
            'result', m.live_state -> 'result',
            'recent', m.live_state -> 'recent'
          ))
        end
      )) as item
    from public.public_scoreboards s
    join public.matches m on m.id = s.match_id
    join public.teams ht on ht.id = m.home_team_id
    join public.teams at on at.id = m.away_team_id
    join public.organisations o on o.id = m.owner_organisation_id
    left join public.grounds g on g.id = m.ground_id
    left join public.competitions c on c.id = m.competition_id
    left join public.organisations co on co.id = c.organisation_id
    where s.enabled = true
      and m.visibility = 'public'
      and (
        m.status in ('live', 'innings_break')
        or (m.status = 'completed' and coalesce(m.completed_at, m.updated_at) > now() - interval '36 hours')
        or (m.status = 'scheduled' and m.scheduled_at between now() - interval '12 hours' and now() + interval '7 days')
      )
    order by 1, 2
    limit 300
  ) rows;
$$;

revoke all on function public.list_public_live_matches() from public;
grant execute on function public.list_public_live_matches() to anon, authenticated;