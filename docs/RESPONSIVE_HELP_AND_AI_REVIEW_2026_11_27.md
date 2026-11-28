# Responsive help and intelligent cricket experience — 27 November 2026

## References reviewed
- [UI UX Pro Max quick reference](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/src/ui-ux-pro-max/templates/base/quick-reference.md): adaptive layout, accessible search, predictable controls, reduced clutter and touch targets.
- [Play-Cricket Scorer navigation update](https://play-cricket.ecb.co.uk/hc/en-us/articles/28208850906781-Play-Cricket-Scorer-Updates-version-7-4-1): improve navigation without moving familiar scoring controls.
- [OpenAI agent guardrails](https://developers.openai.com/api/docs/guides/agents/guardrails-approvals) and [Claude tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview): typed boundaries and approval for side effects.
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output), [Qwen-Agent](https://github.com/QwenLM/Qwen-Agent) and [MCP security](https://modelcontextprotocol.io/specification/latest/basic/security_best_practices): evaluate structured provider responses, scoped tools and minimal permissions.

## Delivered in this change
- Searchable FAQ across the original questions plus eight new questions in each of five languages (40 new localized answers).
- Accent-insensitive matching of questions and answers, result counts, clear action, responsive support card and accessible disclosures. Existing locale and public brand preserved.
- Explain PWA installation, estimated camera speed, stale feeds, AI oversight, junior safeguarding, backups, role access and conditional service availability.

## AI development sequence (not activated by this change)
Keep Omniqora as the existing broker. Do not install arbitrary agents or introduce direct provider credentials into CricLume.
1. Verify provider capabilities and region/data-processing terms per use case. Use a common typed output contract for OpenAI, Claude, Gemini and Qwen candidates; reject malformed or unsupported results.
2. Benchmark on synthetic or approved de-identified match snapshots. Compare factual score grounding, refusal on missing evidence, latency, cost and output validity. No provider is presumed superior without measured results.
3. Use a read-only cricket analyst and coach workflow with bounded steps, cost reservations, source revision, provenance, human review and auditable tool calls. MCP tools must be allowlisted, tenant-scoped, server-mediated and unable to alter scores, send messages or publish.
4. Keep deterministic scoring and camera measurement authoritative. No AI-derived speed may be marketed as radar-certified. Raw video, junior data and paid model execution remain blocked until their independent acceptance gates pass.
5. Device acceptance: phone 375px, tablet 768/1024px, desktop 1440px, keyboard and screen-reader interaction, both themes, zoom and connection recovery. Record actual browser results separately.

No external code or package was installed, no paid inference was requested and no production integration was activated. Source-level tests do not certify accessibility, native stores or deployment.
