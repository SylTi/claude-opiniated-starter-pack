import { test } from '@japa/runner'
import SubscriptionTier from '#models/subscription_tier'
import Product from '#models/product'
import Price from '#models/price'
import { truncateAllTables } from '../bootstrap.js'

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

test.group('Product Model', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('creates product linked to tier', async ({ assert }) => {
    const tier = await SubscriptionTier.findBySlugOrFail('tier1')

    const product = await Product.create({
      tierId: tier.id,
      provider: 'stripe',
      providerProductId: `prod_${uniqueId()}`,
    })

    assert.exists(product.id)
    assert.equal(product.tierId, tier.id)
    assert.equal(product.provider, 'stripe')
  })

  test('findByTierAndProvider returns product', async ({ assert }) => {
    const tier = await SubscriptionTier.findBySlugOrFail('tier1')

    await Product.create({
      tierId: tier.id,
      provider: 'stripe',
      providerProductId: `prod_${uniqueId()}`,
    })

    const product = await Product.findByTierAndProvider(tier.id, 'stripe')
    assert.isNotNull(product)
    assert.equal(product!.tierId, tier.id)
  })

  test('findByTierAndProvider returns null for non-existent', async ({ assert }) => {
    const product = await Product.findByTierAndProvider(999, 'stripe')
    assert.isNull(product)
  })

  test('findByProviderProductId returns product', async ({ assert }) => {
    const tier = await SubscriptionTier.findBySlugOrFail('tier1')
    const providerProductId = `prod_${uniqueId()}`

    await Product.create({
      tierId: tier.id,
      provider: 'stripe',
      providerProductId,
    })

    const product = await Product.findByProviderProductId('stripe', providerProductId)
    assert.isNotNull(product)
    assert.equal(product!.providerProductId, providerProductId)
  })

  test('getProductsWithPrices returns products with tier and prices', async ({ assert }) => {
    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    const tier2 = await SubscriptionTier.findBySlugOrFail('tier2')

    const product1 = await Product.create({
      tierId: tier1.id,
      provider: 'stripe',
      providerProductId: `prod_${uniqueId()}`,
    })

    const product2 = await Product.create({
      tierId: tier2.id,
      provider: 'stripe',
      providerProductId: `prod_${uniqueId()}`,
    })

    await Price.create({
      productId: product1.id,
      provider: 'stripe',
      providerPriceId: `price_${uniqueId()}`,
      interval: 'month',
      currency: 'usd',
      unitAmount: 1000,
      taxBehavior: 'exclusive',
      isActive: true,
    })

    await Price.create({
      productId: product2.id,
      provider: 'stripe',
      providerPriceId: `price_${uniqueId()}`,
      interval: 'year',
      currency: 'usd',
      unitAmount: 10000,
      taxBehavior: 'exclusive',
      isActive: true,
    })

    const products = await Product.getProductsWithPrices('stripe')

    assert.equal(products.length, 2)
    assert.isNotNull(products[0].tier)
    assert.isArray(products[0].prices)
    assert.isNotEmpty(products[0].prices)
  })

  test('preloads tier relationship', async ({ assert }) => {
    const tier = await SubscriptionTier.findBySlugOrFail('tier1')

    const product = await Product.create({
      tierId: tier.id,
      provider: 'stripe',
      providerProductId: `prod_${uniqueId()}`,
    })

    await product.load('tier')

    assert.equal(product.tier.slug, 'tier1')
    assert.equal(product.tier.name, tier.name)
  })
})
