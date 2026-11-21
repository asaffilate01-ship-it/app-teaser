-- CricLume: private, append-only camera command acknowledgment ledger.
-- A receipt is a phone-reported response, NOT proof that video reached storage.
begin;

create table public.camera_command_receipts (
  command_id uuid primary key references public.camera_recording_commands(id) on delete cascade,
  room_id uuid not null references public.camera_rooms(id) on delete cascade,
  device_id uuid not null references public.camera_devices(id) on delete cascade,
  reported_by uuid not null references auth.users(id),
  outcome text not null check (
    outcome in ('started','already_recording','stopped','already_stopped','blocked','failed')
  ),
  reason_code text not null default 'none' check (
    reason_code in ('none','missing_consent','not_armed','preview_off','capture_failed')
  ),
  reported_at timestamptz not null default now(),
  check (
    (outcome in ('started','already_recording','stopped','already_stopped') and reason_code = 'none')
    or (outcome = 'blocked' and reason_code in ('missing_consent','not_armed','preview_off'))
    or (outcome = 'failed' and reason_code = 'capture_failed')
  )
);

create index camera_command_receipts_room_device_idx
  on public.camera_command_receipts(room_id, device_id, reported_at desc);

alter table public.camera_command_receipts enable row level security;
revoke all on public.camera_command_receipts from public, anon, authenticated;
grant select, insert on public.camera_command_receipts to authenticated;

create policy camera_command_receipts_read on public.camera_command_receipts
  for select to authenticated using (
    public.can_direct_camera_room(room_id)
    or exists (
      select 1 from public.camera_devices d
      where d.id = camera_command_receipts.device_id
        and d.room_id = camera_command_receipts.room_id
        and d.user_id = (select auth.uid())
    )
  );

-- Only the explicitly paired device owner may add the single immutable outcome
-- for a recent command addressed to exactly that device and room. A director
-- cannot impersonate a phone acknowledgment.
create policy camera_command_receipts_operator_insert on public.camera_command_receipts
  for insert to authenticated with check (
    reported_by = (select auth.uid())
    and exists (
      select 1 from public.camera_recording_commands c
      join public.camera_devices d on d.id = c.device_id and d.room_id = c.room_id
      where c.id = camera_command_receipts.command_id
        and c.room_id = camera_command_receipts.room_id
        and c.device_id = camera_command_receipts.device_id
        and d.user_id = (select auth.uid())
        and c.created_at >= now() - interval '5 minutes'
        and c.created_at <= now() + interval '5 seconds'
        and (
          (
            c.action = 'start'
            and camera_command_receipts.outcome in ('started','already_recording','blocked','failed')
          )
          or (
            c.action = 'stop'
            and camera_command_receipts.outcome in ('stopped','already_stopped','failed')
          )
        )
    )
  );

-- No authenticated UPDATE or DELETE grants: acknowledgments are immutable.
-- Supabase service role has its existing administrative bypass for audits.
commit;
