alter table public.fee_payments drop constraint if exists fee_payments_method_check;
alter table public.fee_payments add constraint fee_payments_method_check
  check (method in ('cash','bank_transfer','raast','card','jazzcash','easypaisa','mpesa','upi','bkash','other'));

create table public.club_payment_accounts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  method text not null check (method in ('raast','bank_transfer','easypaisa','jazzcash','mpesa','upi','bkash','other')),
  account_title text not null check (char_length(account_title) between 1 and 120),
  account_number text not null check (char_length(account_number) between 3 and 60),
  instructions text check (instructions is null or char_length(instructions) <= 300),
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index club_payment_accounts_org on public.club_payment_accounts (organisation_id);
grant select, insert, update, delete on public.club_payment_accounts to authenticated;
grant all on public.club_payment_accounts to service_role;
alter table public.club_payment_accounts enable row level security;
create policy payment_accounts_select on public.club_payment_accounts for select to authenticated using (public.is_org_member(organisation_id));
create policy payment_accounts_insert on public.club_payment_accounts for insert to authenticated with check (public.is_finance_manager(organisation_id));
create policy payment_accounts_update on public.club_payment_accounts for update to authenticated using (public.is_finance_manager(organisation_id)) with check (public.is_finance_manager(organisation_id));
create policy payment_accounts_delete on public.club_payment_accounts for delete to authenticated using (public.is_finance_manager(organisation_id));
create trigger club_payment_accounts_updated before update on public.club_payment_accounts for each row execute function public.set_updated_at();
create trigger audit_club_payment_accounts after insert or update or delete on public.club_payment_accounts for each row execute function public.audit_row_change('organisation_id');

create table public.fee_payment_claims (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  charge_id uuid not null references public.fee_charges(id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  method text not null check (method in ('raast','bank_transfer','easypaisa','jazzcash','mpesa','upi','bkash','other')),
  reference text not null check (char_length(trim(reference)) between 3 and 120),
  paid_on date not null default current_date,
  note text check (note is null or char_length(note) <= 300),
  submitted_by uuid not null default auth.uid(),
  status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 300),
  payment_id uuid references public.fee_payments(id) on delete set null,
  created_at timestamptz not null default now()
);
create index fee_payment_claims_org on public.fee_payment_claims (organisation_id, status);
create unique index fee_payment_claims_reference_once on public.fee_payment_claims (organisation_id, method, lower(trim(reference))) where status <> 'rejected';
grant select, insert on public.fee_payment_claims to authenticated;
grant all on public.fee_payment_claims to service_role;
alter table public.fee_payment_claims enable row level security;

create or replace function public.can_pay_charge(p_charge_id uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.fee_charges c where c.id = p_charge_id and public.can_act_for_player(c.player_id));
$$;
create policy fee_claims_select on public.fee_payment_claims for select to authenticated
  using (submitted_by = (select auth.uid()) or public.can_pay_charge(charge_id) or public.is_finance_manager(organisation_id));
create policy fee_claims_insert on public.fee_payment_claims for insert to authenticated
  with check (submitted_by = (select auth.uid()) and (public.can_pay_charge(charge_id) or public.is_finance_manager(organisation_id)));

create or replace function public.fee_claim_before()
 returns trigger language plpgsql security definer set search_path to '' as $$
declare v_charge public.fee_charges; v_pending bigint;
begin
  select * into v_charge from public.fee_charges where id = new.charge_id for update;
  if not found then raise exception 'charge not found' using errcode = '22023'; end if;
  new.organisation_id := v_charge.organisation_id;
  new.submitted_by := coalesce((select auth.uid()), new.submitted_by);
  new.status := 'pending';
  new.decided_by := null; new.decided_at := null; new.payment_id := null;
  new.reference := trim(new.reference);
  if v_charge.status in ('paid','waived') then
    raise exception 'nothing is owed on this charge' using errcode = '22023';
  end if;
  select coalesce(sum(c.amount_minor), 0) into v_pending from public.fee_payment_claims c where c.charge_id = new.charge_id and c.status = 'pending';
  if new.amount_minor + v_pending > v_charge.amount_minor - v_charge.paid_minor then
    raise exception 'that is more than what is still owed (including payments waiting to be checked)' using errcode = '22023';
  end if;
  if (select count(*) from public.fee_payment_claims c where c.charge_id = new.charge_id and c.status = 'pending') >= 5 then
    raise exception 'too many payments are waiting to be checked for this charge' using errcode = '53400';
  end if;
  return new;
end;
$$;
create trigger fee_claim_before before insert on public.fee_payment_claims for each row execute function public.fee_claim_before();
create trigger audit_fee_payment_claims after insert or update on public.fee_payment_claims for each row execute function public.audit_row_change('organisation_id');

create or replace function public.decide_fee_claim(p_claim_id uuid, p_confirm boolean, p_note text)
 returns void language plpgsql security definer set search_path to '' as $$
declare v public.fee_payment_claims; v_payment uuid;
begin
  select * into v from public.fee_payment_claims where id = p_claim_id for update;
  if not found then raise exception 'payment not found' using errcode = '22023'; end if;
  if not public.is_finance_manager(v.organisation_id) then
    raise exception 'only the treasurer or a club admin can check payments' using errcode = '42501';
  end if;
  if v.status <> 'pending' then raise exception 'this payment was already checked' using errcode = '22023'; end if;
  if p_confirm then
    insert into public.fee_payments (organisation_id, charge_id, amount_minor, method, paid_on, reference, recorded_by)
    values (v.organisation_id, v.charge_id, v.amount_minor, v.method, v.paid_on, left(v.reference, 120), (select auth.uid()))
    returning id into v_payment;
  end if;
  update public.fee_payment_claims
     set status = case when p_confirm then 'confirmed' else 'rejected' end,
         decided_by = (select auth.uid()), decided_at = now(),
         decision_note = left(nullif(trim(p_note), ''), 300), payment_id = v_payment
   where id = p_claim_id;
end;
$$;
revoke all on function public.decide_fee_claim(uuid, boolean, text) from public, anon;
grant execute on function public.decide_fee_claim(uuid, boolean, text) to authenticated;