# Addon Spec — Main App Design Ownership + Navigation Model V2
**One "Main App" plugin can own global design (theme/layout) while the skeleton app remains recoverable and secure.**
**Also upgrades nav from `items[]` to `sections[] + items[]` to allow both "add item" and "add top-level section".**

---

## 0) Why this addon exists
Your skeleton SaaS already provides:
- auth, users, tenants, admin, enterprise modules, billing, audit, etc.
- a plugin system (Tier A/B) for extending behavior

But you need one "Main App" plugin that:
- provides the *actual product UI* and most business navigation
- can define the global design system (theme/layout)
- can optionally theme skeleton areas (admin/auth) without bricking access

This addon extends the current spec without rewriting it.

---

## 1) Core outcomes and invariants

### 1.1 Outcomes
- Main App plugin defines **baseline** theme + shell for the "product" area.
- Skeleton admin/auth areas keep their default theme by default, but can be overridden.
- Other plugins can extend navigation:
  - add items inside existing sections
  - add new top-level sections
- The skeleton enforces:
  - reserved IDs
  - collision detection
  - mandatory items restoration
  - server-side permission filtering
  - safe fallback if overrides crash

### 1.2 Invariants (hard rules)
- **Exactly one** Main App plugin exists and is required (skeleton alone has no business UI).
- Main App baseline applies to the product area; overrides for admin/auth are optional.
- No silent break:
  - If overrides crash or are invalid, skeleton falls back to default admin/auth theme/shell.
- Navigation IDs must be globally unique. Duplicate `section.id` or `item.id` is boot-fatal.
- Reserved section IDs are skeleton-owned and cannot be replaced or removed.
- Mandatory items cannot be removed silently; skeleton restores them after filters run.
- Permission filtering is centralized in skeleton; nav must not show inaccessible links.

### 1.3 Main App package vs Tier A/B plugins (important)

The "Main App" is a **special package** that may contain:
- a **Design module** (always): shells, theme tokens, nav baseline, page registry
- an optional **Tier B server module**: routes, hooks, jobs, migrations

Security boundary:
- The **design module is UI-only** and is not subject to Tier B server restrictions.
- The **server module is Tier B** and MUST follow all Tier B rules (no raw db/router/bouncer/drive).

---

## 2) Design ownership contract (AppDesign)

### 2.1 Types
```ts
export type ThemeTokens = {
  // Raw CSS variables (preferred, stable substrate).
  cssVars: Record<string, string>

  // Common convenience fields (optional).
  appName?: string
  logoUrl?: string

  // Implementations may add typed tokens like colorPrimary/borderRadius etc.
  // If so, they MUST map to cssVars and remain optional.
}

export type NavItem = {
  id: string
  label: string
  href: string
  icon?: string
  order?: number
  requires?: {
    capability?: string         // entitlements capability
    ability?: string            // authz ability (optional; expensive if per-item)
  }
}

export type NavSection = {
  id: string
  label: string
  order?: number
  items: NavItem[]
}

export type NavModel = {
  main: NavSection[]
  admin: NavSection[]
  userMenu: NavSection[]  // sections, not flat items — allows grouped plugin menus
}

export type NavContext = {
  // Identity / routing state
  tenantId: string | null               // null for guest/no-tenant-selected states
  userId?: string

  // Fast checks: these drive nav visibility (UX). Security is enforced server-side too.
  entitlements: ReadonlySet<string>

  // Coarse role flags for skeleton-owned decisions (admin entry points etc.)
  userRole: 'guest' | 'user' | 'admin' | null
  isTenantAdmin?: boolean

  // Multi-tenant UX
  hasMultipleTenants: boolean

  // Optional precomputed abilities for expensive checks.
  // Use sparingly; prefer capability-based nav gating.
  abilities?: ReadonlyMap<string, boolean>

  // Optional UX-only subscription context (do not enforce security with this).
  // Entitlements remain the enforcement primitive.
  tenantPlanId?: string
}

export type ShellProps = {
  children: React.ReactNode
  nav: NavModel
}

export type ShellOverride = {
  Shell: React.ComponentType<ShellProps>
}

export interface AppDesign {
  /**
   * Baseline theme for the product area (always used).
   * Must be pure (no I/O, no fetch, no env reads that can throw).
   */
  appTokens(): ThemeTokens

  /**
   * Baseline shell for the product area (always used).
   * May be a Client Component; should avoid async work on render.
   */
  AppShell: React.ComponentType<ShellProps>

  /**
   * Optional override for skeleton admin area.
   * If missing or invalid/crashing, skeleton uses its default admin theme/shell.
   */
  adminOverride?: {
    tokens?: ThemeTokens
    shell?: ShellOverride
  }

  /**
   * Optional override for skeleton auth pages (login/register).
   * Same fallback semantics.
   */
  authOverride?: {
    tokens?: ThemeTokens
    shell?: ShellOverride
  }

  /**
   * Baseline navigation model (before plugin filters).
   * This is the product-defined "default nav".
   */
  navBaseline(ctx: NavContext): NavModel
}
```

### 2.2 Pure function rule
- `appTokens()` and `navBaseline()` must be pure.
- If they throw, the skeleton treats it as a plugin failure and falls back to safe minimal nav (and logs).

### 2.3 Fallback behavior
If an override exists but crashes:
- skeleton logs an incident
- skeleton uses default admin/auth shell
- skeleton does NOT block login/admin access

### 2.4 NavContext notes
- `tenantId` is nullable because UI includes auth pages, tenant picker, and onboarding.
- Server endpoints still treat tenant as mandatory.
- `userRole` is coarse; for fine-grained checks use `entitlements` or `abilities`.

---

## 3) Navigation Model V2 (sections + items)

### 3.1 Why `NavSection[]` instead of `items[]`
You want to keep your options open:
- plugins can add items inside existing sections
- plugins can add entirely new sections

This requires:
- stable section IDs
- deterministic ordering
- conflict rules

### 3.2 userMenu is also sections
Unlike flat `NavItem[]`, using `NavSection[]` for userMenu allows:
- grouped plugin settings menus
- nested settings links
- consistent composition across all nav areas

### 3.3 Sorting rules (deterministic)
- default `order = 1000`
- sort sections: `(order asc, id asc)`
- sort items within section: `(order asc, id asc)`

No "registration order" behavior.

---

## 4) Extension points (filters) — how plugins modify nav

### 4.1 Filters (client-side or shared UI registry)
These filters run in skeleton-owned composition code.

- `ui:nav:main` filter:
  - input/output: `NavSection[]`
- `ui:nav:admin` filter:
  - input/output: `NavSection[]`
- `ui:user:menu` filter:
  - input/output: `NavSection[]`
- `ui:theme:config` filter:
  - input/output: `ThemeTokens`

### 4.2 Filter examples

Main nav filter:
```ts
hooks.registerFilter('ui:nav:main', async (sections: NavSection[], ctx: NavContext) => {
  // Add a new section
  return [
    ...sections,
    {
      id: 'plugin.analytics',
      label: 'Analytics',
      order: 500,
      items: [
        { id: 'plugin.analytics.dashboard', label: 'Dashboard', href: '/analytics' },
      ],
    },
  ]
})
```

User menu filter (now sections):
```ts
hooks.registerFilter('ui:user:menu', async (sections: NavSection[], ctx: NavContext) => {
  return [
    ...sections,
    {
      id: 'plugin.settings',
      label: 'Plugin Settings',
      order: 500,
      items: [
        { id: 'plugin.settings.motion', label: 'Motion', href: '/settings/motion' },
        { id: 'plugin.settings.twitter', label: 'Twitter', href: '/settings/twitter' },
      ],
    },
  ]
})
```

---

## 5) Reserved IDs and mandatory items

### 5.1 Reserved section IDs (skeleton-owned)
These section IDs cannot be replaced or removed by plugins:
- `core.account`
- `core.settings`
- `core.admin`
- `core.billing` (if billing is exposed in UI)

Plugins may add items into these sections only if explicitly allowed by skeleton rules.

### 5.2 Mandatory items (skeleton-owned)
Mandatory items must exist after filters run:
- `core.logout`
- `core.switchTenant` (when `hasMultipleTenants` is true)
- `core.profile` (optional, for authenticated users)
- `core.adminDashboard` (only if user can access admin)

Behavior:
- if missing, skeleton restores them into `core.account` section and logs an incident

### 5.3 Collision detection (boot-fatal)
If any of these collide (same ID appears twice):
- section IDs (across main, admin, userMenu)
- item IDs (global uniqueness across all sections in all areas)

Then boot fails.

Yes, boot-fatal. It's the only way to avoid nondeterministic navigation.

---

## 6) Permission filtering (centralized, server-side)

### 6.1 Central rule
Even if plugins provide `requires` hints:
- skeleton applies final filtering based on entitlements (and optionally authz checks).

### 6.2 Practical guidance
- Use `requires.capability` for most nav gating (fast).
- Use `requires.ability` sparingly; per-item authz checks can be expensive.
  - Prefer coarse capability gating in nav, enforce authz server-side on the actual route.
  - If you use abilities, pre-compute them into `NavContext.abilities` map.

### 6.3 Mandatory enforcement
Navigation is UX only.
All server routes must enforce:
- entitlements
- authz
regardless of nav visibility.

---

## 7) Safe mode and incident logging (strongly recommended)

### 7.1 Safe mode
Add a server-side safe mode flag:
- disables all UI overrides (admin/auth) and all non-core plugins
- keeps auth and admin reachable

Example:
- ENV: `SAFE_MODE=1`
- or DB flag controlled by platform admin

### 7.2 Incident logs
When skeleton detects:
- override crash
- missing mandatory items restoration
- invalid nav model (e.g., empty main nav)

Log an incident:
- `audit:record` (platform-level) or structured log, depending on your audit policy

---

## 8) Code examples (reference implementation)

### 8.1 Main App plugin: design module export
`plugins/main-app/src/client/design.tsx`
```tsx
import React from 'react'

export const design = {
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
            <div className="font-semibold">{nav?.main?.[0]?.label ?? 'App'}</div>
            <nav className="flex gap-3">
              {nav.main.flatMap((s) => s.items).slice(0, 5).map((it) => (
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

  adminOverride: {
    // tokens only; keep shell default for now
    tokens: {
      cssVars: { '--brand': '#111827', '--brand-foreground': '#ffffff' },
      appName: 'MyProduct Admin',
    },
  },

  authOverride: {
    // optional
  },

  navBaseline(ctx) {
    return {
      main: [
        {
          id: 'app.home',
          label: 'Home',
          order: 10,
          items: [
            { id: 'app.home.dashboard', label: 'Dashboard', href: '/', order: 10 },
            {
              id: 'app.home.reports',
              label: 'Reports',
              href: '/reports',
              order: 20,
              requires: { capability: 'app.reports' },
            },
          ],
        },
      ],
      admin: [
        {
          id: 'core.admin',
          label: 'Admin',
          order: 10,
          items: [
            { id: 'core.adminDashboard', label: 'Admin Dashboard', href: '/admin', order: 10 },
          ],
        },
      ],
      userMenu: [
        {
          id: 'core.account',
          label: 'Account',
          order: 10,
          items: [
            { id: 'core.profile', label: 'Profile', href: '/settings/profile', order: 10 },
            { id: 'core.logout', label: 'Logout', href: '/auth/logout', order: 9999 },
          ],
        },
      ],
    }
  },
}
```

### 8.2 Skeleton: build final nav model
`apps/web/lib/nav/buildNavModel.ts`

**Build order:**
baseline → filters → mandatory restore → sort → collision check → permission filter

```ts
import type { NavModel, NavSection, NavItem, NavContext } from '@pkg/plugin-kit'

const DEFAULT_ORDER = 1000

function sortSections(sections: NavSection[]): NavSection[] {
  return [...sections]
    .map((s) => ({
      ...s,
      order: s.order ?? DEFAULT_ORDER,
      items: [...s.items]
        .map((i) => ({ ...i, order: i.order ?? DEFAULT_ORDER }))
        .sort((a, b) => (a.order! - b.order!) || a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => (a.order! - b.order!) || a.id.localeCompare(b.id))
}

function assertNoIdCollisions(nav: NavModel): void {
  const seen = new Set<string>()

  const add = (id: string) => {
    if (seen.has(id)) throw new Error(`Nav ID collision: ${id}`)
    seen.add(id)
  }

  // Check all section IDs across all areas
  for (const sec of nav.main) add(sec.id)
  for (const sec of nav.admin) add(sec.id)
  for (const sec of nav.userMenu) add(sec.id)

  // Check all item IDs across all sections
  for (const sec of [...nav.main, ...nav.admin, ...nav.userMenu]) {
    for (const it of sec.items) add(it.id)
  }
}

function findOrCreateAccountSection(userMenu: NavSection[]): NavSection {
  let section = userMenu.find((s) => s.id === 'core.account')
  if (!section) {
    section = { id: 'core.account', label: 'Account', order: 9000, items: [] }
    userMenu.push(section)
  }
  return section
}

function ensureMandatoryItems(nav: NavModel, ctx: NavContext): NavModel {
  const userMenu = nav.userMenu.map((s) => ({ ...s, items: [...s.items] }))
  const accountSection = findOrCreateAccountSection(userMenu)

  const allUserMenuItems = userMenu.flatMap((s) => s.items)
  const existingIds = new Set(allUserMenuItems.map((i) => i.id))

  // core.logout: always required
  if (!existingIds.has('core.logout')) {
    console.warn('[nav:incident] Mandatory item "core.logout" was missing and has been restored.')
    accountSection.items.push({
      id: 'core.logout',
      label: 'Logout',
      href: '/auth/logout',
      order: 9999,
    })
  }

  // core.switchTenant: required when hasMultipleTenants
  if (ctx.hasMultipleTenants && !existingIds.has('core.switchTenant')) {
    console.warn('[nav:incident] Mandatory item "core.switchTenant" was missing and has been restored.')
    accountSection.items.push({
      id: 'core.switchTenant',
      label: 'Switch Organization',
      href: '/tenants',
      order: 9000,
    })
  }

  return { ...nav, userMenu }
}

function applyPermissionFilter(
  nav: NavModel,
  entitlements: ReadonlySet<string>,
  abilities?: ReadonlyMap<string, boolean>
): NavModel {
  const canSee = (it: NavItem) => {
    if (it.requires?.capability && !entitlements.has(it.requires.capability)) {
      return false
    }
    if (it.requires?.ability && abilities && !abilities.get(it.requires.ability)) {
      return false
    }
    return true
  }

  const filterSections = (secs: NavSection[]) =>
    secs
      .map((s) => ({ ...s, items: s.items.filter(canSee) }))
      .filter((s) => s.items.length > 0)

  return {
    main: filterSections(nav.main),
    admin: filterSections(nav.admin),
    userMenu: filterSections(nav.userMenu),
  }
}

export async function buildNavModel({
  design,
  hooks,
  ctx,
}: {
  design: { navBaseline: (ctx: NavContext) => NavModel }
  hooks: { applyFilters: (hook: string, value: any, ctx: any) => Promise<any> }
  ctx: NavContext
}): Promise<NavModel> {
  // 1) baseline
  let nav = design.navBaseline(ctx)

  // 2) filters
  nav = {
    ...nav,
    main: await hooks.applyFilters('ui:nav:main', nav.main, ctx),
    admin: await hooks.applyFilters('ui:nav:admin', nav.admin, ctx),
    userMenu: await hooks.applyFilters('ui:user:menu', nav.userMenu, ctx),
  }

  // 3) mandatory restore
  nav = ensureMandatoryItems(nav, ctx)

  // 4) sort
  nav = {
    main: sortSections(nav.main),
    admin: sortSections(nav.admin),
    userMenu: sortSections(nav.userMenu),
  }

  // 5) collision check (boot-fatal in practice; here it throws)
  assertNoIdCollisions(nav)

  // 6) permission filtering
  nav = applyPermissionFilter(nav, ctx.entitlements, ctx.abilities)

  return nav
}
```

### 8.3 Skeleton: override fallback (admin/auth)
`apps/web/lib/theme/getShellForArea.tsx`
```tsx
import React from 'react'

export function getShellForArea({
  area,
  design,
  DefaultShell,
  nav,
  children,
}: {
  area: 'app' | 'admin' | 'auth'
  design: any
  DefaultShell: React.ComponentType<any>
  nav: any
  children: React.ReactNode
}) {
  try {
    if (area === 'app') {
      const Shell = design.AppShell
      return <Shell nav={nav}>{children}</Shell>
    }

    if (area === 'admin' && design.adminOverride?.shell?.Shell) {
      const Shell = design.adminOverride.shell.Shell
      return <Shell nav={nav}>{children}</Shell>
    }

    if (area === 'auth' && design.authOverride?.shell?.Shell) {
      const Shell = design.authOverride.shell.Shell
      return <Shell nav={nav}>{children}</Shell>
    }

    return <DefaultShell nav={nav}>{children}</DefaultShell>
  } catch (_err) {
    // Log incident (structured log + optional audit record) then return safe default.
    return <DefaultShell nav={nav}>{children}</DefaultShell>
  }
}
```

---

## 9) Implementation checklist
- [ ] Add `AppDesign` + `NavModel` types to your plugin-kit package
- [ ] Main App plugin exports a `design` module implementing `AppDesign`
- [ ] Skeleton loads design early (server and client)
- [ ] Build nav via `navBaseline → filters → mandatory restore → sort → collision check → permission filter`
- [ ] Add reserved IDs enforcement (boot-fatal if violated)
- [ ] Implement override fallback for admin/auth
- [ ] Add SAFE_MODE to disable overrides and non-core plugins for recovery
- [ ] Collision check includes userMenu sections and items

---

End of addon spec.
