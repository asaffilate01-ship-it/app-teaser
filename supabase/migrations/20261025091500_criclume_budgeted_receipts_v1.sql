-- CricLume: prepare a source-owned receipt ledger for the separate
-- Omniqora budgeted Agent Factory. Additive; existing Lovable Supabase only.
-- This migration DOES NOT enable a paid model, create an Omniqora tenant,
-- change official scoring or call an external service.
BEGIN;

ALTER TABLE public.criclume_omniqora_runs
 ADD COLUMN IF NOT EXISTS omniqora_reservation_id uuid,
 ADD COLUMN IF NOT EXISTS omniqora_reserved_minor bigint
  CHECK(omniqora_reserved_minor IS NULL OR omniqora_reserved_minor BETWEEN 1 AND 10000),
 ADD COLUMN IF NOT EXISTS omniqora_currency text
  CHECK(omniqora_currency IS NULL OR omniqora_currency IN('GBP','EUR','USD')),
 ADD COLUMN IF NOT EXISTS admission_mode text NOT NULL DEFAULT 'legacy'
  CHECK(admission_mode IN('legacy','budgeted')),
 ADD COLUMN IF NOT EXISTS reconciliation_note text;

ALTER TABLE public.criclume_omniqora_runs
 DROP CONSTRAINT IF EXISTS criclume_omniqora_runs_status_check;

ALTER TABLE public.criclume_omniqora_runs
 ADD CONSTRAINT criclume_omniqora_runs_status_check
 CHECK(status IN(
  'starting','queued','running','waiting_review','completed',
  'failed','cancelled','stale','reconcile_required'
 ));

COMMENT ON COLUMN public.criclume_omniqora_runs.omniqora_reservation_id IS
 'Omniqora verified, atomic Agent Factory cost reservation UUID; not an invoice';
COMMENT ON COLUMN public.criclume_omniqora_runs.reconciliation_note IS
 'Operator-only receipt reconciliation state for ambiguous upstream timeouts';
COMMIT;
