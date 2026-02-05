import { test } from '@japa/runner'
import request from 'supertest'
import User from '#models/user'
import { truncateAllTables } from '../bootstrap.js'

const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

async function createUserAndLogin(
  email: string,
  password: string
): Promise<{ user: User; cookies: string[] }> {
  const user = await User.create({
    email,
    password,
    fullName: 'Test User',
    role: 'user',
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

test.group('Auth API', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('register creates user', async ({ assert }) => {
    const id = uniqueId()
    const email = `register-${id}@example.com`

    const response = await request(BASE_URL)
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'password123',
        fullName: 'New User',
      })
      .expect(201)

    assert.exists(response.body.message)

    const user = await User.findBy('email', email)
    assert.exists(user)
    assert.equal(user!.email, email)
  })

  test('login succeeds with valid credentials', async ({ assert }) => {
    const id = uniqueId()
    const email = `login-${id}@example.com`

    await User.create({
      email,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const response = await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({ email, password: 'password123' })
      .expect(200)

    assert.equal(response.body.data.email, email)
    assert.exists(response.headers['set-cookie'])
  })

  test('login fails with invalid credentials', async () => {
    const id = uniqueId()
    const email = `invalid-${id}@example.com`

    await User.create({
      email,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrongpassword' })
      .expect(401)
  })

  test('auth/me requires authentication', async () => {
    await request(BASE_URL).get('/api/v1/auth/me').expect(401)
  })

  test('auth/me returns current authenticated user', async ({ assert }) => {
    const id = uniqueId()
    const email = `me-${id}@example.com`
    const { user, cookies } = await createUserAndLogin(email, 'password123')

    const response = await request(BASE_URL)
      .get('/api/v1/auth/me')
      .set('Cookie', cookies)
      .expect(200)

    assert.equal(response.body.data.id, user.id)
    assert.equal(response.body.data.email, email)
  })

  test('profile update requires authentication', async () => {
    await request(BASE_URL)
      .put('/api/v1/auth/profile')
      .send({ fullName: 'Updated Name' })
      .expect(401)
  })
})
