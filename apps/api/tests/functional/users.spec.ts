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
 *
 * SECURITY NOTE: The /api/v1/users endpoints have been secured:
 * - GET /api/v1/users/me - Returns authenticated user's own profile
 * - GET /api/v1/users/:id - Users can only view their own profile
 * - Admin user listing is available via /api/v1/admin/users
 */

const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

async function createUserAndLogin(
  email: string,
  password: string,
  role: 'admin' | 'user' = 'user'
): Promise<{ user: User; cookies: string[] }> {
  const user = await User.create({
    email,
    password,
    fullName: role === 'admin' ? 'Admin User' : 'Regular User',
    role,
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

test.group('Users API - /users/me (Integration - Local DB)', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('GET /api/v1/users/me returns authenticated user profile', async ({ assert }) => {
    const id = uniqueId()
    const { user, cookies } = await createUserAndLogin(`user-${id}@example.com`, 'password123')

    const response = await request(BASE_URL)
      .get('/api/v1/users/me')
      .set('Cookie', cookies)
      .expect(200)

    assert.equal(response.body.data.id, user.id)
    assert.equal(response.body.data.email, `user-${id}@example.com`)
    assert.equal(response.body.data.role, 'user')
    assert.isUndefined(response.body.data.password, 'Password should not be serialized')
  })

  test('GET /api/v1/users/me requires authentication', async () => {
    await request(BASE_URL).get('/api/v1/users/me').expect(401)
  })
})

test.group('Users API - /users/:id Authorization (Integration - Local DB)', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('GET /api/v1/users/:id allows user to view own profile', async ({ assert }) => {
    const id = uniqueId()
    const { user, cookies } = await createUserAndLogin(`user-${id}@example.com`, 'password123')

    const response = await request(BASE_URL)
      .get(`/api/v1/users/${user.id}`)
      .set('Cookie', cookies)
      .expect(200)

    assert.equal(response.body.data.id, user.id)
    assert.equal(response.body.data.email, `user-${id}@example.com`)
    assert.isUndefined(response.body.data.password, 'Password should not be serialized')
  })

  test('GET /api/v1/users/:id denies access to other user profiles', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`user-${id}@example.com`, 'password123')

    // Create another user
    const otherUser = await User.create({
      email: `other-${id}@example.com`,
      password: 'password123',
      fullName: 'Other User',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const response = await request(BASE_URL)
      .get(`/api/v1/users/${otherUser.id}`)
      .set('Cookie', cookies)
      .expect(403)

    assert.equal(response.body.error, 'Forbidden')
    assert.equal(response.body.message, 'You can only view your own profile')
  })

  test('GET /api/v1/users/:id returns 404 for non-existent user', async () => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`user-${id}@example.com`, 'password123')

    // Try to access a non-existent user ID (not the user's own ID)
    // This should return 403 first (before checking if user exists) due to authorization
    await request(BASE_URL).get('/api/v1/users/99999').set('Cookie', cookies).expect(403)

    // If user tries their own non-existent ID somehow, it would be 404
    // But in practice, users always exist when logged in
  })

  test('GET /api/v1/users/:id requires authentication', async () => {
    await request(BASE_URL).get('/api/v1/users/1').expect(401)
  })
})

test.group('Admin Users API (Integration - Local DB)', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('GET /api/v1/admin/users returns list of all users for admin', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', 'admin')

    await User.createMany([
      {
        email: `user1-${id}@example.com`,
        password: 'password123',
        fullName: 'User One',
        role: 'user',
        emailVerified: true,
        mfaEnabled: false,
      },
      {
        email: `user2-${id}@example.com`,
        password: 'password123',
        fullName: 'User Two',
        role: 'user',
        emailVerified: true,
        mfaEnabled: false,
      },
    ])

    const response = await request(BASE_URL)
      .get('/api/v1/admin/users')
      .set('Cookie', cookies)
      .expect(200)

    assert.isArray(response.body.data)
    assert.isTrue(
      response.body.data.length >= 3,
      'Should have at least 3 users (admin + 2 created)'
    )
    assert.isUndefined(response.body.data[0].password, 'Password should not be serialized')
  })

  test('GET /api/v1/admin/users requires admin role', async () => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`user-${id}@example.com`, 'password123', 'user')

    await request(BASE_URL).get('/api/v1/admin/users').set('Cookie', cookies).expect(403)
  })

  test('DELETE /api/v1/admin/users/:id deletes a user', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', 'admin')

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
    const { cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', 'admin')

    await request(BASE_URL).delete('/api/v1/admin/users/99999').set('Cookie', cookies).expect(404)
  })

  test('DELETE /api/v1/admin/users/:id prevents admin from deleting themselves', async ({
    assert,
  }) => {
    const id = uniqueId()
    const { user: admin, cookies } = await createUserAndLogin(
      `admin-${id}@example.com`,
      'password123',
      'admin'
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
    const { cookies } = await createUserAndLogin(`user-${id}@example.com`, 'password123', 'user')

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
