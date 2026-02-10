# Plugin Wiki Spec (Tier C)
**Status:** Draft for implementation
**Depends on:** `tier-c-platform-plugins-spec.md`, `plugin-dependency-enforcement-spec.md`, `plugins-mandatory-rules.md`, `plugin-collab-spec.md`

---

## 0) Purpose

Define a reusable `wiki` Tier C plugin for tenant knowledge spaces and pages.

Design goals:
- Strong content primitives (spaces, pages, revisions, publishing).
- Server-side permission enforcement (no direct API bypass).
- Optional collaboration and file attachment integrations.
- Resource primitives reusable by host plugins.

Non-goals (v1):
- Full WYSIWYG schema standardization.
- Fine-grained block-level ACLs.

---

## 1) Capability and dependency model

### 1.1 Tier and capabilities

`wiki` is a Tier C plugin.

Requested capabilities (minimum):
- `app:routes`
- `app:db:read`
- `app:db:write`
- `app:authz`
- `core:service:users:read`
- `core:service:resources:read`
- `core:service:permissions:manage`
- `core:service:notifications:send` (optional behavior if unavailable)
- `core:hooks:define`
- `core:entity:fk:users`

### 1.2 Plugin dependencies

Optional integrations:
- `collab` (comments/mentions on pages)
- `files` (attachments in page content)

Rules:
- Base wiki works without both dependencies.
- For optional integrations, base wiki MUST NOT declare hard `manifest.dependencies`.
- If a distribution variant declares `manifest.dependencies`, those dependencies are hard requirements and follow `plugin-dependency-enforcement-spec.md`.
- If integration plugin unavailable, corresponding integration endpoints/features must be disabled.

---

## 2) Feature gates (core-owned)

```json
{
  "features": {
    "spaces": { "defaultEnabled": true },
    "pages": { "defaultEnabled": true },
    "publishing": { "defaultEnabled": true },
    "history": { "defaultEnabled": true },
    "comments": { "defaultEnabled": false },
    "attachments": { "defaultEnabled": false }
  }
}
```

Rules:
- Disabled features return `403` + `E_FEATURE_DISABLED`.
- Host-plugin hard-disable policy takes precedence over tenant settings.

---

## 3) Data model (v1)

Tables (plugin-owned):
- `plugin_wiki_spaces`
- `plugin_wiki_pages`
- `plugin_wiki_page_revisions`
- `plugin_wiki_page_memberships`

Optional integration tables:
- `plugin_wiki_page_attachments` (if files integration enabled)

Key rules:
- `tenant_id` required on all rows.
- Soft delete for pages/spaces.
- Revision table append-only.
- FK to users for author/editor with `ON DELETE SET NULL`.

---

## 4) API surface

Base prefix: `/api/v1/apps/wiki`

Endpoints:
- `GET /spaces`
- `POST /spaces`
- `PUT /spaces/:id`
- `DELETE /spaces/:id`
- `GET /pages`
- `POST /pages`
- `GET /pages/:id`
- `PUT /pages/:id`
- `DELETE /pages/:id`
- `POST /pages/:id/publish`
- `POST /pages/:id/unpublish`
- `GET /pages/:id/revisions`
- `POST /pages/:id/revisions/:revisionId/restore`

Optional integration endpoints:
- `POST /pages/:id/comments` (requires `comments` feature + collab integration available)
- `POST /pages/:id/attachments` (requires `attachments` feature + files integration available)

Rules:
- If integration is unavailable, these endpoints are hard-disabled by feature policy (`403 E_FEATURE_DISABLED`), not bypassable by direct API calls.

Response shape:
- Success: `{ data, message? }`
- Failure: `{ error, message, errors? }`

---

## 5) RBAC and authz behavior

Namespace: `wiki.`

Abilities:
- `wiki.space.manage`
- `wiki.page.read`
- `wiki.page.write`
- `wiki.page.publish`
- `wiki.page.delete`

Rules:
- Tenant-level policy defaults:
- owner/admin: full access
- member: read/write, no publish/delete unless explicitly granted
- Enforcement through core authz resolver path (`app:authz`), server-side only.

---

## 6) Resources and hooks

Resource types exposed:
- `wiki_space`
- `wiki_page`

Hook events emitted:
- `wiki:space.created`
- `wiki:page.created`
- `wiki:page.updated`
- `wiki:page.published`
- `wiki:page.deleted`

Filters (optional):
- `wiki:page.render` (host-controlled render transforms)

Rules:
- Hook dispatch uses Tier C hook facade path.
- Plugin-facing listener registry remains listener-only.
- Emitted `wiki:*` hooks/filters must be declared in manifest (`definedHooks`/`definedFilters`) and require `core:hooks:define`.

---

## 7) Search and indexing behavior

v1 baseline:
- SQL search on title + slug + body summary (tenant-scoped).
- Optional hook `wiki:page.indexed` for external indexers.

Non-goal v1:
- External search engine dependency as hard requirement.

---

## 8) Implementation checklist

1. Add wiki manifest with Tier C fields, hooks, and features.
2. Add migrations + seed updates.
3. Implement spaces/pages/revisions routes with feature gates.
4. Implement authz abilities + default tenant policy.
5. Implement resource provider registration (`wiki_page`, `wiki_space`).
6. Add optional collab/files integration guards.
   - No direct cross-plugin facade invocation; integration is through hooks/events and resource references.
7. Add tests:
- unit: permission checks, publishing rules, feature-gate behavior.
- integration: create/update/publish/restore flows and dependency-off behavior.
8. Add docs for host plugin integration.

---

## 9) Open follow-ups

1. Page-level share links and guest access model.
2. Rich text schema/version migration policy.
3. Optional AI summary/extract hooks.
