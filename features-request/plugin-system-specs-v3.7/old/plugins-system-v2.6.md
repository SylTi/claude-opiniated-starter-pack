# Plugin System V2.6 — Actions & Filters
**Production-grade, bundler-safe, pnpm-strict-safe, and *dev-mode sane***  

V2.6 is V2.5 plus **one critical developer-experience fix**:

- ✅ **Adonis dev server must reload when workspace packages rebuild** (aka “watch mode disconnect”).

Your diagnosis is right: once we made `@pkg/*` real built libraries (dist JS), Adonis is no longer reading their `src/` files in dev. Without extra watching, you’ll change `packages/config/src/plugins.server.ts`, `tsc -b -w` will regenerate `packages/config/dist/*`, and **Adonis won’t reload** unless it’s explicitly watching those output files.

---

## 0) What changed from V2.5

### ✅ Fix #5 — Watch workspace package outputs in Adonis dev
Adonis dev modes (`--watch` and `--hmr`) rely on file watching. In watch mode, files must be in the TS project or registered as `metaFiles`. citeturn5view0  
`metaFiles` can also trigger server reload when files change. citeturn1view0turn1view1

We add **minimal watch globs** for the built outputs of local workspace packages.

---

## 1) Recap: V2.5 non-negotiables (still true)

- **No TypeScript at runtime from `node_modules`** in production.
  - Internal packages (`@pkg/config`, `@pkg/hooks`, `@pkg/plugin-kit`) must ship **`dist/*.js` + `dist/*.d.ts`**
- **pnpm strict**: resolve plugin metadata in the package that owns the dependency (i.e., `@pkg/config`), not `apps/api`.

(Everything in V2.5 remains valid.)

---

## 2) The dev-mode failure, stated plainly

You’re running (conceptually):

- `pnpm -r --filter @pkg/* dev` → rebuilds `packages/**/dist/**` on changes
- `apps/api` dev server (`node ace serve ...`) imports `@pkg/config/node/migrations` → **resolves to `dist/...`** (by design)

**Problem:** Adonis dev reload is not guaranteed to watch workspace dependency outputs.  
So the app keeps running with stale config until you manually restart.

This is a Day-2 paper cut that turns into rage fast.

---

## 3) ✅ Recommended fix: Add explicit watch globs via `metaFiles`

### 3.1 Why `metaFiles` works
- Adonis uses `metaFiles` as additional watched globs and can reload the server when they change. citeturn1view0turn1view1
- In watch mode, files not in TS project must be registered as `metaFiles` to be watched. citeturn5view0

### 3.2 Use *node_modules symlink paths*, not `../../packages/...`
Path traversal outside the app root is fragile and sometimes blocked by tooling/sandboxes.  
In a pnpm workspace, the app gets a symlink at `apps/api/node_modules/@pkg/config → ../../packages/config`.

So: **watch `node_modules/@pkg/*/dist/**`**.

### 3.3 `apps/api/adonisrc.ts` update

`apps/api/adonisrc.ts`
```ts
import { defineConfig } from "@adonisjs/core/app";

export default defineConfig({
  /**
   * metaFiles are:
   * - copied to build output (unfortunate side-effect),
   * - AND watched in dev to optionally trigger reloadServer.
   *
   * Keep these globs TIGHT to avoid copying garbage during `node ace build`.
   */
  metaFiles: [
    // Existing ones (examples)
    { pattern: "public/**", reloadServer: false },
    { pattern: "resources/views/**/*.edge", reloadServer: false },

    // Workspace package outputs — force reload when they rebuild
    { pattern: "node_modules/@pkg/config/dist/**/*.js", reloadServer: true },
    { pattern: "node_modules/@pkg/hooks/dist/**/*.js", reloadServer: true },
    { pattern: "node_modules/@pkg/plugin-kit/dist/**/*.js", reloadServer: true },

    // If plugins are also built for server runtime (recommended), watch them too:
    // { pattern: "node_modules/@plugins/*/dist/**/*.js", reloadServer: true },
  ],
});
```

> **Yes, this will cause those JS files to be copied during `node ace build`.**  
> Keep the patterns minimal (only `dist/**/*.js` for your own packages), and it stays negligible.

---

## 4) Dev command recommendations (stop using `&`)

Your earlier `pnpm dev:pkgs & pnpm ...` is *Windows-hostile* and not process-safe.

Use `concurrently` (or Turborepo). Example with `concurrently`:

Root `package.json`
```json
{
  "devDependencies": {
    "concurrently": "^9.0.0"
  },
  "scripts": {
    "dev:pkgs": "pnpm -r --filter @pkg/* dev",
    "dev:api": "pnpm -C apps/api dev",
    "dev:web": "pnpm -C apps/web dev",
    "dev": "concurrently -k -n pkgs,api,web "pnpm dev:pkgs" "pnpm dev:api" "pnpm dev:web""
  }
}
```

### 4.1 Adonis dev flags (pick one)
Adonis `serve` supports `--hmr`, `--watch`, and `--poll`. citeturn6search0  
- `--hmr`: faster for controllers/middleware changes
- `--watch`: brute-force restart on any change
- `--poll`: needed in some Docker/WSL setups

`apps/api/package.json`
```json
{
  "scripts": {
    "dev": "node ace serve --hmr",
    "dev:watch": "node ace serve --watch",
    "dev:docker": "node ace serve --watch --poll"
  }
}
```

If you’re actively changing plugin config / package outputs and something still doesn’t reload reliably:
- switch to `dev:watch` temporarily (it’s dumb but deterministic).

---

## 5) Alternative fix (cleaner build output): external watcher instead of `metaFiles`

If you hate the idea of copying workspace dist files into the Adonis `build/` output (fair), don’t use `metaFiles` at all.

Instead: run Adonis HMR normally and run a tiny “dependency restarter” that only watches those dist folders and restarts Adonis when they change.

Example (nodemon watching only workspace deps):
```json
{
  "scripts": {
    "dev:api": "node ace serve --hmr",
    "dev:api:deps": "nodemon --watch apps/api/node_modules/@pkg/config/dist --watch apps/api/node_modules/@pkg/hooks/dist --watch apps/api/node_modules/@pkg/plugin-kit/dist --exec "node ace serve --hmr" --signal SIGTERM"
  }
}
```

Pros:
- Doesn’t pollute build output
- Very explicit

Cons:
- Two layers of reload logic (be disciplined or you’ll create flapping restarts)

---

## 6) (Brutal but necessary) Plugin packages must also be production-runnable on the server

If your **server-side plugin entrypoints** are TypeScript (`./src/server.ts`) and Adonis imports them in production, you’ll crash again — same reason as `@pkg/config`.

**Hard rule:** any module that Node executes in production must resolve to JS in `dist/`.

That means server-side plugin exports should look like:
```json
"exports": {
  "./plugin.meta.json": "./plugin.meta.json",
  "./types": "./src/types.d.ts",
  "./server": "./dist/server.js",
  "./client": "./src/client.ts"
}
```

- Next.js can still transpile plugin client TS via `transpilePackages`.
- Adonis must execute plugin server JS.

(If you don’t do this, you’re building a time bomb.)

---

## 7) Summary (V2.6)

- V2.5 fixed production runtime correctness (no TS from node_modules).
- V2.6 fixes dev correctness:
  - **Adonis reloads when workspace packages rebuild** via tight `metaFiles` globs (recommended)  
    or external “deps restarter” (cleaner build).
- Keep using pnpm workspaces + kill switch + exports-safe metadata + types aggregator.

---

End of document.
