import { BaseSeeder } from '@adonisjs/lucid/seeders'
import app from '@adonisjs/core/services/app'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Tenant from '#models/tenant'
import TenantMembership from '#models/tenant_membership'

interface SeedUser {
  email: string
  password: string
  fullName: string
  role: 'admin' | 'user' | 'guest'
}

export default class extends BaseSeeder {
  async run(): Promise<void> {
    // Skip in production
    if (app.inProduction) {
      console.log('Skipping default users seeder in production')
      return
    }

    const adminPassword = env.get('SEED_ADMIN_PASSWORD')
    const userPassword = env.get('SEED_USER_PASSWORD')

    if (!adminPassword || !userPassword) {
      console.log(
        'Skipping seeder: SEED_ADMIN_PASSWORD and SEED_USER_PASSWORD must be set in .env.local'
      )
      return
    }

    const defaultUsers: SeedUser[] = [
      {
        email: 'admin@sylti.eu',
        password: adminPassword,
        fullName: 'Admin',
        role: 'admin',
      },
      {
        email: 'syl@sylti.eu',
        password: userPassword,
        fullName: 'Syl',
        role: 'user',
      },
    ]

    // Wrap seeding in a transaction to ensure RLS context is transaction-local.
    // Using set_config(..., true) makes the setting local to the current transaction,
    // preventing RLS context from leaking to other operations on pooled connections.
    await db.transaction(async (trx) => {
      // Set system RLS context to bypass RLS (user_id=0 is the system bypass)
      // The 'true' parameter makes this transaction-local (resets when transaction ends)
      await trx.rawQuery("SELECT set_config('app.user_id', '0', true)")
      await trx.rawQuery("SELECT set_config('app.tenant_id', '0', true)")

      for (const userData of defaultUsers) {
        const existingUser = await User.query({ client: trx })
          .where('email', userData.email)
          .first()

        if (existingUser) {
          console.log(`User already exists: ${userData.email}`)
          // Check if user has a personal workspace
          await this.ensurePersonalWorkspace(existingUser, trx)
          continue
        }

        const user = new User()
        user.email = userData.email
        user.password = userData.password
        user.fullName = userData.fullName
        user.role = userData.role
        user.emailVerified = true
        user.useTransaction(trx)
        await user.save()

        console.log(`User created: ${userData.email} (${userData.role})`)

        // Create personal workspace for the user
        await this.createPersonalWorkspace(user, trx)
      }
    })
  }

  private async ensurePersonalWorkspace(
    user: User,
    trx: import('@adonisjs/lucid/types/database').TransactionClientContract
  ): Promise<void> {
    const slug = `personal-${user.email.split('@')[0].toLowerCase()}`
    console.log(`  Checking for existing workspace with slug: ${slug}`)

    const existingTenant = await Tenant.query({ client: trx }).where('slug', slug).first()

    if (existingTenant) {
      console.log(`  Workspace already exists for ${user.email} (tenant id=${existingTenant.id})`)

      // Ensure user has membership
      const membership = await TenantMembership.query({ client: trx })
        .where('userId', user.id)
        .where('tenantId', existingTenant.id)
        .first()

      if (!membership) {
        console.log(`  Creating missing membership for ${user.email}`)
        const newMembership = new TenantMembership()
        newMembership.userId = user.id
        newMembership.tenantId = existingTenant.id
        newMembership.role = 'owner'
        newMembership.useTransaction(trx)
        await newMembership.save()
      }

      // Ensure user has currentTenantId set
      if (!user.currentTenantId) {
        console.log(`  Setting currentTenantId for ${user.email}`)
        user.currentTenantId = existingTenant.id
        user.useTransaction(trx)
        await user.save()
      }
      return
    }

    console.log(`  No workspace found, creating one for ${user.email}`)
    await this.createPersonalWorkspace(user, trx)
  }

  private async createPersonalWorkspace(
    user: User,
    trx: import('@adonisjs/lucid/types/database').TransactionClientContract
  ): Promise<void> {
    const slug = `personal-${user.email.split('@')[0].toLowerCase()}`

    try {
      const tenant = new Tenant()
      tenant.name = `${user.fullName}'s Workspace`
      tenant.slug = slug
      tenant.type = 'personal'
      tenant.ownerId = user.id
      tenant.balance = 0
      tenant.useTransaction(trx)
      await tenant.save()

      console.log(`  Created tenant id=${tenant.id} for user id=${user.id}`)

      const membership = new TenantMembership()
      membership.userId = user.id
      membership.tenantId = tenant.id
      membership.role = 'owner'
      membership.useTransaction(trx)
      await membership.save()

      console.log(`  Created membership for user id=${user.id} in tenant id=${tenant.id}`)

      // Update user's current tenant
      user.currentTenantId = tenant.id
      user.useTransaction(trx)
      await user.save()

      console.log(`  Created workspace "${tenant.name}" for ${user.email}`)
    } catch (error) {
      console.error(`  ERROR creating workspace for ${user.email}:`, error)
      throw error
    }
  }
}
