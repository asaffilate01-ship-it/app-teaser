create or replace function public.is_ticket_manager(p_org uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select public.has_org_role(p_org, array['owner','club_admin','league_admin','treasurer']::public.platform_role[]);
$$;
revoke all on function public.is_ticket_manager(uuid) from public, anon;
grant execute on function public.is_ticket_manager(uuid) to authenticated, service_role;

create or replace function public.is_ticket_gate(p_org uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select public.has_org_role(p_org, array['owner','club_admin','league_admin','treasurer','team_manager','coach']::public.platform_role[]);
$$;
revoke all on function public.is_ticket_gate(uuid) from public, anon;
grant execute on function public.is_ticket_gate(uuid) to authenticated, service_role;

create table public.ticket_listings (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  details text check (details is null or char_length(details) <= 500),
  starts_at timestamptz not null,
  venue text check (venue is null or char_length(venue) <= 160),
  price_minor bigint not null default 0 check (price_minor >= 0 and price_minor <= 100000000),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  capacity integer not null check (capacity between 1 and 100000),
  max_per_order integer not null default 6 check (max_per_order between 1 and 20),
  on_sale boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ticket_listings_org on public.ticket_listings (organisation_id, starts_at);
grant select, insert, update, delete on public.ticket_listings to authenticated;
grant all on public.ticket_listings to service_role;
alter table public.ticket_listings enable row level security;
create policy ticket_listings_select on public.ticket_listings for select to authenticated using (public.is_org_member(organisation_id));
create policy ticket_listings_insert on public.ticket_listings for insert to authenticated with check (public.is_ticket_manager(organisation_id));
create policy ticket_listings_update on public.ticket_listings for update to authenticated using (public.is_ticket_manager(organisation_id)) with check (public.is_ticket_manager(organisation_id));
create policy ticket_listings_delete on public.ticket_listings for delete to authenticated using (public.is_ticket_manager(organisation_id));
create trigger ticket_listings_updated before update on public.ticket_listings for each row execute function public.set_updated_at();
create trigger audit_ticket_listings after insert or update or delete on public.ticket_listings for each row execute function public.audit_row_change('organisation_id');

create table public.ticket_orders (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  listing_id uuid not null references public.ticket_listings(id) on delete cascade,
  buyer_id uuid not null,
  buyer_name text not null check (char_length(buyer_name) between 2 and 80),
  buyer_phone text check (buyer_phone is null or char_length(buyer_phone) <= 30),
  quantity integer not null check (quantity between 1 and 20),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  method text check (method is null or method in ('raast','bank_transfer','easypaisa','jazzcash','mpesa','upi','bkash','other')),
  reference text check (reference is null or char_length(reference) between 3 and 120),
  status text not null default 'pending' check (status in ('pending','confirmed','rejected','cancelled')),
  code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 300),
  checked_in_at timestamptz,
  checked_in_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount_minor = 0 or (method is not null and reference is not null))
);
create index ticket_orders_org on public.ticket_orders (organisation_id, status);
create index ticket_orders_listing on public.ticket_orders (listing_id, status);
create index ticket_orders_buyer on public.ticket_orders (buyer_id, created_at desc);
create unique index ticket_orders_reference_once on public.ticket_orders (organisation_id, method, lower(reference))
  where reference is not null and status in ('pending','confirmed');
grant select on public.ticket_orders to authenticated;
grant all on public.ticket_orders to service_role;
alter table public.ticket_orders enable row level security;
create policy ticket_orders_select on public.ticket_orders for select to authenticated
  using (public.is_ticket_manager(organisation_id) or public.is_ticket_gate(organisation_id));
create trigger ticket_orders_updated before update on public.ticket_orders for each row execute function public.set_updated_at();
create trigger audit_ticket_orders after insert or update on public.ticket_orders for each row execute function public.audit_row_change('organisation_id');

-- Which organisation a website address belongs to (same rule as get_club_site), only when the site is published.
create or replace function public.ticket_site_org(p_slug text) returns uuid language sql stable security definer set search_path to '' as $$
  select coalesce(
    (select s.organisation_id from public.club_sites s where s.web_slug = p_slug and s.published),
    (select o.id from public.organisations o join public.club_sites s on s.organisation_id = o.id
      where o.slug = p_slug and s.published and not exists (select 1 from public.club_sites w where w.web_slug = p_slug))
  );
$$;
revoke all on function public.ticket_site_org(text) from public, anon, authenticated;

-- Public: tickets on sale on a published club website. No buyer details.
create or replace function public.get_club_tickets(p_slug text) returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare v_org uuid;
begin
  v_org := public.ticket_site_org(p_slug);
  if v_org is null then return jsonb_build_object('listings', '[]'::jsonb); end if;
  return jsonb_build_object('listings', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id, 'title', l.title, 'details', l.details, 'startsAt', l.starts_at, 'venue', l.venue,
      'priceMinor', l.price_minor, 'currency', l.currency, 'maxPerOrder', l.max_per_order,
      'remaining', greatest(0, l.capacity - coalesce((select sum(o.quantity) from public.ticket_orders o
        where o.listing_id = l.id and o.status in ('pending','confirmed')), 0))
    ) order by l.starts_at)
    from public.ticket_listings l
    where l.organisation_id = v_org and l.on_sale and l.starts_at > now() - interval '6 hours'), '[]'::jsonb));
end;
$$;
revoke all on function public.get_club_tickets(text) from public;
grant execute on function public.get_club_tickets(text) to anon, authenticated, service_role;

-- Signed-in buyers: where to send the money for a ticket on sale.
create or replace function public.ticket_payment_options(p_listing uuid)
 returns table (method text, account_title text, account_number text, instructions text)
 language plpgsql stable security definer set search_path to '' as $$
declare v public.ticket_listings;
begin
  if (select auth.uid()) is null then raise exception 'sign in to buy tickets' using errcode = '42501'; end if;
  select * into v from public.ticket_listings where id = p_listing;
  if not found or not v.on_sale or not exists (select 1 from public.club_sites s where s.organisation_id = v.organisation_id and s.published) then
    raise exception 'these tickets are not on sale' using errcode = '22023';
  end if;
  return query select a.method, a.account_title, a.account_number, a.instructions
    from public.club_payment_accounts a where a.organisation_id = v.organisation_id and a.active order by a.created_at;
end;
$$;
revoke all on function public.ticket_payment_options(uuid) from public, anon;
grant execute on function public.ticket_payment_options(uuid) to authenticated;

create or replace function public.request_tickets(p_listing uuid, p_quantity integer, p_name text, p_phone text, p_method text, p_reference text)
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
  v public.ticket_listings;
  v_taken integer;
  v_mine integer;
  v_ref text := nullif(regexp_replace(trim(coalesce(p_reference, '')), '\s+', ' ', 'g'), '');
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_order public.ticket_orders;
begin
  if v_uid is null then raise exception 'sign in to buy tickets' using errcode = '42501'; end if;
  select * into v from public.ticket_listings where id = p_listing for update;
  if not found or not v.on_sale or v.starts_at <= now() - interval '6 hours'
     or not exists (select 1 from public.club_sites s where s.organisation_id = v.organisation_id and s.published) then
    raise exception 'these tickets are not on sale' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > v.max_per_order then
    raise exception 'you can buy up to % tickets at a time', v.max_per_order using errcode = '22023';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then raise exception 'enter the name for the tickets' using errcode = '22023'; end if;
  if v_phone is not null and char_length(v_phone) > 30 then raise exception 'that phone number is too long' using errcode = '22023'; end if;
  select coalesce(sum(quantity), 0) into v_taken from public.ticket_orders where listing_id = v.id and status in ('pending','confirmed');
  if v_taken + p_quantity > v.capacity then
    raise exception 'only % tickets are left', greatest(0, v.capacity - v_taken) using errcode = '53400';
  end if;
  select coalesce(sum(quantity), 0) into v_mine from public.ticket_orders where listing_id = v.id and buyer_id = v_uid and status in ('pending','confirmed');
  if v_mine + p_quantity > v.max_per_order then
    raise exception 'you can hold up to % tickets for this match', v.max_per_order using errcode = '22023';
  end if;
  if (select count(*) from public.ticket_orders where buyer_id = v_uid and status = 'pending') >= 5 then
    raise exception 'you have too many ticket payments waiting to be checked' using errcode = '53400';
  end if;
  if v.price_minor > 0 then
    if v_ref is null or char_length(v_ref) < 3 or char_length(v_ref) > 120 then
      raise exception 'enter the transaction reference from your transfer' using errcode = '22023';
    end if;
    if not exists (select 1 from public.club_payment_accounts a where a.organisation_id = v.organisation_id and a.active and a.method = p_method) then
      raise exception 'the club does not take that payment method' using errcode = '22023';
    end if;
  end if;
  begin
    insert into public.ticket_orders (organisation_id, listing_id, buyer_id, buyer_name, buyer_phone, quantity, amount_minor, currency, method, reference, status, decided_at)
    values (v.organisation_id, v.id, v_uid, v_name, v_phone, p_quantity, v.price_minor * p_quantity, v.currency,
            case when v.price_minor > 0 then p_method end, case when v.price_minor > 0 then v_ref end,
            case when v.price_minor > 0 then 'pending' else 'confirmed' end,
            case when v.price_minor > 0 then null else now() end)
    returning * into v_order;
  exception when unique_violation then
    raise exception 'that transaction reference has already been used' using errcode = '23505';
  end;
  return jsonb_build_object('id', v_order.id, 'status', v_order.status,
    'code', case when v_order.status = 'confirmed' then v_order.code end);
end;
$$;
revoke all on function public.request_tickets(uuid, integer, text, text, text, text) from public, anon;
grant execute on function public.request_tickets(uuid, integer, text, text, text, text) to authenticated;

create or replace function public.decide_ticket_order(p_order uuid, p_confirm boolean, p_note text)
 returns void language plpgsql security definer set search_path to '' as $$
declare v public.ticket_orders;
begin
  select * into v from public.ticket_orders where id = p_order for update;
  if not found then raise exception 'ticket order not found' using errcode = '22023'; end if;
  if not public.is_ticket_manager(v.organisation_id) then
    raise exception 'only the treasurer or a club admin can check ticket payments' using errcode = '42501';
  end if;
  if v.status <> 'pending' then raise exception 'this ticket payment was already checked' using errcode = '22023'; end if;
  update public.ticket_orders
     set status = case when p_confirm then 'confirmed' else 'rejected' end,
         decided_by = (select auth.uid()), decided_at = now(),
         decision_note = left(nullif(trim(coalesce(p_note, '')), ''), 300)
   where id = p_order;
end;
$$;
revoke all on function public.decide_ticket_order(uuid, boolean, text) from public, anon;
grant execute on function public.decide_ticket_order(uuid, boolean, text) to authenticated;

-- Buyers cancel while waiting; ticket managers can cancel any ticket that hasn't been used (refunds are handled by hand).
create or replace function public.cancel_ticket_order(p_order uuid)
 returns void language plpgsql security definer set search_path to '' as $$
declare v public.ticket_orders; v_manager boolean;
begin
  select * into v from public.ticket_orders where id = p_order for update;
  if not found then raise exception 'ticket order not found' using errcode = '22023'; end if;
  v_manager := public.is_ticket_manager(v.organisation_id);
  if v.checked_in_at is not null then raise exception 'this ticket has already been used' using errcode = '22023'; end if;
  if v_manager then
    if v.status not in ('pending','confirmed') then raise exception 'this ticket is already closed' using errcode = '22023'; end if;
  elsif v.buyer_id = (select auth.uid()) then
    if v.status <> 'pending' then raise exception 'ask the club to cancel a confirmed ticket' using errcode = '42501'; end if;
  else
    raise exception 'you cannot cancel this ticket' using errcode = '42501';
  end if;
  update public.ticket_orders set status = 'cancelled', decided_by = (select auth.uid()), decided_at = now() where id = p_order;
end;
$$;
revoke all on function public.cancel_ticket_order(uuid) from public, anon;
grant execute on function public.cancel_ticket_order(uuid) to authenticated;

create or replace function public.check_in_ticket(p_org uuid, p_code text)
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare v public.ticket_orders; v_title text; v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if not public.is_ticket_gate(p_org) then raise exception 'only club staff can check tickets' using errcode = '42501'; end if;
  select * into v from public.ticket_orders where organisation_id = p_org and code = v_code for update;
  if not found then return jsonb_build_object('result', 'unknown'); end if;
  select title into v_title from public.ticket_listings where id = v.listing_id;
  if v.status <> 'confirmed' then
    return jsonb_build_object('result', 'not_valid', 'status', v.status, 'title', v_title, 'name', v.buyer_name, 'quantity', v.quantity);
  end if;
  if v.checked_in_at is not null then
    return jsonb_build_object('result', 'already', 'at', v.checked_in_at, 'title', v_title, 'name', v.buyer_name, 'quantity', v.quantity);
  end if;
  update public.ticket_orders set checked_in_at = now(), checked_in_by = (select auth.uid()) where id = v.id;
  return jsonb_build_object('result', 'admitted', 'title', v_title, 'name', v.buyer_name, 'quantity', v.quantity);
end;
$$;
revoke all on function public.check_in_ticket(uuid, text) from public, anon;
grant execute on function public.check_in_ticket(uuid, text) to authenticated;

-- A buyer's own tickets. The code only shows once the payment is confirmed.
create or replace function public.my_tickets()
 returns jsonb language sql stable security definer set search_path to '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'listingId', o.listing_id, 'title', l.title, 'startsAt', l.starts_at, 'venue', l.venue,
    'club', org.name, 'quantity', o.quantity, 'amountMinor', o.amount_minor, 'currency', o.currency,
    'method', o.method, 'reference', o.reference, 'status', o.status,
    'code', case when o.status = 'confirmed' then o.code end,
    'checkedInAt', o.checked_in_at, 'note', o.decision_note, 'createdAt', o.created_at
  ) order by l.starts_at desc, o.created_at desc), '[]'::jsonb)
  from public.ticket_orders o
  join public.ticket_listings l on l.id = o.listing_id
  join public.organisations org on org.id = o.organisation_id
  where o.buyer_id = (select auth.uid());
$$;
revoke all on function public.my_tickets() from public, anon;
grant execute on function public.my_tickets() to authenticated;