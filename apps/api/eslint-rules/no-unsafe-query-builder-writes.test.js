/**
 * Unit tests for the no-unsafe-query-builder-writes ESLint rule.
 *
 * Run with: node --experimental-vm-modules node_modules/.bin/jest eslint-rules/
 * Or: node eslint-rules/no-unsafe-query-builder-writes.test.js
 */

import { RuleTester } from 'eslint'
import rule from './no-unsafe-query-builder-writes.js'

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
})

ruleTester.run('no-unsafe-query-builder-writes', rule, {
  valid: [
    // With explicit client in query()
    {
      code: `User.query({ client: trx }).update({ name: 'test' })`,
    },
    {
      code: `User.query({ client: ctx.tenantDb }).delete()`,
    },
    {
      code: `Model.query({ client: trx }).where('id', 1).update({ status: 'active' })`,
    },
    {
      code: `Subscription.query({ client: trx }).where('tenantId', id).delete()`,
    },

    // Chained with client
    {
      code: `User.query({ client: trx }).where('email', email).join('profiles', 'users.id', 'profiles.user_id').update({ verified: true })`,
    },
    {
      code: `Order.query({ client: ctx.authDb }).where('status', 'pending').whereNotNull('paid_at').delete()`,
    },

    // Not a Model query (lowercase, likely a transaction or knex query)
    {
      code: `trx.query().update({ name: 'test' })`,
    },
    {
      code: `db.from('users').where('id', 1).delete()`,
    },
    {
      code: `knex('users').update({ active: false })`,
    },

    // Instance methods (not query builder)
    {
      code: `user.delete()`,
    },
    {
      code: `subscription.save()`,
    },

    // Array methods (not query builder)
    {
      code: `items.filter(x => x.active).map(x => x.delete())`,
    },

    // Other patterns that shouldn't trigger
    {
      code: `const result = await User.query().first()`,
    },
    {
      code: `User.query().where('id', 1).first()`,
    },
    {
      code: `Model.query().fetch()`,
    },
  ],

  invalid: [
    // Basic cases without client
    {
      code: `User.query().update({ name: 'test' })`,
      errors: [{ messageId: 'missingClient', data: { method: 'update' } }],
    },
    {
      code: `User.query().delete()`,
      errors: [{ messageId: 'missingClient', data: { method: 'delete' } }],
    },

    // With where clause
    {
      code: `User.query().where('id', 1).update({ status: 'inactive' })`,
      errors: [{ messageId: 'missingClient', data: { method: 'update' } }],
    },
    {
      code: `Subscription.query().where('tenantId', tenantId).delete()`,
      errors: [{ messageId: 'missingClient', data: { method: 'delete' } }],
    },

    // Chained queries
    {
      code: `User.query().where('email', email).where('active', true).update({ lastLogin: new Date() })`,
      errors: [{ messageId: 'missingClient', data: { method: 'update' } }],
    },
    {
      code: `Order.query().where('status', 'cancelled').whereNull('refunded_at').delete()`,
      errors: [{ messageId: 'missingClient', data: { method: 'delete' } }],
    },

    // With joins
    {
      code: `User.query().join('profiles', 'users.id', 'profiles.user_id').where('profiles.verified', false).update({ active: false })`,
      errors: [{ messageId: 'missingClient', data: { method: 'update' } }],
    },

    // With preload
    {
      code: `Tenant.query().preload('memberships').where('id', id).delete()`,
      errors: [{ messageId: 'missingClient', data: { method: 'delete' } }],
    },

    // With orderBy, limit
    {
      code: `AuditLog.query().where('createdAt', '<', cutoff).orderBy('createdAt').limit(1000).delete()`,
      errors: [{ messageId: 'missingClient', data: { method: 'delete' } }],
    },

    // Await patterns
    {
      code: `await User.query().where('currentTenantId', tenantId).update({ currentTenantId: null })`,
      errors: [{ messageId: 'missingClient', data: { method: 'update' } }],
    },

    // Inside async function
    {
      code: `
        async function cleanup() {
          await OldToken.query().where('expiresAt', '<', Date.now()).delete()
        }
      `,
      errors: [{ messageId: 'missingClient', data: { method: 'delete' } }],
    },

    // Multiple Models (each should trigger separately)
    {
      code: `
        User.query().where('inactive', true).delete()
        Subscription.query().where('expired', true).delete()
      `,
      errors: [
        { messageId: 'missingClient', data: { method: 'delete' } },
        { messageId: 'missingClient', data: { method: 'delete' } },
      ],
    },

    // Various Model names (PascalCase)
    {
      code: `PasswordResetToken.query().where('token', hashedToken).delete()`,
      errors: [{ messageId: 'missingClient', data: { method: 'delete' } }],
    },
    {
      code: `EmailVerificationToken.query().where('userId', userId).delete()`,
      errors: [{ messageId: 'missingClient', data: { method: 'delete' } }],
    },
    {
      code: `TenantMembership.query().where('tenantId', id).update({ role: 'member' })`,
      errors: [{ messageId: 'missingClient', data: { method: 'update' } }],
    },
  ],
})

console.log('All ESLint rule tests passed!')
