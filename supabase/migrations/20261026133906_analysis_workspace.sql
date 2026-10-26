begin;
create table public.criclume_analysis_files (
 id uuid primary key default gen_random_uuid(),organisation_id uuid not null references public.organisations(id),match_id uuid not null references public.matches(id),
 kind text not null check(kind in ('image','video')),storage_path text unique not null,label text not null check(length(label) between 1 and 150),
 analysis_consent boolean not null default false,includes_junior boolean not null default true,
 retention_expires_at timestamptz not null default now()+interval '90 days',created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 check(storage_path like organisation_id::text||'/'||match_id::text||'/'||id::text||'.%')
);
create table public.criclume_analysis_notes (
 id uuid primary key default gen_random_uuid(),organisation_id uuid not null references public.organisations(id),match_id uuid not null references public.matches(id),
 discipline text not null check(discipline in ('batting','bowling','fielding')),delivery_id uuid references public.deliveries(id),
 note text not null check(length(btrim(note)) between 3 and 3000),tags text not null default '' check(length(tags)<=300),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create index criclume_analysis_files_scope on public.criclume_analysis_files(organisation_id,match_id,created_at desc);
create index criclume_analysis_notes_scope on public.criclume_analysis_notes(organisation_id,match_id,created_at desc);
alter table public.criclume_analysis_files enable row level security;
alter table public.criclume_analysis_notes enable row level security;
grant select,insert,delete on public.criclume_analysis_files to authenticated;
grant select,insert on public.criclume_analysis_notes to authenticated;
create policy analysis_files_read on public.criclume_analysis_files for select to authenticated using (
 retention_expires_at>now() and public.has_org_role(organisation_id,array['owner','club_admin','league_admin','coach','safeguarding_officer']::public.platform_role[]));
create policy analysis_files_insert on public.criclume_analysis_files for insert to authenticated with check (
 created_by=(select auth.uid()) and analysis_consent and retention_expires_at between now() and now()+interval '90 days'
 and public.has_org_role(organisation_id,array['owner','club_admin','league_admin','coach','safeguarding_officer']::public.platform_role[])
 and exists(select 1 from public.matches m where m.id=match_id and m.owner_organisation_id=organisation_id));
create policy analysis_files_delete on public.criclume_analysis_files for delete to authenticated using (
 created_by=(select auth.uid()) and public.has_org_role(organisation_id,array['owner','club_admin','league_admin','coach','safeguarding_officer']::public.platform_role[]));
create policy analysis_notes_read on public.criclume_analysis_notes for select to authenticated using (
 public.has_org_role(organisation_id,array['owner','club_admin','league_admin','coach','safeguarding_officer']::public.platform_role[]));
create policy analysis_notes_insert on public.criclume_analysis_notes for insert to authenticated with check (
 created_by=(select auth.uid()) and public.has_org_role(organisation_id,array['owner','club_admin','league_admin','coach','safeguarding_officer']::public.platform_role[])
 and exists(select 1 from public.matches m where m.id=match_id and m.owner_organisation_id=organisation_id)
 and (delivery_id is null or exists(select 1 from public.deliveries d where d.id=delivery_id and d.match_id=criclume_analysis_notes.match_id and d.superseded_by is null)));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('criclume-evidence','criclume-evidence',false,52428800,array['image/jpeg','image/png','image/webp','video/mp4','video/webm']) on conflict(id) do nothing;
create policy analysis_object_read on storage.objects for select to authenticated using(bucket_id='criclume-evidence' and exists(select 1 from public.criclume_analysis_files f where f.storage_path=name));
create policy analysis_object_insert on storage.objects for insert to authenticated with check(bucket_id='criclume-evidence' and exists(select 1 from public.criclume_analysis_files f where f.storage_path=name and f.created_by=(select auth.uid())));
create policy analysis_object_delete on storage.objects for delete to authenticated using(bucket_id='criclume-evidence' and exists(select 1 from public.criclume_analysis_files f where f.storage_path=name and f.created_by=(select auth.uid())));
create trigger audit_analysis_files after insert or update or delete on public.criclume_analysis_files for each row execute function public.audit_row_change('organisation_id');
create trigger audit_analysis_notes after insert on public.criclume_analysis_notes for each row execute function public.audit_row_change('organisation_id');
commit;
