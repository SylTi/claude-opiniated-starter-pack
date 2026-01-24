# Tenancy Implementation Checklist

Track progress by checking items as they are completed with unit tests passing.

## Phase 1: Database Migrations

### 1.1 RLS Infrastructure
- [x] Create migration `create_rls_infrastructure.ts`
- [x] Add `app_current_tenant_id()` function
- [x] Add `app_current_user_id()` function
- [x] Add `app_is_tenant_member()` function

### 1.2 Rename Tables
- [x] Create migration `rename_teams_to_tenants.ts`
- [x] Rename `teams` → `tenants`
- [x] Rename `team_members` → `tenant_memberships`
- [x] Rename `team_invitations` → `tenant_invitations`
- [x] Rename column `team_id` → `tenant_id` (memberships)
- [x] Rename column `team_id` → `tenant_id` (invitations)
- [x] Rename column `current_team_id` → `current_tenant_id` (users)
- [x] Add `type` column to tenants (`'personal'` | `'team'`)

### 1.3 Add tenant_id to Scoped Tables
- [x] Create migration `add_tenant_id_columns.ts`
- [x] Add `tenant_id` to `login_history`
- [x] Add `tenant_id` to `discount_code_usages`

### 1.4 Refactor Subscriptions (Tenant = Billing Unit)
- [x] Create migration `refactor_subscriptions.ts`
- [x] Add `tenant_id` to `subscriptions`
- [x] Add `tenant_id` to `payment_customers`
- [ ] Data migration script for user subscriptions → personal tenants
- [x] Drop `subscriber_type` column from `subscriptions`
- [x] Drop `subscriber_id` column from `subscriptions`

### 1.5 Billing Schema Changes
- [x] Create migration `update_billing_columns.ts`
- [x] Rename `max_uses_per_user` → `max_uses_per_tenant` (discount_codes)
- [x] Add `redeemed_for_tenant_id` to `coupons`

### 1.6 Enable RLS Policies
- [x] Create migration `enable_rls.ts`
- [x] Enable RLS on `tenants`
- [x] Enable RLS on `tenant_memberships`
- [x] Enable RLS on `tenant_invitations`
- [x] Enable RLS on `login_history`
- [x] Enable RLS on `subscriptions`
- [x] Enable RLS on `payment_customers`
- [x] Enable RLS on `discount_code_usages`
- [x] Create RLS policies for each table

---

## Phase 2: AdonisJS Middleware

- [x] Create `app/middleware/tenant_context_middleware.ts`
- [x] Implement `resolveTenantIdHint()` (header/cookie)
- [x] Implement membership verification
- [x] Implement RLS context setting (`set_config`)
- [x] Add `ctx.tenant` and `ctx.db` to context
- [x] Register middleware in `start/kernel.ts`
- [ ] Unit test: middleware returns 400 if no tenant header
- [ ] Unit test: middleware returns 403 if not member
- [ ] Unit test: middleware sets RLS context correctly

---

## Phase 3: Model Updates

### 3.1 Model Renames
- [x] Rename `team.ts` → `tenant.ts`
- [x] Rename class `Team` → `Tenant`
- [x] Add `type` column property
- [x] Update table name to `'tenants'`
- [ ] Unit test: Tenant model CRUD

- [x] Rename `team_member.ts` → `tenant_membership.ts`
- [x] Rename class `TeamMember` → `TenantMembership`
- [x] Rename `teamId` → `tenantId`
- [x] Update table name to `'tenant_memberships'`
- [ ] Unit test: TenantMembership model

- [x] Rename `team_invitation.ts` → `tenant_invitation.ts`
- [x] Rename class `TeamInvitation` → `TenantInvitation`
- [x] Rename `teamId` → `tenantId`
- [x] Update table name to `'tenant_invitations'`
- [ ] Unit test: TenantInvitation model

### 3.2 User Model Updates
- [x] Rename `currentTeamId` → `currentTenantId`
- [x] Rename `currentTeam` relationship → `currentTenant`
- [x] Rename `teamMemberships` → `tenantMemberships`
- [x] Remove `getActiveSubscription()` method
- [x] Remove `getEffectiveSubscriptionTier()` method
- [x] Remove `hasAccessToTier()` method
- [x] Remove `hasAccessToLevel()` method
- [ ] Unit test: User model tenant relationships

### 3.3 Subscription Model Updates
- [x] Add `tenantId` property
- [x] Add `tenant` relationship
- [x] Remove `subscriberType` property
- [x] Remove `subscriberId` property
- [x] Remove `forUser()` scope
- [x] Remove `getActiveForUser()` method
- [x] Remove `getAllForUser()` method
- [x] Remove `createForUser()` method
- [x] Remove `downgradeUserToFree()` method
- [x] Update `forTeam()` → use `tenantId`
- [x] Update `getActiveForTeam()` → `getActiveForTenant()`
- [ ] Unit test: Subscription model (tenant-only)

### 3.4 Coupon Model Updates
- [x] Add `redeemedForTenantId` property
- [x] Add `redeemedForTenant` relationship
- [x] Remove `redeemForUser()` method
- [x] Update `redeemForTeam()` → `redeemForTenant(tenantId)`
- [x] Update `redeem()` method signature
- [ ] Unit test: Coupon redemption adds to tenant balance

### 3.5 Discount Code Model Updates
- [x] Rename `maxUsesPerUser` → `maxUsesPerTenant`
- [x] Update `canBeUsedBy(userId)` → `canBeUsedByTenant(tenantId)`
- [ ] Unit test: maxUsesPerTenant limit works

### 3.6 Discount Code Usage Model Updates
- [x] Add `tenantId` property (billing context)
- [x] Keep `userId` property (audit trail)
- [x] Add `tenant` relationship
- [x] Update `recordUsage()` to accept `tenantId, userId`
- [x] Update `countByUserAndCode()` → `countByTenantAndCode()`
- [ ] Unit test: Usage tracked by tenant

### 3.7 Payment Customer Model Updates
- [x] Add `tenantId` property
- [x] Add `tenant` relationship
- [x] Update queries to use `tenantId`
- [ ] Unit test: PaymentCustomer per tenant

### 3.8 Login History Model Updates
- [x] Add `tenantId` property
- [x] Add `tenant` relationship
- [ ] Unit test: LoginHistory with tenant context

---

## Phase 4: Service Updates

### 4.1 Coupon Service
- [x] Update `redeemCoupon(code, userId)` → `redeemCoupon(code, tenantId, userId)`
- [x] Remove `getUserBalance()` method
- [x] Update `redeemCouponForTeam()` → `redeemCouponForTenant()`
- [ ] Unit test: Service adds credit to tenant balance

### 4.2 Discount Code Service
- [x] Update `validateCode(code, priceId, userId)` → `validateCode(code, priceId, tenantId)`
- [x] Update `recordUsage()` to accept `tenantId, userId`
- [x] Update usage count query to use `tenantId`
- [ ] Unit test: Validation checks tenant usage

---

## Phase 5: Controller Updates

### 5.1 Rename TeamsController → TenantsController
- [x] Rename file `teams_controller.ts` → `tenants_controller.ts`
- [x] Rename class `TeamsController` → `TenantsController`
- [x] Update all `team` references to `tenant`
- [x] Update all `teamId` to `tenantId`
- [ ] Functional test: Tenant CRUD operations

### 5.2 Auth Controller
- [x] Create personal tenant on registration
- [x] Create owner membership
- [x] Set `currentTenantId` on new user
- [ ] Add `tenantId` to login history
- [ ] Functional test: Registration creates personal tenant

### 5.3 Coupons Controller
- [x] Update to use `ctx.tenant.id` for billing
- [x] Keep `user.id` for audit (redeemedByUserId)
- [ ] Functional test: Coupon redemption with tenant context

### 5.4 Discount Codes Controller
- [x] Update validation to use `ctx.tenant.id`
- [x] Update usage recording to use tenant context
- [ ] Functional test: Discount validation with tenant

### 5.5 Payment Controller
- [x] Update checkout to use `tenantId` (via request validation)
- [x] Update discount validation with tenant
- [x] Update subscription creation for tenant
- [ ] Functional test: Checkout creates tenant subscription

---

## Phase 6: Route Updates

- [x] Rename `/teams/*` → `/tenants/*`
- [x] Update route controller references
- [x] Tenant context passed via request `tenantId` param (not middleware)
- [x] Update invitation routes
- [x] Update API.md documentation

---

## Phase 7: Frontend Updates

### 7.1 API Client
- [ ] Add `X-Tenant-ID` header to all requests
- [ ] Read tenant ID from cookie
- [ ] Test: API requests include tenant header

### 7.2 Tenant Switcher Component
- [ ] Create `tenant-switcher.tsx` component
- [ ] Fetch user's tenants
- [ ] Handle tenant switching
- [ ] Set tenant cookie on switch
- [ ] Test: Tenant switcher component

### 7.3 Shared Types
- [x] Rename `team.ts` → `tenant.ts`
- [x] Update `TeamDTO` → `TenantDTO`
- [x] Update `TeamMemberDTO` → `TenantMembershipDTO`
- [x] Update `TeamInvitationDTO` → `TenantInvitationDTO`
- [x] Add `type: 'personal' | 'team'` to TenantDTO
- [x] Update User types (currentTeamId → currentTenantId)
- [x] Update SubscriptionDTO (remove subscriberType/subscriberId, add tenantId)
- [x] Update DiscountCodeDTO (maxUsesPerUser → maxUsesPerTenant)
- [x] Update CouponDTO (add redeemedForTenantId)

### 7.4 Pages
- [ ] Rename `app/team/` → `app/tenant/`
- [ ] Rename `app/admin/teams/` → `app/admin/tenants/`
- [ ] Update all team references in components

---

## Phase 8: Data Migration

- [ ] Create data migration script
- [ ] Create personal tenants for all existing users
- [ ] Migrate user subscriptions to personal tenants
- [ ] Migrate payment customers to tenants
- [ ] Backfill tenant_id in discount_code_usages
- [ ] Set default currentTenantId for users without one

---

## Phase 9: Test Updates

### 9.1 Update Test Files
- [ ] Rename `teams.spec.ts` → `tenants.spec.ts`
- [ ] Update `coupons.spec.ts` for tenant billing
- [ ] Update `discount_codes.spec.ts` for tenant validation
- [ ] Update `payment.spec.ts` for tenant checkout
- [ ] Update `subscriptions.spec.ts` (remove user subscription tests)
- [ ] Update `bootstrap.ts` table names

### 9.2 New Test Files
- [ ] Create `tenant_context.spec.ts` (RLS enforcement)

### 9.3 Test Seed Data
- [ ] Update seed to create personal tenants
- [ ] Update seed to use tenant billing

---

## Verification Checklist

- [ ] All unit tests pass: `node ace test unit`
- [ ] All functional tests pass: `node ace test functional`
- [ ] RLS verification: User A cannot access Tenant B data
- [ ] Personal tenant created on registration
- [ ] Coupon credit goes to tenant balance
- [ ] Discount usage tracked per tenant
- [ ] Subscription created for tenant (not user)
- [ ] Frontend tenant switcher works
- [ ] API requests include X-Tenant-ID header
- [ ] E2E tests pass: `pnpm run web:e2e`

---

## Notes

- After each item is completed with passing tests, mark it as checked
- Run `node ace test unit` and `node ace test functional` frequently
- Do NOT run migrations directly - prompt user with commands
- Update API.md when routes change
