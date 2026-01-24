# Plugin System V2.5 — Actions & Filters
**Production-grade, bundler-safe, ops-friendly, pnpm-strict safe, production-build valid**

V2.5 is V2.4 plus **one mandatory correction**:

- ✅ **No TypeScript from `node_modules` at runtime.**  
  Internal packages (`@pkg/config`, `@pkg/hooks`, `@pkg/plugin-kit`) must be **built to JavaScript** before apps run in production (and usually before dev too).

Your finding is correct: exporting `./src/**/*.ts` from workspace packages and importing them from a compiled Adonis app will crash in production.

---

## 0) What changed from V2.4

### ✅ Fix #4 — Build internal packages (dist JS + d.ts)
- `packages/config`, `packages/hooks`, `packages/plugin-kit` become real libraries:
  - `src/` → `dist/` via `tsc -b`
  - `package.json#exports` points to `dist/*.js` (and `dist/*.d.ts`)
- Apps import **compiled JS**, not TS.

### ✅ Config remains split into universal vs node-only exports
But now those exports point to `dist/…` to be executable by Node.

---

## 1) Reality check (why V2.4 was invalid in production)

- Adonis production = compiled JS (e.g. `node build/server.js`)
- Node cannot execute `node_modules/**.ts`
- `node ace build` does **not** compile `node_modules` (and it shouldn’t)
- Therefore: any runtime import like `import { resolvePluginMigrationDirs } from "@pkg/config/node/migrations"` must resolve to **JS**.

---

## 2) Required build setup for internal packages

### 2.1 Root TypeScript base config
At repo root:

`tsconfig.base.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "lib": ["ES2020", "DOM"],
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true
  }
}
```

> Adjust `moduleResolution` to match your repo conventions. If Adonis wants NodeNext semantics, use `NodeNext` consistently across packages.

### 2.2 Each internal package is a TS “build” project

Example: `packages/config/tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": true,
    "tsBuildInfoFile": "dist/.tsbuildinfo"
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts"]
}
```

Do the same for:
- `packages/hooks`
- `packages/plugin-kit`

### 2.3 Build scripts in each package

`packages/config/package.json`
```json
{
  "name": "@pkg/config",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -b",
    "dev": "tsc -b -w",
    "clean": "rimraf dist"
  }
}
```

(Repeat in hooks/plugin-kit.)

---

## 3) Exports must point to `dist` (runtime-safe)

### 3.1 `@pkg/config` exports map (correct in production)

`packages/config/package.json`
```json
{
  "name": "@pkg/config",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./plugins.client": {
      "types": "./dist/plugins.client.d.ts",
      "import": "./dist/plugins.client.js"
    },
    "./plugins.server": {
      "types": "./dist/plugins.server.d.ts",
      "import": "./dist/plugins.server.js"
    },

    // TS-only import: OK to keep as .d.ts because it's never executed by Node.
    // Runtime importing it SHOULD error (by design).
    "./plugins.types": {
      "types": "./src/plugins.types.d.ts"
    },

    // Node-only runtime export MUST be JS
    "./node/migrations": {
      "types": "./dist/node/migrations.d.ts",
      "import": "./dist/node/migrations.js"
    }
  },
  "files": ["dist/**", "src/plugins.types.d.ts"]
}
```

**Key point:** Node runtime paths (like `./node/migrations`) are **JS** in `dist`.

### 3.2 `@pkg/hooks` and `@pkg/plugin-kit` should do the same
At minimum:
- `"exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } }`
- `"files": ["dist/**"]`

---

## 4) pnpm strict dependency rule (still applies)

- `resolvePluginMigrationDirs()` stays inside `@pkg/config/node/migrations`
- because `@pkg/config` is the dependency owner of the plugins, avoiding phantom dependencies.

But now it is compiled to `dist/node/migrations.js`.

---

## 5) Migration resolver (same logic as V2.4, but now compiled)

Source file (TS):

`packages/config/src/node/migrations.ts`
```ts
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { serverPluginManifests } from "../plugins.server";

const require = createRequire(import.meta.url);

export function resolvePluginMigrationDirs(): string[] {
  const dirs: string[] = [];

  for (const meta of serverPluginManifests) {
    // Requires plugin packages to export this subpath
    const metaPath = require.resolve(`${meta.packageName}/plugin.meta.json`);
    const root = dirname(metaPath);
    const data = require(metaPath);

    const rel = data?.migrations;
    if (typeof rel === "string" && rel.length) dirs.push(join(root, rel));
  }

  return dirs;
}
```

Adonis uses compiled JS:

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

---

## 6) Next.js considerations (config package build + transpilation)

### 6.1 Next `next.config.ts` must be able to import `@pkg/config`
If `@pkg/config` is compiled to JS in `dist`, you don’t need Next to transpile it.

However, **you must ensure it’s built before `next build` runs**.

### 6.2 If you still import TS-only paths (don’t)
- `next.config` should only import runtime JS exports from `@pkg/config` (compiled).
- Never import `@pkg/config/node/*` from web code.

---

## 7) Build orchestration (the part people forget)

### 7.1 Root scripts (recommended)

At repo root `package.json`:
```json
{
  "scripts": {
    "build:pkgs": "pnpm -r --filter @pkg/* build",
    "build": "pnpm build:pkgs && pnpm -r --filter ./apps/* build",
    "dev:pkgs": "pnpm -r --filter @pkg/* dev",
    "dev": "pnpm dev:pkgs & pnpm -r --filter ./apps/* dev"
  }
}
```

If you use Turborepo:
- define pipeline so `apps/*` build depends on `packages/*` build.

### 7.2 CI rule
CI must run:
1) `pnpm -r build` (packages first)
2) then `apps/api` build + `migration:run` dry run
3) then `apps/web` build

If you don’t enforce the order, you’ll get “works locally” garbage.

---

## 8) Plugin package constraints (still required)

Each plugin must export metadata + types subpaths:

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

---

## 9) Summary (V2.5)

- Keep V2.4 architecture (two registries, kill switch, FOUC mitigation, auth-forwarding, exports-safe metadata, types aggregator).
- **New hard rule:** internal packages are **built libraries**. Apps only consume `dist/*.js`.
- `@pkg/config/node/migrations` becomes a stable Node runtime API in `dist`.

---

End of document.
