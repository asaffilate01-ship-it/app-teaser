do $$
declare
  o uuid := gen_random_uuid(); a uuid := gen_random_uuid(); t uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  p uuid := gen_random_uuid(); d1 uuid := gen_random_uuid(); d2 uuid := gen_random_uuid(); x uuid := gen_random_uuid();
  org1 uuid; org2 uuid; j uuid; ap uuid; g uuid; fs uuid; ch uuid; b1 uuid; b2 uuid; ev uuid; r1 uuid; r2 uuid; bk uuid; it uuid; ord uuid; cl uuid;
  n int; s text; log text := '';
  u uuid;
begin
  foreach u in array array[o,a,t,c,p,d1,d2,x] loop
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-'||u||'@example.com', '', now(), now(), now(), '{}', '{}');
  end loop;
  insert into public.organisations (kind, name, slug, created_by) values ('club', 'Test CC', 'rls-test-'||left(o::text,8), o) returning id into org1;
  insert into public.organisations (kind, name, slug, created_by) values ('club', 'Other CC', 'rls-other-'||left(x::text,8), x) returning id into org2;
  insert into public.organisation_members (organisation_id, user_id, role, status) values
    (org1, a, 'club_admin', 'active'), (org1, t, 'treasurer', 'active'), (org1, c, 'coach', 'active'),
    (org1, p, 'viewer', 'active'), (org1, d1, 'viewer', 'active'), (org1, d2, 'viewer', 'active')
  on conflict (organisation_id, user_id) do update set role = excluded.role, status = 'active';
  insert into public.organisation_members (organisation_id, user_id, role, status) values (org2, x, 'owner', 'active') on conflict do nothing;
  insert into public.players (organisation_id, display_name, is_junior) values (org1, 'Junior J', true) returning id into j;
  insert into public.players (organisation_id, display_name, is_junior, linked_user_id) values (org1, 'Adult AP', false, d1) returning id into ap;
  insert into public.player_guardians (organisation_id, player_id, user_id) values (org1, j, p);
  insert into public.grounds (organisation_id, name) values (org1, 'Main Ground') returning id into g;

  create or replace function pg_temp.act(p_user uuid) returns void language plpgsql as $f$
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
  end $f$;

  -- Roles
  perform pg_temp.act(a);
  begin update public.organisation_members set role='owner' where organisation_id=org1 and user_id=a; log := log||'1 BAD self-promote; ';
  exception when others then log := log||'1 ok self-promote refused; '; end;
  begin update public.organisation_members set role='club_admin' where organisation_id=org1 and user_id=t; log := log||'2 BAD admin made admin; ';
  exception when others then log := log||'2 ok cannot make admin; '; end;
  update public.organisation_members set role='team_manager' where organisation_id=org1 and user_id=c;
  update public.organisation_members set role='coach' where organisation_id=org1 and user_id=c; log := log||'3 ok admin changed coach role; ';
  begin update public.organisation_members set role='viewer' where organisation_id=org1 and user_id=o; log := log||'4 BAD demoted owner; ';
  exception when others then log := log||'4 ok owner protected; '; end;
  execute 'reset role';
  perform pg_temp.act(o);
  begin update public.organisation_members set role='viewer' where organisation_id=org1 and user_id=o; log := log||'5 BAD owner self-demote; ';
  exception when others then log := log||'5 ok owner self-change refused; '; end;
  execute 'reset role';

  -- Fees
  perform pg_temp.act(t);
  insert into public.fee_schedules (organisation_id, name, amount_minor, currency) values (org1, 'Season subs', 2500000, 'PKR') returning id into fs;
  insert into public.fee_charges (organisation_id, schedule_id, player_id, description, amount_minor, currency) values (org1, fs, j, 'Season subs', 2500000, 'PKR') returning id into ch;
  begin insert into public.fee_payments (organisation_id, charge_id, amount_minor, method) values (org1, ch, 3000000, 'cash'); log := log||'6 BAD overpay; ';
  exception when others then log := log||'6 ok overpay refused; '; end;
  insert into public.fee_payments (organisation_id, charge_id, amount_minor, method) values (org1, ch, 1000000, 'jazzcash');
  select status into s from public.fee_charges where id = ch; log := log||'7 status='||s||'; ';
  execute 'reset role';
  perform pg_temp.act(c);
  begin insert into public.fee_schedules (organisation_id, name, amount_minor, currency) values (org1, 'x', 1, 'PKR'); log := log||'8 BAD coach made fee; ';
  exception when others then log := log||'8 ok coach cannot set fees; '; end;
  execute 'reset role';
  perform pg_temp.act(p); select count(*) into n from public.fee_charges; log := log||'9 parent sees '||n||' charge; ';
  begin insert into public.fee_payments (organisation_id, charge_id, amount_minor, method) values (org1, ch, 1, 'cash'); log := log||'10 BAD parent recorded payment; ';
  exception when others then log := log||'10 ok parent cannot record payment; '; end;
  execute 'reset role';
  perform pg_temp.act(d1); select count(*) into n from public.fee_charges; log := log||'11 other member sees '||n||' charges; '; execute 'reset role';

  -- Ground bookings
  perform pg_temp.act(a); update public.grounds set bookable = true where id = g; execute 'reset role';
  perform pg_temp.act(x);
  b1 := public.request_ground_booking(g, org2, 'Friendly', 'match', now() + interval '2 days', now() + interval '2 days 6 hours', null);
  b2 := public.request_ground_booking(g, org2, 'Nets', 'nets', now() + interval '2 days 2 hours', now() + interval '2 days 4 hours', null);
  select count(*) into n from public.ground_bookings; log := log||'12 other club sees '||n||' own requests; ';
  begin update public.ground_bookings set status='approved' where id=b1; get diagnostics n = row_count; log := log||'13 other club approve rows='||n||'; ';
  exception when others then log := log||'13 ok other club cannot approve; '; end;
  execute 'reset role';
  perform pg_temp.act(a);
  update public.ground_bookings set status='approved' where id=b1;
  begin update public.ground_bookings set status='approved' where id=b2; log := log||'14 BAD double booking; ';
  exception when others then log := log||'14 ok double booking refused; '; end;
  execute 'reset role';

  -- Events, availability, selection
  perform pg_temp.act(c);
  insert into public.club_events (organisation_id, kind, title, starts_at) values (org1, 'match', 'U13 v Rivals', now() + interval '3 days') returning id into ev;
  execute 'reset role';
  perform pg_temp.act(p); insert into public.event_availability (organisation_id, event_id, player_id, status) values (org1, ev, j, 'available'); log := log||'15 ok parent answered; '; execute 'reset role';
  perform pg_temp.act(d1);
  begin insert into public.event_availability (organisation_id, event_id, player_id, status) values (org1, ev, j, 'unavailable'); log := log||'16 BAD stranger answered; ';
  exception when others then log := log||'16 ok stranger cannot answer for child; '; end;
  select count(*) into n from public.event_availability; log := log||'17 stranger sees '||n||' answers; ';
  execute 'reset role';
  perform pg_temp.act(c); insert into public.event_selections (organisation_id, event_id, player_id, captain) values (org1, ev, j, true); execute 'reset role';
  perform pg_temp.act(p); select count(*) into n from public.event_selections; log := log||'18 before publish parent sees '||n||'; '; execute 'reset role';
  perform pg_temp.act(c); update public.club_events set selection_published_at = now() where id = ev; execute 'reset role';
  perform pg_temp.act(p); select count(*) into n from public.event_selections; log := log||'19 after publish sees '||n||'; '; execute 'reset role';

  -- Travel
  perform pg_temp.act(d1); insert into public.ride_offers (organisation_id, event_id, seats, meet_point) values (org1, ev, 3, 'Club car park') returning id into r1; execute 'reset role';
  perform pg_temp.act(p);
  begin insert into public.ride_bookings (organisation_id, ride_id, player_id, guardian_consent) values (org1, r1, j, true); log := log||'20 BAD junior with unapproved driver; ';
  exception when others then log := log||'20 ok unapproved driver refused; '; end;
  execute 'reset role';
  perform pg_temp.act(a);
  begin insert into public.travel_drivers (organisation_id, user_id) values (org1, d2); log := log||'21 BAD admin approved driver; ';
  exception when others then log := log||'21 ok only safeguarding/owner approve drivers; '; end;
  execute 'reset role';
  perform pg_temp.act(o); insert into public.travel_drivers (organisation_id, user_id, checks_note) values (org1, d2, 'DBS seen'); execute 'reset role';
  perform pg_temp.act(d2); insert into public.ride_offers (organisation_id, event_id, seats, meet_point) values (org1, ev, 1, 'Station') returning id into r2; execute 'reset role';
  perform pg_temp.act(p);
  begin insert into public.ride_bookings (organisation_id, ride_id, player_id) values (org1, r2, j); log := log||'22 BAD no consent; ';
  exception when others then log := log||'22 ok parent consent required; '; end;
  insert into public.ride_bookings (organisation_id, ride_id, player_id, guardian_consent) values (org1, r2, j, true) returning id into bk; log := log||'23 ok booked; ';
  begin update public.ride_bookings set status='confirmed' where id=bk; log := log||'24 BAD parent self-confirmed; ';
  exception when others then log := log||'24 ok parent cannot confirm; '; end;
  execute 'reset role';
  perform pg_temp.act(d1);
  begin insert into public.ride_bookings (organisation_id, ride_id, player_id) values (org1, r2, ap); log := log||'25 BAD overfilled car; ';
  exception when others then log := log||'25 ok full car refused; '; end;
  execute 'reset role';
  perform pg_temp.act(d2); update public.ride_bookings set status='confirmed' where id=bk; log := log||'26 ok driver confirmed; '; execute 'reset role';

  -- Store
  perform pg_temp.act(c);
  begin insert into public.club_items (organisation_id, kind, name, stock) values (org1, 'equipment', 'x', 1); log := log||'27 BAD coach added stock; ';
  exception when others then log := log||'27 ok coach cannot manage store; '; end;
  execute 'reset role';
  perform pg_temp.act(t); insert into public.club_items (organisation_id, kind, name, stock, loanable) values (org1, 'equipment', 'Junior helmet', 2, true) returning id into it; execute 'reset role';
  perform pg_temp.act(p); insert into public.item_orders (organisation_id, item_id, player_id) values (org1, it, j) returning id into ord;
  begin update public.item_orders set status='collected' where id=ord; log := log||'28 BAD parent marked collected; ';
  exception when others then log := log||'28 ok parent cannot change order status; '; end;
  execute 'reset role';
  perform pg_temp.act(t);
  insert into public.equipment_loans (organisation_id, item_id, player_id, quantity) values (org1, it, j, 2);
  begin insert into public.equipment_loans (organisation_id, item_id, player_id, quantity) values (org1, it, ap, 1); log := log||'29 BAD over-lent; ';
  exception when others then log := log||'29 ok cannot lend more than stock; '; end;
  execute 'reset role';

  -- Transfer payments (Raast / Easypaisa / JazzCash with a reference)
  perform pg_temp.act(t);
  insert into public.club_payment_accounts (organisation_id, method, account_title, account_number) values (org1, 'raast', 'Test CC', '03001234567');
  select public.charge_fee_schedule(fs, array[j, ap]) into n; log := log||'31 charged new='||n||' (j skipped); ';
  execute 'reset role';
  perform pg_temp.act(c);
  begin perform public.charge_fee_schedule(fs, array[ap]); select count(*) into n from public.fee_charges where schedule_id=fs; log := log||'32 coach charge rows='||n||'; ';
  exception when others then log := log||'32 ok coach cannot charge; '; end;
  select count(*) into n from public.fee_payment_claims; log := log||'33 coach sees claims='||n||'; ';
  execute 'reset role';
  perform pg_temp.act(p);
  select count(*) into n from public.club_payment_accounts where organisation_id=org1; log := log||'34 parent sees accounts='||n||'; ';
  insert into public.fee_payment_claims (organisation_id, charge_id, amount_minor, method, reference) values (org1, ch, 1000000, 'raast', ' TID 111 ') returning id into cl;
  log := log||'35 ok parent sent claim; ';
  begin insert into public.fee_payment_claims (organisation_id, charge_id, amount_minor, method, reference) values (org1, ch, 1000000, 'easypaisa', 'EP 222'); log := log||'36 BAD overclaim; ';
  exception when others then log := log||'36 ok overclaim refused; '; end;
  begin insert into public.fee_payment_claims (organisation_id, charge_id, amount_minor, method, reference) values (org1, ch, 100, 'raast', 'tid 111'); log := log||'37 BAD reused reference; ';
  exception when others then log := log||'37 ok reused reference refused; '; end;
  begin perform public.decide_fee_claim(cl, true, ''); log := log||'38 BAD parent confirmed own payment; ';
  exception when others then log := log||'38 ok parent cannot confirm; '; end;
  begin update public.fee_payment_claims set status='confirmed' where id=cl; get diagnostics n = row_count; log := log||'39 parent direct update rows='||n||'; ';
  exception when others then log := log||'39 ok parent cannot edit claim; '; end;
  execute 'reset role';
  perform pg_temp.act(d1);
  begin insert into public.fee_payment_claims (organisation_id, charge_id, amount_minor, method, reference) values (org1, ch, 100, 'jazzcash', 'JC 333'); log := log||'40 BAD non-family claimed; ';
  exception when others then log := log||'40 ok non-family refused; '; end;
  execute 'reset role';
  perform pg_temp.act(t);
  perform public.decide_fee_claim(cl, true, '');
  select status||' paid='||paid_minor into s from public.fee_charges where id=ch; log := log||'41 after confirm '||s;
  select status into s from public.fee_payment_claims where id=cl; log := log||' claim='||s||'; ';
  execute 'reset role';
  -- Outsider
  perform pg_temp.act(x);
  select count(*) into n from public.fee_charges where organisation_id = org1; log := log||'30 outsider fees='||n;
  select count(*) into n from public.club_events where organisation_id = org1; log := log||' events='||n;
  select count(*) into n from public.ride_offers where organisation_id = org1; log := log||' rides='||n;
  select count(*) into n from public.fee_payment_claims where organisation_id = org1; log := log||' claims='||n;
  select count(*) into n from public.club_payment_accounts where organisation_id = org1; log := log||' accounts='||n||'; ';
  execute 'reset role';

  raise exception 'ROLLBACK RESULT: %', log;
end $$;
