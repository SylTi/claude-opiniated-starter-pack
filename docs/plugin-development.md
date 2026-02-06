# Plugin Development Guide

This guide explains how to develop plugins for the SaaS platform.

## Plugin Tiers

The plugin system has two tiers:

| Tier | Name | Access Level | Description |
|------|------|-------------|-------------|
| A | UI Plugins | Unprivileged | Filters/slots for UI, no server routes, no database |
| B | App Plugins | Moderately Privileged | Routes under `/api/v1/apps/{pluginId}`, own tables, background jobs |

## Getting Started

### 1. Create Plugin Directory Structure

```bash
# For a Tier A plugin (UI only)
mkdir -p plugins/my-plugin/src

# For a Tier B plugin (with database)
mkdir -p plugins/my-plugin/{src,dist,database/migrations}
```

### 2. Create package.json

```json
{
  "name": "@plugins/my-plugin",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/server.js",
  "exports": {
    ".": "./dist/server.js",
    "./plugin.meta.json": "./plugin.meta.json"
  },
  "scripts": {
    "build": "tsc"
  }
}
```

### 3. Create plugin.meta.json

This is the most important file - it declares your plugin's metadata and capabilities.

```json
{
  "pluginId": "my-plugin",
  "packageName": "@plugins/my-plugin",
  "version": "1.0.0",
  "tier": "B",
  "displayName": "My Plugin",
  "description": "A sample plugin",
  "requestedCapabilities": [
    { "capability": "app:routes", "reason": "Serve API endpoints" },
    { "capability": "app:db:read", "reason": "Read data" },
    { "capability": "app:db:write", "reason": "Write data" }
  ],
  "migrations": {
    "dir": "./database/migrations",
    "schemaVersion": 1
  },
  "tables": [
    { "name": "plugin_my_plugin_data", "hasTenantId": true }
  ],
  "authzNamespace": "my-plugin.",
  "routePrefix": "/api/v1/apps/my-plugin"
}
```

### Auth Tokens (Integrations)

If your plugin needs user-generated integration tokens (e.g., MCP, browser extensions),
declare them in `plugin.meta.json`. The core `/api/v1/auth-tokens` endpoints will enforce
these allowlists for `kind` and `scopes`.

```json
{
  "authTokens": {
    "kinds": [
      {
        "id": "integration",
        "title": "Integration tokens",
        "description": "Tokens for external clients",
        "createTitle": "Create integration token",
        "createDescription": "Generate a token for external tools.",
        "emptyMessage": "No integration tokens created yet.",
        "revokeMessage": "This immediately disconnects clients using this token.",
        "scopes": [
          { "id": "my-plugin:read", "label": "Read", "defaultChecked": true },
          { "id": "my-plugin:write", "label": "Write" }
        ]
      }
    ]
  }
}
```

**Consuming tokens in your plugin (server-side):**

```typescript
import type { PluginContext } from '@saas/plugins-core'

export function register({ routes, authTokens }: PluginContext): void {
  routes.post('/mcp/search', async (ctx) => {
    const token = ctx.request.header('authorization')?.replace('Bearer ', '')
    if (!token || !authTokens) {
      return ctx.response.status(401).send({ error: 'Unauthorized', message: 'Missing token' })
    }

    const result = await authTokens.validateToken({
      tokenValue: token,
      kind: 'integration',
      requiredScopes: ['my-plugin:read'],
    })

    if (!result.valid) {
      return ctx.response.status(401).send({ error: 'Unauthorized', message: result.error })
    }

    // result.tenantId / result.userId are available here
    // ...
  })
}
```

## Plugin Capabilities

### Tier A Capabilities (UI Only)

| Capability | Description |
|------------|-------------|
| `ui:filter:nav` | Add items to navigation menu |
| `ui:filter:dashboard` | Add widgets to dashboard |
| `ui:slot:header` | Insert content in header |
| `ui:slot:sidebar` | Insert content in sidebar |
| `ui:slot:footer` | Insert content in footer |

### Tier B Capabilities (App Plugins)

| Capability | Description |
|------------|-------------|
| `app:routes` | Register API routes |
| `app:db:read` | Read from plugin tables |
| `app:db:write` | Write to plugin tables |
| `app:jobs` | Register background jobs |
| `app:authz` | Register authorization resolver |

## Database Tables

### Table Naming

All plugin tables **MUST** be prefixed with `plugin_{pluginId}_`:

```
plugin_notes_notes        ✅ Correct
plugin_notes_categories   ✅ Correct
notes_items               ❌ Wrong - missing prefix
```

### Tenant Isolation (Required)

Every plugin table **MUST**:

1. Have a `tenant_id` column of type INTEGER
2. Have `tenant_id` as NOT NULL
3. Have a foreign key to `tenants(id)`
4. Have RLS enabled and forced
5. Call `app.apply_tenant_rls()` and `app.assert_tenant_scoped_table()`

Example migration:

```typescript
async up(): Promise<void> {
  this.schema.createTable('plugin_my_plugin_items', (table) => {
    table.increments('id').primary()
    table
      .integer('tenant_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('tenants')
      .onDelete('CASCADE')
    // ... other columns
  })

  // Apply RLS
  await this.db.rawQuery(
    `SELECT app.apply_tenant_rls('plugin_my_plugin_items'::regclass);`
  )

  // Verify RLS (fails if invariants violated)
  await this.db.rawQuery(
    `SELECT app.assert_tenant_scoped_table('plugin_my_plugin_items'::regclass);`
  )
}
```

### Schema Versioning

Each plugin tracks its schema version in `plugin_db_state`. The final migration of each release must bump the version using the core helper:

```typescript
// 003_bump_schema_version.ts
import { BaseSchema } from '@adonisjs/lucid/schema'
import { setPluginSchemaVersion } from '#services/plugins/schema_version_helper'

export default class extends BaseSchema {
  async up(): Promise<void> {
    // Use the core helper to set schema version
    await setPluginSchemaVersion('my-plugin', 1, this.db)
  }

  async down(): Promise<void> {
    // Reset to previous version or 0
    await setPluginSchemaVersion('my-plugin', 0, this.db)
  }
}
```

> **Important:** Always use the `setPluginSchemaVersion()` helper instead of raw SQL.
> This ensures consistent schema version tracking and enables boot-time compatibility checks.

## Server Entrypoint

Create `src/server.ts` with a `register` function:

```typescript
import type { RoutesRegistrar } from '@saas/plugins-core'

interface PluginContext {
  routes: RoutesRegistrar
  pluginId: string
}

export function register(context: PluginContext): void {
  const { routes } = context

  routes.get('/items', async (ctx) => {
    // List items
    ctx.response.json({ data: [] })
  })

  routes.post('/items', async (ctx) => {
    // Create item
    ctx.response.created({ data: { id: 1 } })
  })
}
```

## Authorization

### Registering an Authz Resolver

If your plugin needs custom authorization, export an `authzResolver`:

```typescript
import type { AuthzContext, AuthzCheck, AuthzDecision } from '@saas/shared'

export async function authzResolver(
  ctx: AuthzContext,
  check: AuthzCheck
): Promise<AuthzDecision> {
  const { ability } = check

  // Check ability and return decision
  if (ability === 'my-plugin.item.read') {
    return { allow: true }
  }

  return {
    allow: false,
    reason: `Unknown ability: ${ability}`,
  }
}
```

### Ability Naming Convention

Plugin abilities follow the pattern: `{namespace}.{resource}.{action}`

Examples:
- `notes.note.read`
- `notes.note.write`
- `notes.note.delete`

## Client Entrypoint

Create `src/client.ts` for UI hooks:

```typescript
export function navItemsFilter(items: NavItem[]): NavItem[] {
  return [
    ...items,
    { id: 'my-plugin', label: 'My Plugin', href: '/my-plugin' },
  ]
}

export function register(context: { config?: unknown }): void {
  console.log('[my-plugin] Client registered')
}
```

## Registering Your Plugin

Add your plugin to `packages/config/plugins.server.ts`:

```typescript
// 1. Add package name (required for sync migration resolution)
export const serverPluginPackages = {
  'my-plugin': '@my-org/my-plugin',  // Use your actual package name
}

// 2. Add manifest loader
export const serverPluginManifests = {
  'my-plugin': async () => {
    const mod = await import('@my-org/my-plugin/plugin.meta.json')
    return mod.default
  },
}

// 3. Add server entrypoint loader (Tier B only)
export const serverPluginLoaders = {
  'my-plugin': () => import('@my-org/my-plugin'),
}
```

> **Important:** The `serverPluginPackages` map must contain the authoritative package name
> from your `plugin.meta.json`. This is used for synchronous migration resolution.

## Running Migrations

After creating migrations, run:

```bash
cd apps/api
node ace migration:run
```

## Verifying Your Plugin

```bash
cd apps/api
node ace plugins:verify my-plugin
```

## Plugin Checklist

Before releasing a plugin, verify:

- [ ] `plugin.meta.json` has valid pluginId, packageName, version, tier
- [ ] All capabilities are declared in requestedCapabilities
- [ ] Tables are prefixed with `plugin_{pluginId}_`
- [ ] Tables have tenant_id NOT NULL
- [ ] Migrations call `app.apply_tenant_rls()`
- [ ] Migrations call `app.assert_tenant_scoped_table()`
- [ ] Final migration bumps schema version
- [ ] Server entrypoint exports `register` function
- [ ] If using authz, exports `authzResolver` function
- [ ] Plugin is added to loader maps in @saas/config
