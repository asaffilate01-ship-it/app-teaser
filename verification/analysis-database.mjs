import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(`create schema auth;create schema storage;create schema extensions;create schema realtime;
create table realtime.messages(extension text);create function realtime.topic() returns text language sql as $$select ''::text$$;
create role anon;create role authenticated;create role service_role bypassrls;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select current_user::text$$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
create publication supabase_realtime;
grant usage on schema public,auth,storage to anon,authenticated,service_role;
grant all on all tables in schema storage to service_role;grant select,insert,update,delete on storage.objects to authenticated;
alter default privileges in schema public grant all on tables to service_role;`);
const root = new URL("../supabase/migrations/", import.meta.url);
for (const file of (await readdir(root)).filter((f) => f.endsWith(".sql")).sort()) {
  // Embedded PostgreSQL has built-in UUIDs; hosted extension installation is tested separately.
  await db.exec(
    (await readFile(new URL(file, root), "utf8")).replace(
      /create extension if not exists pgcrypto with schema extensions;/i,
      "",
    ),
  );
}
const a = "a1000000-0000-4000-8000-000000000001",
  b = "a1000000-0000-4000-8000-000000000002",
  org = "a2000000-0000-4000-8000-000000000001",
  other = "a2000000-0000-4000-8000-000000000002",
  match = "a4000000-0000-4000-8000-000000000001",
  file = "a5000000-0000-4000-8000-000000000001";
for (const u of [a, b])
  await db.query("insert into auth.users(id,email) values($1,$2)", [u, "fixture@example.invalid"]);
for (const [o, u] of [
  [org, a],
  [other, b],
]) {
  await db.query(
    "insert into public.organisations(id,kind,name,slug,created_by) values($1,'club','Fixture',$2,$3)",
    [o, o, u],
  );
  await db.query(
    "insert into public.organisation_members(organisation_id,user_id,role) values($1,$2,'coach') on conflict do nothing",
    [o, u],
  );
  await db.query(
    "insert into public.teams(id,organisation_id,name,short_name) values($1,$1,'Fixture','F')",
    [o],
  );
}
await db.query(
  "insert into public.matches(id,owner_organisation_id,home_team_id,away_team_id,created_by) values($1,$2,$2,$3,$4)",
  [match, org, other, a],
);
async function asUser(u, fn) {
  await db.exec("begin;set local role authenticated;");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [u]);
  try {
    const r = await fn();
    await db.exec("commit");
    return r;
  } catch (e) {
    await db.exec("rollback");
    throw e;
  }
}
const path = `${org}/${match}/${file}.jpg`;
await asUser(a, async () => {
  await db.query(
    "insert into public.criclume_analysis_files(id,organisation_id,match_id,kind,storage_path,label,analysis_consent,created_by) values($1,$2,$3,'image',$4,'Fixture',true,$5)",
    [file, org, match, path, a],
  );
  await db.query("insert into storage.objects(bucket_id,name) values('criclume-evidence',$1)", [
    path,
  ]);
  assert.equal((await db.query("select * from public.criclume_analysis_files")).rows.length, 1);
  assert.equal(
    (await db.query("select * from storage.objects where bucket_id='criclume-evidence'")).rows
      .length,
    1,
  );
  await db.query(
    "insert into public.criclume_analysis_notes(organisation_id,match_id,discipline,note,created_by) values($1,$2,'batting','Human coaching note',$3)",
    [org, match, a],
  );
});
await asUser(b, async () => {
  for (const table of ["criclume_analysis_files", "criclume_analysis_notes"])
    assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0);
  assert.equal(
    (await db.query("select * from storage.objects where bucket_id='criclume-evidence'")).rows
      .length,
    0,
  );
  assert.equal(
    (await db.query("delete from public.criclume_analysis_files where id=$1 returning id", [file]))
      .rows.length,
    0,
  );
});
await assert.rejects(
  () =>
    asUser(b, () =>
      db.query(
        "insert into public.criclume_analysis_notes(organisation_id,match_id,discipline,note,created_by) values($1,$2,'batting','Cross-club attempt',$3)",
        [other, match, b],
      ),
    ),
  (e) => e.code === "42501",
);
// Structured review classifications and evidence scope are enforced by PostgreSQL.
const secondMatch = "a4000000-0000-4000-8000-000000000002";
await db.query(
  "insert into public.matches(id,owner_organisation_id,home_team_id,away_team_id,created_by) values($1,$2,$2,$3,$4)",
  [secondMatch, org, other, a],
);
const writeAnnotation = (user, m, fields = {}) =>
  asUser(user, () =>
    db.query(
      "insert into public.criclume_analysis_notes(organisation_id,match_id,discipline,note,created_by,shot_type,bowling_length,evidence_file_id,evidence_time_seconds) values($1,$2,'batting','Coach review',$3,$4,$5,$6,$7) returning id",
      [org, m, user, fields.shot ?? "drive", "full", fields.file ?? file, fields.seconds ?? null],
    ),
  );
await writeAnnotation(a, match);
await assert.rejects(
  () => writeAnnotation(a, secondMatch),
  (e) => e.code === "42501",
);
await assert.rejects(
  () => writeAnnotation(b, match),
  (e) => e.code === "42501",
);
await assert.rejects(
  () => writeAnnotation(a, match, { shot: "invented" }),
  (e) => e.code === "23514",
);
await assert.rejects(
  () => writeAnnotation(a, match, { seconds: 0 }),
  (e) => e.code === "42501",
); // photo cannot have video time
const videoFile = "a5000000-0000-4000-8000-000000000002";
await asUser(a, () =>
  db.query(
    "insert into public.criclume_analysis_files(id,organisation_id,match_id,kind,storage_path,label,analysis_consent,created_by) values($1,$2,$3,'video',$4,'Video fixture',true,$5)",
    [videoFile, org, match, `${org}/${match}/${videoFile}.mp4`, a],
  ),
);
const reviewId = (await writeAnnotation(a, match, { file: videoFile, seconds: 12 })).rows[0].id;
await assert.rejects(
  () => writeAnnotation(a, match, { file: videoFile, seconds: -1 }),
  (e) => e.code === "23514",
);
await assert.rejects(
  () => writeAnnotation(a, match, { file: videoFile, seconds: 86401 }),
  (e) => e.code === "23514",
);
await assert.rejects(
  () =>
    asUser(a, () =>
      db.query("update public.criclume_analysis_notes set shot_type='cut' where id=$1", [reviewId]),
    ),
  (e) => e.code === "42501",
);
await assert.rejects(
  () =>
    asUser(a, () => db.query("delete from public.criclume_analysis_notes where id=$1", [reviewId])),
  (e) => e.code === "42501",
);
await asUser(a, () =>
  db.query("delete from public.criclume_analysis_files where id=$1", [videoFile]),
);
const retained = (
  await asUser(a, () =>
    db.query(
      "select evidence_file_id,evidence_time_seconds from public.criclume_analysis_notes where id=$1",
      [reviewId],
    ),
  )
).rows[0];
assert.equal(retained.evidence_file_id, null);
assert.equal(retained.evidence_time_seconds, 12);
await db.query(
  "update public.criclume_analysis_files set retention_expires_at=now()-interval '1 day' where id=$1",
  [file],
);
await asUser(a, async () => {
  assert.equal((await db.query("select * from public.criclume_analysis_files")).rows.length, 0);
  assert.equal(
    (await db.query("select * from storage.objects where bucket_id='criclume-evidence'")).rows
      .length,
    0,
  );
});
await assert.rejects(
  () => writeAnnotation(a, match),
  (e) => e.code === "42501",
); // expired source
assert.equal(
  (
    await db.query(
      "select has_table_privilege('anon','public.criclume_analysis_files','select') as allowed",
    )
  ).rows[0].allowed,
  false,
);
// Atomic media completion requires real private output objects; no provider is called.
const room = "a6000000-0000-4000-8000-000000000001",
  device = "a7000000-0000-4000-8000-000000000001",
  asset = "a8000000-0000-4000-8000-000000000001";
await db.query("insert into public.camera_rooms(id,match_id,opened_by) values($1,$2,$3)", [
  room,
  match,
  a,
]);
await db.query(
  "insert into public.camera_devices(id,room_id,user_id,device_key,label,angle) values($1,$2,$3,'fixture','Fixture','pavilion_end')",
  [device, room, a],
);
await db.query(
  "insert into public.video_assets(id,organisation_id,room_id,device_id,storage_path,started_at,status,recording_consent,retention_expires_at,created_by) values($1,$2,$3,$4,'fixture-source.webm',now(),'uploaded','granted',now()+interval '1 day',$5)",
  [asset, org, room, device, a],
);
await db.query(
  "insert into storage.objects(bucket_id,name) values('match-video','fixture-source.webm')",
);
assert.equal(
  (
    await db.query(
      "select has_function_privilege('authenticated','public.complete_video_processing(uuid,text)','execute') as allowed",
    )
  ).rows[0].allowed,
  false,
);
await assert.rejects(
  () => db.query("select public.claim_video_processing($1,$2)", [asset, b]),
  /permission denied/,
);
const job = (await db.query("select public.claim_video_processing($1,$2) as j", [asset, a])).rows[0]
  .j;
const repeat = (await db.query("select public.claim_video_processing($1,$2) as j", [asset, a]))
  .rows[0].j;
assert.equal(job.jobId, repeat.jobId);
assert.equal(repeat.reused, true);
await assert.rejects(
  () => db.query("select public.complete_video_processing($1,'ready')", [job.jobId]),
  /output missing/,
);
assert.equal(
  (await db.query("select status from public.video_assets where id=$1", [asset])).rows[0].status,
  "processing",
);
for (const path of [job.prefix + "proxy.mp4", job.prefix + "thumbnail.jpg"])
  await db.query("insert into storage.objects(bucket_id,name) values('match-video',$1)", [path]);
assert.equal(
  (await db.query("select public.complete_video_processing($1,'ready') as r", [job.jobId])).rows[0]
    .r.status,
  "ready",
);
assert.equal(
  (await db.query("select public.complete_video_processing($1,'ready') as r", [job.jobId])).rows[0]
    .r.reused,
  true,
);
await assert.rejects(
  () => db.query("select public.complete_video_processing($1,'failed')", [job.jobId]),
  /Conflicting completion/,
);
assert.equal(
  (
    await db.query("select count(*)::integer as n from public.video_variants where asset_id=$1", [
      asset,
    ])
  ).rows[0].n,
  2,
);
// Exercise both CASE branches through the actual match-creation RPC.
const away = "a2000000-0000-4000-8000-000000000003";
await db.query(
  "insert into public.teams(id,organisation_id,name,short_name) values($1,$2,'Second fixture team','S')",
  [away, org],
);
await db.query(
  "update public.organisation_members set role='owner' where organisation_id=$1 and user_id=$2",
  [org, a],
);
for (const team of [org, away]) {
  for (let i = 0; i < 2; i++) {
    const player = (
      await db.query(
        "insert into public.players(organisation_id,display_name) values($1,'Fixture player') returning id",
        [org],
      )
    ).rows[0].id;
    await db.query("insert into public.team_players(team_id,player_id) values($1,$2)", [
      team,
      player,
    ]);
  }
}
for (const scheduled of [null, "2026-12-01T10:00:00Z"]) {
  const result = (
    await asUser(a, () =>
      db.query(
        "select public.create_match_workspace($1,$1,$2,null,null,$3,'private',$1,20,1,6,'{}',null) as result",
        [org, away, scheduled],
      ),
    )
  ).rows[0].result;
  const created = (
    await db.query("select status from public.matches where id=$1", [result.matchId])
  ).rows[0];
  assert.equal(created.status, scheduled ? "scheduled" : "draft");
  assert.equal(
    (
      await db.query("select count(*)::int as n from public.match_squads where match_id=$1", [
        result.matchId,
      ])
    ).rows[0].n,
    4,
  );
  assert.equal(
    (await db.query("select match_id from public.innings where id=$1", [result.inningsId])).rows[0]
      .match_id,
    result.matchId,
  );
}
await assert.rejects(
  () =>
    asUser(b, () =>
      db.query(
        "select public.create_match_workspace($1,$1,$2,null,null,null,'private',$1,20,1,6,'{}',null)",
        [org, away],
      ),
    ),
  (e) => e.code === "42501",
);
// Notes on an undone delivery remain readable but new notes cannot target that delivery.
const fixture = (
  await db.query(
    "select i.id as innings_id,m.id as match_id from public.matches m join public.innings i on i.match_id=m.id where m.owner_organisation_id=$1 and m.status='scheduled' limit 1",
    [org],
  )
).rows[0];
const batterIds = (
  await db.query("select player_id from public.team_players where team_id=$1 order by player_id", [
    org,
  ])
).rows.map((r) => r.player_id);
const bowler = (
  await db.query("select player_id from public.team_players where team_id=$1 limit 1", [away])
).rows[0].player_id;
const deliveryId = (
  await db.query(
    "insert into public.deliveries(match_id,innings_id,sequence,over_number,ball_in_over,striker_id,non_striker_id,bowler_id,outcome,occurred_at,recorded_by) values($1,$2,1,0,1,$3,$4,$5,'runs',now(),$6) returning id",
    [fixture.match_id, fixture.innings_id, batterIds[0], batterIds[1], bowler, a],
  )
).rows[0].id;
const insertDeliveryNote = () =>
  asUser(a, () =>
    db.query(
      "insert into public.criclume_analysis_notes(organisation_id,match_id,discipline,delivery_id,note,created_by) values($1,$2,'batting',$3,'Retained review',$4) returning id",
      [org, fixture.match_id, deliveryId, a],
    ),
  );
const oldNote = (await insertDeliveryNote()).rows[0].id;
const undoEvent = (
  await db.query(
    "insert into public.match_events(match_id,sequence,client_event_id,device_id,event_type,payload,occurred_at,recorded_by) values($1,1,gen_random_uuid(),'fixture','undo','{}',now(),$2) returning id",
    [fixture.match_id, a],
  )
).rows[0].id;
await db.query("update public.deliveries set voided_by_event_id=$2 where id=$1", [
  deliveryId,
  undoEvent,
]);
await assert.rejects(insertDeliveryNote, (e) => e.code === "42501");
assert.equal(
  (
    await asUser(a, () =>
      db.query("select id from public.criclume_analysis_notes where id=$1", [oldNote]),
    )
  ).rows.length,
  1,
);
assert.equal(
  (
    await asUser(b, () =>
      db.query("select id from public.criclume_analysis_notes where id=$1", [oldNote]),
    )
  ).rows.length,
  0,
);
// Evidence browsing can reach beyond the former 100-file cap without crossing tenant scope.
await db.query(
  `insert into public.criclume_analysis_files(id,organisation_id,match_id,kind,storage_path,label,analysis_consent,includes_junior,created_by,created_at)
select id,$1::uuid,$2::uuid,case when n%2=0 then 'video' else 'image' end,$1::uuid::text||'/'||$2::uuid::text||'/'||id::text||'.webm','Archive '||lpad(n::text,3,'0'),true,n%2=1,$3::uuid,now()-n*interval '1 minute'
from (select gen_random_uuid() id,n from generate_series(1,125) n) fixtures`,
  [org, match, a],
);
const finalPage = await asUser(a, () =>
  db.query(
    "select id,label from public.criclume_analysis_files where organisation_id=$1 and match_id=$2 and analysis_consent and retention_expires_at>now() order by created_at desc,id offset 120 limit 25",
    [org, match],
  ),
);
assert.equal(finalPage.rows.length, 5);
assert.equal(finalPage.rows[4].label, "Archive 125");
const olderSource = finalPage.rows[4].id;
assert.equal(
  (
    await asUser(a, () =>
      db.query(
        "select id from public.criclume_analysis_files where id=$1 and organisation_id=$2 and match_id=$3 and retention_expires_at>now()",
        [olderSource, org, match],
      ),
    )
  ).rows.length,
  1,
);
assert.equal(
  (
    await asUser(b, () =>
      db.query("select id from public.criclume_analysis_files where id=$1", [olderSource]),
    )
  ).rows.length,
  0,
);
assert.equal(
  (
    await asUser(a, () =>
      db.query(
        "select count(*)::int n from public.criclume_analysis_files where organisation_id=$1 and match_id=$2 and kind='video' and not includes_junior and label ilike '%Archive 12%' and retention_expires_at>now()",
        [org, match],
      ),
    )
  ).rows[0].n,
  3,
);
await db.close();
console.log(
  "All migrations applied; structured annotations, source scope/expiry/deletion, append-only coaching writes, cross-club isolation, object access, expiry, anonymous denial and atomic media completion passed.",
);
