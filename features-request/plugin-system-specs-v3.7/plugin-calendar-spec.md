# Plugin Calendar Spec (Tier C)
**Status:** Draft for implementation
**Depends on:** `tier-c-platform-plugins-spec.md`, `plugin-dependency-enforcement-spec.md`, `plugins-mandatory-rules.md`, `plugin-webhooks-spec.md`

---

## 0) Purpose

Define a reusable `calendar` Tier C plugin for tenant-scoped events, attendees, and reminders.

Design goals:
- Reliable event and reminder primitives for host plugins.
- Persistent reminder execution model (DB-backed schedule).
- Strong tenant RBAC and feature-gate enforcement.
- Extensible hooks for automations/integrations.

Non-goals (v1):
- Two-way sync with Google/Outlook.
- Complex recurrence engine (RRULE full surface).

---

## 1) Capability and dependency model

### 1.1 Tier and capabilities

`calendar` is a Tier C plugin.

Requested capabilities (minimum):
- `app:routes`
- `app:db:read`
- `app:db:write`
- `app:authz`
- `core:service:users:read`
- `core:service:resources:read`
- `core:service:permissions:manage`
- `core:service:notifications:send`
- `core:hooks:define`
- `core:entity:fk:users`

### 1.2 Plugin dependencies

No hard dependency for base calendar.

Optional integrations:
- `webhooks` for outbound calendar event integration (recommended, not required).

Rules:
- For optional integrations, base calendar MUST NOT declare hard `manifest.dependencies`.
- If a distribution variant declares `manifest.dependencies`, those dependencies are hard requirements and follow `plugin-dependency-enforcement-spec.md`.

---

## 2) Feature gates (core-owned)

```json
{
  "features": {
    "events": { "defaultEnabled": true },
    "attendees": { "defaultEnabled": true },
    "reminders": { "defaultEnabled": true },
    "recurrence": { "defaultEnabled": false }
  }
}
```

Rules:
- Disabled feature routes return `403` + `E_FEATURE_DISABLED`.
- Recurrence endpoints/fields are rejected when `recurrence` is disabled.

---

## 3) Data model (persistent reminders)

Tables (plugin-owned):
- `plugin_calendar_events`
- `plugin_calendar_attendees`
- `plugin_calendar_reminders`
- `plugin_calendar_reminder_runs`

Key rules:
- `tenant_id` required on all rows.
- Event timestamps stored in UTC with explicit original timezone field.
- Reminder processing is durable from DB state, not in-memory timers.
- FK to users for organizer/attendee with `ON DELETE SET NULL`.

---

## 4) API surface

Base prefix: `/api/v1/apps/calendar`

Endpoints:
- `GET /events`
- `POST /events`
- `GET /events/:id`
- `PUT /events/:id`
- `DELETE /events/:id`
- `POST /events/:id/attendees`
- `DELETE /events/:id/attendees/:userId`
- `POST /events/:id/rsvp`
- `POST /events/:id/reminders`
- `DELETE /events/:id/reminders/:reminderId`

Optional recurrence endpoints:
- `POST /events/:id/recurrence`
- `DELETE /events/:id/recurrence`

Response shape:
- Success: `{ data, message? }`
- Failure: `{ error, message, errors? }`

---

## 5) RBAC and authz behavior

Namespace: `calendar.`

Abilities:
- `calendar.event.create`
- `calendar.event.read`
- `calendar.event.update`
- `calendar.event.delete`
- `calendar.event.manage_attendees`
- `calendar.reminder.manage`

Default tenant policy:
- owner/admin: full access.
- member: create/read/update own events, no delete of others unless granted.

Rules:
- All checks enforced server-side through core authz.
- RSVP operations require `calendar.event.read` and attendee membership checks.

---

## 6) Reminder execution model

Scheduler/worker behavior:
- Poll reminders with `scheduled_at <= now` and `status = pending`.
- Lock one reminder row transactionally.
- Enqueue/send through a core-owned notification request/workflow path.
- Record run row with success/failure metadata.
- Retry transient failures with bounded backoff.

Tier C runtime constraint:
- Background jobs must not call request-scoped facades directly (`forRequest(ctx)` is unavailable without `HttpContext`).
- Any core facade usage for reminder dispatch must happen in a request-scoped core-owned path.

Failure semantics:
- Permanent failures marked `failed`.
- Optional operator signal via webhook hook or notification.

---

## 7) Hooks and integration primitives

Hook events emitted:
- `calendar:event.created`
- `calendar:event.updated`
- `calendar:event.deleted`
- `calendar:event.reminder.sent`
- `calendar:event.rsvp.updated`

Rules:
- Hook dispatch through Tier C hook facade.
- `webhooks` plugin can subscribe to these hooks without direct package coupling.
- Emitted `calendar:*` hooks/filters must be declared in manifest (`definedHooks`/`definedFilters`) and require `core:hooks:define`.
- Reminder workers must not dispatch plugin-defined hooks directly; background-triggered hook emission must be routed through a core-owned request/workflow path.

---

## 8) Implementation checklist

1. Add calendar manifest with Tier C fields, capabilities, and features.
2. Add migrations + seed updates for events/attendees/reminders tables.
3. Implement routes with `requiredFeatures` and authz checks.
4. Implement durable reminder worker logic.
5. Implement hook dispatch for event lifecycle.
6. Add tests:
- unit: timezone normalization, reminder scheduling, permission checks.
- integration: CRUD + attendee + RSVP + reminder send flow.
- integration: `403 E_FEATURE_DISABLED` for gated recurrence/reminders.
7. Add docs for hook payloads and reminder semantics.

---

## 9) Open follow-ups

1. External calendar sync adapters and conflict resolution.
2. Rich recurrence (RRULE + exception dates).
3. Availability aggregation API for scheduling assistants.
