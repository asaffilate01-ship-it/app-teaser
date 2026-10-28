begin;
-- Compose with the existing author, coach-role, tenant, match and source checks.
create policy analysis_notes_current_delivery on public.criclume_analysis_notes as restrictive
 for insert to authenticated with check (
   delivery_id is null or exists (
     select 1 from public.deliveries d
     where d.id=delivery_id and d.match_id=criclume_analysis_notes.match_id
       and d.superseded_by is null and d.voided_by_event_id is null
   )
 );
-- Existing observations remain readable for historical review; no writes to scores.
commit;
