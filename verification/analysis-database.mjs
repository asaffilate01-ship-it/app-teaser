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
await db.close();
console.log(
  "All migrations applied; coaching writes, cross-club isolation, object access, expiry, anonymous denial and atomic media completion passed.",
);
