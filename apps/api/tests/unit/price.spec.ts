import { test } from '@japa/runner'
import SubscriptionTier from '#models/subscription_tier'
import Product from '#models/product'
import Price from '#models/price'
import { truncateAllTables } from '../bootstrap.js'

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

test.group('Price Model', (group) => {
  let testProduct: Product

  group.each.setup(async () => {
    await truncateAllTables()

    const tier = await SubscriptionTier.findBySlugOrFail('tier1')
    testProduct = await Product.create({
      tierId: tier.id,
      provider: 'stripe',
      providerProductId: `prod_${uniqueId()}`,
    })
  })

  test('creates price for product', async ({ assert }) => {
    const price = await Price.create({
      productId: testProduct.id,
      provider: 'stripe',
      providerPriceId: `price_${uniqueId()}`,
      interval: 'month',
      currency: 'usd',
      unitAmount: 1999,
      taxBehavior: 'exclusive',
      isActive: true,
    })

    assert.exists(price.id)
    assert.equal(price.productId, testProduct.id)
    assert.equal(price.interval, 'month')
    assert.equal(price.currency, 'usd')
    assert.equal(price.unitAmount, 1999)
    assert.equal(price.taxBehavior, 'exclusive')
    assert.isTrue(price.isActive)
  })

  test('findByProviderPriceId returns price with product and tier', async ({ assert }) => {
    const providerPriceId = `price_${uniqueId()}`

    await Price.create({
      productId: testProduct.id,
      provider: 'stripe',
      providerPriceId,
      interval: 'month',
      currency: 'usd',
      unitAmount: 1999,
      taxBehavior: 'exclusive',
      isActive: true,
    })

    const price = await Price.findByProviderPriceId('stripe', providerPriceId)

    assert.isNotNull(price)
    assert.equal(price!.providerPriceId, providerPriceId)
    assert.isNotNull(price!.product)
    assert.isNotNull(price!.product.tier)
    assert.equal(price!.product.tier.slug, 'tier1')
  })

  test('findByProviderPriceId returns null for non-existent', async ({ assert }) => {
    const price = await Price.findByProviderPriceId('stripe', 'price_nonexistent')
    assert.isNull(price)
  })

  test('getActiveForProduct returns only active prices', async ({ assert }) => {
    await Price.create({
      productId: testProduct.id,
      provider: 'stripe',
      providerPriceId: `price_${uniqueId()}`,
      interval: 'month',
      currency: 'usd',
      unitAmount: 1999,
      taxBehavior: 'exclusive',
      isActive: true,
    })

    await Price.create({
      productId: testProduct.id,
      provider: 'stripe',
      providerPriceId: `price_${uniqueId()}`,
      interval: 'year',
      currency: 'usd',
      unitAmount: 19999,
      taxBehavior: 'exclusive',
      isActive: true,
    })

    await Price.create({
      productId: testProduct.id,
      provider: 'stripe',
      providerPriceId: `price_${uniqueId()}`,
      interval: 'month',
      currency: 'eur',
      unitAmount: 1899,
      taxBehavior: 'inclusive',
      isActive: false, // Inactive
    })

    const activePrices = await Price.getActiveForProduct(testProduct.id)

    assert.equal(activePrices.length, 2)
    activePrices.forEach((price) => {
      assert.isTrue(price.isActive)
    })
  })

  test('getActiveForProvider returns all active prices for provider', async ({ assert }) => {
    const tier2 = await SubscriptionTier.findBySlugOrFail('tier2')
    const product2 = await Product.create({
      tierId: tier2.id,
      provider: 'stripe',
      providerProductId: `prod_${uniqueId()}`,
    })

    await Price.create({
      productId: testProduct.id,
      provider: 'stripe',
      providerPriceId: `price_${uniqueId()}`,
      interval: 'month',
      currency: 'usd',
      unitAmount: 1999,
      taxBehavior: 'exclusive',
      isActive: true,
    })

    await Price.create({
      productId: product2.id,
      provider: 'stripe',
      providerPriceId: `price_${uniqueId()}`,
      interval: 'month',
      currency: 'usd',
      unitAmount: 4999,
      taxBehavior: 'exclusive',
      isActive: true,
    })

    const prices = await Price.getActiveForProvider('stripe')

    assert.equal(prices.length, 2)
    prices.forEach((price) => {
      assert.isNotNull(price.product)
      assert.isNotNull(price.product.tier)
    })
  })

  test('supports multiple currencies', async ({ assert }) => {
    await Price.create({
      productId: testProduct.id,
      provider: 'stripe',
      providerPriceId: `price_${uniqueId()}`,
      interval: 'month',
      currency: 'usd',
      unitAmount: 1999,
      taxBehavior: 'exclusive',
      isActive: true,
    })

    await Price.create({
      productId: testProduct.id,
      provider: 'stripe',
      providerPriceId: `price_${uniqueId()}`,
      interval: 'month',
      currency: 'eur',
      unitAmount: 1899,
      taxBehavior: 'inclusive',
      isActive: true,
    })

    const prices = await Price.getActiveForProduct(testProduct.id)

    assert.equal(prices.length, 2)

    const currencies = prices.map((p) => p.currency)
    assert.includeMembers(currencies, ['usd', 'eur'])
  })

  test('supports tax behaviors', async ({ assert }) => {
    const exclusivePrice = await Price.create({
      productId: testProduct.id,
      provider: 'stripe',
      providerPriceId: `price_${uniqueId()}`,
      interval: 'month',
      currency: 'usd',
      unitAmount: 1999,
      taxBehavior: 'exclusive',
      isActive: true,
    })

    const inclusivePrice = await Price.create({
      productId: testProduct.id,
      provider: 'stripe',
      providerPriceId: `price_${uniqueId()}`,
      interval: 'month',
      currency: 'eur',
      unitAmount: 1899,
      taxBehavior: 'inclusive',
      isActive: true,
    })

    assert.equal(exclusivePrice.taxBehavior, 'exclusive')
    assert.equal(inclusivePrice.taxBehavior, 'inclusive')
  })

  test('price links to product with all metadata', async ({ assert }) => {
    const price = await Price.create({
      productId: testProduct.id,
      provider: 'stripe',
      providerPriceId: `price_${uniqueId()}`,
      interval: 'year',
      currency: 'eur',
      unitAmount: 19999,
      taxBehavior: 'inclusive',
      isActive: true,
    })

    assert.equal(price.interval, 'year')
    assert.equal(price.currency, 'eur')
    assert.equal(price.unitAmount, 19999)
    assert.equal(price.taxBehavior, 'inclusive')
  })
})
