# Plugin System V2.4 — Actions & Filters
**Production-grade, bundler-safe, ops-friendly, Day-2 hardened (pnpm strict-safe)**

V2.4 is V2.3 plus **one critical monorepo fix**:

- ✅ **pnpm “phantom dependency” crash** during migration discovery, caused by resolving plugin packages from `apps/api` even though only `packages/config` owns those plugin dependencies.

This version moves migration resolution into the dependency-owning package **without leaking Node-only code into Next.js**.

---

## 0) What changed from V2.3

### ✅ Fix #3 — pnpm strict dependency resolution (no phantom deps)
**Problem:** `apps/api` cannot `require.resolve("@plugins/foo/...")` unless `apps/api` directly depends on `@plugins/foo`. Under pnpm strictness, transitive deps are not resolvable.  
**Solution:** perform `require.resolve()` from **`packages/config`**, which *does* depend on plugins. Then expose a Node-only export for Adonis to import.

**Important:** Do **not** export Node-only utilities from the same entrypoint that Next.js imports.

---

## 1) Plugin package requirements (unchanged from V2.3)

Each plugin package MUST export metadata + types subpaths under `exports`:

`plugins/user-greeter/package.json`
```json
{
  "name": "@plugins/user-greeter",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "exports": {
    "./plugin.meta.json": "./plugin.meta.json",
    "./types": "./src/types.d.ts",
    "./src/client": "./src/client.ts",
    "./src/server": "./src/server.ts"
  }
}
```

`plugins/user-greeter/plugin.meta.json`
```json
{ "id": "user-greeter", "migrations": "./database/migrations" }
```

---

## 2) Config package: split exports into universal vs node-only

### 2.1 Why
`packages/config` is imported by:
- Next.js (client/server build pipeline)
- Adonis (Node runtime)

If you export `node:module`, `node:path`, `createRequire` from the default config entrypoint, **Next will eventually touch it and explode**.

### 2.2 Structure
```
packages/config/
  src/
    plugins.client.ts
    plugins.server.ts
    plugins.types.d.ts
    node/
      migrations.ts          # Node-only
      index.ts               # Node-only exports
    index.ts                 # Universal exports only
  package.json               # exports map
```

### 2.3 Exports map (MANDATORY)

`packages/config/package.json`
```json
{
  "name": "@pkg/config",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./plugins.client": "./src/plugins.client.ts",
    "./plugins.server": "./src/plugins.server.ts",
    "./plugins.types": "./src/plugins.types.d.ts",
    "./node": "./src/node/index.ts",
    "./node/migrations": "./src/node/migrations.ts"
  }
}
```

`src/index.ts` (UNIVERSAL ONLY)
```ts
export * from "./plugins.client";
export * from "./plugins.server";
```

`src/node/index.ts` (NODE-ONLY)
```ts
export * from "./migrations";
```

---

## 3) ✅ The pnpm-safe migration resolver (moved into packages/config)

### 3.1 Implementation (Node-only)

`packages/config/src/node/migrations.ts`
```ts
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { serverPluginManifests } from "../plugins.server";

// IMPORTANT: this file lives in @pkg/config, which owns plugin dependencies.
// pnpm will allow resolving plugins here, not from apps/api.
const require = createRequire(import.meta.url);

export function resolvePluginMigrationDirs(): string[] {
  const dirs: string[] = [];

  for (const meta of serverPluginManifests) {
    // Resolve the exported metadata file (exports-safe)
    const metaPath = require.resolve(`${meta.packageName}/plugin.meta.json`);
    const root = dirname(metaPath);
    const data = require(metaPath);

    const rel = data?.migrations;
    if (typeof rel === "string" && rel.length) dirs.push(join(root, rel));
  }

  return dirs;
}
```

### 3.2 Use from Adonis (apps/api)

`apps/api/adonisrc.ts`
```ts
import { defineConfig } from "@adonisjs/core/app";
import { resolvePluginMigrationDirs } from "@pkg/config/node/migrations";

export default defineConfig({
  directories: {
    migrations: ["database/migrations", ...resolvePluginMigrationDirs()],
  },
});
```

**Result:** no `MODULE_NOT_FOUND` under pnpm strict mode, because resolution happens where deps exist.

---

## 4) Types (unchanged from V2.3, still mandatory)

### 4.1 Types aggregator (loads plugin augmentations deterministically)

`packages/config/src/plugins.types.d.ts`
```ts
// TS-only: ensures module augmentations are in the type graph.
// Add one import per installed plugin:
import "@plugins/user-greeter/types";

export {};
```

### 4.2 Make both apps include it

Next: `apps/web/next-env.d.ts` (or `global.d.ts`)
```ts
import "@pkg/config/plugins.types";
```

Adonis: `apps/api/contracts/plugins.d.ts` (or any included `.d.ts`)
```ts
import "@pkg/config/plugins.types";
```

---

## 5) Everything else remains V2.3

- Two registries only (Adonis + Browser).
- FOUC mitigation: RSC state + boot barrier for layout-critical UI.
- Authenticated RSC fetch: internal fetch wrapper forwards cookies + uses `no-store`.
- Plugin exports include metadata + types.
- Loader maps for chunked client plugins.

---

## 6) Regression tests you must add (to prevent future breakage)

### 6.1 pnpm phantom dependency test
- In CI, run `node ace migration:run --dry-run` (or equivalent) in a clean install.
- Ensure it can resolve plugin migrations without adding plugins to `apps/api/package.json`.

### 6.2 Next build guard
- Run `next build` to confirm Node-only exports don’t leak into web.
- If it fails with Node builtins, someone imported `@pkg/config/node/*` from web code (fix imports).

---

End of document.
