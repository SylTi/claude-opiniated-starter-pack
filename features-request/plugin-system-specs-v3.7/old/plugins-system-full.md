# Plugin System Full Implementation Plan
**Version:** V2.9 (Open Enterprise Architecture — Unabridged Master Plan)
**Status:** Implementation Ready
**Goal:** A robust, event-driven plugin system inspired by WordPress Actions & Filters, capable of supporting **Full Applications** (LMS, Social, Notes), **Deep Security Integrations** (CMK, YubiKey, Audit), and **Compliance Workflows** (Tenant Isolation, DLP), built for a **Next.js frontend** and **AdonisJS backend**.

---

## 0. Non-Negotiable Design Contracts

### 0.1 Runtime Separation (Safety)
- **Server plugins** must be importable and runnable **only** in Node.js (Adonis / Next server).
- **Client plugins** must be importable and runnable **only** in the browser (Next client).
- **Never** import a “mixed isomorphic plugin object” into code that may be bundled for the browser. Tree-shaking is not a safety boundary.

### 0.2 Deterministic Semantics
- **Filters** run **sequentially** in `(priority asc, registration order)` because each depends on the previous output.
- **Actions** run **sequentially** in `(priority asc, registration order)` (default). Priority implies ordering. You can add parallelism later, but do it explicitly.

### 0.3 Fault Isolation
A failing plugin callback:
- is caught and attributed to **plugin + hook + kind**.
- is reported via `onError` for observability.
- does **not** prevent other plugin callbacks from running.
- prevents a single plugin from crashing the host application.

### 0.4 Typed Hooks (Module Augmentation)
- Core does **not** maintain a giant union of hook names.
- Plugins declare hook types through **TypeScript module augmentation**. This ensures types are always correct without core knowing about every plugin.

### 0.5 Structural Capabilities (The "Anything" Rule)
- **Full Pages:** Plugins define frontend routes (e.g., `/p/notes/dashboard`) via a catch-all route.
- **API Endpoints:** Plugins define backend routes (e.g., `GET /api/v1/notes`) by accessing the Adonis router.
- **Widgets (Slots):** Plugins inject UI components into host app slots (e.g., Dashboard Sidebar).
- **Interceptors:** Plugins intercept HTTP requests/responses on both client and server (Middleware-like).
- **Deep Security:** Plugins access encryption, drive, event bus, and auth contexts natively.

---

## 1. Repository Layout (Monorepo Standard)

```
/
├── apps/
│   ├── api/                 # AdonisJS (Backend)
│   └── web/                 # Next.js (Frontend)
├── packages/
│   ├── hooks/               # Hook registry & shared types (Built to dist/)
│   ├── plugin-kit/          # Plugin manifest types (Built to dist/)
│   └── config/              # Active lists, loaders & resolution logic (Built to dist/)
└── plugins/
    └── user-greeter/        # Example Plugin Package
        ├── package.json
        ├── plugin.meta.json  # Side-effect free metadata
        ├── src/
        │   ├── client.ts    # UI entrypoint
        │   ├── server.ts    # Logic entrypoint
        │   └── types.d.ts   # Hook definitions (Module Augmentation)
        └── database/
            └── migrations/  # Plugin-specific tables (prefixed)
```

---

## 2. Core Packages Implementation

**Constraint:** All internal packages (`@pkg/*`) must be built to `dist/*.js` to ensure production stability in a compiled Adonis environment. Node cannot execute `.ts` files from `node_modules` in production.

### 2.1 Package Build Config (`packages/tsconfig.base.json`)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true
  }
}
```

### 2.2 `@pkg/hooks`: The Registry and Types

**`packages/hooks/src/types.ts`**
```ts
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

**`packages/hooks/src/registry.ts`**
```ts
import type { ActionName, ActionArgs, FilterName, FilterValue, FilterArgs } from "./types.js";

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

type Entry<T extends Function> = {
  id: number;
  plugin: string;
  priority: number;
  fn: T;
};

/**
 * In-memory registry (works in Node and Browser).
 * Deterministic ordering + fault isolation + optional timeouts.
 */
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

  async dispatchAction(hook: string, ...args: any[]): Promise<void> {
    const list = this.sorted(this.actions.get(hook));
    for (const e of list) {
      await this.safeCall("action", hook, e.plugin, () => e.fn(...args), undefined);
    }
  }

  async applyFilters(hook: string, initial: any, ...args: any[]): Promise<any> {
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

### 2.3 Plugin Contexts (Capabilities)
This defines the "capability-based context" handed to plugins. We expose the full stack to allow "Anything" plugins.

**`packages/hooks/src/plugin.ts`**
```ts
import type { InMemoryHookRegistry } from "./registry.js";

// Backend Context: Expose the stack, not just services
export type ServerPluginContext<
  App = any, 
  Router = any, 
  Bouncer = any, 
  Drive = any, 
  Scheduler = any, 
  Emitter = any,
  Config = any
> = {
  app: App;                 // Raw Container Access
  hooks: InMemoryHookRegistry;
  logger: any;
  router: Router;           // Define API Endpoints
  bouncer: Bouncer;         // Define Permissions
  drive: Drive;             // File Storage access
  scheduler: Scheduler;     // Background job access
  emitter: Emitter;         // Global event bus access
  config: Config;           // Plugin settings store access
};

// Frontend Context
export type ClientPluginContext = {
  hooks: InMemoryHookRegistry;
  // Dynamic Routing (Full App support)
  registerPage: (path: string, component: React.ComponentType<any>) => void;
  // UI Injection (Slots)
  registerWidget: (slot: string, component: React.ComponentType<any>) => void;
  // Network Interception (Security/Signing/BYOK)
  registerInterceptor: (fn: (req: Request) => Promise<Request>) => void;
};

export type ServerPlugin = (ctx: ServerPluginContext) => Promise<void> | void;
export type ClientPlugin = (ctx: ClientPluginContext) => Promise<void> | void | (() => void);
```

---

## 3. Installation vs Activation (Operational Safety)

### 3.1 Definitions
- **Installed:** Plugin code exists in the monorepo and build artifact.
- **Enabled:** Runtime configuration (DB/Redis) explicitly allows this plugin to run for the current tenant/environment.
- **Active:** The plugin has successfully executed its `boot` sequence in the current process.
- **Quarantined:** Automatically disabled by the host due to repeated failures (Circuit Breaker).

### 3.2 Controls
- **Emergency Global Switch:** Setting `PLUGINS_DISABLED=1` (server) or `NEXT_PUBLIC_PLUGINS_DISABLED=1` (client) stops all non-core plugins immediately.
- **Quarantine Policy:** If a plugin fails N times in M minutes, it is moved to `quarantined` state in Redis and skipped until manual reset.

---

## 4. Plugin Discovery & Loading (Config Package)

### 4.1 Manifests and Loader Maps
We use explicit maps to ensure Next.js can code-split plugins into separate chunks.

**`packages/config/src/plugins.server.ts`**
```ts
import type { PluginMeta } from "@pkg/plugin-kit/manifest";

export const serverPluginManifests: PluginMeta[] = [
  { id: "enterprise-audit", packageName: "@plugins/enterprise-audit", version: "1.0.0", runtime: "api", category: "core" },
];

export const serverPluginLoaders: Record<string, () => Promise<{ default: any }>> = {
  "enterprise-audit": () => import("@plugins/enterprise-audit/src/server")
};
```

**`packages/config/src/plugins.client.ts`**
```ts
import type { PluginMeta } from "@pkg/plugin-kit/manifest";

export const clientPluginManifests: PluginMeta[] = [
  { id: "enterprise-audit", packageName: "@plugins/enterprise-audit", version: "1.0.0", runtime: "client", category: "core" },
];

export const clientPluginLoaders: Record<string, () => Promise<{ default: any }>> = {
  "enterprise-audit": () => import("@plugins/enterprise-audit/src/client")
};
```

### 4.2 Migration Resolver (Exports-Safe)
**`packages/config/src/node/migrations.ts`**
Resolves plugin migrations using Node's `exports` safety (never imports `server.ts` to avoid side-effects).
```ts
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { serverPluginManifests } from "../plugins.server.js";

const require = createRequire(import.meta.url);

export function resolvePluginMigrationDirs(): string[] {
  const dirs: string[] = [];

  for (const meta of serverPluginManifests) {
    // Resolve metadata via Node exports safely
    const metaPath = require.resolve(`${meta.packageName}/plugin.meta.json`);
    const root = dirname(metaPath);
    const data = require(metaPath);

    const rel = data?.migrations;
    if (typeof rel === "string" && rel.length) dirs.push(join(root, rel));
  }

  return dirs;
}
```

### 4.3 Types Aggregator
**`packages/config/src/plugins.types.d.ts`**
This file is imported by both apps to ensure TypeScript loads all plugin module augmentations.
```ts
import "@plugins/enterprise-audit/types";
export {};
```

---

## 5. Backend Integration (AdonisJS)

### 5.1 Hooks Provider
The central orchestrator for the plugin lifecycle in Adonis.

```ts
import { InMemoryHookRegistry } from "@pkg/hooks";
import { serverPluginLoaders, serverPluginManifests } from "@pkg/config/plugins.server";
import router from '@adonisjs/core/services/router';
import { Bouncer } from '@adonisjs/bouncer';
import drive from '@adonisjs/drive/services/main';
import emitter from '@adonisjs/core/services/emitter';

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
    const scheduler = await this.app.container.make("scheduler");
    const config = await this.app.container.make("plugin_config");

    for (const meta of serverPluginManifests) {
      if (process.env.PLUGINS_DISABLED === '1' && meta.category !== 'core') continue;

      try {
        const mod = await serverPluginLoaders[meta.id]();
        
        // Inject the Open Enterprise Context
        await mod.default({
          app: this.app, 
          hooks, 
          logger,
          router,
          bouncer: Bouncer,
          drive,
          scheduler,
          emitter,
          config
        });
      } catch (error) {
        logger.error({ error, plugin: meta.id }, "Server plugin failed to boot");
      }
    }
  }
}
```

---

## 6. Frontend Integration (Next.js)

### 6.1 UI Registry
A client-side singleton to hold the Components and Interceptors registered by plugins.

```ts
import React from 'react';
type ComponentType = React.ComponentType<any>;
type Interceptor = (req: Request) => Promise<Request>;

class PluginUiRegistry {
  pages = new Map<string, ComponentType>();
  widgets = new Map<string, ComponentType[]>();
  interceptors: Interceptor[] = [];

  registerPage(pluginId: string, component: ComponentType) {
    this.pages.set(pluginId, component);
  }

  registerWidget(slot: string, component: ComponentType) {
    const list = this.widgets.get(slot) || [];
    list.push(component);
    this.widgets.set(slot, list);
  }

  registerInterceptor(fn: Interceptor) {
    this.interceptors.push(fn);
  }
}
export const uiRegistry = new PluginUiRegistry();
```

### 6.2 Catch-All Page Route (`apps/web/app/p/[pluginId]/[...slug]/page.tsx`)
This allows plugins to own entire sections of the URL space.
```tsx
"use client";
import { uiRegistry } from "@/lib/plugin-ui-registry";
import { useParams, notFound } from "next/navigation";
import { usePlugins } from "@/app/PluginProvider";

export default function PluginCatchAllPage() {
  const { pluginsReady } = usePlugins();
  const { pluginId, slug } = useParams();

  if (!pluginsReady) return <div>Loading Plugin...</div>;

  const Component = uiRegistry.pages.get(pluginId as string);
  if (!Component) return notFound();

  return <Component slug={slug} />;
}
```

### 6.3 Network Layer (Secure Fetch & RSC Bridge)
**`apps/web/lib/secure-fetch.ts`**
Plugins use `registerInterceptor` to add security headers or encrypt data here.
```ts
import { uiRegistry } from "./plugin-ui-registry";

export async function secureFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  let req = new Request(input, init);
  for (const interceptor of uiRegistry.interceptors) {
    req = await interceptor(req);
  }
  return fetch(req);
}
```

**`apps/web/lib/internal-api-fetch.ts`** (RSC Bridge)
Ensures Server Components forward cookies to Adonis.
```ts
import { headers } from "next/headers";
export async function internalApiFetch(path: string, init: RequestInit = {}) {
  const h = await headers();
  const cookie = h.get("cookie") || "";
  return fetch(`${process.env.API_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: { ...(init.headers || {}), Cookie: cookie },
  });
}
```

### 6.4 Plugin Provider (Hydration & FOUC Prevention)
Gates UI rendering until all layout-critical plugins are booted.
```tsx
"use client";
import React, { createContext, useContext, useEffect, useRef, useState, useMemo } from "react";
import { InMemoryHookRegistry } from "@pkg/hooks";
import { clientPluginLoaders, clientPluginManifests } from "@pkg/config/plugins.client";
import { uiRegistry } from "@/lib/plugin-ui-registry";

const PluginCtx = createContext<{ hooks: any; pluginsReady: boolean } | null>(null);

export function PluginProvider({ children, initialState }: any) {
  const registryRef = useRef(new InMemoryHookRegistry({ timeoutMs: 1000 }));
  const [pluginsReady, setPluginsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hooks = registryRef.current;
      const enabled = new Set(initialState.enabled);

      await Promise.allSettled(clientPluginManifests.map(async (meta) => {
        if (!enabled.has(meta.id) && meta.category !== 'core') return;
        try {
          const mod = await clientPluginLoaders[meta.id]();
          mod.default({
            hooks,
            registerPage: (comp) => uiRegistry.registerPage(meta.id, comp),
            registerWidget: (slot, comp) => uiRegistry.registerWidget(slot, comp),
            registerInterceptor: (fn) => uiRegistry.registerInterceptor(fn)
          });
        } catch (e) { console.error("Plugin failed", meta.id, e); }
      }));
      if (!cancelled) setPluginsReady(true);
    })();
    return () => { cancelled = true; };
  }, [initialState]);

  const value = useMemo(() => ({ hooks: registryRef.current, pluginsReady }), [pluginsReady]);
  return <PluginCtx.Provider value={value}>{children}</PluginCtx.Provider>;
}
```

---

## 7. Naming Conventions (Collision-Proof)

### 7.1 Database
- **Format:** `plugin_<pluginName>__<table>` (double underscore).
- **Example:** `plugin_user_greeter__greetings`.
- **Lucid Models:** Must reside inside the plugin package.

### 7.2 Hook Names
- **Actions:** `domain.event` (e.g., `user.registered`).
- **Filters:** `ui.area.thing` (e.g., `ui.nav.items`).

---

## 8. Hook Inventory (The Full Contract)

### 8.1 Server Actions (Events)
*   **Auth:** 
    *   `auth:registered` (Payload: `user`)
    *   `auth:logged_in` (Payload: `user, session`)
    *   `auth:mfa_verified` (Payload: `user`)
    *   `auth:password_reset` (Payload: `user`)
*   **Teams:**
    *   `team:created` (Payload: `team, owner`)
    *   `team:updated` (Payload: `team`)
    *   `team:member_added` (Payload: `team, user, role`)
    *   `team:member_removed` (Payload: `team, user`)
*   **Billing:**
    *   `billing:customer_created` (Payload: `user, customerId`)
    *   `billing:subscription_created` (Payload: `subscription`)
    *   `billing:subscription_updated` (Payload: `subscription, oldStatus`)
    *   `billing:invoice_paid` (Payload: `invoice`)
*   **Compliance & System:**
    *   `audit:record` (Payload: `{ actor, action, resource, meta }`)
    *   `http:request` (Payload: `ctx`) - Intercept/Modify incoming requests
    *   `http:response` (Payload: `ctx, body`) - Intercept/Modify outgoing data (DLP)
    *   `db:query` (Payload: `query, bindings`) - Performance/Audit monitoring
    *   `app:capabilities:register` (Payload: `registry`) - Register permissions
    *   `app:shutdown` (Payload: `app`)

### 8.2 Client Filters (Data Transformation)
*   **Navigation:**
    *   `ui:nav:main` (Payload: `items[], user, team`)
    *   `ui:nav:admin` (Payload: `items[]`)
    *   `ui:user:menu` (Payload: `items[], user`)
*   **Settings:**
    *   `ui:settings:tabs:user` (Payload: `tabs[]`)
    *   `ui:settings:tabs:team` (Payload: `tabs[]`)
*   **Theme & I18n:**
    *   `ui:theme:config` (Payload: `theme`) - Modify colors, fonts
    *   `ui:i18n:translations` (Payload: `lang, keys`)

### 8.3 Client Slots (Widget Injection Points)
*   **Dashboard:** `dashboard.main.top`, `dashboard.main.bottom`, `dashboard.sidebar`
*   **Admin:** `admin.dashboard.widgets`, `admin.user.detail.after`
*   **Profiles:** `user.profile.header.actions`, `team.profile.header`
*   **Auth:** `auth.login.form.after`, `auth.register.form.after`

---

## 9. Telemetry & Error Handling (Production Hardening)

### 9.1 Telemetry
Every callback execution is wrapped. In production, we log:
- **Duration:** How long each plugin hook takes.
- **Failure Count:** Frequency of errors per plugin.
- **Last Error:** Snapshot of the most recent failure for the admin dashboard.

### 9.2 Reliability Notes (Docker/WSL)
- **FS Events:** In dev, use `--poll` flag for `nodemon` if file changes in `packages/` are not detected inside containers.
- **Double-Reload:** Nodemon restarts Adonis on package changes; Adonis HMR handles app changes. This separation prevents flapping.

---

## 10. Dev Workflow & Build (V2.7)

### 10.1 Root Orchestration
At root `package.json`:
```json
{
  "scripts": {
    "dev:pkgs": "pnpm -r --filter @pkg/* dev",
    "dev:api": "nodemon --watch packages/config/dist --watch packages/hooks/dist --ext js,json --delay 2500ms --exec \"pnpm -C apps/api node ace serve --hmr\"",
    "dev:web": "pnpm -C apps/web dev",
    "dev": "concurrently -k \"pnpm dev:pkgs\" \"pnpm dev:api\" \"pnpm dev:web\"",
    "build": "pnpm -r --filter @pkg/* build && pnpm -C apps/api build && pnpm -C apps/web build"
  }
}
```

### 10.2 CI Build Order (Mandatory)
1. `pnpm -r --filter @pkg/* build`
2. `pnpm -C apps/api build` + migration dry-run
3. `pnpm -C apps/web build`

---

## 11. Common Failure Modes (Prevented)

- **“Next.js bundle includes server code”:** Prevented by split entrypoints and separate active lists.
- **“Ghost types (never hooks)”:** Prevented by `plugins.types.d.ts` aggregator loaded by both apps.
- **“Migration Resolver Crash”:** Prevented by exports-safe metadata resolution (never imports `server.ts`).
- **“Ordering Jitter”:** Prevented by deterministic `(priority, registration ID)` sorting.

---

## 12. Implementation Checklist

- [ ] 1. Scaffold `packages/hooks`, `plugin-kit`, `config` with strict TS config.
- [ ] 2. Implement `InMemoryHookRegistry` with async/safe calls.
- [ ] 3. Implement the V2.9 `Context` interfaces (Router, Drive, Emitter, Interceptors).
- [ ] 4. Implement `HooksProvider` in Adonis API with service injection.
- [ ] 5. Implement `UIRegistry` and `PluginProvider` in Next.js.
- [ ] 6. Create the `p/[pluginId]` catch-all route in Next.js.
- [ ] 7. Implement `secureFetch` and `internalApiFetch` wrappers.
- [ ] 8. Verify the flow with an "Enterprise Compliance" example plugin.


---
**End of Master Plan.**