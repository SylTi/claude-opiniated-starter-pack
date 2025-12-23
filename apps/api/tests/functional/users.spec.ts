import { test } from '@japa/runner'
import User from '#models/user'
import { truncateAllTables } from '../bootstrap.js'

/**
 * TESTS D'INTÉGRATION - Base de données PostgreSQL LOCALE (Docker)
 *
 * ⚠️ IMPORTANT :
 * - Ces tests utilisent PostgreSQL local via Docker (port 5433)
 * - La base est nettoyée (truncate) avant chaque test
 * - Rollback automatique après chaque test
 * - NE JAMAIS pointer vers Supabase cloud pour les tests
 *
 * Configuration requise:
 * - Docker doit être démarré
 * - docker-compose up postgres-test
 * - Variables .env.test configurées avec DB locale
 */

test.group('Users API (Integration - Local DB)', (group) => {
  group.each.setup(async () => {
    // Nettoie toutes les tables avant chaque test
    await truncateAllTables()
  })

  test('GET /api/v1/users returns list of users', async ({ client, assert }) => {
    await User.createMany([
      {
        email: 'user1@example.com',
        password: 'password123',
        fullName: 'User One',
      },
      {
        email: 'user2@example.com',
        password: 'password123',
        fullName: 'User Two',
      },
    ])

    const response = await client.get('/api/v1/users')

    response.assertStatus(200)
    response.assertBodyContains({
      data: [
        { email: 'user1@example.com', fullName: 'User One' },
        { email: 'user2@example.com', fullName: 'User Two' },
      ],
    })

    const body = response.body()
    assert.equal(body.data.length, 2)
    assert.isUndefined(body.data[0].password, 'Password should not be serialized')
  })

  test('GET /api/v1/users/:id returns single user', async ({ client, assert }) => {
    const user = await User.create({
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Test User',
    })

    const response = await client.get(`/api/v1/users/${user.id}`)

    response.assertStatus(200)
    response.assertBodyContains({
      data: {
        id: user.id,
        email: 'test@example.com',
        fullName: 'Test User',
      },
    })

    const body = response.body()
    assert.isUndefined(body.data.password, 'Password should not be serialized')
  })

  test('GET /api/v1/users/:id returns 404 for non-existent user', async ({ client }) => {
    const response = await client.get('/api/v1/users/99999')

    response.assertStatus(404)
  })

  test('GET /api/v1/users returns empty array when no users exist', async ({ client, assert }) => {
    const response = await client.get('/api/v1/users')

    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.data.length, 0)
  })
})
