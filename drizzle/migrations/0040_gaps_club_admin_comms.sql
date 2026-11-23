ALTER TABLE public.club_events ADD COLUMN IF NOT EXISTS reply_by timestamptz;
ALTER TABLE public.club_events ADD COLUMN IF NOT EXISTS squad_cap integer CHECK (squad_cap IS NULL OR squad_cap BETWEEN 1 AND 200);

ALTER TABLE public.event_availability DROP CONSTRAINT event_availability_status_check;
ALTER TABLE public.event_availability ADD CONSTRAINT event_availability_status_check
  CHECK (status = ANY (ARRAY['available','unavailable','maybe','waitlist']));
ALTER TABLE public.event_availability ADD COLUMN IF NOT EXISTS waitlisted_at timestamptz;

CREATE OR REPLACE FUNCTION public.apply_availability_rules()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE e public.club_events%ROWTYPE; v_taken int;
BEGIN
  SELECT * INTO e FROM public.club_events WHERE id = NEW.event_id;
  IF e.reply_by IS NOT NULL AND now() > e.reply_by AND NOT public.is_event_manager(NEW.organisation_id) THEN
    RAISE EXCEPTION 'Replies for this event closed on %. Ask a manager to change it.', to_char(e.reply_by, 'DD Mon HH24:MI') USING errcode = '23514';
  END IF;
  IF NEW.status = 'waitlist' AND NOT public.is_event_manager(NEW.organisation_id)
     AND (tg_op = 'INSERT' OR OLD.status <> 'waitlist') THEN
    NEW.status := 'available';
  END IF;
  IF NEW.status = 'available' AND e.squad_cap IS NOT NULL AND (tg_op = 'INSERT' OR OLD.status <> 'available') THEN
    PERFORM 1 FROM public.club_events WHERE id = NEW.event_id FOR UPDATE;
    SELECT count(*) INTO v_taken FROM public.event_availability
      WHERE event_id = NEW.event_id AND status = 'available' AND player_id <> NEW.player_id;
    IF v_taken >= e.squad_cap THEN
      NEW.status := 'waitlist';
    END IF;
  END IF;
  IF NEW.status = 'waitlist' AND (tg_op = 'INSERT' OR OLD.status <> 'waitlist') THEN
    NEW.waitlisted_at := now();
  ELSIF NEW.status <> 'waitlist' THEN
    NEW.waitlisted_at := NULL;
  END IF;
  RETURN NEW;
END $function$;
CREATE TRIGGER event_availability_rules BEFORE INSERT OR UPDATE OF status ON public.event_availability
  FOR EACH ROW EXECUTE FUNCTION public.apply_availability_rules();

CREATE OR REPLACE FUNCTION public.promote_availability_waitlist()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_event uuid; v_cap int; v_taken int; v_next uuid;
BEGIN
  IF tg_op = 'DELETE' THEN
    IF OLD.status <> 'available' THEN RETURN OLD; END IF;
    v_event := OLD.event_id;
  ELSE
    IF NOT (OLD.status = 'available' AND NEW.status <> 'available') THEN RETURN NEW; END IF;
    v_event := NEW.event_id;
  END IF;
  SELECT squad_cap INTO v_cap FROM public.club_events WHERE id = v_event;
  IF v_cap IS NOT NULL THEN
    SELECT count(*) INTO v_taken FROM public.event_availability WHERE event_id = v_event AND status = 'available';
    IF v_taken < v_cap THEN
      SELECT id INTO v_next FROM public.event_availability WHERE event_id = v_event AND status = 'waitlist'
        ORDER BY waitlisted_at NULLS LAST, updated_at LIMIT 1;
      IF v_next IS NOT NULL THEN
        UPDATE public.event_availability SET status = 'available', waitlisted_at = NULL, updated_at = now() WHERE id = v_next;
      END IF;
    END IF;
  END IF;
  IF tg_op = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $function$;
CREATE TRIGGER event_availability_promote AFTER UPDATE OF status OR DELETE ON public.event_availability
  FOR EACH ROW EXECUTE FUNCTION public.promote_availability_waitlist();

-- Team chat and announcements
CREATE TABLE public.team_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  author_name text NOT NULL CHECK (char_length(btrim(author_name)) BETWEEN 1 AND 80),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  is_announcement boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX team_messages_channel ON public.team_messages(organisation_id, team_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.team_messages TO authenticated;
GRANT ALL ON public.team_messages TO service_role;
ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_messages_select ON public.team_messages FOR SELECT TO authenticated USING (public.is_org_member(organisation_id));
CREATE POLICY team_messages_insert ON public.team_messages FOR INSERT TO authenticated
  WITH CHECK (author_id = (select auth.uid()) AND public.is_org_member(organisation_id)
    AND (NOT is_announcement OR public.is_event_manager(organisation_id))
    AND (team_id IS NULL OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.organisation_id = team_messages.organisation_id)));
CREATE POLICY team_messages_delete ON public.team_messages FOR DELETE TO authenticated
  USING (author_id = (select auth.uid()) OR public.is_event_manager(organisation_id));

CREATE TABLE public.team_message_reads (
  message_id uuid NOT NULL REFERENCES public.team_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  reader_name text NOT NULL CHECK (char_length(btrim(reader_name)) BETWEEN 1 AND 80),
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
GRANT SELECT, INSERT ON public.team_message_reads TO authenticated;
GRANT ALL ON public.team_message_reads TO service_role;
ALTER TABLE public.team_message_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_message_reads_select ON public.team_message_reads FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR EXISTS (SELECT 1 FROM public.team_messages m WHERE m.id = message_id
    AND (m.author_id = (select auth.uid()) OR public.is_event_manager(m.organisation_id))));
CREATE POLICY team_message_reads_insert ON public.team_message_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()) AND EXISTS (SELECT 1 FROM public.team_messages m WHERE m.id = message_id AND public.is_org_member(m.organisation_id)));

-- Join the club
CREATE TABLE public.club_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 100),
  email text NOT NULL CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND char_length(email) <= 200),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 40),
  interest text NOT NULL CHECK (interest IN ('player','parent','volunteer','coach','umpire','other')),
  junior boolean NOT NULL DEFAULT false,
  message text CHECK (message IS NULL OR char_length(message) <= 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX club_join_requests_org ON public.club_join_requests(organisation_id, status, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.club_join_requests TO authenticated;
GRANT ALL ON public.club_join_requests TO service_role;
ALTER TABLE public.club_join_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY join_requests_select ON public.club_join_requests FOR SELECT TO authenticated
  USING (public.has_org_role(organisation_id, array['owner','club_admin','safeguarding_officer']::public.platform_role[]));
CREATE POLICY join_requests_update ON public.club_join_requests FOR UPDATE TO authenticated
  USING (public.has_org_role(organisation_id, array['owner','club_admin']::public.platform_role[]))
  WITH CHECK (public.has_org_role(organisation_id, array['owner','club_admin']::public.platform_role[]));
CREATE POLICY join_requests_delete ON public.club_join_requests FOR DELETE TO authenticated
  USING (public.has_org_role(organisation_id, array['owner','club_admin']::public.platform_role[]));

CREATE OR REPLACE FUNCTION public.submit_club_join_request(p_slug text, p_name text, p_email text, p_phone text, p_interest text, p_junior boolean, p_message text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_org uuid; v_email text := lower(btrim(coalesce(p_email, '')));
BEGIN
  SELECT s.organisation_id INTO v_org FROM public.club_sites s JOIN public.organisations o ON o.id = s.organisation_id
    WHERE s.published AND (s.web_slug = lower(btrim(p_slug)) OR o.slug = lower(btrim(p_slug))) LIMIT 1;
  IF v_org IS NULL THEN RAISE EXCEPTION 'This club is not taking requests online.'; END IF;
  IF (SELECT count(*) FROM public.club_join_requests WHERE organisation_id = v_org AND lower(email) = v_email AND created_at > now() - interval '1 day') >= 3 THEN
    RAISE EXCEPTION 'We already have your request — the club will be in touch.';
  END IF;
  IF (SELECT count(*) FROM public.club_join_requests WHERE organisation_id = v_org AND created_at > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'Too many requests right now. Please try again later.';
  END IF;
  INSERT INTO public.club_join_requests (organisation_id, name, email, phone, interest, junior, message)
  VALUES (v_org, btrim(p_name), v_email, nullif(btrim(coalesce(p_phone, '')), ''), coalesce(p_interest, 'player'), coalesce(p_junior, false), nullif(btrim(coalesce(p_message, '')), ''));
  RETURN true;
END $function$;
REVOKE ALL ON FUNCTION public.submit_club_join_request(text, text, text, text, text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_club_join_request(text, text, text, text, text, boolean, text) TO anon, authenticated;

-- Looking-for board
CREATE TABLE public.board_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('players_wanted','match_wanted','player_available')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 120),
  detail text CHECK (detail IS NULL OR char_length(detail) <= 1000),
  poster_name text NOT NULL CHECK (char_length(btrim(poster_name)) BETWEEN 1 AND 120),
  country_code text CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  region text CHECK (region IS NULL OR char_length(region) <= 80),
  town text CHECK (town IS NULL OR char_length(town) <= 80),
  play_date date,
  format text CHECK (format IS NULL OR char_length(format) <= 40),
  contact text CHECK (contact IS NULL OR char_length(contact) <= 200),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  CHECK ((kind = 'player_available') = (organisation_id IS NULL))
);
CREATE INDEX board_posts_open ON public.board_posts(status, country_code, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_posts TO authenticated;
GRANT ALL ON public.board_posts TO service_role;
ALTER TABLE public.board_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY board_posts_select ON public.board_posts FOR SELECT TO authenticated
  USING ((status = 'open' AND expires_at > now()) OR created_by = (select auth.uid())
    OR (organisation_id IS NOT NULL AND public.is_event_manager(organisation_id)));
CREATE POLICY board_posts_insert ON public.board_posts FOR INSERT TO authenticated
  WITH CHECK (created_by = (select auth.uid()) AND expires_at <= now() + interval '90 days'
    AND (organisation_id IS NULL OR public.is_event_manager(organisation_id)));
CREATE POLICY board_posts_update ON public.board_posts FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()) OR (organisation_id IS NOT NULL AND public.is_event_manager(organisation_id)))
  WITH CHECK (expires_at <= now() + interval '90 days'
    AND (organisation_id IS NULL OR public.is_event_manager(organisation_id)));
CREATE POLICY board_posts_delete ON public.board_posts FOR DELETE TO authenticated
  USING (created_by = (select auth.uid()) OR (organisation_id IS NOT NULL AND public.is_event_manager(organisation_id)));

DROP TRIGGER IF EXISTS audit_point_adjustments ON public.competition_point_adjustments;
CREATE TRIGGER audit_club_join_requests AFTER UPDATE OR DELETE ON public.club_join_requests FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('organisation_id');