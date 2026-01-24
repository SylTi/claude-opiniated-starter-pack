# Plugin System Full Implementation Plan
**Version:** V2.9 (Open Enterprise Architecture — Consolidated)
**Status:** Implementation Ready

This document consolidates the entire architectural evolution (V2.0 through V2.9) into a single, self-sufficient implementation plan. It supports **Full Applications**, **Deep Security**, **Compliance**, and **Background Jobs**.

---

## 0. Non-Negotiable Design Contracts

### 0.1 Runtime Separation (Safety)
- **Server plugins** must be importable and runnable **only** in Node.js (Adonis / Next server).
- **Client plugins** must be importable and runnable **only** in the browser (Next client).
- **Never** import a “mixed isomorphic plugin object” into code that may be bundled for the browser. Tree-shaking is not a safety boundary.

### 0.2 Deterministic Semantics
- **Filters** run **sequentially** in `(priority asc, registration order)` because each depends on the previous output.
- **Actions** run **sequentially** in `(priority asc, registration order)` (default). Priority implies ordering.

### 0.3 Fault Isolation
A failing plugin callback must never take down the core flow.
- Every call is caught and attributed to **plugin + hook + kind**.
- Errors are reported via an `onError` hook for observability.

### 0.4 Typed Hooks (Module Augmentation)
- Core does **not** maintain a giant union of hook names.
- Plugins declare hook types through **TypeScript module augmentation**.

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
        ├── plugin.meta.json
        ├── src/
        │   ├── client.ts    # UI entrypoint
        │   ├── server.ts    # Logic entrypoint
        │   └── types.d.ts   # Hook definitions (Module Augmentation)
        └── database/
            └── migrations/  # Plugin-specific tables
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
    "resolveJsonModule": true
  }
}
```

### 2.2 `@pkg/hooks` (Registry & Types)

**`src/types.ts`**
```ts
export type Tail<T extends any[]> = T extends [any, ...infer R] ? R : never;

export interface Actions {}
export interface Filters {}

export type ActionName = keyof Actions & string;
export type FilterName = keyof Filters & string;

export type ActionArgs<H extends ActionName> = Actions[H] extends any[] ? Actions[H] : never;
export type FilterTuple<H extends FilterName> = Filters[H] extends any[] ? Filters[H] : never;

export type FilterValue<H extends FilterName> = FilterTuple<H>[0];
export type FilterArgs<H extends FilterName> = Tail<FilterTuple<H>>;
```

**`src/registry.ts`**
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
  onError?: (err: HookError) => void;
  timeoutMs?: number;
};

type Entry<T extends Function> = {
  id: number;
  plugin: string;
  priority: number;
  fn: T;
};

export class InMemoryHookRegistry {
  private seq = 0;
  private actions = new Map<string, Entry<(...args: any[]) => any>[]>();
  private filters = new Map<string, Entry<(value: any, ...args: any[]) => any>[]>();

  constructor(private opts: HookRegistryOptions = {}) {}

  registerAction(plugin: string, hook: string, cb: any, priority = 10): Unregister {
    const entry = { id: ++this.seq, plugin, priority, fn: cb };
    const list = this.actions.get(hook) ?? [];
    list.push(entry);
    this.actions.set(hook, list);
    return () => {
      const filtered = (this.actions.get(hook) ?? []).filter(e => e.id !== entry.id);
      if (filtered.length) this.actions.set(hook, filtered);
      else this.actions.delete(hook);
    };
  }

  registerFilter(plugin: string, hook: string, cb: any, priority = 10): Unregister {
    const entry = { id: ++this.seq, plugin, priority, fn: cb };
    const list = this.filters.get(hook) ?? [];
    list.push(entry);
    this.filters.set(hook, list);
    return () => {
      const filtered = (this.filters.get(hook) ?? []).filter(e => e.id !== entry.id);
      if (filtered.length) this.filters.set(hook, filtered);
      else this.filters.delete(hook);
    };
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
      value = await this.safeCall("filter", hook, e.plugin, () => e.fn(value, ...args), value);
    }
    return value;
  }

  private sorted(list?: Entry<any>[]) {
    return (list ?? []).slice().sort((a, b) => (a.priority - b.priority) || (a.id - b.id));
  }

  private async safeCall(kind: "action" | "filter", hook: string, plugin: string, fn: () => any, fallback: any) {
    try {
      if (!this.opts.timeoutMs) return await fn();
      return await Promise.race([
        Promise.resolve().then(fn),
        new Promise((_, rej) => setTimeout(() => rej(new Error(`Timeout ${this.opts.timeoutMs}ms`)), this.opts.timeoutMs))
      ]);
    } catch (error) {
      this.opts.onError?.({ plugin, hook, kind, error });
      return fallback;
    }
  }
}
```

### 2.3 Plugin Contexts (The "Open" Capability Set)
This defines what a plugin can "see" and "do". We expose the full stack to allow "anything" plugins.

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
  drive: Drive;             // File Storage (Backups, Media)
  scheduler: Scheduler;     // Background Jobs (Cron)
  emitter: Emitter;         // Global Event Bus (Audit/Compliance)
  config: Config;           // Plugin Settings Store
};

// Frontend Context
export type ClientPluginContext = {
  hooks: InMemoryHookRegistry;
  // Dynamic Routing
  registerPage: (path: string, component: React.ComponentType<any>) => void;
  // UI Injection
  registerWidget: (slot: string, component: React.ComponentType<any>) => void;
  // Network Interception (Security/Signing)
  registerInterceptor: (fn: (req: Request) => Promise<Request>) => void;
};

export type ServerPlugin = (ctx: ServerPluginContext) => Promise<void> | void;
export type ClientPlugin = (ctx: ClientPluginContext) => Promise<void> | void | (() => void);
```

### 2.4 `@pkg/plugin-kit` (Manifests)
**`src/manifest.ts`**
```ts
export type PluginRuntime = "api" | "client";
export type PluginCategory = "core" | "feature" | "ui" | "experimental";

export type PluginMeta = {
  id: string;                 // stable (e.g. "user-greeter")
  packageName: string;        // e.g. "@plugins/user-greeter"
  version: string;            // semver
  runtime: PluginRuntime;
  category: PluginCategory;
  dependsOn?: string[];
};
```

### 2.5 `@pkg/config` (Discovery & Loading)

**`src/plugins.server.ts`**
```ts
import type { PluginMeta } from "@pkg/plugin-kit/manifest";
// Imports to compiled JS in dist/
import EnterpriseAuditServer from "@plugins/enterprise-audit/src/server";

export const serverPluginManifests: PluginMeta[] = [
  { id: "enterprise-audit", packageName: "@plugins/enterprise-audit", version: "1.0.0", runtime: "api", category: "core" },
];

export const serverPluginLoaders: Record<string, () => Promise<{ default: any }>> = {
  "enterprise-audit": () => import("@plugins/enterprise-audit/src/server")
};
```

**`src/plugins.client.ts`**
```ts
import type { PluginMeta } from "@pkg/plugin-kit/manifest";
// Imports to compiled JS in dist/
import EnterpriseAuditClient from "@plugins/enterprise-audit/src/client";

export const clientPluginManifests: PluginMeta[] = [
  { id: "enterprise-audit", packageName: "@plugins/enterprise-audit", version: "1.0.0", runtime: "client", category: "core" },
];

export const clientPluginLoaders: Record<string, () => Promise<{ default: any }>> = {
  "enterprise-audit": () => import("@plugins/enterprise-audit/src/client")
};
```

**`src/node/migrations.ts`** (Node-only resolution)
Resolves plugin migrations using Node's `exports` safety (never imports `server.ts`).
```ts
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { serverPluginManifests } from "../plugins.server.js";

const require = createRequire(import.meta.url);

export function resolvePluginMigrationDirs(): string[] {
  const dirs: string[] = [];
  for (const meta of serverPluginManifests) {
    // Resolve metadata via Node exports without importing runtime code
    const metaPath = require.resolve(`${meta.packageName}/plugin.meta.json`);
    const data = require(metaPath);
    if (data?.migrations) dirs.push(join(dirname(metaPath), data.migrations));
  }
  return dirs;
}
```

**`src/plugins.types.d.ts`** (Type Aggregator)
```ts
// This file exists ONLY to load module augmentations into TS.
// It is not imported at runtime.
import "@plugins/enterprise-audit/types";

export {};
```

---

## 3. Backend Integration (AdonisJS)

### 3.1 Hooks Provider
`apps/api/app/providers/hooks_provider.ts`
```ts
import { InMemoryHookRegistry } from "@pkg/hooks";
import { serverPluginLoaders, serverPluginManifests } from "@pkg/config/plugins.server";
import router from '@adonisjs/core/services/router';
import { Bouncer } from '@adonisjs/bouncer';
import drive from '@adonisjs/drive/services/main';
import emitter from '@adonisjs/core/services/emitter';
// import scheduler from '#services/scheduler_service'; 
// import configStore from '#services/plugin_config_service'; 

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
        
        // Pass Open Enterprise Context
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

### 3.2 Migration Config
`apps/api/adonisrc.ts`
```ts
import { defineConfig } from "@adonisjs/core/app";
import { resolvePluginMigrationDirs } from "@pkg/config/node/migrations";

export default defineConfig({
  // IMPORTANT: No dependency globs in metaFiles. They are copied to build output.
  metaFiles: [
    { pattern: "public/**", reloadServer: false },
    { pattern: "resources/views/**/*.edge", reloadServer: false }
  ],
  directories: {
    migrations: [
      "database/migrations",
      ...resolvePluginMigrationDirs(),
    ],
  },
});
```

---

## 4. Frontend Integration (Next.js)

### 4.1 UI Registry
`apps/web/lib/plugin-ui-registry.ts`
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

  getPage(pluginId: string) { return this.pages.get(pluginId); }
  getWidgets(slot: string) { return this.widgets.get(slot) || []; }
}

export const uiRegistry = new PluginUiRegistry();
```

### 4.2 Dynamic Catch-All Route
`apps/web/app/p/[pluginId]/[...slug]/page.tsx`
```tsx
"use client";
import { uiRegistry } from "@/lib/plugin-ui-registry";
import { useParams, notFound } from "next/navigation";
import { usePlugins } from "@/app/PluginProvider";

export default function PluginCatchAllPage() {
  const { pluginsReady } = usePlugins();
  const { pluginId, slug } = useParams();

  if (!pluginsReady) return <div>Loading...</div>;

  const Component = uiRegistry.pages.get(pluginId as string);
  if (!Component) return notFound();

  return <Component slug={slug} />;
}
```

### 4.3 Secure Fetch (Interceptor Support)
`apps/web/lib/secure-fetch.ts`
This allows plugins to inject headers (e.g. YubiKey signatures, Client-side Encryption tokens) into every request.

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

### 4.4 Plugin Provider (Hydration & FOUC Prevention)
`apps/web/app/PluginProvider.tsx`
```tsx
"use client";
import React, { createContext, useContext, useEffect, useRef, useState, useMemo } from "react";
import { InMemoryHookRegistry } from "@pkg/hooks";
import { clientPluginLoaders, clientPluginManifests } from "@pkg/config/plugins.client";
import { uiRegistry } from "@/lib/plugin-ui-registry";

const PluginCtx = createContext<{ hooks: any; pluginsReady: boolean } | null>(null);

export function PluginProvider({ children, initialState }: any) {
  const registryRef = useRef(new InMemoryHookRegistry({
    timeoutMs: 1000,
    onError: (e) => console.error("Client plugin error", e)
  }));
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
            registerPage: (comp: any) => uiRegistry.registerPage(meta.id, comp),
            registerWidget: (slot: string, comp: any) => uiRegistry.registerWidget(slot, comp),
            registerInterceptor: (fn: any) => uiRegistry.registerInterceptor(fn)
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

export const usePlugins = () => useContext(PluginCtx)!;
```

---

## 5. Hook Inventory

This inventory defines the official contracts between Core and Plugins. 

### 5.1 Server Actions (Events)
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

### 5.2 Client Filters (Data Transformation)
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

### 5.3 Client Slots (Widget Injection Points)
*   **Dashboard:** `dashboard.main.top`, `dashboard.main.bottom`, `dashboard.sidebar`
*   **Admin:** `admin.dashboard.widgets`, `admin.user.detail.after`
*   **Profiles:** `user.profile.header.actions`, `team.profile.header`
*   **Auth:** `auth.login.form.after`, `auth.register.form.after`

---

## 6. Dev Workflow (V2.7)

Goal: **Restart Adonis automatically when workspace packages rebuild** (i.e., when `@pkg/*/dist/**` changes), **without** using `metaFiles` (to avoid build pollution).

**`package.json`**
```json
{
  "scripts": {
    "dev:pkgs": "pnpm -r --filter @pkg/* dev",
    "dev:api": "nodemon --watch packages/config/dist --watch packages/hooks/dist --ext js,json --delay 2500ms --exec \"pnpm -C apps/api node ace serve --hmr\"",
    "dev:web": "pnpm -C apps/web dev",
    "dev": "concurrently -k \"pnpm dev:pkgs\" \"pnpm dev:api\" \"pnpm dev:web\""
  }
}
```

---

## 7. Example: "Enterprise Compliance" Plugin

**`server.ts`**
```ts
export default async function CompliancePlugin({ emitter, hooks }: ServerPluginContext) {
  // 1. Universal Audit Logger
  emitter.onAny((event, data) => {
    if (event.startsWith('audit:')) console.log(`[Audit Log] ${event}`, data);
  });

  // 2. Data Loss Prevention (DLP)
  hooks.registerFilter('http:response', 'compliance', (body, ctx) => {
    return body.replace(/[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}/g, "****-****-****-****");
  });
}
```

**`client.ts`**
```ts
export default function ComplianceClient({ registerInterceptor }: ClientPluginContext) {
  // 3. Client-side Signing (YubiKey support)
  registerInterceptor(async (req) => {
    const signature = await hardwareSign(req);
    req.headers.set('X-YubiKey-Signature', signature);
    return req;
  });
}
```