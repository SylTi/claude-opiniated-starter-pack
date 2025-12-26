import { test } from '@japa/runner'
import User from '#models/user'
import { truncateAllTables } from '../bootstrap.js'
import request from 'supertest'

/**
 * TESTS D'INTEGRATION - Base de donnees PostgreSQL LOCALE (Docker)
 *
 * IMPORTANT :
 * - Ces tests utilisent PostgreSQL local via Docker (port 5433)
 * - La base est nettoyee (truncate) avant chaque test
 * - Rollback automatique apres chaque test
 * - NE JAMAIS pointer vers Supabase cloud pour les tests
 *
 * Configuration requise:
 * - Docker doit etre demarre
 * - docker-compose up postgres-test
 * - Variables .env.test configurees avec DB locale
 *
 * NOTE: User creation and profile update operations are tested elsewhere:
 * - POST /auth/register (user creation) -> see tests/functional/auth.spec.ts
 * - PUT /auth/profile (profile update) -> see tests/functional/auth.spec.ts
 * - DELETE /admin/users/:id (admin deletion) -> see tests below
 */

const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

async function createAdminAndLogin(
  email: string,
  password: string
): Promise<{ user: User; cookies: string[] }> {
  const user = await User.create({
    email,
    password,
    fullName: 'Admin User',
    role: 'admin',
    emailVerified: true,
    mfaEnabled: false,
  })

  const response = await request(BASE_URL)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .set('Accept', 'application/json')

  if (response.status !== 200) {
    throw new Error(`Login failed: ${response.status}`)
  }

  const cookies = response.headers['set-cookie']
  return { user, cookies: Array.isArray(cookies) ? cookies : [] }
}

test.group('Users API (Integration - Local DB)', (group) => {
  group.each.setup(async () => {
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

test.group('Admin Users API (Integration - Local DB)', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('DELETE /api/v1/admin/users/:id deletes a user', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createAdminAndLogin(`admin-${id}@example.com`, 'password123')

    const userToDelete = await User.create({
      email: `delete-${id}@example.com`,
      password: 'password123',
      fullName: 'User To Delete',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const response = await request(BASE_URL)
      .delete(`/api/v1/admin/users/${userToDelete.id}`)
      .set('Cookie', cookies)
      .expect(200)

    assert.equal(response.body.message, 'User has been deleted successfully')

    const deletedUser = await User.find(userToDelete.id)
    assert.isNull(deletedUser, 'User should be deleted from database')
  })

  test('DELETE /api/v1/admin/users/:id returns 404 for non-existent user', async () => {
    const id = uniqueId()
    const { cookies } = await createAdminAndLogin(`admin-${id}@example.com`, 'password123')

    await request(BASE_URL).delete('/api/v1/admin/users/99999').set('Cookie', cookies).expect(404)
  })

  test('DELETE /api/v1/admin/users/:id prevents admin from deleting themselves', async ({
    assert,
  }) => {
    const id = uniqueId()
    const { user: admin, cookies } = await createAdminAndLogin(
      `admin-${id}@example.com`,
      'password123'
    )

    const response = await request(BASE_URL)
      .delete(`/api/v1/admin/users/${admin.id}`)
      .set('Cookie', cookies)
      .expect(400)

    assert.equal(response.body.error, 'ValidationError')
    assert.equal(response.body.message, 'You cannot delete your own account from admin panel')

    const stillExists = await User.find(admin.id)
    assert.isNotNull(stillExists, 'Admin user should still exist')
  })

  test('DELETE /api/v1/admin/users/:id requires authentication', async () => {
    await request(BASE_URL).delete('/api/v1/admin/users/1').expect(401)
  })

  test('DELETE /api/v1/admin/users/:id requires admin role', async ({ assert }) => {
    const id = uniqueId()

    // Create regular user for login (not used directly, but needed for authentication)
    await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      fullName: 'Regular User',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const loginResponse = await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({ email: `user-${id}@example.com`, password: 'password123' })
      .set('Accept', 'application/json')

    const cookies = loginResponse.headers['set-cookie']

    const otherUser = await User.create({
      email: `other-${id}@example.com`,
      password: 'password123',
      fullName: 'Other User',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await request(BASE_URL)
      .delete(`/api/v1/admin/users/${otherUser.id}`)
      .set('Cookie', cookies)
      .expect(403)

    const stillExists = await User.find(otherUser.id)
    assert.isNotNull(stillExists, 'User should not be deleted by non-admin')
  })
})
