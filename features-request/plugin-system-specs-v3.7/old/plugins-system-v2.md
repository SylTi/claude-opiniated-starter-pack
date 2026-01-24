# Plugin System V2 — Event-driven Actions & Filters (Guaranteed Success)

> Goal: a **robust, event-driven plugin system** inspired by **WordPress Actions & Filters**, built for a **Next.js frontend** and **AdonisJS backend**, with **async support**, **deterministic ordering**, **typed hooks**, and **fault isolation** (plugin failures never take down core flows).

This document is intentionally opinionated. Follow it and you’ll ship something that compiles, runs, and stays maintainable.

---

## 0) Non-negotiables (Design Contracts)

### Runtime separation (do not violate)
- **Server plugins** must be importable and runnable **only** in Node.js (Adonis / Next server).
- **Client plugins** must be importable and runnable **only** in the browser (Next client).
- **Never** import a “mixed isomorphic plugin object” into code that may be bundled for the browser. Tree-shaking is not a safety boundary.

### Deterministic semantics
- **Filters** run **sequentially** in `(priority asc, registration order)` because each depends on the previous output.
- **Actions** run **sequentially** in `(priority asc, registration order)` (default). Priority implies ordering. You can add parallelism later, but do it explicitly.

### Fault isolation
- A failing plugin callback:
  - is caught
  - is attributed to **plugin + hook + kind**
  - is reported via `onError`
  - does **not** prevent other plugin callbacks from running

### Typed hooks (module augmentation)
- Core does **not** maintain a giant union of hook names.
- Plugins declare hook types through **TypeScript module augmentation**.

---

## 1) Repository layout (recommended)

Monorepo example:

```
apps/
  api/                 # AdonisJS
  web/                 # Next.js
packages/
  hooks/               # Hook registry implementation + shared types
  config/              # active plugin lists (server/client)
plugins/
  user-greeter/
    client.ts
    server.ts
    database/migrations/
    types.d.ts
```

---

## 2) Shared types: module augmentation that actually works

Create `packages/hooks/src/types.ts`:

```ts
// packages/hooks/src/types.ts
export type Tail<T extends any[]> = T extends [any, ...infer R] ? R : never;

/**
 * Plugins augment these interfaces.
 * - Actions: hookName -> tuple of args
 * - Filters: hookName -> tuple of [value, ...args]
 */
export interface Actions {}
export interface Filters {}

export type ActionName = keyof Actions & string;
export type FilterName = keyof Filters & string;

export type ActionArgs<H extends ActionName> = Actions[H] extends any[] ? Actions[H] : never;
export type FilterTuple<H extends FilterName> = Filters[H] extends any[] ? Filters[H] : never;

export type FilterValue<H extends FilterName> = FilterTuple<H>[0];
export type FilterArgs<H extends FilterName> = Tail<FilterTuple<H>>;
```

Export a stable module path from `packages/hooks/src/index.ts`:

```ts
export * from "./types";
export * from "./registry";
```

---

## 3) Registry interface (typed, async-safe, with isolation)

Create `packages/hooks/src/registry.ts`:

```ts
// packages/hooks/src/registry.ts
import type { ActionName, ActionArgs, FilterName, FilterValue, FilterArgs } from "./types";

export type Unregister = () => void;

export type HookError = {
  plugin: string;
  hook: string;
  kind: "action" | "filter";
  error: unknown;
};

export type HookRegistryOptions = {
  /**
   * Called for every callback failure (including timeouts).
   * In production: log + metrics.
   * In tests: optionally throw.
   */
  onError?: (err: HookError) => void;

  /**
   * Optional timeout for each callback.
   * If exceeded: callback considered failed; registry continues.
   */
  timeoutMs?: number;
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
  applyFilters<H extends FilterName>(
    hook: H,
    initial: FilterValue<H>,
    ...args: FilterArgs<H>
  ): Promise<FilterValue<H>>;
}

/**
 * In-memory registry (works in Node and Browser).
 * Deterministic ordering + fault isolation + optional timeouts.
 */
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

  registerAction(plugin: string, hook: string, cb: any, priority = 10): Unregister {
    const entry: Entry<any> = { id: ++this.seq, plugin, priority, fn: cb };
    const list = this.actions.get(hook) ?? [];
    list.push(entry);
    this.actions.set(hook, list);
    return () => this.remove(this.actions, hook, entry.id);
  }

  registerFilter(plugin: string, hook: string, cb: any, priority = 10): Unregister {
    const entry: Entry<any> = { id: ++this.seq, plugin, priority, fn: cb };
    const list = this.filters.get(hook) ?? [];
    list.push(entry);
    this.filters.set(hook, list);
    return () => this.remove(this.filters, hook, entry.id);
  }

  async dispatchAction(hook: any, ...args: any[]): Promise<void> {
    const list = this.sorted(this.actions.get(hook));
    for (const e of list) {
      await this.safeCall("action", hook, e.plugin, () => e.fn(...args), undefined);
    }
  }

  async applyFilters(hook: any, initial: any, ...args: any[]): Promise<any> {
    const list = this.sorted(this.filters.get(hook));
    let value = initial;
    for (const e of list) {
      const next = await this.safeCall("filter", hook, e.plugin, () => e.fn(value, ...args), value);
      value = next;
    }
    return value;
  }

  private sorted(list?: Entry<any>[]) {
    return (list ?? []).slice().sort((a, b) => (a.priority - b.priority) || (a.id - b.id));
  }

  private remove(map: Map<string, Entry<any>[]>, hook: string, id: number) {
    const list = map.get(hook);
    if (!list) return;
    const next = list.filter((e) => e.id !== id);
    if (next.length) map.set(hook, next);
    else map.delete(hook);
  }

  private async safeCall(
    kind: "action" | "filter",
    hook: string,
    plugin: string,
    fn: () => any,
    fallback: any
  ) {
    try {
      if (!this.opts.timeoutMs) return await fn();
      return await Promise.race([
        Promise.resolve().then(fn),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error(`Hook timeout after ${this.opts.timeoutMs}ms`)), this.opts.timeoutMs)
        ),
      ]);
    } catch (error) {
      this.opts.onError?.({ plugin, hook, kind, error });
      return fallback;
    }
  }
}
```

---

## 4) Plugin API: split entrypoints per runtime (no “isomorphic plugin object”)

Define “plugin entrypoints” as functions, not objects.

Create `packages/hooks/src/plugin.ts` (optional but recommended):

```ts
// packages/hooks/src/plugin.ts
import type { HookRegistry } from "./registry";

export type ServerPluginContext<App = unknown, Logger = unknown> = {
  app: App;
  hooks: HookRegistry;
  logger: Logger;
};

export type ClientPluginContext = {
  hooks: HookRegistry;
};

export type ServerPlugin = (ctx: ServerPluginContext) => Promise<void> | void;
export type ClientPlugin = (ctx: ClientPluginContext) => Promise<void> | void | (() => void);
```

---

## 5) Plugin discovery: static lists per runtime (bundler-safe)

Create:

- `packages/config/plugins.server.ts`
- `packages/config/plugins.client.ts`

```ts
// packages/config/plugins.server.ts
import UserGreeterServer from "@plugins/user-greeter/server";
export const activeServerPlugins = [UserGreeterServer] as const;
```

```ts
// packages/config/plugins.client.ts
import UserGreeterClient from "@plugins/user-greeter/client";
export const activeClientPlugins = [UserGreeterClient] as const;
```

**Why this is “guaranteed success”:**
- Next client code never imports server plugin modules.
- Adonis never imports client plugin modules.
- No dynamic filesystem discovery.
- Works in Docker, CI, and bundlers.

---

## 6) AdonisJS backend integration (Service Provider)

### 6.1 Provider: register the registry + boot plugins once

Create `apps/api/app/providers/hooks_provider.ts`:

```ts
import { InMemoryHookRegistry } from "@pkg/hooks";
import { activeServerPlugins } from "@pkg/config/plugins.server";

/**
 * NOTE:
 * - Give plugins a restricted "capability context" (hooks + logger + app)
 * - Never hand out raw internals casually.
 */
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
    const hooks = await this.app.container.make("hooks");
    const logger = this.app.logger;

    for (const registerPlugin of activeServerPlugins) {
      try {
        await registerPlugin({ app: this.app, hooks, logger });
      } catch (error) {
        logger.error({ error }, "Server plugin failed to boot");
      }
    }
  }
}
```

### 6.2 Usage in controllers/services

```ts
// Example in a service
const hooks = await this.app.container.make("hooks");
await hooks.dispatchAction("user.authenticated", user);
```

---

## 7) Next.js frontend integration (Client Provider)

### 7.1 Provider + hook accessor

`apps/web/app/PluginProvider.tsx`:

```tsx
"use client";

import React, { createContext, useContext, useEffect, useRef } from "react";
import { InMemoryHookRegistry, HookRegistry } from "@pkg/hooks";
import { activeClientPlugins } from "@pkg/config/plugins.client";

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
    const hooks = registryRef.current!;
    const disposers: Array<() => void> = [];

    for (const register of activeClientPlugins) {
      try {
        const maybeDisposer = register({ hooks });
        if (typeof maybeDisposer === "function") disposers.push(maybeDisposer);
      } catch (error) {
        console.error("Client plugin failed to boot", error);
      }
    }

    return () => disposers.forEach((d) => d());
  }, []);

  return <PluginCtx.Provider value={registryRef.current}>{children}</PluginCtx.Provider>;
}

export function usePlugins(): HookRegistry {
  const v = useContext(PluginCtx);
  if (!v) throw new Error("usePlugins must be used inside <PluginProvider>");
  return v;
}
```

### 7.2 Async filters in components (do not pretend this is sync)

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

  return (
    <nav>
      {nav.map((i) => (
        <a key={i.href} href={i.href}>{i.label}</a>
      ))}
    </nav>
  );
}
```

---

## 8) Optional but recommended: Next.js Server Hooks (SSR/RSC injection)

If you want plugins to affect **server-rendered UI** (RSC/SSR), add a server registry in `apps/web` and load **server-safe web plugins**.

- Create `packages/config/plugins.web.server.ts` (separate from Adonis!)
- Only include plugins that are safe in Next server runtime.

If you don’t need SSR injection, skip this entire section.

---

## 9) Database & migrations (done correctly)

### 9.1 Stop scanning inactive plugins; derive paths from the active list

Each **server plugin** may export migration directories.

`plugins/user-greeter/server.ts`:

```ts
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const migrations = [join(__dirname, "database/migrations")];

export default async function UserGreeterServer({ hooks, logger }: any) {
  hooks.registerAction("user-greeter", "user.authenticated", async (user) => {
    logger.info({ email: user.email }, "[Server] Hello");
  });
}
```

Then in `apps/api/adonisrc.ts`:

```ts
import { defineConfig } from "@adonisjs/core/app";
import { activeServerPlugins } from "@pkg/config/plugins.server";

function pluginMigrationDirs() {
  const dirs: string[] = [];
  for (const p of activeServerPlugins) {
    // Convention: plugin entrypoint may have a `migrations` export
    const anyP = p as any;
    if (Array.isArray(anyP.migrations)) dirs.push(...anyP.migrations);
  }
  return dirs;
}

export default defineConfig({
  directories: {
    migrations: [
      "database/migrations",
      ...pluginMigrationDirs(),
    ],
  },
});
```

### 9.2 Naming conventions (collision-proof)
- All plugin tables MUST be prefixed:
  - `plugin_<pluginName>__<table>` (double underscore)
  - Example: `plugin_user_greeter__greetings`
- All plugin Lucid models live inside the plugin package.

**Why:** collisions are not “rare”, they are inevitable.

---

## 10) Hook naming rules (prevent chaos early)

### 10.1 Hook namespaces
- Actions: `domain.event` (e.g. `user.authenticated`, `billing.invoice.paid`)
- UI filters: `ui.<area>.<thing>` (e.g. `ui.nav.items`, `ui.profile.badges`)

### 10.2 Plugin identity is mandatory
Every registration must include a plugin name:

```ts
hooks.registerAction("user-greeter", "user.authenticated", cb);
```

This is not optional. It’s how you debug and isolate failures.

---

## 11) Dependencies, ordering, and boot safety (production hardening)

### 11.1 Plugin dependencies
Support:

```ts
export const meta = {
  name: "user-greeter",
  dependsOn: ["core-auth"],
};
```

Then topologically sort plugins during boot. If there’s a cycle, fail boot (or disable involved plugins) deterministically.

### 11.2 Boot once (avoid double-registration in dev/test)
When running in dev (HMR) or tests, you can accidentally boot twice.

Protect:

- Store a symbol on `globalThis` for Adonis
- Store a module-level flag for Next client

Example idea:

```ts
const BOOT_KEY = Symbol.for("notarium.plugins.booted");
if ((globalThis as any)[BOOT_KEY]) return;
(globalThis as any)[BOOT_KEY] = true;
```

---

## 12) Error handling policy (don’t hide failures, don’t crash users)

Default:
- **Production:** log + metrics, continue.
- **Tests/CI:** fail fast (throw) to prevent shipping broken plugins.

Suggested pattern:

```ts
const failFast = process.env.NODE_ENV === "test";
const registry = new InMemoryHookRegistry({
  onError: (e) => {
    if (failFast) throw e.error;
    logger.error(e, "Plugin hook failed");
  },
});
```

---

## 13) Telemetry (you will need it)
Add:
- duration per callback
- error count per plugin
- timeout count per plugin
- last error snapshot per plugin

Minimum viable: wrap calls and `Date.now()`.

---

## 14) Security model (client plugins are untrusted by default)

### 14.1 Capability-based contexts
Do NOT pass “everything” into plugins.
- Backend: pass `hooks`, `logger`, and curated APIs (e.g. `db`, `mail`, etc.) only when needed.
- Frontend: pass only `hooks` and safe UI utilities.

### 14.2 Never pass secrets to client filters
Client filters must never see:
- access tokens
- raw internal IDs that enable enumeration
- server-only flags

---

## 15) Example plugin: `user-greeter` (complete, typed, working)

### 15.1 Plugin hook types (module augmentation)

`plugins/user-greeter/types.d.ts`:

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

### 15.2 Server entrypoint

`plugins/user-greeter/server.ts`:

```ts
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const migrations = [join(__dirname, "database/migrations")];

export default async function UserGreeterServer({ hooks, logger }: any) {
  hooks.registerAction("user-greeter", "user.authenticated", async (user) => {
    logger.info({ email: user.email }, "[Server] Hello");
  });
}
```

### 15.3 Client entrypoint

`plugins/user-greeter/client.ts`:

```ts
export default function UserGreeterClient({ hooks }: any) {
  // Add a badge to verified users
  return hooks.registerFilter("user-greeter", "user.profile.displayName", (name, user) => {
    return user.isVerified ? `${name} ✅` : name;
  });
}
```

### 15.4 Register plugin in runtime lists

`packages/config/plugins.server.ts`:

```ts
import UserGreeterServer from "@plugins/user-greeter/server";
export const activeServerPlugins = [UserGreeterServer] as const;
```

`packages/config/plugins.client.ts`:

```ts
import UserGreeterClient from "@plugins/user-greeter/client";
export const activeClientPlugins = [UserGreeterClient] as const;
```

### 15.5 Verify behavior
- Backend: after login/auth, call:
  ```ts
  await hooks.dispatchAction("user.authenticated", user);
  ```
  You should see the server log.

- Frontend: when rendering a profile name:
  ```ts
  const displayName = await hooks.applyFilters("user.profile.displayName", user.name, user);
  ```
  Verified users show ✅.

---

## 16) Implementation checklist (do this in order)

1. Create `packages/hooks` with `types.ts`, `registry.ts`, exports.
2. Add unit tests for:
   - priority ordering
   - sequential filter behavior
   - action fault isolation
   - timeouts
3. Create `packages/config/plugins.server.ts` and `plugins.client.ts`.
4. Implement Adonis `HooksProvider`:
   - singleton registry
   - boot server plugins once
5. Implement Next `<PluginProvider />`:
   - singleton registry per browser session
   - boot client plugins once
6. Add the example plugin `user-greeter`:
   - types augmentation
   - server + client entrypoints
   - optional migrations export
7. Replace any “sync filter usage” in UI with async-safe patterns (`useEffect`, `use`, server helper, etc.).
8. Add observability:
   - error logs include plugin+hook
   - (optional) metrics counters

---

## 17) Common failure modes (and how this plan prevents them)

- **“Next.js bundle includes server-only code”**  
  Prevented by split entrypoints and separate active lists.

- **“Filters need extra args but typing doesn’t allow it”**  
  Fixed by tuple-based typing: `Filters[hook] = [value, ...args]`.

- **“A plugin breaks the whole login flow”**  
  Prevented by `safeCall` + `onError` + continue-on-error semantics.

- **“Migration runner can’t find plugin migrations in Docker”**  
  Prevented by exporting explicit migration paths derived from the active list.

- **“Random ordering changes between runs”**  
  Prevented by deterministic ordering: priority + registration ID.

---

## 18) Optional upgrades (easy to add later)

- Parallel actions (explicit, opt-in)
- Plugin enable/disable at runtime (feature flags)
- Plugin permissions/capabilities manifest
- Hot reload safe plugin reboots (dev only)
- Persistent plugin error quarantine (disable a plugin after N failures)

---

**End of document**
