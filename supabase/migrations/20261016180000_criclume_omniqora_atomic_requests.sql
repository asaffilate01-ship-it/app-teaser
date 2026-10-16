-- Use the existing Lovable-connected CricLume Supabase database.
-- Atomic, idempotent reservations for an AI request; does NOT authorise spend.
-- Only the reviewed service-role Edge Function may call this helper.
CREATE OR REPLACE FUNCTION public.claim_criclume_omniqora_run(
  _organisation_id uuid,
  _match_id uuid,
  _tenant_id uuid,
  _task text,
  _source_version timestamptz,
  _requested_by uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  existing_id uuid;
  existing_status text;
  request_id uuid;
  request_status text;
  hour_count bigint;
BEGIN
  IF _organisation_id IS NULL OR _match_id IS NULL OR _tenant_id IS NULL
    OR _source_version IS NULL OR _requested_by IS NULL THEN
    RAISE EXCEPTION 'CRICLUME_AI_INVALID_SCOPE';
  END IF;

  IF _task NOT IN (
    'match_insights', 'batting_coach', 'bowling_coach',
    'fielding_review', 'training_plan', 'analyst_agent'
  ) THEN
    RAISE EXCEPTION 'CRICLUME_AI_INVALID_TASK';
  END IF;

  -- A single club must not race its own 12/hour limit from different devices.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_organisation_id::text, 0)
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.criclume_omniqora_links AS l
    WHERE l.organisation_id = _organisation_id
      AND l.omniqora_tenant_id = _tenant_id
      AND l.enabled = true
      AND l.approved_by IS NOT NULL
      AND l.approved_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'CRICLUME_AI_LINK_INACTIVE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.matches AS m
    WHERE m.id = _match_id
      AND m.owner_organisation_id = _organisation_id
      AND m.updated_at = _source_version
  ) THEN
    RAISE EXCEPTION 'CRICLUME_AI_MATCH_CHANGED';
  END IF;

  SELECT r.id, r.status INTO existing_id, existing_status
  FROM public.criclume_omniqora_runs AS r
  WHERE r.organisation_id = _organisation_id
    AND r.match_id = _match_id
    AND r.task = _task
    AND r.source_version = _source_version;

  IF existing_id IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'requestId', existing_id, 'status', existing_status, 'reused', true
    );
  END IF;

  SELECT count(*) INTO hour_count
  FROM public.criclume_omniqora_runs AS r
  WHERE r.organisation_id = _organisation_id
    AND r.requested_at >= pg_catalog.clock_timestamp() - interval '1 hour';

  IF hour_count >= 12 THEN
    RAISE EXCEPTION 'CRICLUME_AI_HOURLY_QUOTA';
  END IF;

  INSERT INTO public.criclume_omniqora_runs(
    organisation_id, match_id, omniqora_tenant_id, task,
    source_version, requested_by
  ) VALUES (
    _organisation_id, _match_id, _tenant_id, _task,
    _source_version, _requested_by
  ) RETURNING id, status INTO request_id, request_status;

  RETURN pg_catalog.jsonb_build_object(
    'requestId', request_id, 'status', request_status, 'reused', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_criclume_omniqora_run(
  uuid, uuid, uuid, text, timestamptz, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_criclume_omniqora_run(
  uuid, uuid, uuid, text, timestamptz, uuid
) TO service_role;

COMMENT ON FUNCTION public.claim_criclume_omniqora_run(
  uuid, uuid, uuid, text, timestamptz, uuid
) IS 'Only the authenticated CricLume Edge Function may atomically reserve an advisory request; billable model costs require a separate Omniqora budget reservation.';
