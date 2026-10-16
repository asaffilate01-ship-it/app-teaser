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
     -> cost-free scoped connection.verify on Omniqora
        -> approved service credential & tenant/product entitlement
     <- verified binding only; modelExecutionReady remains false
  -> local deterministic match preview (no tokens/charges)
  -> paid run.start is explicitly blocked pending budgeted admission
  -> existing run.get results remain read-only and become stale on score edits
```

The source and Omniqora **both block** CricLume generic `run.start`: the
generic queue does not reserve an approved spend budget. Source `run.list` and
`run.get` remain for historical runs, and the separate, cost-free
`connection.verify` checks actual service-credential scope and entitlement.
The result deliberately reports `modelExecutionReady:false`; even a verified
handshake does **not** mean a model/worker is live.

Allowed tasks: match insights, batting coach, bowling coach, fielding review,
training plan and a bounded read-only match analyst. No arbitrary user prompt,
provider key, model key or tool access is accepted across the browser boundary.
Cricket source evidence is deliberately aggregate-only. Junior-specific video
analysis remains disabled until individual consent and safeguarding tests are
separately approved.

## Activation prerequisites — operator-only

1. Verify the actual Lovable-connected CricLume project matches the declared
   project reference, current Auth settings, SQL migrations and Edge Functions.
2. Review and apply both `20261016153000_criclume_omniqora_intelligence.sql`
   and `20261016180000_criclume_omniqora_atomic_requests.sql` through the
   **existing** Lovable-managed Supabase release process, after checking actual
   migration history. They create two RLS-protected tables and a restricted,
   invoker-security atomic claim RPC. They do **not** provision tenants or
   create billable AI runs. The RPC is preparatory for a future budgeted caller.
3. Review the Omniqora tenancy and authorise a **different, existing Omniqora
   tenant UUID per CricLume club**. Have a trusted operator insert
   `criclume_omniqora_links` mappings, with independent `approved_by` and
   `approved_at` verification; leave `enabled=false` pending pilot.
4. In Omniqora, issue a server-to-server platform credential (format
   `<keyId>.<secret>`) with `intelligence.connection.verify` and
   `intelligence.run.read` only, scoped to productKey `criclume` and the
   approved tenant UUIDs. A `run.start` capability is not required while
   billable model execution remains blocked. Provision active
   `omniqora.intelligence-runtime` entitlements and verify credential expiry.
5. Configure **Supabase Edge Function secrets** in the existing Lovable project:
   - `OMNIQORA_INTELLIGENCE_URL=https://YOUR_OMNIQORA_HOST/api/platform/intelligence`
   - `OMNIQORA_SERVICE_AUTH=<keyId>.<secret>`
   - `OMNIQORA_CRICLUME_ENABLED=false` initially
   The URL is fixed server-side and must use HTTPS. Keep `SUPABASE_SECRET_KEY`
   or provider-managed service-role credentials in the server runtime only.
6. For paid GenAI/agentic activation, implement and verify a dedicated,
   authenticated **service-to-service budgeted admission endpoint** inside
   Omniqora that reuses the Agent Factory's atomic cost reservation and actual
   receipt settlement, reviewed model rates, region/capability evaluation,
   independent use-case approval and bounded worker. Do not reopen generic
   `run.start` for CricLume as a shortcut.
7. For a **connection-only** controlled coach pilot, enable reviewed mappings
   and set the server-side flag, then click "Verify Omniqora connection" in
   `/platform` and confirm the scoped handshake with **zero model cost**.
   Use the six free, deterministic coaching previews while billable AI is
   awaiting approval. A connection-only pilot must not be labelled a model pilot.
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
- The source migration contains an atomic, idempotent club request reservation
  capped at 12 new requests/hour. It is **not a spending approval** and the
  paid start path remains disabled until Omniqora's budgeted API is integrated.
- A historical AI report is marked `stale` whenever the underlying match
  score revision changes; the dashboard must not portray old advice as current.
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
