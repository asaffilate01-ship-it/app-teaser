begin;
create table public.video_processing_jobs (
 id uuid primary key default gen_random_uuid(),asset_id uuid not null unique references public.video_assets(id) on delete cascade,
 status text not null default 'processing' check(status in ('processing','ready','failed')),output_prefix text not null,kinds text[] not null,
 created_at timestamptz not null default now(),completed_at timestamptz
);
alter table public.video_processing_jobs enable row level security;
revoke all on public.video_processing_jobs from public,anon,authenticated;
grant all on public.video_processing_jobs to service_role;
create function public.claim_video_processing(p_asset uuid,p_user uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a public.video_assets;j public.video_processing_jobs;prefix text;kinds text[];
begin
 select * into a from public.video_assets where id=p_asset for update;
 if not found or not exists(select 1 from public.organisation_members where organisation_id=a.organisation_id and user_id=p_user and status='active' and role in ('owner','league_admin','club_admin','coach','safeguarding_officer')) then raise exception 'Video processing permission denied';end if;
 select * into j from public.video_processing_jobs where asset_id=p_asset;
 if found then return jsonb_build_object('jobId',j.id,'reused',true,'status',j.status);end if;
 if a.status<>'uploaded' or a.recording_consent<>'granted' or a.storage_path is null or a.retention_expires_at<=now() then raise exception 'Consented current upload required';end if;
 if not exists(select 1 from storage.objects where bucket_id='match-video' and name=a.storage_path) then raise exception 'Source object missing';end if;
 prefix:=a.organisation_id::text||'/'||a.room_id::text||'/'||a.id::text||'/processed/';
 kinds:=case when a.blur_mode='none' then array['proxy','thumbnail'] else array['proxy','thumbnail','blurred'] end;
 insert into public.video_processing_jobs(asset_id,output_prefix,kinds) values(a.id,prefix,kinds) returning * into j;
 update public.video_assets set status='processing' where id=a.id;
 return jsonb_build_object('jobId',j.id,'reused',false,'status','processing','prefix',prefix,'kinds',to_jsonb(kinds));
end $$;
create function public.complete_video_processing(p_job uuid,p_status text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j public.video_processing_jobs;a public.video_assets;k text;path text;
begin
 if p_status not in ('ready','failed') or p_status is null then raise exception 'Invalid callback state';end if;
 select a0.* into a from public.video_assets a0 join public.video_processing_jobs j0 on j0.asset_id=a0.id where j0.id=p_job for update of a0;
 if not found then raise exception 'Unknown media job';end if;
 select * into j from public.video_processing_jobs where id=p_job for update;
 if j.status<>'processing' then if j.status<>p_status then raise exception 'Conflicting completion';end if;return jsonb_build_object('jobId',j.id,'status',j.status,'reused',true);end if;
 if a.status<>'processing' or a.recording_consent<>'granted' or a.retention_expires_at<=now() then raise exception 'Media consent, retention or state changed';end if;
 if p_status='ready' then foreach k in array j.kinds loop
  path:=j.output_prefix||k||case when k='thumbnail' then '.jpg' else '.mp4' end;
  if not exists(select 1 from storage.objects where bucket_id='match-video' and name=path) then raise exception 'Completed output missing from private storage';end if;
  insert into public.video_variants(asset_id,kind,storage_path,status) values(a.id,k,path,'ready');
 end loop;end if;
 update public.video_assets set status=p_status::public.media_status where id=a.id;
 update public.video_processing_jobs set status=p_status,completed_at=now() where id=j.id;
 return jsonb_build_object('jobId',j.id,'status',p_status,'reused',false);
end $$;
revoke all on function public.claim_video_processing(uuid,uuid) from public,anon,authenticated;
revoke all on function public.complete_video_processing(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_video_processing(uuid,uuid) to service_role;
grant execute on function public.complete_video_processing(uuid,text) to service_role;
commit;
