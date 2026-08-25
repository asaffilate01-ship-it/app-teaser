# CricLume production setup

The repository now contains the production data model, access policies, realtime/offline scoring
client, multi-phone camera page, public scoreboard, operational dashboard and server-side adapters.
External services stay disabled until their credentials and policies are supplied.

Set `PUBLIC_APP_ORIGINS` to the comma-separated production web origins allowed to call browser-facing
Edge Functions. Do not use `*`; Stripe signature and scheduled-job secret headers are deliberately
excluded from browser CORS and remain server-to-server only.

## 1. Create the Supabase environments

Use separate Supabase projects for development, staging and production. Install the Supabase CLI,
link the correct project and apply the migration:

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy invite-member
supabase functions deploy create-checkout-session
supabase functions deploy rain-calculate
supabase functions deploy analyze-delivery
supabase functions deploy transcode-video
supabase functions deploy send-notifications
supabase functions deploy cleanup-media
```

Copy `.env.example` to `.env.local` for local development. Only the Supabase URL and publishable key
and non-secret Stripe Price ID belong in the browser. Store all secret values with
`supabase secrets set`.

For the scheduled managed-backup monitor, add `SUPABASE_PROJECT_REF` and a fine-grained
`SUPABASE_ACCESS_TOKEN` with only `backups_read` permission as GitHub repository secrets. The workflow
checks PITR or the age of the latest completed provider backup and never exports database contents to
GitHub Actions.

Enable a production SMTP provider in Supabase Auth, customize invite/recovery templates and add the
production and staging redirect URLs. The built-in SMTP service is not a production mail service.

## 2. Provision organisations and matches

The first authenticated user can insert an organisation; an owner membership is created
automatically. Owners, league administrators and club administrators can then invite people through
the `invite-member` function. RLS is authoritative for every API request. The UI permission matrix is
only a convenience and never grants access.

Create teams, a season, a competition, a versioned rule pack and fixtures. Each match pins its rule
version so later rule edits cannot alter a historical result. Open the scorer with
`/app?cloudMatch=MATCH_UUID` to append encrypted, idempotent events and synchronize authorized phones.

## 3. Public scoreboards

Create a `public_scoreboards` row, choose a unique slug, set the match visibility to `public` and
enable the board. Only the safe `get_public_scoreboard` RPC is callable anonymously. The public route
is `/scoreboard/SLUG`; direct anonymous access to match, delivery and player tables remains blocked.

## 4. Multi-phone capture and video

Create a room with `create_camera_room(match_id)`. Its short-lived pairing token can connect signed-in
phones at `/camera/ROOM_UUID`. Recording is blocked in the UI until consent is confirmed. Each phone
publishes presence/health, records its own angle and uses TUS resumable uploads to the private
`match-video` bucket.

Configure a transcoding provider behind `VIDEO_TRANSCODE_ENDPOINT`. The adapter requests proxy,
thumbnail and optional blurred variants. Use a provider that supports signed input URLs, verified
callbacks, regional processing and deletion. Do not make the bucket public.

Schedule `cleanup-media` daily using a secret header. It permanently removes expired objects unless a
legal hold is present. Source video should also be copied to an independent backup store if the club's
retention policy requires recoverability; Supabase database backups do not include Storage objects.

## 5. Billing and email

Create Stripe Products and recurring Prices, set `VITE_STRIPE_PRICE_CLUB` to the public recurring
Price ID, then set `STRIPE_SECRET_KEY` in the server environment. Register
`https://YOUR_APP_DOMAIN/api/stripe-webhook` for Checkout and subscription lifecycle events and store
its signing secret alongside `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in the web runtime. That server
route verifies the raw Stripe signature before it uses the Supabase secret key; there is no
JWT-disabled Edge Function.
Subscription state is webhook-driven and idempotent; never grant an entitlement from the Checkout
redirect alone.

Auth invites use Supabase's admin API. Application notifications use a provider-neutral HTTPS adapter.
Set the provider endpoint and schedule `send-notifications` with a Supabase service-role JWT and
`CRON_SECRET`. Use the same two checks for `cleanup-media`; neither scheduled function allows browser
CORS or bypasses the Supabase JWT gateway.

## 6. Rain rules and AI

Rain calculation fails closed unless the competition rule version names a provider, method and
edition and a licensed provider endpoint is configured. Every request, result, provider reference and
response hash is stored. Do not describe an unlicensed approximation as DLS.

AI analysis is advisory. It cannot mutate a score. Jobs retain provider/model versions, the consent
snapshot, evidence timestamps, confidence and the human review decision. Junior biometric
identification is disabled even when general coaching analysis is permitted.

## 7. Release gates

- Complete the privacy impact assessment, junior safeguarding review and data-processing agreements.
- Run the migration/RLS test workflow and an independent penetration test.
- Enable daily managed backups or PITR, approve a separate logical/Storage backup destination, and rehearse restore.
- Configure monitoring, alerting, a status page and an on-call/incident process.
- Pilot complete matches on current iPhone and Android devices, including offline recovery and conflicts.
- Obtain the rain-rule licence, App Store/Play Console accounts and production payment/email accounts.
- Complete the app-store checklist in `docs/RELEASE_CHECKLIST.md` before submitting a native wrapper.
