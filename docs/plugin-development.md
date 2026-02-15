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

## UI Components (`@saas/ui`)

All plugins **must** use the `@saas/ui` workspace package for UI components. Do **not** import from `apps/web/components/ui/` or use a `@/*` path alias pointing into `apps/web`.

### Setup

Add the dependency and path aliases:

**`package.json`:**
```json
{
  "dependencies": {
    "@saas/ui": "workspace:*"
  }
}
```

**`tsconfig.json`:**
```json
{
  "compilerOptions": {
    "paths": {
      "@saas/ui": ["../../packages/ui/src/index.ts"],
      "@saas/ui/*": ["../../packages/ui/src/*"]
    }
  }
}
```

### Importing Components

```typescript
import { Button } from '@saas/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@saas/ui/card'
import { Input } from '@saas/ui/input'
import { cn } from '@saas/ui/utils'
```

### Available Components

`alert-dialog`, `alert`, `avatar`, `badge`, `button`, `card`, `dialog`, `dropdown-menu`, `form`, `input`, `label`, `scroll-area`, `select`, `separator`, `sheet`, `switch`, `table`, `tabs`, `textarea`, `utils`

### Plugin Auth

Use `usePluginAuth()` from `@saas/plugins-core/framework` instead of importing `useAuth` from the host app:

```typescript
import { usePluginAuth } from '@saas/plugins-core/framework'

function MyComponent() {
  const { user, isLoading, isAuthenticated } = usePluginAuth()
  // ...
}
```

## Client Entrypoint

Create `src/client.ts` for UI hooks:

```typescript
import type { NavItem, PluginTranslations } from '@saas/plugins-core'
import { translatePlugin } from '@saas/plugins-core'

const text = translatePlugin('my-plugin')

export const translations: PluginTranslations = {
  en: {
    nav_label: 'My Plugin',
  },
}

export function navItemsFilter(items: NavItem[]): NavItem[] {
  return [
    ...items,
    { id: 'my-plugin', label: text('nav_label', 'My Plugin'), href: '/my-plugin' },
  ]
}

export function register(context: { config?: unknown }): void {
  console.log('[my-plugin] Client registered')
}
```

## Internationalization (Required)

All plugins must be i18n-ready by default.

- Every plugin **must own its translations** in its own package (do not rely on a central core plugin catalog).
- Every plugin **must ship a base English (`en`) catalog**.
- UI text in plugin code must use translation keys (no hardcoded user-facing strings in components/pages).
- `src/client.ts` must export a `translations` object so the plugin loader can register catalogs.
- Use plugin-scoped keys with `translatePlugin('<plugin-id>')` to avoid key collisions.

Optional language packs can be delivered as separate Tier A plugins that add or override locales for one or many plugins (for example, `@plugins/lang-fr`).

## Server Action Hooks

Action hooks let plugins react to core events (fire-and-forget, side effects only).

### Subscribing to hooks

**Programmatic (in `register()`):**

```typescript
import type { PluginContext } from '@saas/plugins-core'
import { hookRegistry } from '@saas/plugins-core'

export function register(context: PluginContext): void {
  hookRegistry.addAction('auth:logged_in', context.pluginId, async (data) => {
    // Track DAU/MAU
    await recordActiveUser(data.userId, data.tenantId)
  })

  hookRegistry.addAction('billing:subscription_created', context.pluginId, async (data) => {
    // Track MRR
    await recordMrr(data.tenantId, data.amount, data.currency, data.interval)
  })
}
```

**Declarative (in `plugin.meta.json`):**

```json
{
  "hooks": [
    { "hook": "auth:logged_in", "handler": "onLogin", "priority": 50 },
    { "hook": "billing:invoice_paid", "handler": "onInvoicePaid" }
  ]
}
```

### Available hooks

#### Lifecycle

| Hook | Payload | Notes |
|------|---------|-------|
| `app:boot` | `{ active: string[], quarantined: { pluginId, error }[] }` | Awaited. Fired after plugin boot completes. |
| `app:ready` | `{}` | Awaited. App is ready to accept requests. |
| `app:shutdown` | `{}` | Awaited. App is shutting down. |

#### Auth

| Hook | Payload | Notes |
|------|---------|-------|
| `auth:registered` | `{ userId, email, tenantId }` | New user registered. |
| `auth:logged_in` | `{ userId, method, tenantId }` | User logged in. `method`: `'password'` \| `'mfa'` \| `'google'` \| `'github'` \| `'sso'`. |
| `auth:logged_out` | `{ userId }` | User logged out. |
| `auth:mfa_verified` | `{ userId }` | MFA code verified. |
| `auth:password_reset` | `{ userId }` | Password reset completed. |

#### Teams / Tenancy

| Hook | Payload | Notes |
|------|---------|-------|
| `team:created` | `{ tenantId, ownerId, type }` | `type`: `'personal'` \| `'team'`. |
| `team:updated` | `{ tenantId, updatedFields }` | `updatedFields`: array of changed field names. |
| `team:deleted` | `{ tenantId, tenantName }` | Fired before deletion. |
| `team:member_added` | `{ tenantId, userId, role }` | Member added to team. |
| `team:member_removed` | `{ tenantId, userId, role }` | Member removed by admin. |
| `team:member_left` | `{ tenantId, userId, role }` | Member voluntarily left. |
| `team:switched` | `{ userId, tenantId, previousTenantId }` | User switched active tenant. |

#### Billing

| Hook | Payload | Notes |
|------|---------|-------|
| `billing:customer_created` | `{ tenantId, customerId }` | Stripe customer created for tenant. |
| `billing:subscription_created` | `{ tenantId, subscriptionId, tierId, providerSubscriptionId, amount, currency, interval }` | `amount` in cents, `interval`: `'month'` \| `'year'`. |
| `billing:subscription_updated` | `{ tenantId, subscriptionId, status, previousStatus, tierId, amount, currency, interval }` | Status or plan changed. |
| `billing:subscription_cancelled` | `{ tenantId, subscriptionId, tierId }` | Subscription cancelled. |
| `billing:invoice_paid` | `{ tenantId, subscriptionId, amountPaid, currency, invoiceId }` | Invoice payment succeeded. |
| `billing:payment_failed` | `{ tenantId, subscriptionId, invoiceId }` | Invoice payment failed. |

#### Compliance

| Hook | Payload | Notes |
|------|---------|-------|
| `audit:record` | `{ type, tenantId, actor, resource, meta }` | Mirrors every audit event. Observe only. |

### Example: Analytics plugin

```typescript
import { hookRegistry } from '@saas/plugins-core'

export function register({ pluginId }: { pluginId: string }): void {
  // DAU/MAU tracking
  hookRegistry.addAction('auth:logged_in', pluginId, async ({ userId, tenantId }) => {
    await db.query('INSERT INTO plugin_analytics_active_users ...')
  })

  // MRR tracking
  hookRegistry.addAction('billing:subscription_created', pluginId, async (data) => {
    const mrr = data.interval === 'year'
      ? (data.amount ?? 0) / 12
      : (data.amount ?? 0)
    await db.query('INSERT INTO plugin_analytics_mrr ...')
  })

  // Churn tracking
  hookRegistry.addAction('billing:subscription_cancelled', pluginId, async ({ tenantId }) => {
    await db.query('UPDATE plugin_analytics_mrr SET churned_at = NOW() ...')
  })

  // LTV tracking
  hookRegistry.addAction('billing:invoice_paid', pluginId, async ({ tenantId, amountPaid }) => {
    await db.query('UPDATE plugin_analytics_ltv SET total = total + $1 ...')
  })
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
- [ ] UI components imported from `@saas/ui/*` (not `@/components/ui/*`)
- [ ] Plugin auth uses `usePluginAuth()` from `@saas/plugins-core/framework`
- [ ] Client entrypoint exports plugin `translations`
- [ ] Base `en` catalog exists in plugin package
- [ ] No hardcoded user-facing strings in plugin UI code
