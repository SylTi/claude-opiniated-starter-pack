import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Tenant from '#models/tenant'
import TenantMembership from '#models/tenant_membership'
import SubscriptionTier from '#models/subscription_tier'
import Subscription from '#models/subscription'
import Product from '#models/product'
import Price, { type PriceInterval } from '#models/price'
import Coupon from '#models/coupon'
import DiscountCode from '#models/discount_code'
import { getMainAppPluginId } from '@saas/config/plugins/server'

export default class extends BaseSeeder {
  async run(): Promise<void> {
    // Skip in production
    if (app.inProduction) {
      console.log('Skipping test data seeder in production')
      return
    }

    // Set system RLS context to bypass RLS (user_id=0 is the system bypass)
    // This is necessary because seeders are admin operations that need to create
    // data across multiple tenants without RLS restrictions
    await db.rawQuery("SELECT set_config('app.user_id', '0', false)")
    await db.rawQuery("SELECT set_config('app.tenant_id', '0', false)")

    console.log('Seeding test data...')

    // Create subscription tiers
    await this.seedSubscriptionTiers()

    // Create products and prices
    await this.seedProductsAndPrices()

    // Create test users with personal tenants
    const users = await this.seedUsers()

    // Create team tenants
    await this.seedTenants(users)

    // Create coupons
    await this.seedCoupons()

    // Create discount codes
    await this.seedDiscountCodes()

    // Seed enterprise-only test data (vaults, audit, DLP, etc.)
    try {
      // @ts-ignore - Enterprise feature: module may not exist on public repo
      const { seedEnterpriseData } = await import('./test_data_seeder_enterprise.js')
      await seedEnterpriseData(users)
    } catch {
      // Enterprise seeder not available
    }

    // Enable plugins for tenants
    await this.seedPluginStates()

    console.log('Test data seeding complete!')
  }

  private async seedSubscriptionTiers(): Promise<void> {
    const tiers = [
      {
        slug: 'free',
        name: 'Free',
        level: 0,
        maxTeamMembers: 1,
        priceMonthly: 0,
        yearlyDiscountPercent: 0,
        features: { storage: '1GB', support: 'community' },
        isActive: true,
      },
      {
        slug: 'tier1',
        name: 'Pro',
        level: 1,
        maxTeamMembers: 5,
        priceMonthly: 999,
        yearlyDiscountPercent: 20,
        features: { storage: '10GB', support: 'email', analytics: true },
        isActive: true,
      },
      {
        slug: 'tier2',
        name: 'Enterprise',
        level: 2,
        maxTeamMembers: 50,
        priceMonthly: 4999,
        yearlyDiscountPercent: 25,
        features: { storage: '100GB', support: 'priority', analytics: true, sso: true },
        isActive: true,
      },
    ]

    for (const tierData of tiers) {
      const existing = await SubscriptionTier.findBySlug(tierData.slug)
      if (existing) {
        console.log(`  Tier already exists: ${tierData.slug}`)
        continue
      }
      await SubscriptionTier.create(tierData)
      console.log(`  Created tier: ${tierData.slug}`)
    }
  }

  private async seedUsers(): Promise<Record<string, User>> {
    const testUsers = [
      {
        key: 'freeUser',
        email: 'free@test.com',
        password: 'password123',
        fullName: 'Free User',
        role: 'user' as const,
        emailVerified: true,
        tier: 'free',
      },
      {
        key: 'proUser',
        email: 'pro@test.com',
        password: 'password123',
        fullName: 'Pro User',
        role: 'user' as const,
        emailVerified: true,
        tier: 'tier1',
      },
      {
        key: 'enterpriseUser',
        email: 'enterprise@test.com',
        password: 'password123',
        fullName: 'Enterprise User',
        role: 'user' as const,
        emailVerified: true,
        tier: 'tier2',
      },
      {
        key: 'adminUser',
        email: 'admin@test.com',
        password: 'password123',
        fullName: 'Admin User',
        role: 'admin' as const,
        emailVerified: true,
        tier: 'tier2',
      },
      {
        key: 'tenantOwner',
        email: 'owner@test.com',
        password: 'password123',
        fullName: 'Tenant Owner',
        role: 'user' as const,
        emailVerified: true,
      },
      {
        key: 'tenantMember',
        email: 'member@test.com',
        password: 'password123',
        fullName: 'Tenant Member',
        role: 'user' as const,
        emailVerified: true,
      },
      {
        key: 'unverified',
        email: 'unverified@test.com',
        password: 'password123',
        fullName: 'Unverified User',
        role: 'user' as const,
        emailVerified: false,
      },
    ]

    const users: Record<string, User> = {}

    for (const userData of testUsers) {
      const existing = await User.findBy('email', userData.email)
      if (existing) {
        console.log(`  User already exists: ${userData.email}`)
        users[userData.key] = existing
        continue
      }

      const user = await User.create({
        email: userData.email,
        password: userData.password,
        fullName: userData.fullName,
        role: userData.role,
        emailVerified: userData.emailVerified,
      })

      // Create personal tenant for each user (tenant is the billing unit)
      const personalTenant = await Tenant.create({
        name: `${userData.fullName}'s Workspace`,
        slug: `personal-${userData.key}`,
        type: 'personal',
        ownerId: user.id,
        balance: userData.key === 'tenantOwner' ? 5000 : 0,
        balanceCurrency: 'usd',
      })

      // Create owner membership
      await TenantMembership.create({
        userId: user.id,
        tenantId: personalTenant.id,
        role: 'owner',
      })

      // Set current tenant
      user.currentTenantId = personalTenant.id
      await user.save()

      // Create subscription for the tenant if tier specified
      if (userData.tier) {
        const tier = await SubscriptionTier.findBySlug(userData.tier)
        if (tier) {
          await Subscription.create({
            tenantId: personalTenant.id,
            tierId: tier.id,
            status: 'active',
            startsAt: DateTime.now(),
            expiresAt: userData.tier === 'free' ? null : DateTime.now().plus({ years: 1 }),
          })
        }
      }

      users[userData.key] = user
      console.log(`  Created user: ${userData.email} with personal tenant`)
    }

    return users
  }

  private async seedProductsAndPrices(): Promise<void> {
    // Read provider from env (default: stripe)
    const provider = (process.env.PAYMENT_PROVIDER ?? 'stripe') as string
    const isMoR = provider === 'paddle' || provider === 'lemonsqueezy' || provider === 'polar'
    const taxBehavior = isMoR ? 'inclusive' : 'exclusive'

    // Provider-prefixed test IDs
    const prefixMap: Record<string, string> = {
      stripe: '',
      paddle: 'pdl_',
      lemonsqueezy: 'ls_',
      polar: 'pol_',
    }
    const prefix = prefixMap[provider] ?? ''

    const tierConfigs: Array<{
      slug: string
      providerProductId: string
      prices: Array<{ providerPriceId: string; interval: PriceInterval; unitAmount: number }>
    }> = [
      {
        slug: 'tier1',
        providerProductId: `${prefix}prod_test_tier1`,
        prices: [
          {
            providerPriceId: `${prefix}price_test_tier1_month`,
            interval: 'month',
            unitAmount: 1999,
          },
          {
            providerPriceId: `${prefix}price_test_tier1_year`,
            interval: 'year',
            unitAmount: 19990,
          },
        ],
      },
      {
        slug: 'tier2',
        providerProductId: `${prefix}prod_test_tier2`,
        prices: [
          {
            providerPriceId: `${prefix}price_test_tier2_month`,
            interval: 'month',
            unitAmount: 4999,
          },
          {
            providerPriceId: `${prefix}price_test_tier2_year`,
            interval: 'year',
            unitAmount: 49990,
          },
        ],
      },
    ]

    for (const config of tierConfigs) {
      const tier = await SubscriptionTier.findBySlug(config.slug)
      if (!tier) {
        console.log(`  Tier not found for product seed: ${config.slug}`)
        continue
      }

      let product = await Product.findByTierAndProvider(tier.id, provider)
      if (!product) {
        product = await Product.create({
          tierId: tier.id,
          provider,
          providerProductId: config.providerProductId,
        })
        console.log(`  Created product for tier: ${config.slug} (provider: ${provider})`)
      }

      const existingPrices = await Price.query()
        .where('productId', product.id)
        .where('provider', provider)

      if (existingPrices.length > 0) {
        continue
      }

      for (const price of config.prices) {
        await Price.create({
          productId: product.id,
          provider,
          providerPriceId: price.providerPriceId,
          interval: price.interval,
          currency: 'usd',
          unitAmount: price.unitAmount,
          taxBehavior: taxBehavior as 'inclusive' | 'exclusive',
          isActive: true,
        })
      }
      console.log(`  Created prices for tier: ${config.slug} (provider: ${provider})`)
    }
  }

  private async seedTenants(users: Record<string, User>): Promise<void> {
    const owner = users['tenantOwner']
    const member = users['tenantMember']

    if (!owner || !member) {
      console.log('  Skipping team tenant creation - required users not found')
      return
    }

    // Check if tenant already exists
    const existingTenant = await Tenant.findBy('slug', 'test-team')
    if (existingTenant) {
      console.log('  Tenant already exists: test-team')
      return
    }

    // Create team tenant
    const tenant = await Tenant.create({
      name: 'Test Team',
      slug: 'test-team',
      type: 'team',
      ownerId: owner.id,
      balance: 10000,
      balanceCurrency: 'usd',
    })

    // Add owner as member
    await TenantMembership.create({
      userId: owner.id,
      tenantId: tenant.id,
      role: 'owner',
    })

    // Add member
    await TenantMembership.create({
      userId: member.id,
      tenantId: tenant.id,
      role: 'member',
    })

    // Update current tenant for users
    owner.currentTenantId = tenant.id
    await owner.save()
    member.currentTenantId = tenant.id
    await member.save()

    // Create tenant subscription
    const tier = await SubscriptionTier.findBySlug('tier1')
    if (tier) {
      await Subscription.create({
        tenantId: tenant.id,
        tierId: tier.id,
        status: 'active',
        startsAt: DateTime.now(),
        expiresAt: DateTime.now().plus({ years: 1 }),
      })
    }

    console.log(`  Created team tenant: ${tenant.name} with 2 members`)
  }

  private async seedCoupons(): Promise<void> {
    const coupons = [
      {
        code: 'WELCOME50',
        description: 'Welcome bonus - $50 credit',
        creditAmount: 5000,
        currency: 'usd',
        expiresAt: DateTime.now().plus({ months: 6 }),
        isActive: true,
      },
      {
        code: 'TESTCREDIT',
        description: 'Test coupon - $10 credit',
        creditAmount: 1000,
        currency: 'usd',
        expiresAt: DateTime.now().plus({ days: 30 }),
        isActive: true,
      },
      {
        code: 'EXPIRED',
        description: 'Expired coupon',
        creditAmount: 500,
        currency: 'usd',
        expiresAt: DateTime.now().minus({ days: 1 }),
        isActive: true,
      },
      {
        code: 'INACTIVE',
        description: 'Inactive coupon',
        creditAmount: 500,
        currency: 'usd',
        expiresAt: DateTime.now().plus({ months: 1 }),
        isActive: false,
      },
    ]

    for (const couponData of coupons) {
      const existing = await Coupon.findByCode(couponData.code)
      if (existing) {
        console.log(`  Coupon already exists: ${couponData.code}`)
        continue
      }
      await Coupon.create(couponData)
      console.log(`  Created coupon: ${couponData.code}`)
    }
  }

  private async seedDiscountCodes(): Promise<void> {
    const discountCodes = [
      {
        code: 'SAVE20',
        description: '20% off your purchase',
        discountType: 'percent' as const,
        discountValue: 20,
        maxUses: 100,
        maxUsesPerTenant: 1,
        expiresAt: DateTime.now().plus({ months: 3 }),
        isActive: true,
      },
      {
        code: 'FLAT10',
        description: '$10 off',
        discountType: 'fixed' as const,
        discountValue: 1000,
        currency: 'usd',
        minAmount: 2000,
        maxUses: 50,
        maxUsesPerTenant: 1,
        expiresAt: DateTime.now().plus({ months: 1 }),
        isActive: true,
      },
      {
        code: 'UNLIMITED',
        description: '10% off - unlimited uses',
        discountType: 'percent' as const,
        discountValue: 10,
        maxUses: null,
        maxUsesPerTenant: null,
        expiresAt: null,
        isActive: true,
      },
    ]

    for (const codeData of discountCodes) {
      const existing = await DiscountCode.findByCode(codeData.code)
      if (existing) {
        console.log(`  Discount code already exists: ${codeData.code}`)
        continue
      }
      await DiscountCode.create(codeData)
      console.log(`  Created discount code: ${codeData.code}`)
    }
  }

  private async seedPluginStates(): Promise<void> {
    console.log('Seeding plugin states...')

    // Get all tenants to enable plugins for
    const tenants = await Tenant.all()

    // Plugins to enable for all tenants
    const pluginsToEnable = [getMainAppPluginId(), 'notes']

    for (const tenant of tenants) {
      for (const pluginId of pluginsToEnable) {
        // Use raw upsert to avoid any model issues
        await db.rawQuery(
          `
          INSERT INTO plugin_states (tenant_id, plugin_id, version, enabled, config, installed_at, updated_at)
          VALUES (?, ?, '1.0.0', true, '{}', NOW(), NOW())
          ON CONFLICT (tenant_id, plugin_id)
          DO UPDATE SET enabled = true, updated_at = NOW()
          `,
          [tenant.id, pluginId]
        )
        console.log(`  Enabled plugin ${pluginId} for tenant: ${tenant.slug}`)
      }
    }

    // Seed plugin_db_state for plugins with migrations so boot-time
    // schema checks pass (the migration rows are lost on DB reset)
    const pluginSchemaVersions = [
      { pluginId: 'notes', schemaVersion: 1 },
      { pluginId: 'analytics', schemaVersion: 1 },
    ]

    for (const { pluginId, schemaVersion } of pluginSchemaVersions) {
      await db.rawQuery(
        `
        INSERT INTO plugin_db_state (plugin_id, schema_version, updated_at)
        VALUES (?, ?, NOW())
        ON CONFLICT (plugin_id)
        DO UPDATE SET schema_version = ?, updated_at = NOW()
        `,
        [pluginId, schemaVersion, schemaVersion]
      )
    }
    console.log('  Plugin schema versions seeded')
  }
}
