ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS ball_track jsonb;

CREATE OR REPLACE FUNCTION public.record_delivery_v2(p_match_id uuid, p_innings_id uuid, p_client_event_id uuid, p_device_id text, p_delivery jsonb, p_match_snapshot jsonb, p_live_state jsonb, p_occurred_at timestamp with time zone)
 RETURNS public.match_events
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_event public.match_events;
  v_delivery public.deliveries;
  v_extras jsonb := coalesce(p_delivery -> 'extras', '{}'::jsonb);
  v_batter_runs integer := coalesce((p_delivery ->> 'batterRuns')::integer, 0);
  v_extra_runs integer := coalesce((v_extras ->> 'wide')::integer, 0)
    + coalesce((v_extras ->> 'noBall')::integer, 0)
    + coalesce((v_extras ->> 'bye')::integer, 0)
    + coalesce((v_extras ->> 'legBye')::integer, 0)
    + coalesce((v_extras ->> 'penalty')::integer, 0);
  v_legal boolean := coalesce((p_delivery ->> 'legal')::boolean, true);
  v_wicket boolean := p_delivery ? 'dismissal' and p_delivery -> 'dismissal' <> 'null'::jsonb;
  v_dismissal jsonb;
begin
  if not public.can_score_match(p_match_id) then
    raise exception 'not authorised to score this match' using errcode = '42501';
  end if;
  if not exists (select 1 from public.innings where id = p_innings_id and match_id = p_match_id) then
    raise exception 'innings does not belong to match' using errcode = '23503';
  end if;
  if not exists (select 1 from public.match_squads where match_id = p_match_id and player_id = (p_delivery ->> 'strikerId')::uuid)
    or not exists (select 1 from public.match_squads where match_id = p_match_id and player_id = (p_delivery ->> 'nonStrikerId')::uuid)
    or not exists (select 1 from public.match_squads where match_id = p_match_id and player_id = (p_delivery ->> 'bowlerId')::uuid) then
    raise exception 'delivery players must belong to the match squad' using errcode = '23503';
  end if;
  if nullif(p_delivery ->> 'fielderId', '') is not null and not exists (
    select 1 from public.match_squads where match_id = p_match_id and player_id = (p_delivery ->> 'fielderId')::uuid
  ) then
    raise exception 'fielder must belong to the match squad' using errcode = '23503';
  end if;

  select e.* into v_event from public.match_events e
  where e.match_id = p_match_id and e.client_event_id = p_client_event_id;
  if found then return v_event; end if;

  v_event := public.append_match_event(
    p_match_id, p_client_event_id, p_device_id, 'delivery.recorded',
    jsonb_build_object('delivery', p_delivery, 'inningsId', p_innings_id, 'matchSnapshot', p_match_snapshot, 'liveState', p_live_state),
    p_occurred_at
  );

  v_dismissal := case
    when v_wicket then (p_delivery -> 'dismissal') || jsonb_build_object(
      'creditedToBowler', coalesce(p_delivery -> 'dismissal' ->> 'type', '') not in ('run-out', 'obstructing-the-field'))
    else null
  end;

  insert into public.deliveries (
    match_id, innings_id, event_id, sequence, over_number, ball_in_over,
    striker_id, non_striker_id, bowler_id, end_name, delivery_style, outcome,
    batter_runs, extras, total_runs, legal_ball, wicket, dismissal,
    shot_zone, fielding_zone, fielder_id, notes, occurred_at, recorded_by, ball_track
  ) values (
    p_match_id, p_innings_id, v_event.id, v_event.sequence,
    coalesce((p_delivery ->> 'over')::integer, 0),
    coalesce((p_delivery ->> 'ball')::integer, 1),
    (p_delivery ->> 'strikerId')::uuid,
    (p_delivery ->> 'nonStrikerId')::uuid,
    (p_delivery ->> 'bowlerId')::uuid,
    p_delivery ->> 'end',
    p_delivery ->> 'deliveryStyle',
    coalesce(p_delivery ->> 'outcome', 'not-recorded'),
    v_batter_runs, v_extras, v_batter_runs + v_extra_runs, v_legal, v_wicket, v_dismissal,
    coalesce(p_delivery ->> 'shotZone', p_delivery ->> 'fieldZone'),
    coalesce(p_delivery ->> 'fieldingZone', p_delivery ->> 'fieldZone'),
    nullif(p_delivery ->> 'fielderId', '')::uuid,
    p_delivery ->> 'note',
    p_occurred_at,
    (select auth.uid()),
    nullif(jsonb_strip_nulls(jsonb_build_object('pitch', p_delivery -> 'pitch', 'beehive', p_delivery -> 'beehive', 'speedKph', p_delivery -> 'speedKph')), '{}'::jsonb)
  ) returning * into v_delivery;

  update public.innings set
    runs = runs + v_batter_runs + v_extra_runs,
    wickets = wickets + case when v_wicket then 1 else 0 end,
    legal_balls = legal_balls + case when v_legal then 1 else 0 end,
    status = case when p_match_snapshot -> 'innings' -> -1 ->> 'status' = 'completed' then 'completed' else 'live' end,
    started_at = coalesce(started_at, p_occurred_at),
    completed_at = case when p_match_snapshot -> 'innings' -> -1 ->> 'status' = 'completed' then coalesce(completed_at, p_occurred_at) else completed_at end,
    updated_at = now()
  where id = p_innings_id;

  return v_event;
end;
$function$;

-- Correct an earlier ball (batting & runs or lead scorer only).
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

  update public.innings set
    runs = greatest(0, runs - v_row.total_runs + v_total),
    wickets = greatest(0, wickets - (case when v_row.wicket then 1 else 0 end) + (case when v_wicket then 1 else 0 end)),
    legal_balls = greatest(0, legal_balls - (case when v_row.legal_ball then 1 else 0 end) + (case when v_legal then 1 else 0 end)),
    status = case when p_match_snapshot -> 'innings' -> -1 ->> 'status' = 'completed' then 'completed' else 'live' end,
    updated_at = now()
  where id = p_innings_id and match_id = p_match_id;
  return v_event;
end;
$function$;
REVOKE ALL ON FUNCTION public.correct_delivery_v1(uuid, uuid, text, uuid, text, jsonb, jsonb, jsonb, jsonb, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.correct_delivery_v1(uuid, uuid, text, uuid, text, jsonb, jsonb, jsonb, jsonb, timestamptz) TO authenticated;

-- Training
CREATE TABLE public.training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 120),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  location text CHECK (location IS NULL OR char_length(location) <= 200),
  focus text CHECK (focus IS NULL OR char_length(focus) <= 200),
  plan jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(plan) = 'array' AND jsonb_array_length(plan) <= 30),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 2000),
  cancelled_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX training_sessions_org ON public.training_sessions(organisation_id, starts_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_sessions TO authenticated;
GRANT ALL ON public.training_sessions TO service_role;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY training_sessions_select ON public.training_sessions FOR SELECT TO authenticated USING (public.is_org_member(organisation_id));
CREATE POLICY training_sessions_insert ON public.training_sessions FOR INSERT TO authenticated
  WITH CHECK (public.is_event_manager(organisation_id)
    AND (team_id IS NULL OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.organisation_id = training_sessions.organisation_id)));
CREATE POLICY training_sessions_update ON public.training_sessions FOR UPDATE TO authenticated
  USING (public.is_event_manager(organisation_id))
  WITH CHECK (public.is_event_manager(organisation_id)
    AND (team_id IS NULL OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.organisation_id = training_sessions.organisation_id)));
CREATE POLICY training_sessions_delete ON public.training_sessions FOR DELETE TO authenticated USING (public.is_event_manager(organisation_id));

CREATE TABLE public.training_attendance (
  session_id uuid NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('present','late','absent','excused')),
  effort smallint CHECK (effort IS NULL OR effort BETWEEN 1 AND 5),
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  recorded_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, player_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_attendance TO authenticated;
GRANT ALL ON public.training_attendance TO service_role;
ALTER TABLE public.training_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY training_attendance_select ON public.training_attendance FOR SELECT TO authenticated
  USING (public.is_event_manager(organisation_id) OR public.can_act_for_player(player_id));
CREATE POLICY training_attendance_insert ON public.training_attendance FOR INSERT TO authenticated
  WITH CHECK (public.is_event_manager(organisation_id)
    AND EXISTS (SELECT 1 FROM public.training_sessions s WHERE s.id = session_id AND s.organisation_id = training_attendance.organisation_id)
    AND EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.organisation_id = training_attendance.organisation_id));
CREATE POLICY training_attendance_update ON public.training_attendance FOR UPDATE TO authenticated
  USING (public.is_event_manager(organisation_id))
  WITH CHECK (public.is_event_manager(organisation_id)
    AND EXISTS (SELECT 1 FROM public.training_sessions s WHERE s.id = session_id AND s.organisation_id = training_attendance.organisation_id)
    AND EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.organisation_id = training_attendance.organisation_id));
CREATE POLICY training_attendance_delete ON public.training_attendance FOR DELETE TO authenticated USING (public.is_event_manager(organisation_id));

CREATE TABLE public.player_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 140),
  detail text CHECK (detail IS NULL OR char_length(detail) <= 1000),
  target_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','achieved','dropped')),
  progress smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX player_goals_player ON public.player_goals(player_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_goals TO authenticated;
GRANT ALL ON public.player_goals TO service_role;
ALTER TABLE public.player_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY player_goals_select ON public.player_goals FOR SELECT TO authenticated
  USING (public.is_event_manager(organisation_id) OR public.can_act_for_player(player_id));
CREATE POLICY player_goals_insert ON public.player_goals FOR INSERT TO authenticated
  WITH CHECK ((public.is_event_manager(organisation_id) OR public.can_act_for_player(player_id))
    AND EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.organisation_id = player_goals.organisation_id));
CREATE POLICY player_goals_update ON public.player_goals FOR UPDATE TO authenticated
  USING (public.is_event_manager(organisation_id) OR public.can_act_for_player(player_id))
  WITH CHECK ((public.is_event_manager(organisation_id) OR public.can_act_for_player(player_id))
    AND EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.organisation_id = player_goals.organisation_id));
CREATE POLICY player_goals_delete ON public.player_goals FOR DELETE TO authenticated
  USING (public.is_event_manager(organisation_id) OR created_by = (select auth.uid()));

CREATE TABLE public.player_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL CHECK (kind IN ('coach','self')),
  session_id uuid REFERENCES public.training_sessions(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 2 AND 2000),
  rating smallint CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX player_feedback_player ON public.player_feedback(player_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.player_feedback TO authenticated;
GRANT ALL ON public.player_feedback TO service_role;
ALTER TABLE public.player_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY player_feedback_select ON public.player_feedback FOR SELECT TO authenticated
  USING (public.is_event_manager(organisation_id) OR public.can_act_for_player(player_id));
CREATE POLICY player_feedback_insert ON public.player_feedback FOR INSERT TO authenticated
  WITH CHECK (author_id = (select auth.uid())
    AND ((kind = 'coach' AND public.is_event_manager(organisation_id)) OR (kind = 'self' AND public.can_act_for_player(player_id)))
    AND EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.organisation_id = player_feedback.organisation_id));
CREATE POLICY player_feedback_delete ON public.player_feedback FOR DELETE TO authenticated USING (author_id = (select auth.uid()));

CREATE TABLE public.fitness_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  test text NOT NULL CHECK (char_length(test) BETWEEN 2 AND 40),
  value numeric NOT NULL CHECK (value >= 0 AND value < 100000),
  recorded_on date NOT NULL DEFAULT current_date,
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  recorded_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fitness_results_player ON public.fitness_results(player_id, test, recorded_on);
GRANT SELECT, INSERT, DELETE ON public.fitness_results TO authenticated;
GRANT ALL ON public.fitness_results TO service_role;
ALTER TABLE public.fitness_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY fitness_results_select ON public.fitness_results FOR SELECT TO authenticated
  USING (public.is_event_manager(organisation_id) OR public.can_act_for_player(player_id));
CREATE POLICY fitness_results_insert ON public.fitness_results FOR INSERT TO authenticated
  WITH CHECK ((public.is_event_manager(organisation_id) OR public.can_act_for_player(player_id))
    AND EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.organisation_id = fitness_results.organisation_id));
CREATE POLICY fitness_results_delete ON public.fitness_results FOR DELETE TO authenticated
  USING (public.is_event_manager(organisation_id) OR recorded_by = (select auth.uid()));

-- Public rankings: adult players whose club made their profile public.
CREATE OR REPLACE FUNCTION public.player_rankings(p_country text DEFAULT NULL, p_region text DEFAULT NULL, p_town text DEFAULT NULL, p_limit integer DEFAULT 50)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select coalesce(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb) from (
    select p.id as ref, p.display_name as name, o.name as club, o.country_code as country, o.region, o.town,
           s.runs, s.balls_faced as "ballsFaced", s.fours, s.sixes, s.balls_bowled as "ballsBowled",
           s.runs_conceded as "runsConceded", s.wickets, s.catches, s.stumpings, s.run_outs as "runOuts"
    from public.players p
    join public.organisations o on o.id = p.organisation_id
    join public.player_career_stats s on s.player_id = p.id
    where p.public_profile and not p.is_junior
      and (p_country is null or o.country_code = upper(p_country))
      and (p_region is null or o.region ilike p_region)
      and (p_town is null or o.town ilike p_town)
      and (coalesce(s.balls_faced, 0) > 0 or coalesce(s.balls_bowled, 0) > 0)
    order by coalesce(s.runs, 0) + 20 * coalesce(s.wickets, 0) + 10 * (coalesce(s.catches, 0) + coalesce(s.stumpings, 0) + coalesce(s.run_outs, 0)) desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
  ) r;
$function$;
REVOKE ALL ON FUNCTION public.player_rankings(text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.player_rankings(text, text, text, integer) TO anon, authenticated;

-- Claim your own profile; club admins approve.
CREATE TABLE public.player_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  message text CHECK (message IS NULL OR char_length(message) <= 300),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.player_claims TO authenticated;
GRANT ALL ON public.player_claims TO service_role;
ALTER TABLE public.player_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY player_claims_select ON public.player_claims FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR public.has_org_role(organisation_id, array['owner','club_admin']::public.platform_role[]));
CREATE POLICY player_claims_insert ON public.player_claims FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()) AND status = 'pending' AND public.is_org_member(organisation_id)
    AND EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.organisation_id = player_claims.organisation_id AND p.linked_user_id IS NULL));
CREATE POLICY player_claims_delete ON public.player_claims FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()) AND status = 'pending');

CREATE OR REPLACE FUNCTION public.decide_player_claim(p_claim_id uuid, p_approve boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE c public.player_claims%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.player_claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_org_role(c.organisation_id, array['owner','club_admin']::public.platform_role[]) THEN
    RAISE EXCEPTION 'Only club admins can decide profile claims.' USING errcode = '42501';
  END IF;
  IF c.status <> 'pending' THEN RAISE EXCEPTION 'That claim has already been decided.'; END IF;
  IF p_approve THEN
    IF EXISTS (SELECT 1 FROM public.players WHERE id = c.player_id AND linked_user_id IS NOT NULL AND linked_user_id <> c.user_id) THEN
      RAISE EXCEPTION 'That profile is already linked to someone else.';
    END IF;
    UPDATE public.players SET linked_user_id = c.user_id, updated_at = now() WHERE id = c.player_id;
    UPDATE public.player_claims SET status = 'rejected', decided_by = auth.uid(), decided_at = now()
      WHERE player_id = c.player_id AND id <> c.id AND status = 'pending';
  END IF;
  UPDATE public.player_claims SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    decided_by = auth.uid(), decided_at = now() WHERE id = c.id;
END $function$;
REVOKE ALL ON FUNCTION public.decide_player_claim(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decide_player_claim(uuid, boolean) TO authenticated;

-- One career across every club that linked this person.
CREATE OR REPLACE FUNCTION public.my_career()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select coalesce(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb) from (
    select p.id as "playerId", p.display_name as name, o.name as club,
           coalesce(s.runs, 0) as runs, coalesce(s.balls_faced, 0) as "ballsFaced", coalesce(s.fours, 0) as fours,
           coalesce(s.sixes, 0) as sixes, coalesce(s.balls_bowled, 0) as "ballsBowled",
           coalesce(s.runs_conceded, 0) as "runsConceded", coalesce(s.wickets, 0) as wickets,
           coalesce(s.catches, 0) as catches, coalesce(s.stumpings, 0) as stumpings, coalesce(s.run_outs, 0) as "runOuts"
    from public.players p
    join public.organisations o on o.id = p.organisation_id
    left join public.player_career_stats s on s.player_id = p.id
    where p.linked_user_id = (select auth.uid())
    order by o.name
  ) r;
$function$;
REVOKE ALL ON FUNCTION public.my_career() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_career() TO authenticated;

-- Fans follow public players.
CREATE TABLE public.player_follows (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, player_id)
);
GRANT SELECT, INSERT, DELETE ON public.player_follows TO authenticated;
GRANT ALL ON public.player_follows TO service_role;
ALTER TABLE public.player_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY player_follows_select ON public.player_follows FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY player_follows_insert ON public.player_follows FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid())
    AND EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.public_profile AND NOT p.is_junior));
CREATE POLICY player_follows_delete ON public.player_follows FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

CREATE TRIGGER audit_training_sessions AFTER INSERT OR UPDATE OR DELETE ON public.training_sessions FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('organisation_id');
CREATE TRIGGER audit_player_claims AFTER INSERT OR UPDATE OR DELETE ON public.player_claims FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('organisation_id');
CREATE TRIGGER audit_players AFTER INSERT OR UPDATE OR DELETE ON public.players FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('organisation_id');
CREATE TRIGGER audit_teams AFTER INSERT OR UPDATE OR DELETE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('organisation_id');
CREATE TRIGGER audit_club_events AFTER INSERT OR UPDATE OR DELETE ON public.club_events FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('organisation_id');
CREATE TRIGGER audit_event_selections AFTER INSERT OR UPDATE OR DELETE ON public.event_selections FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('organisation_id');