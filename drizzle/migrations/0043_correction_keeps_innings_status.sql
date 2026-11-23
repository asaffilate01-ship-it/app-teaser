CREATE OR REPLACE FUNCTION public.correct_delivery_v1(
  p_match_id uuid, p_innings_id uuid, p_delivery_id text, p_client_event_id uuid, p_device_id text,
  p_delivery jsonb, p_renumber jsonb, p_match_snapshot jsonb, p_live_state jsonb, p_occurred_at timestamptz)
 RETURNS public.match_events
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_event public.match_events;
  v_recorded public.match_events;
  v_row public.deliveries;
  v_extras jsonb := coalesce(p_delivery -> 'extras', '{}'::jsonb);
  v_batter integer := coalesce((p_delivery ->> 'batterRuns')::integer, 0);
  v_total integer;
  v_legal boolean := coalesce((p_delivery ->> 'legal')::boolean, true);
  v_wicket boolean := p_delivery ? 'dismissal' and p_delivery -> 'dismissal' <> 'null'::jsonb;
  v_item jsonb;
begin
  if not public.can_record_balls(p_match_id) then
    raise exception 'not authorised to correct this match' using errcode = '42501';
  end if;
  select * into v_event from public.match_events where match_id = p_match_id and client_event_id = p_client_event_id;
  if found then return v_event; end if;
  if coalesce(p_delivery ->> 'id', '') <> coalesce(p_delivery_id, '') or coalesce(p_delivery_id, '') = '' then
    raise exception 'which ball?' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(array[
      p_delivery ->> 'strikerId', p_delivery ->> 'nonStrikerId', p_delivery ->> 'bowlerId',
      nullif(p_delivery ->> 'fielderId', ''), nullif(p_delivery -> 'dismissal' ->> 'fielderId', '')
    ]) as x(id)
    where x.id is not null
      and not exists (select 1 from public.match_squads s where s.match_id = p_match_id and s.player_id::text = x.id)
  ) then
    raise exception 'delivery players must belong to the match squad' using errcode = '23503';
  end if;
  select * into v_recorded from public.match_events e
  where e.match_id = p_match_id and e.event_type = 'delivery.recorded'
    and e.payload -> 'delivery' ->> 'id' = p_delivery_id and e.payload ->> 'inningsId' = p_innings_id::text
  order by e.sequence desc limit 1;
  if not found then raise exception 'that ball has not reached the cloud yet' using errcode = 'P0002'; end if;
  select * into v_row from public.deliveries where event_id = v_recorded.id and voided_by_event_id is null for update;
  if not found then raise exception 'that ball has been undone' using errcode = 'P0002'; end if;

  v_event := public.append_match_event(
    p_match_id, p_client_event_id, p_device_id, 'delivery.corrected',
    jsonb_build_object('inningsId', p_innings_id, 'deliveryId', p_delivery_id, 'delivery', p_delivery,
                       'matchSnapshot', p_match_snapshot, 'liveState', p_live_state),
    p_occurred_at);

  v_total := v_batter + coalesce((v_extras ->> 'wide')::integer, 0) + coalesce((v_extras ->> 'noBall')::integer, 0)
    + coalesce((v_extras ->> 'bye')::integer, 0) + coalesce((v_extras ->> 'legBye')::integer, 0)
    + coalesce((v_extras ->> 'penalty')::integer, 0);

  update public.deliveries set
    over_number = coalesce((p_delivery ->> 'over')::integer, over_number),
    ball_in_over = coalesce((p_delivery ->> 'ball')::integer, ball_in_over),
    striker_id = (p_delivery ->> 'strikerId')::uuid,
    non_striker_id = (p_delivery ->> 'nonStrikerId')::uuid,
    bowler_id = (p_delivery ->> 'bowlerId')::uuid,
    delivery_style = coalesce(p_delivery ->> 'deliveryStyle', delivery_style),
    outcome = coalesce(p_delivery ->> 'outcome', outcome),
    batter_runs = v_batter,
    extras = v_extras,
    total_runs = v_total,
    legal_ball = v_legal,
    wicket = v_wicket,
    dismissal = case when v_wicket then (p_delivery -> 'dismissal') || jsonb_build_object(
      'creditedToBowler', coalesce(p_delivery -> 'dismissal' ->> 'type', '') not in ('run-out', 'obstructing-the-field')) else null end,
    shot_zone = coalesce(p_delivery ->> 'fieldZone', shot_zone),
    fielding_zone = coalesce(p_delivery ->> 'fieldZone', fielding_zone),
    fielder_id = nullif(p_delivery ->> 'fielderId', '')::uuid,
    notes = p_delivery ->> 'note',
    ball_track = nullif(jsonb_strip_nulls(jsonb_build_object('pitch', p_delivery -> 'pitch', 'beehive', p_delivery -> 'beehive', 'speedKph', p_delivery -> 'speedKph')), '{}'::jsonb)
  where id = v_row.id;

  -- Later balls may move to a different over/ball number after the change.
  for v_item in select * from jsonb_array_elements(coalesce(p_renumber, '[]'::jsonb)) loop
    update public.deliveries d set
      over_number = (v_item ->> 'over')::integer,
      ball_in_over = (v_item ->> 'ball')::integer
    from public.match_events e
    where d.event_id = e.id and e.match_id = p_match_id and d.innings_id = p_innings_id
      and e.event_type = 'delivery.recorded' and e.payload -> 'delivery' ->> 'id' = v_item ->> 'id';
  end loop;

  -- Innings status is left alone: a fix to an earlier innings must never reopen it.
  update public.innings set
    runs = greatest(0, runs - v_row.total_runs + v_total),
    wickets = greatest(0, wickets - (case when v_row.wicket then 1 else 0 end) + (case when v_wicket then 1 else 0 end)),
    legal_balls = greatest(0, legal_balls - (case when v_row.legal_ball then 1 else 0 end) + (case when v_legal then 1 else 0 end)),
    updated_at = now()
  where id = p_innings_id and match_id = p_match_id;
  return v_event;
end;
$function$;