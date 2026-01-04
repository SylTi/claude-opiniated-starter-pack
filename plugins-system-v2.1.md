# Plugin System V2.1 — Actions & Filters
Production-grade, bundler-safe, ops-friendly

This is the “guaranteed success” plan: stable builds + runtime kill-switch + workspace-safe dependencies + no accidental third registry (RSC stays dumb, API shapes data).

---

## 0) What V2.1 fixes (explicitly)

V2.1 keeps V2’s bundler safety, and **closes the three operational/architectural gaps**:

1) **Re-deployment bottleneck** → solved with **installation vs activation** + **runtime flags** + (client) **code-splitting loaders**  
2) **Dependency hoisting trap** → solved with **pnpm workspace plugins as packages** + **manifest-driven transpilation**  
3) **Next “third runtime” (RSC) blind spot** → solved by **API-first shaping** + **explicit SEO/data endpoints** + caching policy

---

## 1) Non-negotiables (Design Contracts)

### 1.1 Runtime separation
- **API registry (Adonis / Node)**: domain logic + DB events.
- **Client registry (Browser)**: UI injection/modification.
- No “isomorphic plugin object” imported into client bundle. That’s a trap.

### 1.2 Deterministic semantics
- **Filters**: sequential in `(priority asc, registration order)`.
- **Actions**: sequential in `(priority asc, registration order)` by default.

### 1.3 Fault isolation
A plugin callback failure:
- doesn’t stop other callbacks
- is attributed to `{ pluginId, hook, kind }`
- is observable (logs/metrics)
- can be auto-quarantined after repeated failures

### 1.4 Typed hook contracts via module augmentation
Hook names and payloads are **declared by plugins** (and core), not hardcoded in one giant union.

---

## 2) Repository layout (recommended)

```
apps/
  api/                      # AdonisJS
  web/                      # Next.js (App Router)
packages/
  hooks/                    # hook types + registry
  plugin-kit/               # plugin manifest types + flags helpers
  config/                   # plugin manifests + loader maps (server/client)
plugins/
  user-greeter/
    package.json
    src/
      client.ts
      server.ts
      types.d.ts
    database/migrations/
```

---

## 3) Plugin Manifest (DO NOT rely on function.name)

A plugin must have a stable identity and metadata.

### 3.1 Manifest type

`packages/plugin-kit/src/manifest.ts`
```ts
export type PluginRuntime = "api" | "client";
export type PluginCategory = "core" | "feature" | "ui" | "experimental";

export type PluginMeta = {
  id: string;                 // stable, never changes (e.g. "user-greeter")
  packageName: string;        // e.g. "@plugins/user-greeter"
  version: string;            // semver
  runtime: PluginRuntime;     // api/client
  category: PluginCategory;   // affects fail-open/closed policy
  dependsOn?: string[];       // plugin IDs
};
```

### 3.2 Why this matters
- Kill switch checks a stable `meta.id`.
- Observability / quarantine uses `meta.id`.
- Next transpilation uses `meta.packageName` **without importing plugin code**.

---

## 4) Typed Hooks via Module Augmentation (supports extra args)

`packages/hooks/src/types.ts`
```ts
export type Tail<T extends any[]> = T extends [any, ...infer R] ? R : never;

// Plugins augment these:
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

## 5) Registry (deterministic ordering + timeout + isolation)

`packages/hooks/src/registry.ts`
```ts
import type { ActionName, ActionArgs, FilterName, FilterValue, FilterArgs } from "./types";

export type Unregister = () => void;

export type HookError = {
  plugin: string;
  hook: string;
  kind: "action" | "filter";
  error: unknown;
};

export type HookRegistryOptions = {
  timeoutMs?: number;
  onError?: (err: HookError) => void;
};

export interface HookRegistry {
  registerAction<H extends ActionName>(
    plugin: string,
    hook: H,
    cb: (...args: ActionArgs<H>) => Promise<void> | void,
    priority?: number
  ): Unregister;

  registerFilter<H extends FilterName>(
    plugin: string,
    hook: H,
    cb: (value: FilterValue<H>, ...args: FilterArgs<H>) => Promise<FilterValue<H>> | FilterValue<H>,
    priority?: number
  ): Unregister;

  dispatchAction<H extends ActionName>(hook: H, ...args: ActionArgs<H>): Promise<void>;
  applyFilters<H extends FilterName>(hook: H, initial: FilterValue<H>, ...args: FilterArgs<H>): Promise<FilterValue<H>>;
}

type Entry<T extends Function> = {
  id: number;
  plugin: string;
  priority: number;
  fn: T;
};

export class InMemoryHookRegistry implements HookRegistry {
  private seq = 0;
  private actions = new Map<string, Entry<(...args: any[]) => any>[]>();
  private filters = new Map<string, Entry<(value: any, ...args: any[]) => any>[]>();

  constructor(private opts: HookRegistryOptions = {}) {}

  registerAction(plugin: string, hook: string, cb: any, priority = 10) {
    const entry = { id: ++this.seq, plugin, priority, fn: cb };
    const list = this.actions.get(hook) ?? [];
    list.push(entry);
    this.actions.set(hook, list);
    return () => this.remove(this.actions, hook, entry.id);
  }

  registerFilter(plugin: string, hook: string, cb: any, priority = 10) {
    const entry = { id: ++this.seq, plugin, priority, fn: cb };
    const list = this.filters.get(hook) ?? [];
    list.push(entry);
    this.filters.set(hook, list);
    return () => this.remove(this.filters, hook, entry.id);
  }

  async dispatchAction(hook: any, ...args: any[]) {
    for (const e of this.sorted(this.actions.get(hook))) {
      await this.safeCall("action", hook, e.plugin, () => e.fn(...args), undefined);
    }
  }

  async applyFilters(hook: any, initial: any, ...args: any[]) {
    let value = initial;
    for (const e of this.sorted(this.filters.get(hook))) {
      value = await this.safeCall("filter", hook, e.plugin, () => e.fn(value, ...args), value);
    }
    return value;
  }

  private sorted(list?: Entry<any>[]) {
    return (list ?? []).slice().sort((a, b) => (a.priority - b.priority) || (a.id - b.id));
  }

  private remove(map: Map<string, Entry<any>[]>, hook: string, id: number) {
    const list = map.get(hook);
    if (!list) return;
    const next = list.filter(e => e.id !== id);
    next.length ? map.set(hook, next) : map.delete(hook);
  }

  private async safeCall(kind: "action" | "filter", hook: string, plugin: string, fn: () => any, fallback: any) {
    try {
      if (!this.opts.timeoutMs) return await fn();
      return await Promise.race([
        Promise.resolve().then(fn),
        new Promise((_, rej) => setTimeout(() => rej(new Error(`Hook timeout after ${this.opts.timeoutMs}ms`)), this.opts.timeoutMs)),
      ]);
    } catch (error) {
      this.opts.onError?.({ plugin, hook, kind, error });
      return fallback;
    }
  }
}
```

---

## 6) Installation vs Activation (Kill Switch Pattern)

### 6.1 Definitions
- **Installed**: plugin code exists in the build artifact.
- **Enabled**: runtime config says “this plugin may run”.
- **Active**: it booted successfully in this process/session.
- **Quarantined**: auto-disabled due to repeated failures.

### 6.2 Flags source
Pick one:
- DB table `plugins_state`
- Redis keys
- Config service

### 6.3 Flag caching policy (mandatory)
Reliably ship this or you will suffer:
- server: TTL cache (10–30s) + lazy refresh
- client: fetch once per session (+ optional refresh on route changes)
- explicit fail policy:
  - `core`: fail-open
  - `feature/ui/experimental`: fail-closed

### 6.4 Emergency global switch
- `PLUGINS_DISABLED=1` disables all non-core plugins immediately.

---

## 7) Plugin discovery that is bundler-safe AND kill-switch-friendly

### 7.1 Never “import everything then skip”
That still ships code, runs module top-level side effects, and keeps vulnerable deps in the bundle.

### 7.2 Use loader maps (explicit dynamic imports, code-splittable)

`packages/config/plugins.client.ts`
```ts
import type { PluginMeta } from "@pkg/plugin-kit/manifest";

export const clientPluginManifests: PluginMeta[] = [
  { id: "user-greeter", packageName: "@plugins/user-greeter", version: "1.0.0", runtime: "client", category: "ui" },
];

// Explicit map => Next can split chunks. No computed strings.
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

export const serverPluginLoaders: Record<string, () => Promise<{ default: (ctx: any) => any; migrations?: string[] }>> = {
  "user-greeter": () => import("@plugins/user-greeter/src/server"),
};
```

**Result**
- You ship installed plugins but only load/execute enabled ones.
- Client plugins become chunks and are not downloaded unless enabled.

---

## 8) Adonis integration (Provider + kill switch + quarantine)

### 8.1 Provider
`apps/api/app/providers/hooks_provider.ts`
```ts
import { InMemoryHookRegistry } from "@pkg/hooks";
import { serverPluginLoaders, serverPluginManifests } from "@pkg/config/plugins.server";

const BOOT_KEY = Symbol.for("app.plugins.booted");

export default class HooksProvider {
  constructor(private app: any) {}

  register() {
    this.app.container.singleton("hooks", () => {
      const logger = this.app.logger;
      return new InMemoryHookRegistry({
        timeoutMs: 2000,
        onError: (e) => logger.error(e, "Plugin hook failed"),
      });
    });
  }

  async boot() {
    if ((globalThis as any)[BOOT_KEY]) return;
    (globalThis as any)[BOOT_KEY] = true;

    const hooks = await this.app.container.make("hooks");
    const logger = this.app.logger;

    // Your runtime flags client (DB/Redis). Must return Sets.
    const flags = await this.app.container.make("flags");
    const state = await flags.getPluginState(); // { enabled:Set<string>, quarantined:Set<string> }

    for (const meta of serverPluginManifests) {
      const id = meta.id;

      const mustRun = meta.category === "core";
      const isEnabled = state.enabled.has(id);
      const isQuarantined = state.quarantined.has(id);

      if (process.env.PLUGINS_DISABLED === "1" && !mustRun) continue;
      if (isQuarantined) {
        logger.warn({ pluginId: id }, "Plugin quarantined; skipping");
        continue;
      }
      if (!isEnabled && !mustRun) continue;

      try {
        const mod = await serverPluginLoaders[id]();
        await mod.default({ app: this.app, hooks, logger }); // capability-based context
        logger.info({ pluginId: id }, "Plugin active");
      } catch (error) {
        logger.error({ pluginId: id, error }, "Plugin boot failed");
        // Optional: quarantine on boot failure for non-core
      }
    }
  }
}
```

---

## 9) Next.js client integration (Provider + code-splitting + kill switch)

`apps/web/app/PluginProvider.tsx`
```tsx
"use client";

import React, { createContext, useContext, useEffect, useRef } from "react";
import { InMemoryHookRegistry, HookRegistry } from "@pkg/hooks";
import { clientPluginLoaders, clientPluginManifests } from "@pkg/config/plugins.client";

type EnabledPluginState = { enabled: Set<string>; quarantined: Set<string> };

async function fetchPluginState(): Promise<EnabledPluginState> {
  const res = await fetch("/api/plugins/state", { cache: "no-store" });
  const json = await res.json();
  return { enabled: new Set(json.enabled), quarantined: new Set(json.quarantined) };
}

const PluginCtx = createContext<HookRegistry | null>(null);

export function PluginProvider({ children }: { children: React.ReactNode }) {
  const registryRef = useRef<HookRegistry | null>(null);

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
      const state = await fetchPluginState();

      for (const meta of clientPluginManifests) {
        const id = meta.id;

        const mustRun = meta.category === "core";
        const isEnabled = state.enabled.has(id);
        const isQuarantined = state.quarantined.has(id);

        if (isQuarantined) continue;
        if (!isEnabled && !mustRun) continue;

        try {
          const mod = await clientPluginLoaders[id](); // code-split chunk
          mod.default({ hooks });
        } catch (e) {
          console.error("Client plugin boot failed", { pluginId: id, e });
        }
      }

      if (cancelled) return;
      // Optional: set "pluginsLoaded" state to avoid UI flicker for nav/menu filters
    })();

    return () => { cancelled = true; };
  }, []);

  return <PluginCtx.Provider value={registryRef.current}>{children}</PluginCtx.Provider>;
}

export function usePlugins(): HookRegistry {
  const v = useContext(PluginCtx);
  if (!v) throw new Error("usePlugins must be used inside <PluginProvider>");
  return v;
}
```

### 9.1 Async filters in components (correct usage)
```tsx
"use client";
import { useEffect, useState } from "react";
import { usePlugins } from "./PluginProvider";

export function Navigation() {
  const hooks = usePlugins();
  const defaultNav = [{ label: "Home", href: "/" }];
  const [nav, setNav] = useState(defaultNav);

  useEffect(() => {
    hooks.applyFilters("ui.nav.items", defaultNav).then(setNav);
  }, [hooks]);

  return <nav>{nav.map(i => <a key={i.href} href={i.href}>{i.label}</a>)}</nav>;
}
```

---

## 10) Dependencies: pnpm workspace standard

### 10.1 pnpm-workspace.yaml
```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "plugins/*"
```

### 10.2 Plugin is a workspace package
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
  },
  "dependencies": {
    "axios": "^1.6.0"
  }
}
```

### 10.3 Next transpilation is manifest-driven
`apps/web/next.config.ts`
```ts
import { clientPluginManifests } from "@pkg/config/plugins.client";

const nextConfig = {
  transpilePackages: clientPluginManifests.map(p => p.packageName),
};

export default nextConfig;
```

**Rule:** `next.config.ts` only imports **pure-data manifests**, not plugin modules.

---

## 11) Migrations (explicit, Docker-safe)

### 11.1 Plugin server entrypoint may export `migrations`
`plugins/user-greeter/src/server.ts`
```ts
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const migrations = [join(__dirname, "../database/migrations")];

export default async function UserGreeterServer({ hooks, logger }: any) {
  hooks.registerAction("user-greeter", "user.authenticated", async (user) => {
    logger.info({ email: user.email }, "[Server] Hello");
  });
}
```

### 11.2 Naming convention
`plugin_<pluginId>__<table>`  
Example: `plugin_user_greeter__greetings`

---

## 12) Next RSC strategy: API-first, RSC stays dumb

- Plugins that affect **data** hook in **Adonis**.
- Plugins that affect **UI** hook in **Browser**.
- Next Server Components fetch plugin-shaped data from API.

Example SEO in Next:
```ts
export async function generateMetadata() {
  const res = await fetch(process.env.API_URL + "/seo?path=/", { cache: "no-store" });
  const seo = await res.json();
  return { title: seo.title, description: seo.description };
}
```

**Caching must be explicit**: choose `no-store` or `revalidate`, and define invalidation.

---

## 13) Quarantine / Circuit breaker (recommended)

Policy:
- Track failures per plugin ID (Redis recommended)
- Threshold: `N failures in M minutes` → quarantine for `T minutes`
- Admin override supported

This prevents runaway error spam and latency when a plugin is broken.

---

## 14) Security: capability-based contexts

- Backend plugins get curated capabilities, not raw internals.
- Client plugins are untrusted: never pass secrets/tokens.

---

## 15) Example plugin (typed, split runtime)

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

## 16) Checklist

- [ ] Add `packages/hooks`
- [ ] Add plugin manifests + loader maps (server/client)
- [ ] Add runtime flags (enabled/quarantined) + TTL caching
- [ ] Add Adonis provider boot
- [ ] Add Next PluginProvider boot (code-split loaders)
- [ ] Add migrations strategy (explicit)
- [ ] Add quarantine / circuit breaker
- [ ] Add tests for ordering/timeout/isolation

---

End of document.
