# Plugin System V2.2 — Actions & Filters
**Production-grade, bundler-safe, ops-friendly, Day-2 hardened**

V2.2 is V2.1 plus three **production “Day 2” patches**:

1) **FOUC / layout shift** from client-side plugin boot  
2) **Migration discovery side-effects** from importing runtime modules  
3) **Anonymous RSC requests** (cookies/headers not forwarded to API)

It also tightens caching, timeouts, and operational controls so you don’t refactor later.

---

## 0) Core Principles (unchanged)

### Runtime separation
- **API registry (Adonis / Node):** domain logic + DB events + response shaping.
- **Client registry (Browser):** UI injection/enhancement.

### Deterministic semantics
- Filters sequential in `(priority asc, registration order)`.
- Actions sequential in `(priority asc, registration order)` by default.

### Fault isolation
- Per-callback try/catch + timeout + observability.
- Repeated failures can trigger quarantine.

### Typed hooks via module augmentation
- Hook names/payloads are declared via module augmentation.

---

## 1) Repository Layout (recommended)

```
apps/
  api/
  web/
packages/
  hooks/                  # types + registry
  plugin-kit/             # manifest types + flags types + fetch helpers
  config/                 # manifests + loader maps
plugins/
  user-greeter/
    package.json
    plugin.meta.json      # (recommended) no-side-effect metadata
    src/
      server.ts
      client.ts
      types.d.ts
    database/migrations/
```

---

## 2) Plugin Identity: Manifest (stable IDs, not function.name)

`packages/plugin-kit/src/manifest.ts`
```ts
export type PluginRuntime = "api" | "client";
export type PluginCategory = "core" | "feature" | "ui" | "experimental";

export type PluginMeta = {
  id: string;                 // stable (e.g. "user-greeter")
  packageName: string;        // e.g. "@plugins/user-greeter"
  version: string;            // semver
  runtime: PluginRuntime;
  category: PluginCategory;   // influences fail-open/closed policy
  dependsOn?: string[];       // plugin IDs
};
```

**Rule:** the `id` is the *only* thing you use for:
- enable/disable
- quarantine
- logs/metrics attribution
- dependency ordering

---

## 3) Hook Types: Module Augmentation

`packages/hooks/src/types.ts`
```ts
export type Tail<T extends any[]> = T extends [any, ...infer R] ? R : never;

export interface Actions {}   // hookName -> tuple of args
export interface Filters {}   // hookName -> tuple of [value, ...args]

export type ActionName = keyof Actions & string;
export type FilterName = keyof Filters & string;

export type ActionArgs<H extends ActionName> = Actions[H] extends any[] ? Actions[H] : never;
export type FilterTuple<H extends FilterName> = Filters[H] extends any[] ? Filters[H] : never;

export type FilterValue<H extends FilterName> = FilterTuple<H>[0];
export type FilterArgs<H extends FilterName> = Tail<FilterTuple<H>>;
```

---

## 4) Registry (deterministic + isolation + timeout)

Use the same `InMemoryHookRegistry` as V2.1 (no changes required here).

---

## 5) Installed vs Enabled vs Active vs Quarantined

### Definitions
- **Installed:** plugin code exists in the build artifact (monorepo package present).
- **Enabled:** runtime state allows it to run.
- **Active:** boot executed successfully in this process/session.
- **Quarantined:** disabled automatically due to repeated failures (circuit breaker).

### Controls (must implement)
- `PLUGINS_DISABLED=1` => disables all **non-core** plugins immediately.
- State source: DB or Redis (Redis preferred for fast toggles).

---

## 6) Plugin Discovery (bundler-safe + code-splittable)

### 6.1 Manifests + loader maps (explicit imports, no computed strings)

`packages/config/plugins.client.ts`
```ts
import type { PluginMeta } from "@pkg/plugin-kit/manifest";

export const clientPluginManifests: PluginMeta[] = [
  { id: "user-greeter", packageName: "@plugins/user-greeter", version: "1.0.0", runtime: "client", category: "ui" },
];

export const clientPluginLoaders: Record<string, () => Promise<{ default: (ctx: any) => any }>> = {
  "user-greeter": () => import("@plugins/user-greeter/src/client"),
};
```

`packages/config/plugins.server.ts`
```ts
import type { PluginMeta } from "@pkg/plugin-kit/manifest";

export const serverPluginManifests: PluginMeta[] = [
  { id: "user-greeter", packageName: "@plugins/user-greeter", version: "1.0.0", runtime: "api", category: "feature" },
];

export const serverPluginLoaders: Record<string, () => Promise<{ default: (ctx: any) => any }>> = {
  "user-greeter": () => import("@plugins/user-greeter/src/server"),
};
```

**Why:**  
- Browser only downloads enabled plugins (chunked), reducing perf + security surface.

---

## 7) ✅ Day-2 Patch #1: Fix FOUC / Layout Shift (No Nav Jump)

### The problem
If you boot plugins via `useEffect`, your default UI renders first, then updates later: **layout shift**.

### The V2.2 solution (two-layer fix)

#### Layer A — Fetch plugin state on the server (RSC) and pass it down
Do **not** fetch plugin state in `useEffect` for the initial render path.

`apps/web/app/layout.tsx` (Server Component)
```tsx
import { fetchPluginStateRsc } from "@/lib/plugin-state-rsc";
import { PluginProvider } from "./PluginProvider";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialState = await fetchPluginStateRsc(); // runs on server
  return (
    <html>
      <body>
        <PluginProvider initialState={initialState}>
          {children}
        </PluginProvider>
      </body>
    </html>
  );
}
```

#### Layer B — Add a boot barrier for “layout-critical” UI regions
Even with correct state, plugin code is still chunk-loaded. If nav depends on it, you must either:
- **Gate nav until plugins are ready** (recommended), or
- **Move nav composition to API-shaped data** (see Option C below)

**Recommended:** gate nav using `pluginsReady`.

`apps/web/app/PluginProvider.tsx` (Client Component)
```tsx
"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { InMemoryHookRegistry, HookRegistry } from "@pkg/hooks";
import { clientPluginLoaders, clientPluginManifests } from "@pkg/config/plugins.client";

export type PluginState = {
  enabled: string[];
  quarantined: string[];
};

type ProviderValue = {
  hooks: HookRegistry;
  pluginsReady: boolean;
  state: PluginState;
};

const PluginCtx = createContext<ProviderValue | null>(null);

export function PluginProvider({ children, initialState }: { children: React.ReactNode; initialState: PluginState }) {
  const registryRef = useRef<HookRegistry | null>(null);
  const [pluginsReady, setPluginsReady] = useState(false);

  const state = initialState;

  if (!registryRef.current) {
    registryRef.current = new InMemoryHookRegistry({
      timeoutMs: 1000,
      onError: (e) => console.error("Client plugin hook failed", e),
    });
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const hooks = registryRef.current!;
      const enabled = new Set(state.enabled);
      const quarantined = new Set(state.quarantined);

      // Load/boot only enabled + not quarantined (and not globally disabled)
      const bootPromises: Promise<unknown>[] = [];

      for (const meta of clientPluginManifests) {
        const id = meta.id;
        const mustRun = meta.category === "core";

        if (process.env.NEXT_PUBLIC_PLUGINS_DISABLED === "1" && !mustRun) continue;
        if (quarantined.has(id)) continue;
        if (!enabled.has(id) && !mustRun) continue;

        const loader = clientPluginLoaders[id];
        if (!loader) continue;

        bootPromises.push(
          loader()
            .then((mod) => mod.default({ hooks }))
            .catch((e) => console.error("Client plugin boot failed", { pluginId: id, e }))
        );
      }

      await Promise.allSettled(bootPromises);
      if (!cancelled) setPluginsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [state.enabled, state.quarantined]);

  const value = useMemo(() => ({ hooks: registryRef.current!, pluginsReady, state }), [pluginsReady, state]);

  return <PluginCtx.Provider value={value}>{children}</PluginCtx.Provider>;
}

export function usePlugins() {
  const v = useContext(PluginCtx);
  if (!v) throw new Error("usePlugins must be used inside <PluginProvider>");
  return v;
}
```

Now gate layout-critical UI:

`apps/web/app/Navigation.tsx`
```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePlugins } from "./PluginProvider";

const DEFAULT_NAV = [{ label: "Home", href: "/" }];

export function Navigation() {
  const { hooks, pluginsReady } = usePlugins();
  const [nav, setNav] = useState(DEFAULT_NAV);

  // Prevent layout shift: don't render final nav until plugins are ready
  // Render a stable skeleton placeholder instead.
  if (!pluginsReady) {
    return <nav aria-busy="true" style={{ height: 40 }} />; // stable height placeholder
  }

  useEffect(() => {
    hooks.applyFilters("ui.nav.items", DEFAULT_NAV).then(setNav);
  }, [hooks]);

  return (
    <nav style={{ height: 40, display: "flex", gap: 12 }}>
      {nav.map((i) => (
        <a key={i.href} href={i.href}>
          {i.label}
        </a>
      ))}
    </nav>
  );
}
```

##### Option C (Best UX): Make initial nav server-correct via API-shaped data
If nav composition needs to be correct at SSR without gating, **compute nav items in Adonis** using hooks, and have Next fetch them server-side. Client plugins then only enhance interaction. This eliminates nav flicker entirely.

---

## 8) ✅ Day-2 Patch #2: Migration Discovery Without Side-Effects

### The problem
If migration paths are obtained by importing `src/server.ts`, a developer can accidentally add top-level side effects and break `ace migration:run`.

### V2.2 rule
**Never import runtime plugin entrypoints to discover static metadata.**

### Recommended approach (clean): `plugin.meta.json`
Each plugin has a side-effect-free metadata file.

`plugins/user-greeter/plugin.meta.json`
```json
{
  "id": "user-greeter",
  "migrations": "./database/migrations"
}
```

Alternative (acceptable): `package.json` custom key
```json
{
  "name": "@plugins/user-greeter",
  "x-plugin": {
    "id": "user-greeter",
    "migrations": "./database/migrations"
  }
}
```

### How to resolve migration paths safely (Node-only, no TS imports)
In Adonis (Node), resolve `package.json` or `plugin.meta.json` via `require.resolve`.

`apps/api/config/plugin_migrations.ts`
```ts
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { serverPluginManifests } from "@pkg/config/plugins.server";

const require = createRequire(import.meta.url);

export function resolvePluginMigrationDirs(): string[] {
  const dirs: string[] = [];

  for (const meta of serverPluginManifests) {
    // Resolve the plugin's package.json path (workspace-safe)
    const pkgJsonPath = require.resolve(`${meta.packageName}/package.json`);
    const root = dirname(pkgJsonPath);

    // Preferred: plugin.meta.json
    try {
      const metaPath = join(root, "plugin.meta.json");
      const data = require(metaPath);
      if (data?.migrations) dirs.push(join(root, data.migrations));
      continue;
    } catch {
      // fallback to package.json x-plugin
    }

    const pkg = require(pkgJsonPath);
    const rel = pkg?.["x-plugin"]?.migrations;
    if (rel) dirs.push(join(root, rel));
  }

  return dirs;
}
```

Now wire it into Adonis migration directories (sync):

`apps/api/adonisrc.ts`
```ts
import { defineConfig } from "@adonisjs/core/app";
import { resolvePluginMigrationDirs } from "./config/plugin_migrations";

export default defineConfig({
  directories: {
    migrations: ["database/migrations", ...resolvePluginMigrationDirs()],
  },
});
```

**Result:** migration runner reads static JSON and never imports `server.ts`.

---

## 9) ✅ Day-2 Patch #3: Authenticated RSC → Adonis fetch (forward cookies safely)

### The problem
RSC `fetch(process.env.API_URL + "/...")` does **not** forward cookies by default.
Adonis sees anonymous requests, so user-specific plugin behavior can’t work.

### The V2.2 solution: internal fetch wrapper for RSC
`apps/web/lib/internal-api-fetch.ts`
```ts
import { headers } from "next/headers";

export async function internalApiFetch(path: string, init: RequestInit = {}) {
  if (!path.startsWith("/")) throw new Error("internalApiFetch path must start with '/'");
  if (path.includes("..")) throw new Error("internalApiFetch path cannot include '..'");

  const h = headers();
  const cookie = h.get("cookie") || "";

  // USER-SPECIFIC => NEVER CACHE
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    return await fetch(`${process.env.API_URL}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        ...(init.headers || {}),
        Cookie: cookie,
        // Optional: trace/correlation
        "x-request-id": h.get("x-request-id") || "",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
```

Usage in RSC / `generateMetadata`:

```ts
import { internalApiFetch } from "@/lib/internal-api-fetch";

export async function generateMetadata() {
  const res = await internalApiFetch("/seo?path=/");
  const seo = await res.json();
  return { title: seo.title, description: seo.description };
}
```

**Critical note:** If the response is user-specific, do not use `revalidate` caching or you risk cross-user leaks.

---

## 10) Next.js “Server-First” Strategy (keep registries at 2)

V2.2 keeps **two registries**:
- Adonis (logic/data shaping)
- Browser (UI enhancements)

Next RSC is a bridge:
- it fetches plugin-shaped data from Adonis using `internalApiFetch`.
- it renders server HTML with correct user context.
- it avoids a third plugin runtime/registry.

---

## 11) Dependencies: pnpm Workspace Standard (monorepo-safe)

`pnpm-workspace.yaml`
```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "plugins/*"
```

Plugin is a real package with exports:

`plugins/user-greeter/package.json`
```json
{
  "name": "@plugins/user-greeter",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "exports": {
    "./src/client": "./src/client.ts",
    "./src/server": "./src/server.ts"
  }
}
```

Next transpiles plugins via manifest (pure data):

`apps/web/next.config.ts`
```ts
import { clientPluginManifests } from "@pkg/config/plugins.client";

export default {
  transpilePackages: clientPluginManifests.map((p) => p.packageName),
};
```

---

## 12) Example plugin (typed, split runtime)

`plugins/user-greeter/src/types.d.ts`
```ts
import type { User } from "@pkg/types";

declare module "@pkg/hooks/types" {
  interface Actions {
    "user.authenticated": [User];
  }
  interface Filters {
    "user.profile.displayName": [string, User];
    "ui.nav.items": [Array<{ label: string; href: string }>];
  }
}
```

`plugins/user-greeter/src/server.ts`
```ts
export default async function UserGreeterServer({ hooks, logger }: any) {
  hooks.registerAction("user-greeter", "user.authenticated", async (user) => {
    logger.info({ email: user.email }, "[Server] Hello");
  });
}
```

`plugins/user-greeter/src/client.ts`
```ts
export default function UserGreeterClient({ hooks }: any) {
  return hooks.registerFilter("user-greeter", "user.profile.displayName", (name, user) =>
    user.isVerified ? `${name} ✅` : name
  );
}
```

---

## 13) Testing Checklist (don’t ship without these)

### Registry unit tests
- priority ordering
- filter value propagation
- action isolation
- timeouts
- unregister

### Integration tests
- Adonis boots only enabled plugins
- client downloads/boots only enabled plugins (chunk splitting)
- nav does not layout shift (snapshot/Playwright: no visual jump)
- internalApiFetch forwards cookies + is `no-store`
- migration runner can read migration dirs without importing runtime entrypoints

---

## 14) Operational Checklist (production sanity)

- [ ] `PLUGINS_DISABLED=1` supported
- [ ] Flags state cached with TTL server-side
- [ ] Plugin state RSC fetch is cheap (DB/Redis + minimal payload)
- [ ] Client boot barrier for layout-critical UI (nav/header)
- [ ] Migration metadata is side-effect free (meta JSON / package.json)
- [ ] internalApiFetch uses `no-store` + timeout + cookie forward
- [ ] Quarantine exists (Redis) for repeated failures

---

End of document.
