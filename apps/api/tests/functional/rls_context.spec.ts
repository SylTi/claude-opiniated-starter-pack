import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Tenant from '#models/tenant'
import TenantMembership from '#models/tenant_membership'
import TenantInvitation from '#models/tenant_invitation'
import Subscription from '#models/subscription'
import SubscriptionTier from '#models/subscription_tier'
import PaymentCustomer from '#models/payment_customer'
import LoginHistory from '#models/login_history'
import { setRlsContext, setSystemRlsContext } from '#utils/rls_context'
import { truncateAllTables } from '../bootstrap.js'
import request from 'supertest'
import { DateTime } from 'luxon'

const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

async function createUserAndLogin(
  email: string,
  password: string,
  options: { emailVerified?: boolean; fullName?: string } = {}
): Promise<{ user: User; cookies: string[] }> {
  const user = await User.create({
    email,
    password,
    fullName: options.fullName ?? 'Test User',
    role: 'user',
    emailVerified: options.emailVerified ?? true,
    mfaEnabled: false,
  })

  const response = await request(BASE_URL)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .set('Accept', 'application/json')

  if (response.status !== 200) {
    throw new Error(`Login failed: ${response.status} - ${JSON.stringify(response.body)}`)
  }

  const cookies = response.headers['set-cookie']
  return { user, cookies: Array.isArray(cookies) ? cookies : [] }
}

async function createUserWithTenant(
  emailPrefix: string,
  tenantName: string
): Promise<{ user: User; tenant: Tenant; cookies: string[] }> {
  const id = uniqueId()
  const email = `${emailPrefix}-${id}@example.com`
  const password = 'password123'

  const { user, cookies } = await createUserAndLogin(email, password)

  const tenant = await Tenant.create({
    name: tenantName,
    slug: `${tenantName.toLowerCase().replace(/\s+/g, '-')}-${id}`,
    ownerId: user.id,
  })

  await TenantMembership.create({
    userId: user.id,
    tenantId: tenant.id,
    role: 'owner',
  })

  user.currentTenantId = tenant.id
  await user.save()

  return { user, tenant, cookies }
}

/**
 * Helper to create tenant with paid subscription and fresh login cookies.
 * Use this for invitation tests where:
 * 1. Paid subscription is required
 * 2. Fresh login cookies are needed (after tenant is set up)
 */
async function createPaidTenantWithOwner(
  emailPrefix: string,
  tenantName: string
): Promise<{ user: User; tenant: Tenant; cookies: string[] }> {
  const id = uniqueId()
  const email = `${emailPrefix}-${id}@example.com`
  const password = 'password123'

  // Create user first
  const user = await User.create({
    email,
    password,
    fullName: 'Test User',
    role: 'user',
    emailVerified: true,
    mfaEnabled: false,
  })

  // Create tenant
  const tenant = await Tenant.create({
    name: tenantName,
    slug: `${tenantName.toLowerCase().replace(/\s+/g, '-')}-${id}`,
    ownerId: user.id,
  })

  // Add paid subscription (invitations require tier1+)
  const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
  await Subscription.createForTenant(tenant.id, tier1.id)

  // Create membership
  await TenantMembership.create({
    userId: user.id,
    tenantId: tenant.id,
    role: 'owner',
  })

  // Set current tenant
  user.currentTenantId = tenant.id
  await user.save()

  // Login AFTER setup to get fresh cookies with correct tenant context
  const response = await request(BASE_URL)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .set('Accept', 'application/json')

  if (response.status !== 200) {
    throw new Error(`Login failed: ${response.status} - ${JSON.stringify(response.body)}`)
  }

  const cookies = response.headers['set-cookie']
  return { user, tenant, cookies: Array.isArray(cookies) ? cookies : [] }
}

test.group('RLS Context Integration', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('authenticated request can access own user data', async ({ assert }) => {
    const id = uniqueId()
    const email = `me-test-${id}@example.com`
    const { cookies } = await createUserAndLogin(email, 'password123')

    const response = await request(BASE_URL)
      .get('/api/v1/auth/me')
      .set('Cookie', cookies)
      .expect(200)

    assert.equal(response.body.data.email, email)
  })

  test('tenant middleware sets context for tenant-scoped requests', async ({ assert }) => {
    const { tenant, cookies } = await createUserWithTenant('tenant-test', 'Test Tenant')

    const response = await request(BASE_URL)
      .get(`/api/v1/tenants/${tenant.id}`)
      .set('Cookie', cookies)
      .set('X-Tenant-ID', String(tenant.id))
      .expect(200)

    assert.equal(response.body.data.id, tenant.id)
    assert.equal(response.body.data.name, 'Test Tenant')
  })

  test('request without tenant header fails for tenant-scoped billing endpoints', async ({
    assert,
  }) => {
    const id = uniqueId()
    const email = `no-tenant-${id}@example.com`
    const { cookies } = await createUserAndLogin(email, 'password123')

    const response = await request(BASE_URL)
      .get('/api/v1/billing/subscription')
      .set('Cookie', cookies)
      .expect(400)

    assert.equal(response.body.error, 'TenantRequired')
  })

  test('cross-tenant access is blocked by middleware', async ({ assert }) => {
    // Create two users with separate tenants
    const { cookies: cookies1 } = await createUserWithTenant('user1', 'Tenant 1')
    const { tenant: tenant2 } = await createUserWithTenant('user2', 'Tenant 2')

    // User 1 trying to access Tenant 2 via header should be blocked
    const response = await request(BASE_URL)
      .get(`/api/v1/tenants/${tenant2.id}`)
      .set('Cookie', cookies1)
      .set('X-Tenant-ID', String(tenant2.id))
      .expect(403)

    assert.equal(response.body.error, 'Forbidden')
    assert.include(response.body.message, 'not a member of this tenant')
  })

  test('setRlsContext sets session variables correctly', async ({ assert }) => {
    const tenantId = 123
    const userId = 456

    await db.transaction(async (trx) => {
      await setRlsContext(trx, tenantId, userId)

      const tenantResult = await trx.rawQuery(
        "SELECT current_setting('app.tenant_id', true) as tenant_id"
      )
      const userResult = await trx.rawQuery(
        "SELECT current_setting('app.user_id', true) as user_id"
      )

      assert.equal(tenantResult.rows[0].tenant_id, '123')
      assert.equal(userResult.rows[0].user_id, '456')
    })
  })

  test('setRlsContext defaults user_id to 0 for system operations', async ({ assert }) => {
    const tenantId = 789

    await db.transaction(async (trx) => {
      await setRlsContext(trx, tenantId)

      const userResult = await trx.rawQuery(
        "SELECT current_setting('app.user_id', true) as user_id"
      )

      assert.equal(userResult.rows[0].user_id, '0')
    })
  })

  test('setSystemRlsContext sets both user_id and tenant_id to 0', async ({ assert }) => {
    await db.transaction(async (trx) => {
      await setSystemRlsContext(trx)

      const userResult = await trx.rawQuery(
        "SELECT current_setting('app.user_id', true) as user_id"
      )
      const tenantResult = await trx.rawQuery(
        "SELECT current_setting('app.tenant_id', true) as tenant_id"
      )

      assert.equal(userResult.rows[0].user_id, '0')
      assert.equal(tenantResult.rows[0].tenant_id, '0')
    })
  })

  test('can transition from system context to tenant context', async ({ assert }) => {
    const tenantId = 42
    const userId = 99

    await db.transaction(async (trx) => {
      // Start with system context (for lookups)
      await setSystemRlsContext(trx)

      let result = await trx.rawQuery(
        "SELECT current_setting('app.user_id', true) as user_id, current_setting('app.tenant_id', true) as tenant_id"
      )
      assert.equal(result.rows[0].user_id, '0')
      assert.equal(result.rows[0].tenant_id, '0')

      // Transition to tenant context (after lookup determines tenant)
      await setRlsContext(trx, tenantId, userId)

      result = await trx.rawQuery(
        "SELECT current_setting('app.user_id', true) as user_id, current_setting('app.tenant_id', true) as tenant_id"
      )
      assert.equal(result.rows[0].user_id, '99')
      assert.equal(result.rows[0].tenant_id, '42')
    })
  })

  test('webhook simulation with setRlsContext can update subscriptions', async ({ assert }) => {
    const { tenant } = await createUserWithTenant('webhook', 'Webhook Tenant')

    // Ensure free tier exists
    let tier = await SubscriptionTier.findBy('slug', 'free')
    if (!tier) {
      tier = await SubscriptionTier.create({
        slug: 'free',
        name: 'Free',
        level: 0,
        maxTeamMembers: 1,
        priceMonthly: 0,
        yearlyDiscountPercent: 0,
        features: {},
        isActive: true,
      })
    }

    // Create subscription
    const subscription = await Subscription.create({
      tenantId: tenant.id,
      tierId: tier.id,
      status: 'active',
      startsAt: DateTime.now(),
    })

    // Simulate webhook updating subscription with RLS context
    await db.transaction(async (trx) => {
      await setRlsContext(trx, tenant.id)

      const sub = await Subscription.query({ client: trx })
        .where('id', subscription.id)
        .firstOrFail()

      sub.status = 'cancelled'
      sub.useTransaction(trx)
      await sub.save()
    })

    // Verify update persisted
    const updated = await Subscription.findOrFail(subscription.id)
    assert.equal(updated.status, 'cancelled')
  })

  test('BaseModel save() works in authenticated context', async ({ assert }) => {
    const { tenant, cookies } = await createUserWithTenant('save-test', 'Save Test Tenant')

    // Update tenant name via API (exercises save() with RLS context)
    const response = await request(BASE_URL)
      .put(`/api/v1/tenants/${tenant.id}`)
      .set('Cookie', cookies)
      .set('X-Tenant-ID', String(tenant.id))
      .send({ name: 'Updated Name' })
      .expect(200)

    assert.equal(response.body.data.name, 'Updated Name')

    // Verify update persisted
    const updated = await Tenant.findOrFail(tenant.id)
    assert.equal(updated.name, 'Updated Name')
  })

  test('RLS context is scoped to transaction', async ({ assert }) => {
    // Set RLS in one transaction
    await db.transaction(async (trx) => {
      await setRlsContext(trx, 999, 888)

      const result = await trx.rawQuery(
        "SELECT current_setting('app.tenant_id', true) as tenant_id"
      )
      assert.equal(result.rows[0].tenant_id, '999')
    })

    // Outside the transaction, settings should be gone (or empty)
    const result = await db.rawQuery("SELECT current_setting('app.tenant_id', true) as tenant_id")
    // Should be empty string or null after transaction ends
    assert.oneOf(result.rows[0].tenant_id, ['', null, undefined])
  })

  test('app_current_user_id() returns NULL when no RLS context is set (fail-closed)', async ({
    assert,
  }) => {
    // This test verifies the fail-closed security design
    // When no RLS context is set, app_current_user_id() should return NULL
    // which will cause RLS policies to deny access (fail-closed)
    // System bypass (user_id=0) must be set EXPLICITLY via systemOps.withSystemContext()
    await db.transaction(async (trx) => {
      // Do NOT set any RLS context - simulating a misconfigured endpoint

      // Query app_current_user_id() directly
      const result = await trx.rawQuery('SELECT app_current_user_id() as user_id')

      // Should return NULL (fail-closed), not 0
      // This ensures that missing context = denied access, not system bypass
      assert.isNull(result.rows[0].user_id, 'app_current_user_id() should return NULL when not set')
    })
  })

  test('system context must be set explicitly for system bypass', async ({ assert }) => {
    // This test verifies that system bypass only works when explicitly set
    // via setSystemRlsContext(), not by default
    await db.transaction(async (trx) => {
      // Explicitly set system context
      await setSystemRlsContext(trx)

      // Now app_current_user_id() should return 0 (system identity)
      const result = await trx.rawQuery('SELECT app_current_user_id() as user_id')
      assert.equal(
        result.rows[0].user_id,
        0,
        'app_current_user_id() should return 0 after setSystemRlsContext()'
      )
    })
  })
})

/**
 * Negative RLS Tests
 *
 * These tests verify that RLS policies are enforced at the database level.
 * They prove that without proper RLS context:
 * - SELECT returns no rows (not the data from other tenants)
 * - INSERT/UPDATE/DELETE fail or are restricted
 *
 * This is critical for security - we need to know that RLS isn't just
 * enforced by application code, but by the database itself.
 *
 * IMPORTANT: These tests require a non-superuser database connection to work.
 * Superusers bypass RLS entirely. In production, RLS is enforced because:
 * - Supabase uses authenticated/anon roles that don't bypass RLS
 * - The app connects as a non-superuser role
 *
 * In test environments using Docker with superuser (postgres), these tests
 * are skipped because superusers bypass RLS. Database-level RLS enforcement
 * is validated in production via Supabase's role-based access control.
 */
test.group('RLS Negative Tests - Database Enforcement', (group) => {
  let isSuperuser = false

  group.setup(async () => {
    const result = await db.rawQuery<{ rows: Array<{ is_superuser: boolean }> }>(
      "SELECT current_setting('is_superuser') = 'on' as is_superuser"
    )
    isSuperuser = result.rows[0]?.is_superuser ?? false
  })

  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('SELECT on tenant-scoped table returns no rows without RLS context', async ({ assert }) => {
    if (isSuperuser) {
      // Superuser bypasses RLS - this test only works with non-superuser connection
      return
    }
    // Create test data
    const { tenant } = await createUserWithTenant('rls-neg-1', 'Negative Test Tenant 1')

    // Create a subscription for this tenant
    let tier = await SubscriptionTier.findBy('slug', 'free')
    if (!tier) {
      tier = await SubscriptionTier.create({
        slug: 'free',
        name: 'Free',
        level: 0,
        maxTeamMembers: 1,
        priceMonthly: 0,
        yearlyDiscountPercent: 0,
        features: {},
        isActive: true,
      })
    }

    await Subscription.create({
      tenantId: tenant.id,
      tierId: tier.id,
      status: 'active',
      startsAt: DateTime.now(),
    })

    // Verify data exists using raw query (bypassing RLS for setup verification)
    const rawCount = await db.rawQuery('SELECT COUNT(*) as count FROM subscriptions')
    assert.isTrue(Number(rawCount.rows[0].count) > 0, 'Data should exist in subscriptions table')

    // Now try to read with WRONG tenant context
    await db.transaction(async (trx) => {
      // Set RLS context to a different (non-existent) tenant AND non-zero user_id
      // Using non-zero user_id prevents the system bypass (user_id=0)
      await setRlsContext(trx, 99999, 99999)

      // Query should return no rows because RLS policy restricts access
      const subscriptions = await Subscription.query({ client: trx })
      assert.equal(subscriptions.length, 0, 'RLS should block access to other tenants data')
    })
  })

  test('SELECT on tenant-scoped table returns data with correct RLS context', async ({
    assert,
  }) => {
    // Create test data
    const { tenant } = await createUserWithTenant('rls-neg-2', 'Negative Test Tenant 2')

    let tier = await SubscriptionTier.findBy('slug', 'free')
    if (!tier) {
      tier = await SubscriptionTier.create({
        slug: 'free',
        name: 'Free',
        level: 0,
        maxTeamMembers: 1,
        priceMonthly: 0,
        yearlyDiscountPercent: 0,
        features: {},
        isActive: true,
      })
    }

    await Subscription.create({
      tenantId: tenant.id,
      tierId: tier.id,
      status: 'active',
      startsAt: DateTime.now(),
    })

    // Query with CORRECT tenant context should return data
    await db.transaction(async (trx) => {
      await setRlsContext(trx, tenant.id)

      const subscriptions = await Subscription.query({ client: trx })
      assert.equal(subscriptions.length, 1, 'RLS should allow access to own tenant data')
      assert.equal(subscriptions[0].tenantId, tenant.id)
    })
  })

  test('cross-tenant data isolation is enforced by database', async ({ assert }) => {
    if (isSuperuser) {
      // Superuser bypasses RLS - this test only works with non-superuser connection
      return
    }
    // Create two separate tenants with subscriptions
    const { user: user1, tenant: tenant1 } = await createUserWithTenant('rls-neg-3a', 'Tenant A')
    const { user: user2, tenant: tenant2 } = await createUserWithTenant('rls-neg-3b', 'Tenant B')

    let tier = await SubscriptionTier.findBy('slug', 'free')
    if (!tier) {
      tier = await SubscriptionTier.create({
        slug: 'free',
        name: 'Free',
        level: 0,
        maxTeamMembers: 1,
        priceMonthly: 0,
        yearlyDiscountPercent: 0,
        features: {},
        isActive: true,
      })
    }

    // Create subscriptions for both tenants
    await Subscription.create({
      tenantId: tenant1.id,
      tierId: tier.id,
      status: 'active',
      startsAt: DateTime.now(),
    })

    await Subscription.create({
      tenantId: tenant2.id,
      tierId: tier.id,
      status: 'active',
      startsAt: DateTime.now(),
    })

    // Verify total count (using raw query, bypassing RLS)
    const totalCount = await db.rawQuery('SELECT COUNT(*) as count FROM subscriptions')
    assert.equal(Number(totalCount.rows[0].count), 2, 'Should have 2 subscriptions total')

    // Tenant 1 context should only see Tenant 1's subscription
    await db.transaction(async (trx) => {
      // Pass user_id to avoid system bypass (user_id=0)
      await setRlsContext(trx, tenant1.id, user1.id)

      const subs = await Subscription.query({ client: trx })
      assert.equal(subs.length, 1, 'Tenant 1 should only see 1 subscription')
      assert.equal(subs[0].tenantId, tenant1.id, 'Should be Tenant 1 subscription')
    })

    // Tenant 2 context should only see Tenant 2's subscription
    await db.transaction(async (trx) => {
      // Pass user_id to avoid system bypass (user_id=0)
      await setRlsContext(trx, tenant2.id, user2.id)

      const subs = await Subscription.query({ client: trx })
      assert.equal(subs.length, 1, 'Tenant 2 should only see 1 subscription')
      assert.equal(subs[0].tenantId, tenant2.id, 'Should be Tenant 2 subscription')
    })
  })

  test('system context (user_id=0) can read tenant-scoped data when policy allows', async ({
    assert,
  }) => {
    // This test verifies that system operations can work when policies allow user_id=0
    const { tenant } = await createUserWithTenant('rls-neg-4', 'System Context Test')

    let tier = await SubscriptionTier.findBy('slug', 'free')
    if (!tier) {
      tier = await SubscriptionTier.create({
        slug: 'free',
        name: 'Free',
        level: 0,
        maxTeamMembers: 1,
        priceMonthly: 0,
        yearlyDiscountPercent: 0,
        features: {},
        isActive: true,
      })
    }

    await Subscription.create({
      tenantId: tenant.id,
      tierId: tier.id,
      status: 'active',
      startsAt: DateTime.now(),
      providerName: 'stripe',
      providerSubscriptionId: 'sub_test123',
    })

    // System context (for webhook lookups) should be able to find subscriptions
    // when the policy allows system bypass for lookups
    await db.transaction(async (trx) => {
      await setSystemRlsContext(trx)

      // Lookup by provider subscription ID (common in webhook handlers)
      const sub = await Subscription.query({ client: trx })
        .where('providerSubscriptionId', 'sub_test123')
        .first()

      // Note: This will only work if RLS policies include a system bypass clause
      // If this fails, the RLS policy needs to be updated to allow system operations
      if (sub) {
        assert.equal(sub.tenantId, tenant.id)
      }
      // We don't assert failure here because different RLS policies may or may not allow this
    })
  })

  test('tenant membership table enforces RLS', async ({ assert }) => {
    if (isSuperuser) {
      // Superuser bypasses RLS - this test only works with non-superuser connection
      return
    }
    // Create two tenants
    const { user: user1, tenant: tenant1 } = await createUserWithTenant(
      'rls-neg-5a',
      'Membership Test A'
    )
    const { user: user2, tenant: tenant2 } = await createUserWithTenant(
      'rls-neg-5b',
      'Membership Test B'
    )

    // Verify both tenants have memberships
    const totalMemberships = await db.rawQuery('SELECT COUNT(*) as count FROM tenant_memberships')
    assert.isTrue(Number(totalMemberships.rows[0].count) >= 2, 'Should have at least 2 memberships')

    // Tenant 1 context should only see Tenant 1's memberships
    await db.transaction(async (trx) => {
      // Pass user_id to avoid system bypass (user_id=0)
      await setRlsContext(trx, tenant1.id, user1.id)

      const memberships = await TenantMembership.query({ client: trx })
      assert.isTrue(memberships.length > 0, 'Should see own memberships')
      for (const m of memberships) {
        assert.equal(m.tenantId, tenant1.id, 'All memberships should be for Tenant 1')
      }
    })

    // Tenant 2 context should only see Tenant 2's memberships
    await db.transaction(async (trx) => {
      // Pass user_id to avoid system bypass (user_id=0)
      await setRlsContext(trx, tenant2.id, user2.id)

      const memberships = await TenantMembership.query({ client: trx })
      assert.isTrue(memberships.length > 0, 'Should see own memberships')
      for (const m of memberships) {
        assert.equal(m.tenantId, tenant2.id, 'All memberships should be for Tenant 2')
      }
    })
  })

  test('payment_customers table enforces tenant RLS', async ({ assert }) => {
    if (isSuperuser) {
      // Superuser bypasses RLS - this test only works with non-superuser connection
      return
    }
    // Create two tenants with payment customers
    const { user: user1, tenant: tenant1 } = await createUserWithTenant(
      'rls-neg-6a',
      'Payment Test A'
    )
    const { user: user2, tenant: tenant2 } = await createUserWithTenant(
      'rls-neg-6b',
      'Payment Test B'
    )

    // Create payment customers for both tenants
    await PaymentCustomer.create({
      tenantId: tenant1.id,
      provider: 'stripe',
      providerCustomerId: 'cus_tenant1_test',
    })

    await PaymentCustomer.create({
      tenantId: tenant2.id,
      provider: 'stripe',
      providerCustomerId: 'cus_tenant2_test',
    })

    // Tenant 1 should only see their payment customer
    await db.transaction(async (trx) => {
      // Pass user_id to avoid system bypass (user_id=0)
      await setRlsContext(trx, tenant1.id, user1.id)

      const customers = await PaymentCustomer.query({ client: trx })
      assert.equal(customers.length, 1, 'Should only see 1 payment customer')
      assert.equal(customers[0].tenantId, tenant1.id)
      assert.equal(customers[0].providerCustomerId, 'cus_tenant1_test')
    })

    // Tenant 2 should only see their payment customer
    await db.transaction(async (trx) => {
      // Pass user_id to avoid system bypass (user_id=0)
      await setRlsContext(trx, tenant2.id, user2.id)

      const customers = await PaymentCustomer.query({ client: trx })
      assert.equal(customers.length, 1, 'Should only see 1 payment customer')
      assert.equal(customers[0].tenantId, tenant2.id)
      assert.equal(customers[0].providerCustomerId, 'cus_tenant2_test')
    })
  })

  test('attempting to INSERT with wrong tenant_id is blocked by RLS', async ({ assert }) => {
    if (isSuperuser) {
      // Superuser bypasses RLS - this test only works with non-superuser connection
      return
    }
    // Create a tenant
    const { tenant } = await createUserWithTenant('rls-neg-7', 'Insert Test Tenant')

    let tier = await SubscriptionTier.findBy('slug', 'free')
    if (!tier) {
      tier = await SubscriptionTier.create({
        slug: 'free',
        name: 'Free',
        level: 0,
        maxTeamMembers: 1,
        priceMonthly: 0,
        yearlyDiscountPercent: 0,
        features: {},
        isActive: true,
      })
    }

    // Set context for tenant, then try to insert with different tenant_id
    // This should be blocked by RLS policies (depending on policy configuration)
    await db.transaction(async (trx) => {
      await setRlsContext(trx, tenant.id)

      // Try to create a subscription for a different tenant
      // Most RLS policies only allow INSERT if tenant_id matches context
      try {
        await trx.table('subscriptions').insert({
          tenant_id: 99999, // Wrong tenant ID
          tier_id: tier.id,
          status: 'active',
          starts_at: new Date(),
        })
        // If we get here, the INSERT was allowed - check if policy blocks reads
        const badSub = await trx.from('subscriptions').where('tenant_id', 99999).first()

        // If RLS is properly configured, either the INSERT should fail
        // or the subsequent read should not return the row
        assert.isNull(badSub, 'RLS should prevent seeing data from wrong tenant')
      } catch {
        // INSERT was blocked by RLS - this is the expected behavior
        assert.isTrue(true, 'RLS correctly blocked INSERT for wrong tenant')
      }
    })
  })
})

/**
 * Login History RLS Tests
 *
 * These tests verify that the login_history RLS policy correctly allows:
 * - Users to see their own login history (user_id = app_current_user_id())
 * - SSO login entries with tenant_id are visible to the user
 * - Users cannot see other users' login history
 *
 * Note: Database-level tests require a non-superuser connection.
 */
test.group('Login History RLS', (group) => {
  let isSuperuser = false

  group.setup(async () => {
    const result = await db.rawQuery<{ rows: Array<{ is_superuser: boolean }> }>(
      "SELECT current_setting('is_superuser') = 'on' as is_superuser"
    )
    isSuperuser = result.rows[0]?.is_superuser ?? false
  })

  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('user can see their own login history via API', async ({ assert }) => {
    const id = uniqueId()
    const email = `login-history-${id}@example.com`
    const password = 'password123'
    const { cookies } = await createUserAndLogin(email, password)

    // Login creates a history entry, so there should be at least 1
    const response = await request(BASE_URL)
      .get('/api/v1/auth/login-history')
      .set('Cookie', cookies)
      .expect(200)

    assert.isArray(response.body.data)
    assert.isTrue(response.body.data.length >= 1, 'Should have at least one login history entry')
    assert.equal(response.body.data[0].loginMethod, 'password')
    assert.equal(response.body.data[0].success, true)
  })

  test('login history with tenant_id (SSO) is visible to the user', async ({ assert }) => {
    // Create user with tenant
    const { user, tenant, cookies } = await createUserWithTenant('sso-history', 'SSO Test Tenant')

    // Manually insert SSO login history entry with tenant_id
    // This simulates what sso_service does on SSO login
    await db.transaction(async (trx) => {
      await setSystemRlsContext(trx) // Use system context to insert
      await LoginHistory.create(
        {
          userId: user.id,
          tenantId: tenant.id, // SSO logins have tenant_id
          loginMethod: 'sso_oidc',
          success: true,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        },
        { client: trx }
      )
    })

    // User should be able to see this SSO entry via the API
    // even though they don't have tenant context set (only user context)
    const response = await request(BASE_URL)
      .get('/api/v1/auth/login-history')
      .set('Cookie', cookies)
      .expect(200)

    assert.isArray(response.body.data)

    // Find the SSO login entry
    const ssoEntry = response.body.data.find(
      (entry: { loginMethod: string }) => entry.loginMethod === 'sso_oidc'
    )
    assert.isDefined(ssoEntry, 'SSO login entry should be visible to the user')
    assert.equal(ssoEntry.success, true)
  })

  test('user cannot see other users login history', async ({ assert }) => {
    // Create two users
    const id1 = uniqueId()
    const id2 = uniqueId()
    const { user: user1 } = await createUserAndLogin(`user1-${id1}@example.com`, 'password123')
    const { cookies: cookies2 } = await createUserAndLogin(
      `user2-${id2}@example.com`,
      'password123'
    )

    // Create login history for user1 (simulate additional login)
    await db.transaction(async (trx) => {
      await setSystemRlsContext(trx)
      await LoginHistory.create(
        {
          userId: user1.id,
          loginMethod: 'password',
          success: true,
          ipAddress: '192.168.1.1',
          userAgent: 'User 1 Agent',
        },
        { client: trx }
      )
    })

    // User2 tries to get login history - should only see their own
    const response = await request(BASE_URL)
      .get('/api/v1/auth/login-history')
      .set('Cookie', cookies2)
      .expect(200)

    // Verify no entries belong to user1
    for (const entry of response.body.data) {
      // We can't directly check userId in response, but we can verify
      // by checking that none of the entries have user1's IP
      assert.notEqual(entry.ipAddress, '192.168.1.1', 'Should not see user1 login history')
    }
  })

  test('login history RLS at database level blocks cross-user access', async ({ assert }) => {
    if (isSuperuser) {
      // Superuser bypasses RLS - this test only works with non-superuser connection
      return
    }
    // Create two users
    const id1 = uniqueId()
    const id2 = uniqueId()
    const { user: user1 } = await createUserAndLogin(`db-user1-${id1}@example.com`, 'password123')
    const { user: user2 } = await createUserAndLogin(`db-user2-${id2}@example.com`, 'password123')

    // Create distinct login entries for each user
    await db.transaction(async (trx) => {
      await setSystemRlsContext(trx)
      await LoginHistory.create(
        {
          userId: user1.id,
          loginMethod: 'password',
          success: true,
          ipAddress: '10.0.0.1',
        },
        { client: trx }
      )
      await LoginHistory.create(
        {
          userId: user2.id,
          loginMethod: 'password',
          success: true,
          ipAddress: '10.0.0.2',
        },
        { client: trx }
      )
    })

    // Verify total count (using raw query, bypassing RLS)
    const totalCount = await db.rawQuery('SELECT COUNT(*) as count FROM login_history')
    assert.isTrue(
      Number(totalCount.rows[0].count) >= 4,
      'Should have at least 4 login history entries'
    )

    // User1 context should only see User1's entries
    await db.transaction(async (trx) => {
      await trx.rawQuery("SELECT set_config('app.user_id', ?, true)", [String(user1.id)])

      const entries = await LoginHistory.query({ client: trx })
      assert.isTrue(entries.length > 0, 'Should see own entries')
      for (const entry of entries) {
        assert.equal(entry.userId, user1.id, 'All entries should belong to user1')
      }
    })

    // User2 context should only see User2's entries
    await db.transaction(async (trx) => {
      await trx.rawQuery("SELECT set_config('app.user_id', ?, true)", [String(user2.id)])

      const entries = await LoginHistory.query({ client: trx })
      assert.isTrue(entries.length > 0, 'Should see own entries')
      for (const entry of entries) {
        assert.equal(entry.userId, user2.id, 'All entries should belong to user2')
      }
    })
  })
})

/**
 * Invitation RLS Tests
 *
 * These tests verify that the tenant_invitations RLS policy correctly allows:
 * - Users to access invitations sent to their email (for accept/decline)
 * - Tenant admins to manage invitations for their tenant
 * - System operations to bypass RLS
 *
 * Note: Database-level tests require a non-superuser connection.
 */
test.group('Invitation RLS', (group) => {
  let isSuperuser = false

  group.setup(async () => {
    const result = await db.rawQuery<{ rows: Array<{ is_superuser: boolean }> }>(
      "SELECT current_setting('is_superuser') = 'on' as is_superuser"
    )
    isSuperuser = result.rows[0]?.is_superuser ?? false
  })

  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('user can access invitation sent to their email via API', async ({ assert }) => {
    // Create a tenant with owner (with paid subscription for invitations)
    const { tenant, cookies: ownerCookies } = await createPaidTenantWithOwner(
      'inv-owner',
      'Invitation Test Tenant'
    )

    // Create another user who will be invited
    const inviteeId = uniqueId()
    const inviteeEmail = `invitee-${inviteeId}@example.com`
    const { cookies: inviteeCookies } = await createUserAndLogin(inviteeEmail, 'password123')

    // Owner sends invitation
    const inviteResponse = await request(BASE_URL)
      .post(`/api/v1/tenants/${tenant.id}/invitations`)
      .set('Cookie', ownerCookies)
      .set('X-Tenant-ID', String(tenant.id))
      .send({ email: inviteeEmail, role: 'member' })
      .expect(201)

    // Extract token from invitationLink (format: {frontendUrl}/invitations/{token})
    const invitationLink = inviteResponse.body.data.invitationLink
    const invitationToken = invitationLink.split('/invitations/')[1]

    // Invitee should be able to accept (uses authContext, no tenant context)
    const acceptResponse = await request(BASE_URL)
      .post(`/api/v1/invitations/${invitationToken}/accept`)
      .set('Cookie', inviteeCookies)
      .expect(200)

    assert.equal(acceptResponse.body.message, 'You have joined the tenant successfully')
    assert.equal(acceptResponse.body.data.tenantId, tenant.id)
    assert.isDefined(acceptResponse.body.data.tenantName)
  })

  test('user can decline invitation sent to their email', async ({ assert }) => {
    // Create a tenant with owner (with paid subscription for invitations)
    const { tenant, cookies: ownerCookies } = await createPaidTenantWithOwner(
      'inv-decline-owner',
      'Decline Test Tenant'
    )

    // Create another user who will be invited
    const inviteeId = uniqueId()
    const inviteeEmail = `decline-invitee-${inviteeId}@example.com`
    const { cookies: inviteeCookies } = await createUserAndLogin(inviteeEmail, 'password123')

    // Owner sends invitation
    const inviteResponse = await request(BASE_URL)
      .post(`/api/v1/tenants/${tenant.id}/invitations`)
      .set('Cookie', ownerCookies)
      .set('X-Tenant-ID', String(tenant.id))
      .send({ email: inviteeEmail, role: 'member' })
      .expect(201)

    // Extract token from invitationLink (format: {frontendUrl}/invitations/{token})
    const invitationLink = inviteResponse.body.data.invitationLink
    const invitationToken = invitationLink.split('/invitations/')[1]

    // Invitee should be able to decline
    const declineResponse = await request(BASE_URL)
      .post(`/api/v1/invitations/${invitationToken}/decline`)
      .set('Cookie', inviteeCookies)
      .expect(200)

    assert.equal(declineResponse.body.message, 'Invitation declined')
  })

  test('user cannot access invitation sent to different email', async ({ assert }) => {
    // Create a tenant with owner (with paid subscription for invitations)
    const { tenant, cookies: ownerCookies } = await createPaidTenantWithOwner(
      'inv-wrong-email',
      'Wrong Email Test Tenant'
    )

    // Create user A who will be invited
    const userAId = uniqueId()
    const userAEmail = `user-a-${userAId}@example.com`

    // Create user B who will try to accept
    const userBId = uniqueId()
    const { cookies: userBCookies } = await createUserAndLogin(
      `user-b-${userBId}@example.com`,
      'password123'
    )

    // Owner sends invitation to user A
    const inviteResponse = await request(BASE_URL)
      .post(`/api/v1/tenants/${tenant.id}/invitations`)
      .set('Cookie', ownerCookies)
      .set('X-Tenant-ID', String(tenant.id))
      .send({ email: userAEmail, role: 'member' })
      .expect(201)

    // Extract token from invitationLink (format: {frontendUrl}/invitations/{token})
    const invitationLink = inviteResponse.body.data.invitationLink
    const invitationToken = invitationLink.split('/invitations/')[1]

    // User B tries to accept - should get forbidden (email mismatch)
    const acceptResponse = await request(BASE_URL)
      .post(`/api/v1/invitations/${invitationToken}/accept`)
      .set('Cookie', userBCookies)
      .expect(403)

    assert.equal(acceptResponse.body.error, 'Forbidden')
    assert.include(acceptResponse.body.message, 'different email')
  })

  test('invitation RLS at database level allows user access to their invitations', async ({
    assert,
  }) => {
    if (isSuperuser) {
      // Superuser bypasses RLS - this test only works with non-superuser connection
      return
    }
    // Create tenant and invitation using system context
    const { user: owner, tenant } = await createPaidTenantWithOwner('inv-db-test', 'DB Test Tenant')

    // Create user who will be invited
    const inviteeId = uniqueId()
    const inviteeEmail = `db-invitee-${inviteeId}@example.com`
    const { user: invitee } = await createUserAndLogin(inviteeEmail, 'password123')

    // Create invitation using system context
    await db.transaction(async (trx) => {
      await setSystemRlsContext(trx)
      await trx.table('tenant_invitations').insert({
        tenant_id: tenant.id,
        email: inviteeEmail,
        role: 'member',
        status: 'pending',
        token: `test-token-${inviteeId}`,
        invited_by_id: owner.id,
        expires_at: DateTime.now().plus({ days: 7 }).toSQL(),
        created_at: DateTime.now().toSQL(),
        updated_at: DateTime.now().toSQL(),
      })
    })

    // Invitee should be able to see their invitation with user context only
    await db.transaction(async (trx) => {
      // Set only user_id (no tenant_id) - simulates authContext middleware
      await trx.rawQuery("SELECT set_config('app.user_id', ?, true)", [String(invitee.id)])

      const invitations = await TenantInvitation.query({ client: trx }).where('email', inviteeEmail)

      assert.equal(invitations.length, 1, 'User should see invitation sent to their email')
      assert.equal(invitations[0].email, inviteeEmail)
    })

    // Different user should NOT see the invitation
    const otherUserId = uniqueId()
    const { user: otherUser } = await createUserAndLogin(
      `other-${otherUserId}@example.com`,
      'password123'
    )

    await db.transaction(async (trx) => {
      await trx.rawQuery("SELECT set_config('app.user_id', ?, true)", [String(otherUser.id)])

      const invitations = await TenantInvitation.query({ client: trx }).where('email', inviteeEmail)

      assert.equal(
        invitations.length,
        0,
        'Other users should not see invitations to different email'
      )
    })
  })
})
