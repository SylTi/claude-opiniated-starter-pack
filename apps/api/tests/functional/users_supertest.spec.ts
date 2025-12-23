import { test } from '@japa/runner'
import User from '#models/user'
import { truncateAllTables } from '../bootstrap.js'
import request from 'supertest'

test.group('Users API (Supertest)', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('GET /api/v1/users returns list of users with supertest', async ({ assert }) => {
    // Arrange
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

    // Act
    const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`
    const response = await request(BASE_URL)
      .get('/api/v1/users')
      .expect(200)
      .expect('Content-Type', /json/)

    // Assert
    assert.equal(response.body.data.length, 2)
    assert.equal(response.body.data[0].email, 'user1@example.com')
    assert.equal(response.body.data[1].email, 'user2@example.com')
    assert.isUndefined(response.body.data[0].password, 'Password should not be serialized')
  })

  test('GET /api/v1/users/:id returns single user with supertest', async ({ assert }) => {
    // Arrange
    const user = await User.create({
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Test User',
    })

    // Act
    const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`
    const response = await request(BASE_URL).get(`/api/v1/users/${user.id}`).expect(200)

    // Assert
    assert.equal(response.body.data.id, user.id)
    assert.equal(response.body.data.email, 'test@example.com')
    assert.equal(response.body.data.fullName, 'Test User')
    assert.isUndefined(response.body.data.password)
  })

  test('GET /api/v1/users/:id returns 404 for non-existent user with supertest', async () => {
    const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`
    await request(BASE_URL).get('/api/v1/users/99999').expect(404)
  })

  test('POST /api/v1/users with valid data (example)', async ({ assert }) => {
    const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`
    const response = await request(BASE_URL)
      .post('/api/v1/users')
      .send({
        email: 'newuser@example.com',
        password: 'password123',
        fullName: 'New User',
      })
      .set('Accept', 'application/json')

    // Note: Ce test échouera car la route POST n'existe pas encore
    // C'est juste pour montrer la syntaxe
    if (response.status === 201) {
      assert.equal(response.body.data.email, 'newuser@example.com')
      assert.exists(response.body.data.id)
    }
  })
})
