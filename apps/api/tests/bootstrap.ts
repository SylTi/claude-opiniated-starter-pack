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
 * Truncate all tables with CASCADE to handle foreign key constraints.
 * This is more reliable than the default truncate for tables with circular references.
 */
export async function truncateAllTables(): Promise<void> {
  const tables = [
    'processed_webhook_events',
    'prices',
    'products',
    'payment_customers',
    'subscriptions',
    'team_invitations',
    'team_members',
    'email_verification_tokens',
    'password_reset_tokens',
    'login_history',
    'oauth_accounts',
    'teams',
    'users',
  ]

  // Use TRUNCATE with CASCADE to handle foreign key constraints
  for (const table of tables) {
    await db.rawQuery(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`)
  }
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
