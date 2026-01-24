# Tier A Plugin Examples (UI-only)

These examples assume:
- plugin system is bundler-safe (static loader maps)
- tenancy and RBAC are handled by core
- Tier A plugins only affect UI through filters/slots

---

## Example A1 — Add a main nav item
**Capabilities:** `ui.nav.write`

```ts
export default function NavDocsPlugin({ hooks }) {
  hooks.registerFilter("ui:nav:main", async (items, user, team) => {
    return [
      ...items,
      { id: "docs", label: "Docs", href: "/docs", requiresAuth: true }
    ];
  }, 20);
}
```

---

## Example A2 — Add a settings tab
**Capabilities:** `ui.settings.write`

```ts
export default function SettingsTabPlugin({ hooks }) {
  hooks.registerFilter("ui:settings:tabs:user", (tabs) => {
    return [...tabs, { id: "privacy", label: "Privacy", href: "/settings/privacy" }];
  });
}
```

---

## Example A3 — Inject a dashboard widget
**Capabilities:** `ui.slots.write`

```ts
export default function DashboardWidgetPlugin({ hooks }) {
  hooks.registerFilter("dashboard.main.top", (widgets, ctx) => {
    return [
      ...widgets,
      { id: "hello", title: "Hello", component: "HelloWidget", props: { userId: ctx.user?.id } }
    ];
  });
}
```

---

## Example A4 — Extend translations
**Capabilities:** `ui.i18n.write`

```ts
export default function I18nPlugin({ hooks }) {
  hooks.registerFilter("ui:i18n:translations", (map, lang) => {
    if (lang !== "fr") return map;
    return { ...map, "nav.docs": "Documentation" };
  });
}
```

---

Notes:
- Tier A plugins must not fetch secrets or call privileged APIs.
- UI injection should be stable and deterministic.

End of document.
