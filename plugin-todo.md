# Plugin Compliance TODO (Tier C)

Date: 2026-02-14

## Scope
- Track follow-ups from Tier C compliance hardening.
- Document what changed, what was reduced, and what remains to fully align with strict plugin boundaries.

## Completed Compliance Fixes
- Added missing `definedHooks` in:
  - `plugins/forms/plugin.meta.json`
  - `plugins/experiments/plugin.meta.json`
- Removed explicit `authzNamespace` from Tier C manifests where it was declared:
  - `plugins/forms/plugin.meta.json`
  - `plugins/experiments/plugin.meta.json`
- Messaging:
  - Removed direct `users` table reads.
  - Switched user profile resolution to `facades.users`.
  - If users facade missing, request is denied with capability error.
- Support:
  - Removed direct `tenants` join from admin request listing.
  - Removed request-time `user_id` bypass for admin request paths.
  - Added strict tenant scoping.
- Chatbot:
  - Removed cross-plugin SQL reads of Notes/Calendar/Wiki tables.
  - Search now uses only chatbot knowledge docs table.
  - Removed `core:service:resources:read` capability.
- Workers:
  - Removed webhook-specific worker handler path.
  - Supported handlers now: `noop`, `http_request`, `hook_action`, `fail_test`.

## Lost Or Reduced Features (Important)
- Chatbot assistant no longer performs direct “global workspace” retrieval from other plugin tables
  - Removed:
    - cross-plugin notes retrieval
    - cross-plugin calendar events retrieval
    - cross-plugin wiki content retrieval
  - Kept alternative:
    - chatbot-owned knowledge documents retrieval
  - Result:
    - better isolation/spec compliance, but less automatic cross-plugin context unless core exposes a sanctioned search/resource facade.

- Messaging no longer falls back to direct core user table lookups
  - Removed:
    - direct read from core `users` table for profile data
  - Kept alternative:
    - profile lookup through `facades.users`
  - Result:
    - strict boundary compliance; if facade is unavailable/misconfigured, profile resolution fails fast instead of silently bypassing boundaries.

- Support admin listing no longer enriches request rows with direct tenant joins
  - Removed:
    - direct join against `tenants` table
  - Kept alternative:
    - tenant-scoped request querying without cross-table enrichment
  - Result:
    - secure tenant isolation; less rich admin list metadata unless core provides an approved tenant-info facade.

- Workers no longer includes embedded webhook event processing flow
  - Removed:
    - webhook-specific worker handler (`webhooks_event`) from worker runtime
  - Kept alternative:
    - generic handlers (`http_request`, `hook_action`, etc.) so webhook integration can be composed externally
  - Result:
    - cleaner generic worker core; webhook coupling moved out of workers plugin.

## Remaining Gap To Reach Stricter Tier C Purity
- Some Tier C plugins still read/write `plugin_states` directly.
  - Current status:
    - practically acceptable in this codebase and currently used for plugin config/state paths.
  - Strict interpretation concern:
    - direct table access can be considered boundary leakage if Tier C should only use core facades/APIs.
  - Needed to close gap:
    - core plugin-state facade/API for read/write by plugin key + tenant scoping.
    - migrate plugins from direct `plugin_states` SQL to that facade.

## Follow-up Work Items
- Define and implement a core plugin-state facade/API.
- Migrate plugins currently using direct `plugin_states` access:
  - calendar
  - chatbot
  - files
  - support
  - wiki
- Add regression tests asserting:
  - no direct cross-plugin table reads
  - no direct core table reads unless explicitly whitelisted by capability/facade contracts.
- Keep workers-webhooks integration documented as optional composition, not hard coupling.
