begin;

-- PostgreSQL grants EXECUTE to PUBLIC for new functions by default. Reset the
-- public schema after all application functions exist, then explicitly expose
-- only the RPCs required by authenticated clients and the safe scoreboard RPC.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.platform_role[]) to authenticated;
grant execute on function public.can_view_match(uuid) to authenticated;
grant execute on function public.can_score_match(uuid) to authenticated;
grant execute on function public.can_access_camera_room(uuid) to authenticated;
grant execute on function public.can_upload_video(uuid, uuid, uuid) to authenticated;
grant execute on function public.append_match_event(uuid, uuid, text, text, jsonb, timestamptz) to authenticated;
grant execute on function public.record_delivery_v1(uuid, uuid, uuid, text, jsonb, jsonb, timestamptz) to authenticated;
grant execute on function public.record_delivery_v2(uuid, uuid, uuid, text, jsonb, jsonb, jsonb, timestamptz) to authenticated;
grant execute on function public.create_camera_room(uuid, text) to authenticated;
grant execute on function public.pair_camera_device(text, text, text, text) to authenticated;
grant execute on function public.create_competition_workspace(uuid, text, text, text, date, date, jsonb) to authenticated;
grant execute on function public.create_match_workspace(uuid, uuid, uuid, uuid, uuid, timestamptz, public.match_visibility, uuid, integer, integer, integer, jsonb, text) to authenticated;
grant execute on function public.record_player_consent_decision(uuid, uuid, public.consent_state, public.consent_state, public.consent_state, public.consent_state, text) to authenticated;
grant execute on function public.start_match_innings(uuid, integer, uuid, uuid) to authenticated;
grant execute on function public.void_last_delivery_v1(uuid, uuid, uuid, text, jsonb, jsonb, timestamptz) to authenticated;

grant execute on function public.get_public_scoreboard(text) to anon, authenticated;

commit;
