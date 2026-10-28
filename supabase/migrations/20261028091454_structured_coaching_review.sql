begin;
-- Explicit grants also cover projects with permissive default table privileges.
revoke all on public.criclume_analysis_notes from anon, authenticated;
grant select, insert on public.criclume_analysis_notes to authenticated;
-- Append-only human annotations. Existing notes remain valid with null classifications.
alter table public.criclume_analysis_notes
 add column shot_type text check (shot_type in ('drive','cut','pull','hook','sweep','reverse_sweep','defence','glance','lofted','other')),
 add column bowling_line text check (bowling_line in ('outside_off','off_stump','middle_stump','leg_stump','outside_leg')),
 add column bowling_length text check (bowling_length in ('yorker','full','good','short','full_toss')),
 add column fielding_action text check (fielding_action in ('catch','drop','stop','misfield','throw','run_out','stumping')),
 add column evidence_file_id uuid references public.criclume_analysis_files(id) on delete set null,
 add column evidence_time_seconds integer check (evidence_time_seconds between 0 and 86400);
create index criclume_analysis_notes_evidence on public.criclume_analysis_notes(evidence_file_id) where evidence_file_id is not null;
-- Restrictive policy composes with the existing coach, author, tenant, match and delivery checks.
-- A retained timestamp after source deletion is provenance only, never a playable URL.
create policy analysis_notes_evidence_scope on public.criclume_analysis_notes as restrictive
 for insert to authenticated with check (
 (evidence_file_id is null and evidence_time_seconds is null)
 or exists (
   select 1 from public.criclume_analysis_files f
   where f.id=evidence_file_id and f.organisation_id=criclume_analysis_notes.organisation_id
     and f.match_id=criclume_analysis_notes.match_id and f.analysis_consent
     and f.retention_expires_at>now()
     and (evidence_time_seconds is null or f.kind='video')
 )
);
-- No updates/deletes or provider access added: source classifications cannot change scores.
commit;
