# Plugin Webhooks Spec (Tier C)
**Status:** Draft for implementation
**Depends on:** `tier-c-platform-plugins-spec.md`, `plugin-dependency-enforcement-spec.md`, `plugins-mandatory-rules.md`, `plugin-ui-access-control-spec.md`

---

## 0) Purpose

Define a reusable `webhooks` Tier C plugin that delivers tenant-scoped outbound events to external systems.

Design goals:
- Persistent delivery pipeline (queue in DB), not in-memory fire-and-forget.
- Tenant-admin controlled endpoint/subscription management.
- Non-bypassable server-side RBAC and feature-gating.
- Deterministic retries, dead-lettering, and replay.

Non-goals (v1):
- Inbound webhooks.
- Arbitrary transformation scripting.

---

## 1) Capability and dependency model

### 1.1 Tier and capabilities

`webhooks` is a Tier C plugin.

Requested capabilities (minimum):
- `app:routes`
- `app:db:read`
- `app:db:write`
- `app:authz`
- `core:service:permissions:manage`
- `core:hooks:define`
- `core:entity:fk:users`

Optional capabilities:
- `core:service:notifications:send` (operator alerting when delivery health degrades)

Rules:
- Any request-time use of optional core facades must guard `null` (denied capability/missing service).

### 1.2 Plugin dependencies

No hard plugin dependency required for v1.

Rules:
- `webhooks` can subscribe to core hooks and plugin-defined hooks without direct package dependencies.
- If a source plugin is disabled/quarantined, events from that source simply stop emitting.

---

## 2) Feature gates (core-owned)

```json
{
  "features": {
    "endpoint_management": { "defaultEnabled": true },
    "subscriptions": { "defaultEnabled": true },
    "deliveries_read": { "defaultEnabled": true },
    "replay": { "defaultEnabled": true }
  }
}
```

Rules:
- Route-level `requiredFeatures` is mandatory for feature-specific endpoints.
- Direct API calls to disabled routes MUST return `403` + `E_FEATURE_DISABLED`.

---

## 3) Data model (persistent pipeline)

Tables (plugin-owned):
- `plugin_webhooks_endpoints`
- `plugin_webhooks_subscriptions`
- `plugin_webhooks_events`
- `plugin_webhooks_deliveries`
- `plugin_webhooks_dead_letters`

Key rules:
- `tenant_id` required on all rows.
- Payload envelope snapshot stored in `plugin_webhooks_events`.
- Delivery attempts stored append-only in `plugin_webhooks_deliveries`.
- Terminal failures copied to dead-letter table with reason and last response metadata.

Delivery policy (v1):
- Exponential backoff: `1m, 5m, 15m, 1h, 6h`.
- Max attempts: `5`, then dead-letter.
- Signature: `X-SaaS-Signature` HMAC-SHA256 over raw body.

---

## 4) API surface

Base prefix: `/api/v1/apps/webhooks`

Admin endpoints (tenant owner/admin):
- `GET /admin/endpoints`
- `POST /admin/endpoints`
- `PUT /admin/endpoints/:id`
- `DELETE /admin/endpoints/:id`
- `GET /admin/subscriptions`
- `PUT /admin/subscriptions/:id`
- `GET /admin/deliveries`
- `GET /admin/deliveries/:id`
- `POST /admin/deliveries/:id/replay`

Response shape:
- Success: `{ data, message? }`
- Failure: `{ error, message, errors? }`

---

## 5) RBAC and authz behavior

Namespace: `webhooks.`

Abilities:
- `webhooks.endpoint.manage`
- `webhooks.subscription.manage`
- `webhooks.delivery.read`
- `webhooks.delivery.replay`

Rules:
- Manage endpoints/subscriptions requires tenant-admin policy by default.
- Replay is tenant-admin only by default.
- All enforcement server-side; no UI-only gating.

---

## 6) Event ingestion and dispatch model

Ingestion:
- `webhooks` listens to configured hooks via listener registry.
- For each matching subscription, plugin writes one event row + one or more delivery rows.

Dispatch worker:
- Polls pending deliveries by `next_attempt_at`.
- Locks one delivery row transactionally before sending.
- Writes attempt result + schedules retry or marks success/dead-letter.

Tier C runtime constraint:
- Worker code must not call request-scoped facades directly (`forRequest(ctx)` is unavailable in background jobs).
- If operator alerting is needed, worker writes durable alert records and a core-owned request/workflow path performs facade-based notification dispatch.

Idempotency:
- Outbound header `X-SaaS-Event-ID` must be stable per event row.
- Replay creates a new delivery attempt tied to the same event ID.

Hook contract:
- Listener registration uses plugin listener registry APIs only.
- Any emitted `webhooks:*` hook must be declared in `definedHooks` and requires `core:hooks:define`.
- Background delivery workers must not dispatch plugin-defined hooks directly; hook emission from background execution must be routed through a core-owned request/workflow path.

---

## 7) Security rules

- HTTPS required for non-local endpoints.
- Secret values stored encrypted-at-rest (reuse existing encrypted config path where available).
- Redact secrets/tokens from logs and API responses.
- Reject private-network target URLs unless explicitly allowed by platform policy.

---

## 8) Implementation checklist

1. Add manifest with Tier C fields, capabilities, hooks, and features.
2. Add migrations + seed updates for persistent delivery tables.
3. Implement endpoint/subscription admin routes with `requiredFeatures`.
4. Implement hook listener ingestion to event/delivery tables.
5. Implement worker loop for retries + dead-lettering.
6. Add tests:
- unit: signature generation, retry schedule, feature-gate enforcement.
- integration: endpoint CRUD, subscription filtering, delivery retries, dead-letter + replay.
7. Add docs for event envelope and signing verification.

---

## 9) Open follow-ups

1. Per-endpoint custom retry policy overrides.
2. Batch delivery optimization for high-volume tenants.
3. Inbound webhook plugin as a separate spec.
