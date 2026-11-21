-- CricLume: check real private S3 video objects after signed LiveKit egress completion.
-- Do not deploy this to Dishbee or treat object existence as publication approval.
begin;

alter table public.camera_cloud_recordings
  add column archive_check_status text not null default 'uninspected'
    check (archive_check_status in (
      'uninspected','object_confirmed','object_missing',
      'invalid_object','storage_error','review_required'
    )),
  add column archive_check_attempts integer not null default 0
    check (archive_check_attempts between 0 and 5),
  add column archive_object_bytes bigint
    check (archive_object_bytes is null or archive_object_bytes >= 0),
  add column archive_object_etag text
    check (archive_object_etag is null or char_length(archive_object_etag) <= 200),
  add column archive_checked_at timestamptz,
  add column archive_object_confirmed_at timestamptz,
  add constraint cloud_archive_confirmed_only_with_evidence check (
    archive_check_status <> 'object_confirmed'
    or (
      archive_object_bytes >= 1024
      and archive_checked_at is not null
      and archive_object_confirmed_at is not null
      and state = 'provider_completed'
    )
  );

create index camera_cloud_archive_inspection_pending
  on public.camera_cloud_recordings(created_at)
  where state = 'provider_completed'
    and archive_check_status in ('uninspected','object_missing','storage_error')
    and archive_check_attempts < 5;

-- The parent table already has RLS and no authenticated INSERT/UPDATE/DELETE
-- grants. Only the service role updates verified object metadata.
-- Even after an object is confirmed, all viewing and download permissions
-- remain separate from this non-public storage evidence.
commit;
