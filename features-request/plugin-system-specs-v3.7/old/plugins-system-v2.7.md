# Plugin System V2.7 — Actions & Filters
**Production-grade, bundler-safe, pnpm-strict-safe, production-build valid, dev-mode sane (nodemon-based)**

V2.9 replaces the **tsx watch** approach from V2.8 with a **cleaner nodemon-based dependency watcher**, while keeping all production constraints intact.

Goal: **Restart Adonis automatically when workspace packages rebuild** (i.e., when `@pkg/*/dist/**` changes), **without** using `metaFiles` (to avoid build pollution), and **without** forcing Adonis to watch `node_modules` itself.

---

## 0) Why nodemon is the cleanest choice here

Once internal packages (`@pkg/config`, `@pkg/hooks`, `@pkg/plugin-kit`) are real built libraries:

- Apps import **compiled JS** from `node_modules/@pkg/*/dist/**`.
- In dev, `tsc -b -w` updates those `dist/**` files.
- Adonis (`node ace serve`) does **not** reliably reload on workspace dependency output changes.

nodemon is built for exactly this: watch arbitrary files and restart a command.

This keeps:
- `node ace serve --hmr` (Adonis' integrated dev workflow)
- clean production builds (no `metaFiles` pollution)

---

## 1) Production constraints (unchanged from V2.5+)

- Internal packages must build to **`dist/*.js` + `dist/*.d.ts`**.
- `package.json#exports` for runtime imports must point to `dist/*.js`.
- pnpm strict dependency resolution: migration resolution happens inside `@pkg/config/node/migrations` (compiled).

---

## 2) Remove dependency globs from Adonis `metaFiles` (no build pollution)

`apps/api/adonisrc.ts`
```ts
import { defineConfig } from "@adonisjs/core/app";

export default defineConfig({
  metaFiles: [
    { pattern: "public/**", reloadServer: false },
    { pattern: "resources/views/**/*.edge", reloadServer: false }

    // IMPORTANT:
    // No node_modules/@pkg/** here. metaFiles are copied to build output.
  ],
});
```

---

## 3) Dev workflow: build packages + nodemon restarts Adonis when deps rebuild

### 3.1 Install dev deps (root recommended)
```bash
pnpm add -D nodemon concurrently
```

### 3.2 Ensure internal packages have watch build scripts
Each internal package:
`packages/config/package.json` (same pattern for hooks/plugin-kit)
```json
{
  "scripts": {
    "build": "tsc -b",
    "dev": "tsc -b -w"
  }
}
```

### 3.3 Root-level orchestration (recommended)

Root `package.json`:
```json
{
  "scripts": {
    "dev:pkgs": "pnpm -r --filter @pkg/* dev",

    "dev:api": "nodemon --watch packages/config/dist --watch packages/hooks/dist --watch packages/plugin-kit/dist --ext js,json --delay 2500ms --signal SIGTERM --exec \"pnpm -C apps/api node ace serve --hmr\"",

    "dev:web": "pnpm -C apps/web dev",

    "dev": "concurrently -k -n pkgs,api,web \"pnpm dev:pkgs\" \"pnpm dev:api\" \"pnpm dev:web\""
  }
}
```

### 3.4 If you also build server-side plugins (recommended)
If your server-side plugins are also compiled to `dist/` and executed by Adonis in production, include them too:

```bash
--watch plugins/*/dist
```

---

## 4) Reliability notes (Docker/WSL)

### 4.1 FS events may be flaky
If you notice missed reloads:
- add polling to Adonis:
```bash
node ace serve --hmr --poll
```

### 4.2 Avoid double-reload chaos
nodemon restarts Adonis when deps change.
Adonis HMR handles app code changes.

This separation avoids “flapping” restarts.

---

## 5) CI / production build order (unchanged, but mandatory)

CI should run:
1. `pnpm -r --filter @pkg/* build`
2. `pnpm -C apps/api build` + migration dry-run
3. `pnpm -C apps/web build`

If you don’t enforce build order, expect “works locally” failures.

---

## 6) Everything else remains as in V2.7

- Exports-safe plugin metadata (`./plugin.meta.json`) and strict pnpm resolution.
- Types aggregator (`@pkg/config/plugins.types`) imported by both apps.
- FOUC mitigation (RSC initial state + boot barrier for layout-critical UI).
- Authenticated RSC → API fetch wrapper (cookie forward + `no-store`).

---

End of document.