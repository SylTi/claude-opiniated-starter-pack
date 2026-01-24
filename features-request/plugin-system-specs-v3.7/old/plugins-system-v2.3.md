# Plugin System V2.3 — Actions & Filters
**Production-grade, bundler-safe, ops-friendly, Day‑2 hardened (with crash + DX fixes)**

V2.3 is V2.2 plus **two critical fixes** discovered in review:

1) **Boot crash**: migration resolver tried to `require.resolve(<pkg>/package.json)` but Node `exports` hides it → `ERR_PACKAGE_PATH_NOT_EXPORTED`.  
2) **Broken DX**: plugin module augmentation lived in a `.d.ts` that TypeScript never loaded → hook names collapse to `never`.

This version makes **metadata resolvable under `exports`** and makes **types deterministic** without forcing runtime imports.

---

## 0) What changed from V2.2

### ✅ Fix #1 — Exports-safe metadata resolution
Plugins must explicitly export:
- `./plugin.meta.json` (or `./package.json`) so Node can resolve it safely under `exports`.

Migration discovery now resolves **metadata**, not runtime entrypoints.

### ✅ Fix #2 — Deterministic module augmentation
We add a dedicated **types aggregator** file that is loaded by TypeScript for both apps:
- `packages/config/plugins.types.d.ts`

Apps include it via an app-level `.d.ts` import so augmentation is always present during typecheck, without runtime bundling.

---

## 1) Non-negotiables (unchanged)

- Two registries: **Adonis (API)** + **Browser (Client)**.
- Filters/actions are deterministic and async-safe.
- Plugins are isolated: errors are caught; quarantine is possible.
- Hooks are typed via module augmentation.

---

## 2) Plugin Manifest (stable ID)

`packages/plugin-kit/src/manifest.ts`
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

**Rule:** `id` is the only identity used for flags/quarantine/logs.

---

## 3) Hook Types (module augmentation)

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

## 4) Registry (same as V2.2)

Use `InMemoryHookRegistry` with:
- deterministic ordering
- per-callback timeout
- `onError` hook

(No changes required here for V2.3.)

---

## 5) Installed vs Enabled vs Active vs Quarantined

**Installed** (code shipped) is not **Enabled** (allowed to run).  
Controls:
- state source: DB or Redis (Redis preferred)
- emergency global switch: `PLUGINS_DISABLED=1` (server) and `NEXT_PUBLIC_PLUGINS_DISABLED=1` (client)

---

## 6) Plugin Discovery (bundler-safe + code-splittable)

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

---

## 7) Day‑2 Patch: FOUC / Layout Shift (same as V2.2)

- Fetch plugin state in **RootLayout (RSC)** and pass `initialState` to `PluginProvider`.
- Add a **boot barrier** (`pluginsReady`) for layout-critical UI (nav/header), or compute those via API-shaped data.

(Kept as-is from V2.2; not repeated here.)

---

## 8) ✅ Critical Fix #1: Exports-safe metadata for migrations (no boot crash)

### 8.1 Why V2.2 crashed
With `"exports"` defined, Node hides non-exported subpaths.
So `require.resolve("@plugins/x/package.json")` fails unless exported.

### 8.2 Plugin packaging requirement (MANDATORY)

**Every plugin package must export its metadata file(s):**

`plugins/user-greeter/package.json`
```json
{
  "name": "@plugins/user-greeter",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "exports": {
    "./plugin.meta.json": "./plugin.meta.json",
    "./package.json": "./package.json",
    "./types": "./src/types.d.ts",
    "./src/client": "./src/client.ts",
    "./src/server": "./src/server.ts"
  }
}
```

> You can omit `"./package.json"` if you always resolve `./plugin.meta.json`, but exporting it is convenient.

### 8.3 Side-effect free metadata file (recommended)

`plugins/user-greeter/plugin.meta.json`
```json
{
  "id": "user-greeter",
  "migrations": "./database/migrations"
}
```

### 8.4 Migration resolver reads metadata (never imports server.ts)

`apps/api/config/plugin_migrations.ts`
```ts
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { serverPluginManifests } from "@pkg/config/plugins.server";

const require = createRequire(import.meta.url);

export function resolvePluginMigrationDirs(): string[] {
  const dirs: string[] = [];

  for (const meta of serverPluginManifests) {
    // Exports-safe resolution
    const metaPath = require.resolve(`${meta.packageName}/plugin.meta.json`);
    const root = dirname(metaPath);
    const data = require(metaPath);

    const rel = data?.migrations;
    if (typeof rel === "string" && rel.length) dirs.push(join(root, rel));
  }

  return dirs;
}
```

Wire into Adonis config:

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

**Result:** no more `ERR_PACKAGE_PATH_NOT_EXPORTED` and no side-effect imports.

---

## 9) ✅ Critical Fix #2: Deterministic module augmentation (no “never” hooks)

### 9.1 Why V2.2 broke DX
TypeScript does not automatically include “random plugin `.d.ts` files” from dependencies unless:
- they are reachable from the compilation graph, or
- they are included via `types`/`typeRoots`, or
- they are referenced/imported from an included `.d.ts`.

Relying on “the plugin entrypoint will reference types” does not help if the core app never imports plugin modules (and it shouldn’t).

### 9.2 The V2.3 solution: a types aggregator file

Create:

`packages/config/plugins.types.d.ts`
```ts
// This file exists ONLY to load module augmentations into TS.
// It is not imported at runtime.
//
// Add one line per installed plugin:
import "@plugins/user-greeter/types";

export {};
```

Each plugin must export `./types` (see Section 8.2).

### 9.3 Ensure both apps include the aggregator

#### Next.js (App Router)
Edit `apps/web/next-env.d.ts` (or `apps/web/global.d.ts`) and add:
```ts
import "@pkg/config/plugins.types";
```

#### AdonisJS
Create `apps/api/contracts/plugins.d.ts` (or any `.d.ts` included by tsconfig):
```ts
import "@pkg/config/plugins.types";
```

Make sure Adonis tsconfig includes `contracts/**/*.d.ts` (typical Adonis setup already does).

**Result:** when core code writes:
```ts
await hooks.dispatchAction("user.authenticated", user);
```
TypeScript sees the augmentation and the hook name is no longer `never`.

---

## 10) RSC authenticated fetch (kept from V2.2, mandatory)

Use `internalApiFetch()` that forwards cookies and forces `cache: "no-store"` when user-specific.

(No changes required here for V2.3 except: keep it in place.)

---

## 11) Next transpilation (manifest-driven)

`apps/web/next.config.ts`
```ts
import { clientPluginManifests } from "@pkg/config/plugins.client";

export default {
  transpilePackages: clientPluginManifests.map((p) => p.packageName),
};
```

---

## 12) Example plugin (updated to match V2.3 rules)

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

`plugins/user-greeter/plugin.meta.json`
```json
{ "id": "user-greeter", "migrations": "./database/migrations" }
```

`plugins/user-greeter/package.json` exports include `./plugin.meta.json` and `./types` (Section 8.2).

---

## 13) Tests to prevent regressions (add these now)

### Boot crash prevention
- Unit test `resolvePluginMigrationDirs()` with a plugin package using `exports`.
- Assert no import of runtime entrypoints occurs.

### Ghost types prevention
- Type test (tsd or `tsc --noEmit`) in each app that:
  - `hooks.dispatchAction("user.authenticated", user)` compiles
  - `hooks.applyFilters("ui.nav.items", ...)` compiles
- CI fails if `plugins.types.d.ts` is missing or a plugin forgot to export `./types`.

---

## 14) Checklist (V2.3)

- [ ] Plugins export `./plugin.meta.json` and `./types` (and optionally `./package.json`)
- [ ] Migration resolver resolves `plugin.meta.json` via exports-safe subpath
- [ ] `packages/config/plugins.types.d.ts` maintained with all installed plugins
- [ ] `apps/web/next-env.d.ts` imports `@pkg/config/plugins.types`
- [ ] `apps/api/contracts/plugins.d.ts` imports `@pkg/config/plugins.types`
- [ ] FOUC boot barrier remains for layout-critical UI
- [ ] `internalApiFetch` forwards cookies and uses `no-store`

---

End of document.
