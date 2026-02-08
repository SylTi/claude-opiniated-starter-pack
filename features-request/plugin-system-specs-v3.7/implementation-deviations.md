# Implementation Deviations from Spec

This document tracks conscious deviations from the plugin system specification that align with our existing architecture.

---

## 1) Tenant ID Type: Integer vs UUID

**Spec says:** `tenant_id uuid NOT NULL`

**Implementation uses:** `tenant_id integer NOT NULL`

### Rationale

Our entire database schema uses **integer IDs** (auto-incrementing primary keys) rather than UUIDs:

1. **Consistency** - All tables (`users`, `tenants`, `subscriptions`, etc.) use integer IDs
2. **Performance** - Integer comparisons and joins are faster than UUID
3. **Simplicity** - Shorter IDs in URLs and logs
4. **Existing schema** - Changing to UUIDs would require a major migration

### RLS Context Adaptation

The spec example uses:
```sql
tenant_id = current_setting('app.tenant_id')::uuid
```

Our implementation uses:
```sql
tenant_id = current_setting('app.tenant_id')::integer
```

### Affected files

- `apps/api/database/migrations/*` - All migrations use integer tenant_id
- `plugins/*/database/migrations/*` - Plugin tables reference integer tenant_id
- RLS helper functions cast to integer instead of uuid

---

## Summary

| Spec Requirement | Implementation | Reason |
|-----------------|----------------|--------|
| `tenant_id uuid` | `tenant_id integer` | Existing schema uses integers |

These deviations are **intentional** and align with our application's architectural decisions. The security and isolation guarantees remain intact.
