import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'

/**
 * This file is imported by the "bin/test.ts" entrypoint file
 */

/**
 * Get admin database connection (superuser) for operations that need to bypass RLS.
 * Used for truncate, seed, and other admin operations in tests.
 */
function getAdminDb() {
  return db.connection('postgres')
}

/**
 * Seed base subscription tiers required by most tests.
 * Uses admin connection to bypass RLS.
 */
async function seedBaseTiers(): Promise<void> {
  const adminDb = getAdminDb()
  // Check if tiers already exist
  const existingTiers = await adminDb.from('subscription_tiers').select('slug')
  const existingSlugs = new Set(existingTiers.map((t) => t.slug))

  const now = new Date().toISOString()
  const baseTiers = [
    {
      slug: 'free',
      name: 'Free',
      level: 0,
      max_team_members: 5,
      price_monthly: 0,
      yearly_discount_percent: 0,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      slug: 'tier1',
      name: 'Tier 1',
      level: 1,
      max_team_members: 20,
      price_monthly: 999,
      yearly_discount_percent: 20,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      slug: 'tier2',
      name: 'Tier 2',
      level: 2,
      max_team_members: null,
      price_monthly: 2999,
      yearly_discount_percent: 20,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
  ]

  for (const tier of baseTiers) {
    if (!existingSlugs.has(tier.slug)) {
      // Use table insert instead of rawQuery to handle null values properly
      await adminDb.table('subscription_tiers').insert({
        slug: tier.slug,
        name: tier.name,
        level: tier.level,
        max_team_members: tier.max_team_members,
        price_monthly: tier.price_monthly,
        yearly_discount_percent: tier.yearly_discount_percent,
        is_active: tier.is_active,
        created_at: tier.created_at,
        updated_at: tier.updated_at,
      })
    }
  }
}

/**
 * Truncate all tables with CASCADE to handle foreign key constraints.
 * This is more reliable than the default truncate for tables with circular references.
 * Uses admin connection to bypass RLS.
 */
export async function truncateAllTables(): Promise<void> {
  const adminDb = getAdminDb()

  // Enterprise-only tables (may not exist on public repo)
  const enterpriseTables = ['sso_states', 'sso_user_identities', 'tenant_sso_configs']

  // Core tables (always exist)
  const coreTables = [
    'discount_code_usages',
    'discount_codes',
    'coupons',
    'processed_webhook_events',
    'prices',
    'products',
    'payment_customers',
    'subscriptions',
    'auth_tokens',
    'tenant_invitations',
    'tenant_memberships',
    'email_verification_tokens',
    'password_reset_tokens',
    'login_history',
    'oauth_accounts',
    'tenants',
    'users',
  ]

  // Truncate enterprise tables (silently skip if not exist)
  for (const table of enterpriseTables) {
    try {
      await adminDb.rawQuery(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`)
    } catch {
      // Table doesn't exist on public repo - skip silently
    }
  }

  // Truncate core tables
  for (const table of coreTables) {
    await adminDb.rawQuery(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`)
  }

  // Re-seed base tiers after truncation
  await seedBaseTiers()
}

/**
 * Configure Japa plugins in the plugins array.
 * Learn more - https://japa.dev/docs/runner-config#plugins-optional
 */
export const plugins: Config['plugins'] = [assert(), apiClient(), pluginAdonisJS(app)]

/**
 * Configure lifecycle function to run before and after all the
 * tests.
 *
 * The setup functions are executed before all the tests
 * The teardown functions are executed after all the tests
 */
export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [
    async () => {
      // Truncate all tables at the start of the test run to ensure clean state
      await truncateAllTables()
    },
  ],
  teardown: [],
}

/**
 * Configure suites by tapping into the test suite instance.
 * Learn more - https://japa.dev/docs/test-suites#lifecycle-hooks
 */
export const configureSuite: Config['configureSuite'] = (suite) => {
  if (['browser', 'functional', 'e2e'].includes(suite.name)) {
    return suite.setup(() => testUtils.httpServer().start())
  }
}
