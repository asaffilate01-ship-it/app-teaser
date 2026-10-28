-- Nullable for existing organisations and older clients. Retries are scoped to the creator.
alter table public.organisations add column creation_request_id uuid;
alter table public.organisations add constraint organisations_creator_request_key unique (created_by, creation_request_id);

create function public.preserve_organisation_creation_request()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.creation_request_id is distinct from new.creation_request_id
     or (old.creation_request_id is not null and old.created_by is distinct from new.created_by) then
    raise exception 'Organisation creation identity cannot be changed.' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger preserve_organisation_creation_request before update on public.organisations
for each row execute function public.preserve_organisation_creation_request();
revoke all on function public.preserve_organisation_creation_request() from public, anon, authenticated;

create function public.create_organisation_once(p_request_id uuid, p_name text, p_kind public.organisation_kind)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_name text := btrim(p_name);
  v_existing public.organisations%rowtype;
  v_constraint text;
begin
  if v_user is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_request_id is null or p_kind is null or v_name is null or char_length(v_name) not between 2 and 120 then
    raise exception 'A request ID, organisation type and name of 2 to 120 characters are required.' using errcode = '22023';
  end if;
  begin
    insert into public.organisations(kind, name, slug, created_by, creation_request_id)
  values(p_kind, v_name, 'org-' || gen_random_uuid()::text, v_user, p_request_id)
    ;
  exception when unique_violation then
    -- The unique request constraint serialises concurrent retries. RLS is
    -- checked when the winning row is read below; never return a hidden row.
    get stacked diagnostics v_constraint = CONSTRAINT_NAME;
    if v_constraint <> 'organisations_creator_request_key' then raise; end if;
  end;
  -- This statement runs after any conflicting insert commits. RLS still applies.
  select * into v_existing from public.organisations
    where created_by = v_user and creation_request_id = p_request_id;
  if not found then raise exception 'Organisation access is unavailable.' using errcode = '42501'; end if;
  if v_existing.name <> v_name or v_existing.kind <> p_kind then
    raise exception 'This request was already used for different organisation details.' using errcode = '22023';
  end if;
  return v_existing.id;
end;
$$;
revoke all on function public.create_organisation_once(uuid,text,public.organisation_kind) from public, anon;
grant execute on function public.create_organisation_once(uuid,text,public.organisation_kind) to authenticated;
