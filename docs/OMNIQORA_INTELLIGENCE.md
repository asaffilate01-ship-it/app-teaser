# CricLume → Omniqora Intelligence — integration and activation

**Status: integration source ready for CI and a controlled Lovable/Supabase pilot; NOT
a claim of live Omniqora execution or production deployment.**

CricLume remains the authority for match scores, events, players, permissions,
consent, video and publication. Omniqora remains the authority for AI/provider
routing, approved agents, budgets, usage and human action proposals.

## Existing Lovable Supabase project — do not create a replacement

- CricLume repository: `asaffilate01-ship-it/app-teaser`.
- Lovable project: `4fdd88f7-86ce-40f6-8f36-03dbb58cdac2`.
- CricLume's `supabase/config.toml` declares `eivwnjbykohrlxavvpcr` as the project reference.
  **This is a repository configuration, not evidence that latest migrations/functions are deployed.**
- The supplied Supabase connector currently exposes another SaaS project; do not apply
  CricLume migrations to it.
- Continue using the existing Lovable-bound Supabase URL and publishable key for
  `/platform`, `/app` and `functions.invoke`.
- Do **not** place `OMNIQORA_SERVICE_AUTH` in a `VITE_*` env variable or browser.

## Contract and data flow

```text
CricLume club operator (Supabase Auth, role-checked)
  -> /platform > AI Intelligence (browser session)
  -> Lovable-connected Supabase Edge Function: omniqora-intelligence
     -> checks club membership and match ownership in CricLume
     -> reads backend-only criclume_omniqora_links + runs
     -> strips all player names/IDs, notes, DOB, video/biometrics
     -> fixed task, aggregate score values, source version, max 3-5 steps
     -> server-to-server /api/platform/intelligence on Omniqora
        -> Omniqora tenant/product-scoped credential & entitlement
        -> budget/policy/provider-approved work queue and agent runtime
     <- queued run ID, later advisory result
  <- reviewed draft, never a score mutation
```

The Omniqora source API currently implements **async** `run.start` and `run.get`
and responds with a queued run ID; it does not guarantee a deployed worker, an
available LLM provider, an executed MCP tool, or completed GenAI results.

Allowed tasks: match insights, batting coach, bowling coach, fielding review,
training plan and a bounded read-only match analyst. No arbitrary user prompt,
provider key, model key or tool access is accepted across the browser boundary.
Cricket source evidence is deliberately aggregate-only. Junior-specific video
analysis remains disabled until individual consent and safeguarding tests are
separately approved.

## Activation prerequisites — operator-only

1. Verify the actual Lovable-connected CricLume project matches the declared
   project reference, current Auth settings, SQL migrations and Edge Functions.
2. Review and apply `20261016153000_criclume_omniqora_intelligence.sql` through
   the existing Lovable-managed Supabase release process. It adds two isolated,
   RLS-enabled, backend-only tables. It does not provision any customer or tenant.
3. Review the Omniqora tenancy and authorise a **different, existing Omniqora
   tenant UUID per CricLume club**. Have a trusted operator insert
   `criclume_omniqora_links` mappings, with independent `approved_by` and
   `approved_at` verification; leave `enabled=false` pending pilot.
4. In Omniqora, issue a server-to-server platform service credential (format
   `<keyId>.<secret>`) with only `intelligence.run.start` and
   `intelligence.run.read` for productKey `criclume` and precisely the
   approved tenant UUIDs. Provision active `omniqora.intelligence-runtime`
   entitlements and verify the service credential is not expired.
5. Configure **Supabase Edge Function secrets** in the existing Lovable project:
   - `OMNIQORA_INTELLIGENCE_URL=https://YOUR_OMNIQORA_HOST/api/platform/intelligence`
   - `OMNIQORA_SERVICE_AUTH=<keyId>.<secret>`
   - `OMNIQORA_CRICLUME_ENABLED=false` initially
   The URL is fixed server-side and must use HTTPS. Keep `SUPABASE_SECRET_KEY`
   or provider-managed service-role credentials in the server runtime only.
6. Verify Omniqora provider/model bindings, real verified tariffs, spending
   approval, budget reservation/settlement and the AI execution worker. The
   generic `run.start` service used by this first pilot must not be mistaken
   for budgeted Agent Factory execution; **do not enable live paid model runs
   until the upstream cost gate and worker are verified**.
7. Enable each reviewed mapping and set the server-side flag only for the
   controlled authorised-coach pilot. Smoke-test the Edge Function and the
   `/platform` AI Intelligence tab.
8. Run negative tests: wrong club, wrong match, revoked member, unauthorised role,
   expired credential, duplicate request, stale run, unknown task, hostile prompt,
   provider outage, junior data payload, no entitlement and cross-tenant denial.
   Then verify provider usage receipts and human approval reports.

## Safeguarding and operational rules

- Official scoring and match publication are never writable by Omniqora.
- No private player identities, medical details, identifiable junior records,
  raw video, audio or consent documents are exported by this bridge.
- Match status, runs, wickets, overs, target and last-six *labels* are the
  entirety of externally shared match data (plus source UUID for audit).
- A cached previous request for the same score revision is returned rather
  than charging again. A failed/ambiguous remote start is not blindly retried.
- Each club has 12 AI starts/hour in the source adapter; Omniqora still
  controls higher-level budgets, throttles and model allocation.
- Use only approved aggregate facts. No unverified inferences presented as
  video analysis, biometric recognition or licensed DLS calculations.
- Retain separate video consent and `analyze-delivery` review workflow; this
  feature does not replace it.

## Verification commands

```bash
bun run typecheck
bun run test
bun run lint
bun run build
supabase test db
```

The code can be built and unit tested without live credentials; these tests
cannot certify an actual Lovable deployment or external Omniqora run.
