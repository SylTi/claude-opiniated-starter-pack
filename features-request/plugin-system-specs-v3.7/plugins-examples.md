# Plugin Tier Examples — Quick Reference

## Tier overview

```
Marketplace (OSS + Enterprise)
  Tier A — UI plugins (themes, widgets, translations)
  Tier B — App plugins (self-contained modules)
  Tier C — Platform plugins (privileged, core service access)

Enterprise (core-owned, NOT plugins)
  SSO, KMS, audit sinks, DLP, RBAC extensions
  Ships with enterprise license
  Dynamic imports pattern
```

## Marketplace pricing tiers

| Tier | Access level | Typical price | Example |
|------|-------------|---------------|---------|
| A | UI only | Free / $5-20/mo | Custom theme, dashboard widget |
| B | Own namespace | $10-50/mo | Time tracking, Kanban board |
| C | Core facades | $30-150/mo | Collaboration suite, advanced analytics, full-text search |

## Enterprise marketplace

Tier B and C plugins that declare `"requiresEnterprise": true` in their manifest depend on enterprise core features (e.g., a plugin that extends the audit sink with custom compliance reports).

## Detailed specs

- Tier A examples: `examples-plugins/tierA/plugins.md`
- Tier B examples: `examples-plugins/tierB/plugins.md`
- Tier C spec: `tier-c-platform-plugins-spec.md`
- Marketplace distribution: `marketplace-distribution-spec.md`
- Enterprise control plane: `enterprise-feature-control-plane-spec.md`
