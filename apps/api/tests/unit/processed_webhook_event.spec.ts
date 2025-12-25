import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import ProcessedWebhookEvent from '#models/processed_webhook_event'
import { truncateAllTables } from '../bootstrap.js'

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

test.group('ProcessedWebhookEvent Model', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('hasBeenProcessed returns false for new event', async ({ assert }) => {
    const result = await ProcessedWebhookEvent.hasBeenProcessed('evt_new', 'stripe')
    assert.isFalse(result)
  })

  test('markAsProcessed creates event record', async ({ assert }) => {
    const eventId = `evt_${uniqueId()}`

    const event = await ProcessedWebhookEvent.markAsProcessed(
      eventId,
      'stripe',
      'checkout.session.completed'
    )

    assert.exists(event.id)
    assert.equal(event.eventId, eventId)
    assert.equal(event.provider, 'stripe')
    assert.equal(event.eventType, 'checkout.session.completed')
    assert.isNotNull(event.processedAt)
  })

  test('hasBeenProcessed returns true after marking', async ({ assert }) => {
    const eventId = `evt_${uniqueId()}`

    await ProcessedWebhookEvent.markAsProcessed(eventId, 'stripe')

    const result = await ProcessedWebhookEvent.hasBeenProcessed(eventId, 'stripe')
    assert.isTrue(result)
  })

  test('same event ID different provider not considered processed', async ({ assert }) => {
    const eventId = `evt_${uniqueId()}`

    await ProcessedWebhookEvent.markAsProcessed(eventId, 'stripe')

    const result = await ProcessedWebhookEvent.hasBeenProcessed(eventId, 'paypal')
    assert.isFalse(result)
  })

  test('markAsProcessed works without eventType', async ({ assert }) => {
    const eventId = `evt_${uniqueId()}`

    const event = await ProcessedWebhookEvent.markAsProcessed(eventId, 'stripe')

    assert.equal(event.eventId, eventId)
    assert.isNull(event.eventType)
  })

  test('cleanupOldEvents removes old events', async ({ assert }) => {
    // Create an old event (35 days ago)
    const oldEventId = `evt_old_${uniqueId()}`
    await ProcessedWebhookEvent.create({
      eventId: oldEventId,
      provider: 'stripe',
      eventType: 'old.event',
      processedAt: DateTime.now().minus({ days: 35 }),
    })

    // Create a recent event
    const recentEventId = `evt_recent_${uniqueId()}`
    await ProcessedWebhookEvent.create({
      eventId: recentEventId,
      provider: 'stripe',
      eventType: 'recent.event',
      processedAt: DateTime.now().minus({ days: 5 }),
    })

    // Cleanup events older than 30 days
    const deleted = await ProcessedWebhookEvent.cleanupOldEvents(30)

    assert.equal(deleted, 1)

    // Old event should be gone
    const oldExists = await ProcessedWebhookEvent.hasBeenProcessed(oldEventId, 'stripe')
    assert.isFalse(oldExists)

    // Recent event should still exist
    const recentExists = await ProcessedWebhookEvent.hasBeenProcessed(recentEventId, 'stripe')
    assert.isTrue(recentExists)
  })

  test('multiple events can be processed', async ({ assert }) => {
    const events = [
      { id: `evt_${uniqueId()}`, type: 'checkout.session.completed' },
      { id: `evt_${uniqueId()}`, type: 'customer.subscription.updated' },
      { id: `evt_${uniqueId()}`, type: 'invoice.payment_succeeded' },
    ]

    for (const evt of events) {
      await ProcessedWebhookEvent.markAsProcessed(evt.id, 'stripe', evt.type)
    }

    const allProcessed = await Promise.all(
      events.map((evt) => ProcessedWebhookEvent.hasBeenProcessed(evt.id, 'stripe'))
    )

    allProcessed.forEach((processed) => {
      assert.isTrue(processed)
    })
  })
})
