# Tier B Plugin Examples (Apps + routes + jobs)

Tier B plugins can provide “full-blown apps” under `/apps/{pluginId}` and register server routes/jobs under a safe namespace.

---

## Example B1 — Provide an app mounted under `/apps/reviews/*`
**Capabilities:** `app.pages.expose`

Concept:
- core hosts `/apps/[pluginId]/[[...path]]`
- plugin exports an app module with a route tree + page loaders

```ts
export default function ReviewsApp() {
  return {
    routes: [
      { path: "", page: "Home" },
      { path: "items", page: "Items" },
      { path: "items/:id", page: "ItemDetail" }
    ],
    pages: {
      Home: () => import("./pages/Home"),
      Items: () => import("./pages/Items"),
      ItemDetail: () => import("./pages/ItemDetail")
    }
  };
}
```

---

## Example B2 — Register API routes under `/apps/reviews/*`
**Capabilities:** `app.api.routes.register`

Server entrypoint receives a **RoutesRegistrar** (not raw router):

```ts
export default async function ReviewsServer({ routes }) {
  routes.get("/items", async (ctx) => {
    // ctx.db is request-scoped RLS transaction client (tenant enforced)
    return ctx.db.from("plugin_reviews_items").select("*");
  });

  routes.post("/items", async (ctx) => {
    // Insert must include tenant_id (or DB default via RLS context)
    return ctx.db.insertInto("plugin_reviews_items").values({
      tenant_id: ctx.tenant.id,
      title: ctx.request.input("title")
    });
  });
}
```

---

## Example B3 — Register a background job
**Capabilities:** `app.jobs.register`

```ts
export default async function ReviewsJobs({ jobs }) {
  jobs.register("reviews:recomputeStats", async (payload) => {
    // payload includes tenantId (required) to set RLS context
    // job runner sets app.tenant_id before running queries
  });
}
```

---

Notes:
- Tier B plugins must always run under tenant context (RLS).
- Routes must never be registered outside `/apps/{pluginId}`.
- DB schema must be prefixed (e.g., `plugin_reviews_*`) to avoid collisions.

End of document.
