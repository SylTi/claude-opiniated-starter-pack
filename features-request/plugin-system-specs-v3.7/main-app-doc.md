~~~md
# Main App Plugin Author Guide
**Build the actual SaaS product on top of the Skeleton App.**
You get auth, tenants, admin, enterprise modules, billing, audit, and a plugin runtime.
You provide the business UI + business API routes + baseline design.

This document explains:
- what the Main App plugin is
- what it can do
- what it must not do
- required contracts (design + navigation)
- recommended patterns (entitlements, local RBAC, audit)
- a working skeleton template

---

## 0) Mental model
Think “WordPress core + theme + plugins”, but for SaaS:
- **Skeleton App** = boring core (auth, users, tenants, admin, enterprise)
- **Main App plugin** = the actual product (business pages, business APIs, baseline design)
- **Other plugins** = optional extensions (features, integrations, UI augmentations)

The skeleton will not ship business UI on its own.
A Main App plugin is required.

---

## 1) What is a “Main App plugin”?
A **Main App plugin** is a Tier B plugin with extra responsibilities:
- it provides the **baseline UI shell** and **theme tokens** for the product area
- it provides the **baseline navigation model**
- it provides the **business pages** (via the skeleton app’s dispatcher route)
- it provides the **business API endpoints** (via RoutesRegistry, depending on your platform)

There is exactly one Main App plugin installed.

---

## 2) What you get from the Skeleton App
You do **not** implement these:
- auth / sessions
- tenant / membership
- billing objects and webhooks
- admin access controls
- enterprise modules framework (toConf / runtimeDisableSafe)
- audit pipeline
- entitlements engine
- authz service (global + plugin local namespaces)
- hook registry (actions + filters)
- RLS tenant enforcement (core rules)

You **use** these via the plugin context.

---

## 3) Main App plugin responsibilities
You must provide:

1) **Design module** (theme + shell + nav baseline)
2) **Page registry** (route matching → component rendering)
3) Optional: **Admin/Auth overrides** (tokens/shell) with safe fallback
4) Optional: **Server routes** (business API) + authz/entitlements enforcement
5) Capability definitions (so core can gate features)
6) Audit events for any privileged mutation

---

## 3.1 Integration tokens (optional)
If your app needs external integrations (MCP, browser extensions, etc.), declare
token kinds + scopes in `plugin.meta.json` under `authTokens`. The core
`/api/v1/auth-tokens` endpoints enforce these allowlists and handle issuance.

To consume a token in your server routes, use the `authTokens` adapter from
the plugin context:

~~~ts
export function register({ routes, authTokens }: PluginContext): void {
  routes.post('/mcp/search', async (ctx) => {
    const token = ctx.request.header('authorization')?.replace('Bearer ', '')
    if (!token || !authTokens) {
      return ctx.response.status(401).send({ error: 'Unauthorized', message: 'Missing token' })
    }

    const result = await authTokens.validateToken({
      tokenValue: token,
      kind: 'integration',
      requiredScopes: ['my-app:read'],
    })

    if (!result.valid) {
      return ctx.response.status(401).send({ error: 'Unauthorized', message: result.error })
    }

    // result.tenantId / result.userId available here
  })
}
~~~

---

## 4) Required exports and file layout

### 4.1 Package identity
Your plugin is a workspace package:
- `@plugins/<appId>`

You must include:
- `plugin.meta.json` (static metadata)
- `src/client/design.tsx` (required)
- `src/client/pages.tsx` (required)
- `src/server/server.ts` (recommended if you expose APIs, hooks, background jobs)

Recommended layout:
~~~text
plugins/main-app/
  plugin.meta.json
  package.json
  src/
    client/
      design.tsx
      pages.tsx
    server/
      server.ts
      capabilities.ts
      authz.ts
  database/
    migrations/
      ... (if needed)
~~~

---

## 5) Contracts you must implement

### 5.1 AppDesign (required)
Your design export must satisfy the `AppDesign` interface.

The skeleton will use:
- `appTokens()` always
- `AppShell` always (for product area)
- `navBaseline()` always
- `AppProviders` if provided (wraps entire app)
- `adminOverride` and `authOverride` only if provided and valid
- `headerOverride` only if provided and valid

Rules:
- `appTokens()` and `navBaseline()` must be **pure**
- do not fetch from API
- do not read env in a way that can throw
- do not create side effects

Example:
~~~tsx
import React from 'react'
import type { AppDesign } from '@pkg/plugin-kit'

export const design: AppDesign = {
  appTokens() {
    return {
      cssVars: {
        '--brand': '#4f46e5',
        '--brand-foreground': '#ffffff',
      },
      appName: 'MyProduct',
      logoUrl: '/logo.svg',
    }
  },

  AppShell({ children, nav }) {
    return (
      <div className="min-h-screen">
        <header className="border-b">
          <div className="mx-auto max-w-6xl p-4 flex items-center justify-between">
            <a href="/" className="font-semibold">MyProduct</a>
            <nav className="flex gap-3">
              {nav.main.flatMap((s) => s.items).slice(0, 6).map((it) => (
                <a key={it.id} href={it.href} className="text-sm underline">
                  {it.label}
                </a>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-6">{children}</main>
      </div>
    )
  },

  // Optional override: admin uses skeleton default unless you provide this.
  adminOverride: {
    tokens: { cssVars: { '--brand': '#111827' }, appName: 'MyProduct Admin' },
  },

  navBaseline(ctx) {
    return {
      main: [
        {
          id: 'app.main',
          label: 'Main',
          order: 10,
          items: [
            { id: 'app.dashboard', label: 'Dashboard', href: '/', order: 10 },
            {
              id: 'app.reports',
              label: 'Reports',
              href: '/reports',
              order: 20,
              requires: { capability: 'app.reports' },
            },
          ],
        },
      ],
      admin: [],
      userMenu: [
        {
          id: 'core.account',
          label: 'Account',
          order: 10,
          items: [
            { id: 'core.profile', label: 'Profile', href: '/settings/profile', order: 10 },
            { id: 'core.switchTenant', label: 'Switch Tenant', href: '/tenants', order: 9000 },
            { id: 'core.logout', label: 'Logout', href: '/auth/logout', order: 9999 },
          ],
        },
      ],
    }
  },
}
~~~

### 5.1.1 Using FrameworkContext (optional)
If your plugin needs framework-agnostic routing or components, use the `FrameworkContext` from `@saas/plugins-core/framework`:

~~~tsx
import { useFramework } from '@saas/plugins-core/framework'

function MyComponent() {
  const framework = useFramework()

  if (!framework) {
    // Running outside skeleton (e.g., standalone mode)
    return null
  }

  const { router, Link, Image, theme } = framework

  return (
    <div>
      <Link href="/dashboard">Go to Dashboard</Link>
      <button onClick={() => router.push('/settings')}>Settings</button>
      <button onClick={() => theme.toggleTheme?.()}>Toggle theme</button>
    </div>
  )
}
~~~

The `FrameworkContext` provides:
- `router` - Navigation methods (push, replace, back, refresh) and current state (pathname, searchParams)
- `Link` - Framework-specific link component
- `Image` - Framework-specific optimized image component
- `theme` - Theme bridge (`getTheme`, `setTheme`, optional `toggleTheme`/`listThemes`, `subscribe`)

**Import paths:**
- Types (server-safe): `import type { ... } from '@saas/plugins-core/types'`
- Framework hooks (client-only): `import { useFramework } from '@saas/plugins-core/framework'`

### 5.1.2 Using AppProviders (optional)
If your plugin needs to wrap the **entire app** with context providers, use `AppProviders`:

~~~tsx
import type { AppDesign } from '@saas/plugins-core/types'
import { useFramework } from '@saas/plugins-core/framework'

// Your plugin's providers that need to wrap the entire app
function MyAppProviders({ children }: { children: React.ReactNode }) {
  const framework = useFramework()

  return (
    <MyRouterProvider
      router={framework?.router}
      Link={framework?.Link}
      Image={framework?.Image}
    >
      <MyThemeProvider>
        <MyGlobalStateProvider>
          {children}
        </MyGlobalStateProvider>
      </MyThemeProvider>
    </MyRouterProvider>
  )
}

export const design: AppDesign = {
  // ... required fields (appTokens, AppShell, navBaseline)

  // Optional: wrap entire app with your providers
  AppProviders: MyAppProviders,
}
~~~

When to use `AppProviders`:
- You need providers above the header/navigation (e.g., theme CSS variables)
- You have framework-agnostic routing that needs to wrap the entire app
- You have global state that all components need access to

### 5.1.3 Using headerOverride (optional)
Use `headerOverride` when you want custom placement of the skeleton header slots
(for example centered `Library | Use` navigation with tenant/user controls on the right).

`headerOverride` only changes **layout**. The skeleton still owns:
- authenticated nav data (from nav model + filters + permission checks)
- tenant switching behavior
- user menu behavior
- fallback behavior in safe mode or on override crash

Example:
~~~tsx
import type { AppDesign } from '@saas/plugins-core/types'

export const design: AppDesign = {
  // ...appTokens, AppShell, navBaseline
  headerOverride: {
    Header({
      brand,
      mainNavigation,
      tenantSwitcher,
      userMenu,
      authActions,
      pendingNavigation,
      isAuthenticated,
      isPendingUser,
    }) {
      return (
        <header className="border-b border-border bg-background">
          <div className="container mx-auto grid h-16 grid-cols-[1fr_auto_1fr] items-center px-4">
            <div className="justify-self-start">{brand}</div>

            <div className="justify-self-center rounded-full border border-border bg-muted/40 px-2 py-1">
              <div className="flex items-center gap-1">{mainNavigation}</div>
            </div>

            <div className="justify-self-end flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  {tenantSwitcher}
                  {userMenu}
                </>
              ) : isPendingUser ? (
                pendingNavigation
              ) : (
                authActions
              )}
            </div>
          </div>
        </header>
      )
    },
  },
}
~~~

If `headerOverride` throws, skeleton logs an incident and falls back to default header.

Alternative (declarative) mode:
~~~tsx
headerOverride: {
  layout: ({ isAuthenticated }) => ({
    left: ['brand'],
    center: isAuthenticated ? ['mainNavigation'] : [],
    right: isAuthenticated ? ['tenantSwitcher', 'userMenu'] : ['authActions'],
  }),
}
~~~

Notes:
- If both `Header` and `layout` are defined, `layout` takes precedence.
- Responsive/mobile behavior should be handled with CSS/Tailwind in skeleton rendering.

### 5.1.4 Tailwind sources contract (required for utility classes)
The skeleton compiles Tailwind **only** from the sources it knows about. Since main-app
plugin UI lives outside `apps/web`, you must expose your Tailwind sources as a **package
contract** and have the skeleton import that contract (no hardcoded repo paths).

**Plugin side (inside your package):**
1. Create a sources file:

~~~css
/* plugins/<appId>/tailwind.sources.css */
@source "./src/client/**/*.{ts,tsx,js,jsx,mdx}";
~~~

2. Export it in `package.json`:

~~~json
{
  "exports": {
    "./tailwind.sources.css": "./tailwind.sources.css"
  }
}
~~~

**Skeleton side (config + globals):**
1. Add a config CSS entry that points to the current main-app plugin:

~~~css
/* packages/config/main-app.css */
@import "@plugins/<appId>/tailwind.sources.css";
~~~

2. Import it once in `apps/web/app/globals.css`:

~~~css
@import "@saas/config/main-app.css";
~~~

When switching main-app plugins, only update `packages/config/main-app.css`
to import the new plugin’s `tailwind.sources.css`.

When NOT to use `AppProviders`:
- Providers only needed in the content area → use `AppShell` instead
- Page-specific providers → wrap in individual pages

Provider hierarchy:
1. `FrameworkProvider` (skeleton) - Next.js primitives
2. `AppProviders` (your plugin) - Your app-level providers
3. `AuthProvider` (skeleton) - Authentication
4. `DesignProvider` (skeleton) - Theme tokens
5. `NavigationProvider` (skeleton) - Nav model
6. `AppShell` (your plugin) - Content area shell

**Safe mode behavior:**
- When `SAFE_MODE=1`, `AppProviders` is **skipped entirely**
- Skeleton wraps `AppProviders` in an error boundary as fallback
- If `AppProviders` crashes, app continues without it
- Your app should work without `AppProviders` (test with `SAFE_MODE=1`)

---

### 5.2 NavModel V2 (required)
Your nav must be in the `NavModel` format:
- `main: NavSection[]`
- `admin: NavSection[]`
- `userMenu: NavSection[]`

Rules:
- IDs must be globally unique (`section.id`, `item.id`)
- do not use reserved IDs unless you are intentionally adding items into skeleton reserved sections
- do not remove mandatory items: skeleton restores them and logs an incident

Recommended conventions:
- prefix with `app.` for your plugin-owned IDs:
  - `app.section.analytics`
  - `app.nav.reports`

---

### 5.3 PageRegistry / Pages module (required)
The skeleton uses a stable dispatcher route:
- it passes you the requested path
- you return a component + params (or null → 404)

Minimal example:
~~~tsx
import React from 'react'

type PageMatch = { component: React.ComponentType<any>; params: Record<string, string> }

function match(pattern: string, pathname: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean)
  const s = pathname.split('/').filter(Boolean)
  if (p.length !== s.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!
    const b = s[i]!
    if (a.startsWith(':')) params[a.slice(1)] = decodeURIComponent(b)
    else if (a !== b) return null
  }
  return params
}

export const pages = [
  {
    pattern: '/',
    component: function Dashboard() {
      return <div>Dashboard</div>
    },
  },
  {
    pattern: '/reports',
    component: function Reports() {
      return <div>Reports</div>
    },
  },
  {
    pattern: '/notes/:id',
    component: function NoteDetail({ params }: { params: { id: string } }) {
      return <div>Note {params.id}</div>
    },
  },
] as const

export function matchPage(pathname: string): PageMatch | null {
  for (const p of pages) {
    const params = match(p.pattern, pathname)
    if (params) return { component: p.component as any, params }
  }
  return null
}
~~~

Rules:
- do not do network calls during `matchPage`
- do not mutate globals during match
- keep matching deterministic and fast

---

## 6) Capabilities, entitlements, and paid feature gating

### 6.1 You define capabilities
Your Main App plugin must declare capabilities it uses:
- `app.core`
- `app.reports`
- `app.export.pdf`

### 6.2 Core decides who gets what (admin-configurable)
The skeleton admin panel maps:
- plan → capabilities

### 6.3 Enforcement rule
Nav gating is UX only.
All server endpoints must enforce `entitlements.require(capabilityId, ctx)`.

In UI, use capabilities for visibility:
- `requires: { capability: 'app.reports' }`

---

## 7) Local RBAC for your app resources
If your product needs roles/groups/scopes:
- implement a local authz namespace, e.g. `app.`
- create tenant-scoped RBAC tables with tenant_id + RLS
- enforce using `authz.require(ctx, { ability, resource })`

Example:
- `app.note.read`
- `app.note.write`

You must not rely on UI-only checks.

---

## 8) Auditing
Anything privileged must emit audit events:
- role changes
- data exports
- admin mutations
- security config changes

Emit via:
- `audit:record`

Recommended action names:
- `app.note.created`
- `app.note.updated`
- `app.rbac.member_added`

Do not log secrets.

---

## 9) Auth tokens: integrate + consume (optional)
Use core token primitives from the host instead of implementing token storage in the plugin.

Model:
- host owns mint/list/revoke/validate internals (tenant-scoped, hashed storage)
- plugin owns token semantics (`kind`, `scopes`) and route authorization behavior
- plugin receives a scoped adapter as `ctx.authTokens`

Use cases:
- issue token from plugin route or host profile integrations UI
- validate token on plugin API endpoints (MCP/browser extension/webhook-style calls)

Example consume flow in plugin route:
~~~ts
const authHeader = ctx.request.header('authorization')
const tokenValue = authHeader?.replace(/^Bearer\s+/i, '').trim()

if (!tokenValue) {
  ctx.response.status(401).json({ error: 'missing_token', message: 'Token is required' })
  return
}

const result = await ctx.authTokens?.validateToken({
  tokenValue,
  kind: 'integration',
  requiredScopes: ['mcp:read'],
})

if (!result?.valid) {
  ctx.response.status(401).json({ error: 'invalid_token', message: result?.error ?? 'Unauthorized' })
  return
}

if (result.tenantId !== ctx.tenant?.id) {
  ctx.response.status(403).json({ error: 'tenant_mismatch', message: 'Token tenant mismatch' })
  return
}
~~~

Guidelines:
- keep scope names plugin-owned and stable (`mcp:*`, `browser:*`, etc.)
- always enforce required scopes server-side on each token-protected endpoint
- audit token creation/revocation and privileged token-backed actions
- fail safe if `ctx.authTokens` is unavailable

Quick checklist (plugin author):
- [ ] choose stable `kind` values (for example `integration`, `browser_ext`)
- [ ] define and document allowed scopes per kind
- [ ] validate token with `ctx.authTokens.validateToken(...)` on every token-protected route
- [ ] enforce tenant binding (`validatedToken.tenantId === currentTenantId`)
- [ ] enforce required scopes per endpoint (least privilege)
- [ ] emit audit events for token lifecycle and sensitive token-backed mutations

---

## 10) Migrations and plugin schema upgrades (if you use DB tables)
If you need tables:
- include migrations in `database/migrations`
- bump `schemaVersion` in `plugin.meta.json`
- run migrations via CLI
- boot will fail if schema is behind

No runtime auto-migrations in production.

---

## 11) What you must not do
- Do not register routes under skeleton reserved prefixes (auth/admin/enterprise)
- Do not remove skeleton mandatory nav items
- Do not “shadow” core security (auth, tenant enforcement, RLS)
- Do not store secrets unencrypted
- Do not bypass entitlements/authz on server routes
- Do not rely on client checks for security

---

## 12) Debugging and safe mode
If your design override crashes:
- skeleton falls back to default admin/auth theme
- you should be able to recover by:
  - disabling override in config
  - or using `SAFE_MODE=1` (if enabled on the platform)

As a plugin author:
- keep overrides small
- avoid heavy logic in shells
- fail safe, not fancy

---

## 13) Minimal checklist before shipping
- [ ] `plugin.meta.json` present and valid
- [ ] `design` implements `AppDesign`
- [ ] `AppProviders` (if used) doesn't break when `useFramework()` returns null
- [ ] nav IDs are unique and stable
- [ ] pages match deterministically, no side effects
- [ ] capabilities declared and enforced on server
- [ ] local RBAC (if needed) uses `authz.require`
- [ ] privileged mutations emit audit events
- [ ] migrations bump schemaVersion and update plugin_db_state
- [ ] no routes collide with skeleton prefixes

---

End of document.
~~~md
