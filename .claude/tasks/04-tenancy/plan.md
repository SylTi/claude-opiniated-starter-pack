# Multi-Tenancy with RLS Implementation Plan

## Summary

Implement multi-tenancy with Row Level Security (RLS) for the AdonisJS SaaS application:
- Rename `teams` → `tenants`, `team_members` → `tenant_memberships`
- Add RLS policies to enforce tenant isolation at database level
- Header/Cookie based tenant selection (`X-Tenant-ID`) with **backend membership verification**
- **Tenant is the billing unit** - All subscriptions, Stripe customers, and billing scoped to tenant

---

## Core Principles

1. **Tenant is the billing unit** - No user-level subscriptions
2. **Every user has a personal tenant** - Created automatically on registration
3. **Users can belong to multiple tenants** - Personal + team tenants
4. **Backend ALWAYS verifies membership** - Cookie/header is a hint, not trusted

---

## Confirmed Decisions

| Decision | Choice |
|----------|--------|
| Tenant table | Rename `teams` → `tenants` |
| Tenant selection | Header/Cookie (`X-Tenant-ID`) + **backend verification** |
| Billing unit | **Tenant** (not user) |
| Personal tenant | Auto-created on user registration |
| Scoped tables | tenants, tenant_memberships, tenant_invitations, login_history, subscriptions, payment_customers, discount_code_usages |
| Global tables | users, oauth_accounts, tokens, subscription_tiers, products, prices, processed_webhook_events, discount_codes, coupons |

---

## Phase 1: Database Migrations

### 1.1 Create RLS Infrastructure
**File:** `database/migrations/XXXX_create_rls_infrastructure.ts`

```sql
-- Helper functions (using integer IDs, not UUIDs)
CREATE OR REPLACE FUNCTION app_current_tenant_id()
RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.tenant_id', true), '')::integer
$$;

CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::integer
$$;

CREATE OR REPLACE FUNCTION app_is_tenant_member(t integer, u integer)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_memberships m
    WHERE m.tenant_id = t AND m.user_id = u
  )
$$;
```

### 1.2 Rename Tables
**File:** `database/migrations/XXXX_rename_teams_to_tenants.ts`

- Rename `teams` → `tenants`
- Rename `team_members` → `tenant_memberships`
- Rename `team_invitations` → `tenant_invitations`
- Rename columns: `team_id` → `tenant_id`
- Rename user column: `current_team_id` → `current_tenant_id`
- Add `type` column to tenants: `'personal' | 'team'`

### 1.3 Add tenant_id to Scoped Tables
**File:** `database/migrations/XXXX_add_tenant_id_columns.ts`

Add `tenant_id integer REFERENCES tenants(id)` to:
- `login_history`
- `discount_code_usages`

### 1.4 Refactor Subscriptions (Tenant = Billing Unit)
**File:** `database/migrations/XXXX_refactor_subscriptions.ts`

**Important:** Tenant is the ONLY billing unit. No user-level subscriptions.

- Add `tenant_id NOT NULL` column to `subscriptions`
- Add `tenant_id NOT NULL` column to `payment_customers`
- Data migration:
  1. For each user with personal subscription → Create personal tenant → Migrate subscription
  2. Team subscriptions already have tenant context
- Drop polymorphic columns: `subscriber_type`, `subscriber_id`
- Remove all user subscription code paths from models/controllers

### 1.5 Enable RLS Policies
**File:** `database/migrations/XXXX_enable_rls.ts`

For each tenant-scoped table:
```sql
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {table} FORCE ROW LEVEL SECURITY;

CREATE POLICY {table}_tenant_isolation ON {table}
  USING (tenant_id = app_current_tenant_id());
```

---

## Phase 2: AdonisJS Middleware

### 2.1 Tenant Context Middleware
**File:** `app/middleware/tenant_context_middleware.ts`

**Security: ALWAYS verify membership on backend. Cookie/header is only a hint.**

```typescript
export default class TenantContextMiddleware {
  async handle(ctx: HttpContext, next: NextFn): Promise<void> {
    const user = ctx.auth.user
    if (!user) return ctx.response.unauthorized()

    // Get tenant hint from header/cookie (NOT trusted)
    const tenantIdHint = this.resolveTenantIdHint(ctx)
    if (!tenantIdHint) {
      return ctx.response.badRequest({
        error: 'TenantRequired',
        message: 'X-Tenant-ID header is required'
      })
    }

    // ALWAYS verify membership on backend - never trust the hint alone
    const membership = await TenantMembership.query()
      .where('tenantId', tenantIdHint)
      .where('userId', user.id)
      .first()

    if (!membership) {
      return ctx.response.forbidden({
        error: 'Forbidden',
        message: 'Not a member of this tenant'
      })
    }

    // Membership verified - now safe to set RLS context
    const verifiedTenantId = membership.tenantId

    await db.transaction(async (trx) => {
      await trx.rawQuery("SELECT set_config('app.user_id', ?, true)", [String(user.id)])
      await trx.rawQuery("SELECT set_config('app.tenant_id', ?, true)", [String(verifiedTenantId)])

      ctx.tenant = { id: verifiedTenantId, membership }
      ctx.db = trx
      await next()
    })
  }

  // This is just a HINT - actual tenant is verified via membership check
  private resolveTenantIdHint(ctx: HttpContext): number | null {
    const header = ctx.request.header('X-Tenant-ID')
    if (header) return parseInt(header, 10) || null
    const cookie = ctx.request.cookie('tenant_id')
    if (cookie) return parseInt(cookie, 10) || null
    return null
  }
}
```

### 2.2 Register Middleware
**File:** `start/kernel.ts`

Add to named middleware:
```typescript
tenant: () => import('#middleware/tenant_context_middleware')
```

---

## Phase 3: Model Updates

### Models to Rename
| Old | New | File |
|-----|-----|------|
| Team | Tenant | `app/models/tenant.ts` |
| TeamMember | TenantMembership | `app/models/tenant_membership.ts` |
| TeamInvitation | TenantInvitation | `app/models/tenant_invitation.ts` |

### Models to Update
| Model | Changes |
|-------|---------|
| User | `currentTeamId` → `currentTenantId`, update relationships, **remove subscription methods** (`getActiveSubscription`, `hasAccessToTier` - these belong to Tenant now) |
| Subscription | Remove polymorphic, add `tenantId NOT NULL`, **remove all user-based queries** |
| PaymentCustomer | Add `tenantId NOT NULL`, **remove user FK** |
| LoginHistory | Add `tenantId` |
| DiscountCodeUsage | Add `tenantId NOT NULL` |

### userId → tenantId Audit (Billing Context Changes)

**Important:** Tenant is the billing unit. All billing-scoped `userId` references must become `tenantId`.

#### Coupon Model (`app/models/coupon.ts`)
| Current | Change To | Reason |
|---------|-----------|--------|
| `redeemedByUserId` | Keep for audit | WHO redeemed (audit trail) |
| - | Add `redeemedForTenantId` | Which tenant got the credit (billing) |
| `redeemForUser(userId)` | Remove | No user-level billing |
| `redeemForTeam(teamId, userId)` | `redeemForTenant(tenantId)` | Tenant is billing unit |

#### Discount Code Model (`app/models/discount_code.ts`)
| Current | Change To | Reason |
|---------|-----------|--------|
| `maxUsesPerUser` | `maxUsesPerTenant` | Limits are per tenant, not per user |
| `canBeUsedBy(userId)` | `canBeUsedByTenant(tenantId)` | Billing context |

#### Discount Code Usage Model (`app/models/discount_code_usage.ts`)
| Current | Change To | Reason |
|---------|-----------|--------|
| `userId` | `tenantId` + Keep `userId` | Need both: tenant (billing) + user (audit) |
| `recordUsage(..., userId, ...)` | `recordUsage(..., tenantId, userId, ...)` | Dual context |
| `countByUserAndCode(userId, ...)` | `countByTenantAndCode(tenantId, ...)` | Billing scoped |

#### Services to Update
| Service | Method | Change |
|---------|--------|--------|
| `coupon_service.ts` | `redeemCoupon(code, userId)` | `redeemCoupon(code, tenantId)` |
| `coupon_service.ts` | `getUserBalance(userId)` | Remove (use `getTenantBalance`) |
| `discount_code_service.ts` | `validateCode(code, priceId, userId)` | `validateCode(code, priceId, tenantId)` |
| `discount_code_service.ts` | `recordUsage(..., userId, ...)` | `recordUsage(..., tenantId, userId, ...)` |

#### Controllers to Update
| Controller | Change |
|------------|--------|
| `coupons_controller.ts` | Pass `ctx.tenant.id` instead of `user.id` for billing |
| `discount_codes_controller.ts` | Pass `ctx.tenant.id` instead of `user.id` for validation |
| `payment_controller.ts` | Pass `ctx.tenant.id` for discount validation and recording |

### References to KEEP as userId
These track WHO performed an action (audit/auth), NOT billing context:
- `auth.user!` in controllers (authentication)
- Permission checks like `team.ownerId !== user.id`
- `login_history.userId` (who logged in, but add `tenantId` for context)
- `redeemedByUserId` in coupons (who redeemed - keep for audit)

### User Registration Flow
**File:** `app/controllers/auth_controller.ts`

On user registration, **automatically create a personal tenant**:
```typescript
async register(ctx: HttpContext) {
  // 1. Create user
  const user = await User.create({ ... })

  // 2. Create personal tenant
  const personalTenant = await Tenant.create({
    name: `${user.fullName || user.email}'s Workspace`,
    slug: `personal-${user.id}`,
    type: 'personal',
    ownerId: user.id,
  })

  // 3. Create owner membership
  await TenantMembership.create({
    tenantId: personalTenant.id,
    userId: user.id,
    role: 'owner',
  })

  // 4. Set as current tenant
  user.currentTenantId = personalTenant.id
  await user.save()
}
```

---

## Phase 4: Controller Updates

### Controllers to Rename
- `teams_controller.ts` → `tenants_controller.ts`

### Controllers to Update
All controllers must:
1. Use `ctx.db` (transaction) for queries
2. Access tenant via `ctx.tenant.id`
3. Include `tenant_id` in creates

**Files:**
- `tenants_controller.ts` (renamed)
- `payment_controller.ts`
- `auth_controller.ts` (login history)
- `discount_codes_controller.ts`
- `coupons_controller.ts`

---

## Phase 5: Route Updates
**File:** `start/routes.ts`

- Rename `/teams/*` → `/tenants/*`
- Add `middleware.tenant()` to all tenant-scoped routes

```typescript
router.group(() => {
  // Tenant routes
  router.resource('tenants', TenantsController)
  router.post('/tenants/:id/switch', [TenantsController, 'switch'])
  // ... billing, dashboard, etc
}).use([middleware.auth(), middleware.tenant()])
```

---

## Phase 6: Frontend Updates

### 6.1 Tenant Switcher Component
**File:** `apps/web/components/tenant-switcher.tsx`

### 6.2 API Client Update
**File:** `apps/web/lib/api.ts`

Add `X-Tenant-ID` header from cookie to all requests.

### 6.3 Shared Types
**File:** `packages/shared/src/types/tenant.ts`

Rename all team types to tenant types.

### 6.4 Pages to Update
- `app/team/` → `app/tenant/`
- `app/admin/teams/` → `app/admin/tenants/`

---

## Phase 7: Data Migration

### 7.1 Create Personal Tenants for ALL Existing Users
**Every user MUST have a personal tenant.** This is not optional.

```typescript
async function createPersonalTenants() {
  const usersWithoutPersonalTenant = await User.query()
    .whereDoesntHave('tenantMemberships', (q) => {
      q.whereHas('tenant', (tq) => tq.where('type', 'personal'))
    })

  for (const user of usersWithoutPersonalTenant) {
    const personalTenant = await Tenant.create({
      name: `${user.fullName || user.email}'s Workspace`,
      slug: `personal-${user.id}`,
      type: 'personal',
      ownerId: user.id,
    })

    await TenantMembership.create({
      tenantId: personalTenant.id,
      userId: user.id,
      role: 'owner',
    })

    // If user has no current tenant, set personal as default
    if (!user.currentTenantId) {
      user.currentTenantId = personalTenant.id
      await user.save()
    }
  }
}
```

### 7.2 Migrate User Subscriptions to Personal Tenants
```typescript
async function migrateUserSubscriptions() {
  const userSubscriptions = await Subscription.query()
    .where('subscriberType', 'user')

  for (const sub of userSubscriptions) {
    // Find user's personal tenant
    const membership = await TenantMembership.query()
      .whereHas('tenant', (q) => q.where('type', 'personal'))
      .where('userId', sub.subscriberId)
      .preload('tenant')
      .firstOrFail()

    sub.tenantId = membership.tenant.id
    await sub.save()
  }
}
```

### 7.3 Backfill tenant_id for Other Tables
- Associate existing `login_history` entries (may leave null for historical)
- Associate `discount_code_usages` with billing tenant context
- Associate `payment_customers` with tenant (migrate from user to their personal tenant)

---

## Phase 8: Testing

### New Test Files
- `tests/functional/tenants.spec.ts` - Tenant CRUD, rename from teams
- `tests/functional/tenant_context.spec.ts` - RLS enforcement tests

### Existing Test Files to Update
| Test File | Changes |
|-----------|---------|
| `tests/functional/teams.spec.ts` | Rename to `tenants.spec.ts`, update all references |
| `tests/functional/coupons.spec.ts` | Update to use `tenantId` for redemption |
| `tests/functional/discount_codes.spec.ts` | Update validation to use `tenantId` |
| `tests/functional/payment.spec.ts` | Update checkout to use tenant context |
| `tests/functional/subscriptions.spec.ts` | Remove user subscription tests |
| `tests/bootstrap.ts` | Update table names in `truncateAllTables()` |

### Test Scenarios

**Tenant Context:**
1. User can access their tenant data
2. User cannot access other tenant data (403)
3. RLS prevents data leakage in queries
4. Backend verifies membership (cookie/header not trusted alone)

**Billing (Tenant-scoped):**
5. Subscriptions scoped to tenant (no user subscriptions)
6. Coupon redemption adds credit to tenant balance
7. Discount code usage tracked per tenant
8. `maxUsesPerTenant` limit enforced per tenant

**Personal Tenant:**
9. Personal tenant auto-created on user registration
10. User with only personal tenant can checkout
11. User can belong to multiple tenants

### Test Seed Data
```typescript
// Tenant A (personal) with User A (owner)
// Tenant B (team) with User B (owner)
// Tenant C (team) with User A (member) + User B (admin)
// Shared User (member of Tenant A personal + Tenant B)
```

### Tests for userId → tenantId Changes
| Test | Verify |
|------|--------|
| Coupon redemption | Credit goes to `tenant.balance`, not `user.balance` |
| Discount code validation | `canBeUsedByTenant(tenantId)` checks tenant usage |
| Discount usage recording | Both `tenantId` and `userId` recorded |
| Payment checkout | Subscription created for tenant, not user |

---

## Implementation Order

```
Phase 1.1-1.3 (Schema)
    ↓
Phase 3 (Models)
    ↓
Phase 2 (Middleware)
    ↓
Phase 4 (Controllers)
    ↓
Phase 5 (Routes)
    ↓
Phase 1.4-1.5 (Subscriptions + RLS)
    ↓
Phase 7 (Data Migration)
    ↓
Phase 6 (Frontend)
    ↓
Phase 8 (Tests throughout)
```

---

## Critical Files

**Backend - Models (Rename):**
- `apps/api/app/models/team.ts` → `tenant.ts`
- `apps/api/app/models/team_member.ts` → `tenant_membership.ts`
- `apps/api/app/models/team_invitation.ts` → `tenant_invitation.ts`

**Backend - Models (Update for Tenant Billing):**
- `apps/api/app/models/user.ts` - Remove subscription methods, update tenant refs
- `apps/api/app/models/subscription.ts` - Remove polymorphic, add tenantId
- `apps/api/app/models/coupon.ts` - Add `redeemedForTenantId`, update methods
- `apps/api/app/models/discount_code.ts` - Change `maxUsesPerUser` → `maxUsesPerTenant`
- `apps/api/app/models/discount_code_usage.ts` - Add `tenantId`, keep `userId`
- `apps/api/app/models/payment_customer.ts` - Add `tenantId`

**Backend - Services:**
- `apps/api/app/services/coupon_service.ts` - Update to tenant billing
- `apps/api/app/services/discount_code_service.ts` - Update to tenant billing

**Backend - Controllers:**
- `apps/api/app/controllers/teams_controller.ts` → `tenants_controller.ts`
- `apps/api/app/controllers/auth_controller.ts` - Personal tenant on registration
- `apps/api/app/controllers/coupons_controller.ts` - Pass tenantId
- `apps/api/app/controllers/discount_codes_controller.ts` - Pass tenantId
- `apps/api/app/controllers/payment_controller.ts` - Tenant-based checkout

**Backend - Infrastructure:**
- `apps/api/start/routes.ts` - Rename routes, add tenant middleware
- `apps/api/start/kernel.ts` - Register tenant middleware
- `apps/api/app/middleware/tenant_context_middleware.ts` (new)

**Backend - Tests:**
- `apps/api/tests/functional/teams.spec.ts` → `tenants.spec.ts`
- `apps/api/tests/functional/coupons.spec.ts`
- `apps/api/tests/functional/discount_codes.spec.ts`
- `apps/api/tests/bootstrap.ts`

**Frontend:**
- `apps/web/lib/api.ts` - Add X-Tenant-ID header
- `apps/web/components/tenant-switcher.tsx` (new)
- `packages/shared/src/types/team.ts` → `tenant.ts`

**Specs:**
- `features-request/plugin-system-specs-v3.7/rls.md`
- `features-request/plugin-system-specs-v3.7/core/mandatory/01-tenancy.md`

---

## Verification

1. **Unit Tests:** Run `cd apps/api && node ace test unit`
2. **Integration Tests:** Run `cd apps/api && node ace test functional`
3. **RLS Verification:** Login as User A, set tenant B header, verify 403
4. **Frontend:** Test tenant switcher, verify API calls include header
5. **E2E:** Run `pnpm run web:e2e` after implementation
