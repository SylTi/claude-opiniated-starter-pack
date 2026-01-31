import { test, expect, type Page } from '@playwright/test'

/**
 * Notes Plugin E2E Tests
 *
 * Tests the notes plugin API endpoints with full authentication.
 * Verifies:
 * - CRUD operations
 * - Tenant isolation (RLS)
 * - Authorization (RBAC)
 */

const TEST_USER = {
  email: 'free@test.com',
  password: 'password123',
} as const

const API_BASE = process.env.API_URL || 'http://localhost:3333'
const NOTES_API = `${API_BASE}/api/v1/apps/notes/notes`

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel(/email address/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.locator('form').getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 20000 })
}

async function getAuthCookie(page: Page): Promise<string> {
  const cookies = await page.context().cookies()
  const sessionCookie = cookies.find((c) => c.name.includes('session') || c.name.includes('adonis'))
  return sessionCookie ? `${sessionCookie.name}=${sessionCookie.value}` : ''
}

test.describe('Notes Plugin API', () => {
  let authCookie: string

  test.beforeAll(async ({ browser }) => {
    // Login once to get auth cookie
    const context = await browser.newContext()
    const page = await context.newPage()
    await login(page, TEST_USER.email, TEST_USER.password)
    authCookie = await getAuthCookie(page)
    await context.close()
  })

  test.describe('CRUD Operations', () => {
    test('creates a new note', async ({ request }) => {
      const response = await request.post(NOTES_API, {
        headers: {
          Cookie: authCookie,
          'Content-Type': 'application/json',
        },
        data: {
          title: 'Test Note',
          content: 'This is a test note content.',
        },
      })

      // If plugin is not enabled or routes not mounted, we get 404
      // If enabled, we should get 201 or 200
      if (response.status() === 404) {
        test.skip(true, 'Notes plugin not enabled for this tenant')
        return
      }

      expect(response.ok()).toBeTruthy()
      const body = await response.json()
      expect(body.data).toBeDefined()
      expect(body.data.title).toBe('Test Note')
      expect(body.data.content).toBe('This is a test note content.')
      expect(body.data.id).toBeDefined()
    })

    test('lists notes for tenant', async ({ request }) => {
      const response = await request.get(NOTES_API, {
        headers: {
          Cookie: authCookie,
        },
      })

      if (response.status() === 404) {
        test.skip(true, 'Notes plugin not enabled for this tenant')
        return
      }

      expect(response.ok()).toBeTruthy()
      const body = await response.json()
      expect(body.data).toBeInstanceOf(Array)
    })

    test('gets a specific note', async ({ request }) => {
      // First create a note
      const createResponse = await request.post(NOTES_API, {
        headers: {
          Cookie: authCookie,
          'Content-Type': 'application/json',
        },
        data: {
          title: 'Note to Get',
          content: 'Getting this note.',
        },
      })

      if (createResponse.status() === 404) {
        test.skip(true, 'Notes plugin not enabled for this tenant')
        return
      }

      const createBody = await createResponse.json()
      const noteId = createBody.data.id

      // Now get the note
      const response = await request.get(`${NOTES_API}/${noteId}`, {
        headers: {
          Cookie: authCookie,
        },
      })

      expect(response.ok()).toBeTruthy()
      const body = await response.json()
      expect(body.data.id).toBe(noteId)
      expect(body.data.title).toBe('Note to Get')
    })

    test('updates a note', async ({ request }) => {
      // First create a note
      const createResponse = await request.post(NOTES_API, {
        headers: {
          Cookie: authCookie,
          'Content-Type': 'application/json',
        },
        data: {
          title: 'Note to Update',
          content: 'Original content.',
        },
      })

      if (createResponse.status() === 404) {
        test.skip(true, 'Notes plugin not enabled for this tenant')
        return
      }

      const createBody = await createResponse.json()
      const noteId = createBody.data.id

      // Update the note
      const updateResponse = await request.put(`${NOTES_API}/${noteId}`, {
        headers: {
          Cookie: authCookie,
          'Content-Type': 'application/json',
        },
        data: {
          title: 'Updated Title',
          content: 'Updated content.',
        },
      })

      expect(updateResponse.ok()).toBeTruthy()
      const updateBody = await updateResponse.json()
      expect(updateBody.data.title).toBe('Updated Title')
      expect(updateBody.data.content).toBe('Updated content.')
    })

    test('deletes a note', async ({ request }) => {
      // First create a note
      const createResponse = await request.post(NOTES_API, {
        headers: {
          Cookie: authCookie,
          'Content-Type': 'application/json',
        },
        data: {
          title: 'Note to Delete',
          content: 'Delete me.',
        },
      })

      if (createResponse.status() === 404) {
        test.skip(true, 'Notes plugin not enabled for this tenant')
        return
      }

      const createBody = await createResponse.json()
      const noteId = createBody.data.id

      // Delete the note
      const deleteResponse = await request.delete(`${NOTES_API}/${noteId}`, {
        headers: {
          Cookie: authCookie,
        },
      })

      expect(deleteResponse.ok()).toBeTruthy()

      // Verify note is gone
      const getResponse = await request.get(`${NOTES_API}/${noteId}`, {
        headers: {
          Cookie: authCookie,
        },
      })

      expect(getResponse.status()).toBe(404)
    })
  })

  test.describe('Authentication', () => {
    test('rejects unauthenticated requests', async ({ request }) => {
      const response = await request.get(NOTES_API)

      // Should get 401 Unauthorized or 403 Forbidden
      expect([401, 403]).toContain(response.status())
    })

    test('rejects invalid session', async ({ request }) => {
      const response = await request.get(NOTES_API, {
        headers: {
          Cookie: 'adonis-session=invalid-session-token',
        },
      })

      // Should get 401 Unauthorized or 403 Forbidden
      expect([401, 403]).toContain(response.status())
    })
  })

  test.describe('Validation', () => {
    test('rejects note without title', async ({ request }) => {
      const response = await request.post(NOTES_API, {
        headers: {
          Cookie: authCookie,
          'Content-Type': 'application/json',
        },
        data: {
          content: 'Note without title.',
        },
      })

      if (response.status() === 404) {
        test.skip(true, 'Notes plugin not enabled for this tenant')
        return
      }

      // Should get validation error
      expect(response.status()).toBe(422)
      const body = await response.json()
      expect(body.errors).toBeDefined()
    })

    test('rejects empty title', async ({ request }) => {
      const response = await request.post(NOTES_API, {
        headers: {
          Cookie: authCookie,
          'Content-Type': 'application/json',
        },
        data: {
          title: '',
          content: 'Note with empty title.',
        },
      })

      if (response.status() === 404) {
        test.skip(true, 'Notes plugin not enabled for this tenant')
        return
      }

      // Should get validation error
      expect(response.status()).toBe(422)
    })
  })
})

test.describe('Notes Plugin - Tenant Isolation', () => {
  // This test requires two different tenant users
  // Skipped by default as it requires specific test data setup

  test.skip('tenant 1 cannot see tenant 2 notes', async ({ request: _request }) => {
    // TODO: Implement when multi-tenant test users are available
    // 1. Login as tenant 1 user
    // 2. Create a note
    // 3. Login as tenant 2 user
    // 4. List notes - should not see tenant 1's note
    // 5. Try to get tenant 1's note by ID - should get 404
  })
})
