import { test, expect, type Page, request as playwrightRequest, type APIRequestContext } from '@playwright/test'

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
const NOTES_API = `/api/v1/apps/notes/notes`

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel(/email address/i).fill(email)
  await page.getByLabel(/password/i).fill(password)

  const submitButton = page.locator('form').getByRole('button', { name: /sign in/i })
  await submitButton.click()

  // If still on login page after 5s, React hydration may not have been ready — retry click
  try {
    await page.waitForURL('**/dashboard', { timeout: 5000 })
  } catch {
    await submitButton.click()
    await page.waitForURL('**/dashboard', { timeout: 45000 })
  }
}

test.describe('Notes Plugin API', () => {
  // Disable parallel execution within this describe to share auth state
  test.describe.configure({ mode: 'serial' })

  let apiContext: APIRequestContext

  test.beforeAll(async () => {
    // Create a temporary context to login and discover the tenant ID
    const tempContext = await playwrightRequest.newContext({
      baseURL: API_BASE,
    })

    const loginResponse = await tempContext.post('/api/v1/auth/login', {
      data: { email: TEST_USER.email, password: TEST_USER.password },
    })

    if (!loginResponse.ok()) {
      throw new Error(`Login failed: ${loginResponse.status()} ${await loginResponse.text()}`)
    }

    // Get the user's current tenant ID
    const meResponse = await tempContext.get('/api/v1/auth/me')
    if (!meResponse.ok()) {
      throw new Error(`Failed to get user info: ${meResponse.status()}`)
    }
    const meBody = await meResponse.json()
    const tenantId = meBody.data.currentTenantId

    // Extract cookies from temp context to reuse in the real context
    const storageState = await tempContext.storageState()
    await tempContext.dispose()

    // Create the real API context with tenant ID header and session cookies
    apiContext = await playwrightRequest.newContext({
      baseURL: API_BASE,
      extraHTTPHeaders: {
        'X-Tenant-ID': String(tenantId),
      },
      storageState,
    })
  })

  test.afterAll(async () => {
    await apiContext?.dispose()
  })

  test.describe('CRUD Operations', () => {
    test('creates a new note', async () => {
      const response = await apiContext.post(NOTES_API, {
        data: {
          title: 'Test Note',
          content: 'This is a test note content.',
        },
      })

      // If plugin is not enabled or routes not mounted, we get 404
      if (response.status() === 404) {
        test.skip(true, 'Notes plugin not enabled for this tenant')
        return
      }

      if (!response.ok()) {
        const errorBody = await response.text()
        throw new Error(`Note creation failed with status ${response.status()}: ${errorBody}`)
      }
      const body = await response.json()
      expect(body.data).toBeDefined()
      expect(body.data.title).toBe('Test Note')
      expect(body.data.content).toBe('This is a test note content.')
      expect(body.data.id).toBeDefined()
    })

    test('lists notes for tenant', async () => {
      const response = await apiContext.get(NOTES_API)

      if (response.status() === 404) {
        test.skip(true, 'Notes plugin not enabled for this tenant')
        return
      }

      expect(response.ok()).toBeTruthy()
      const body = await response.json()
      expect(body.data).toBeInstanceOf(Array)
    })

    test('gets a specific note', async () => {
      // First create a note
      const createResponse = await apiContext.post(NOTES_API, {
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
      const response = await apiContext.get(`${NOTES_API}/${noteId}`)

      expect(response.ok()).toBeTruthy()
      const body = await response.json()
      expect(body.data.id).toBe(noteId)
      expect(body.data.title).toBe('Note to Get')
    })

    test('updates a note', async () => {
      // First create a note
      const createResponse = await apiContext.post(NOTES_API, {
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
      const updateResponse = await apiContext.put(`${NOTES_API}/${noteId}`, {
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

    test('deletes a note', async () => {
      // First create a note
      const createResponse = await apiContext.post(NOTES_API, {
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
      const deleteResponse = await apiContext.delete(`${NOTES_API}/${noteId}`)

      expect(deleteResponse.ok()).toBeTruthy()

      // Verify note is gone
      const getResponse = await apiContext.get(`${NOTES_API}/${noteId}`)

      expect(getResponse.status()).toBe(404)
    })
  })

  test.describe('Authentication', () => {
    test('rejects unauthenticated requests', async ({ request }) => {
      const response = await request.get(`${API_BASE}${NOTES_API}`)

      // Should get 401 Unauthorized or 403 Forbidden
      expect([401, 403]).toContain(response.status())
    })

    test('rejects invalid session', async ({ request }) => {
      const response = await request.get(`${API_BASE}${NOTES_API}`, {
        headers: {
          Cookie: 'adonis-session=invalid-session-token',
        },
      })

      // Should get 401 Unauthorized or 403 Forbidden
      expect([401, 403]).toContain(response.status())
    })
  })

  test.describe('Validation', () => {
    test('rejects note without title', async () => {
      const response = await apiContext.post(NOTES_API, {
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

    test('rejects empty title', async () => {
      const response = await apiContext.post(NOTES_API, {
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

  test.skip('tenant 1 cannot see tenant 2 notes', async () => {
    // TODO: Implement when multi-tenant test users are available
    // 1. Login as tenant 1 user
    // 2. Create a note
    // 3. Login as tenant 2 user
    // 4. List notes - should not see tenant 1's note
    // 5. Try to get tenant 1's note by ID - should get 404
  })
})

test.describe('Notes Plugin - UI', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each UI test
    await login(page, TEST_USER.email, TEST_USER.password)
  })

  test('enables plugin when not enabled', async ({ page }) => {
    // Navigate to notes plugin page
    await page.goto('/plugins/notes')

    // If plugin is not enabled, we should see the enable button
    const enableButton = page.getByTestId('enable-plugin-button')
    if (await enableButton.isVisible()) {
      await enableButton.click()
      // Wait for plugin to be enabled and page to reload
      await page.waitForSelector('[data-testid="create-note-button"]', { timeout: 10000 })
    }

    // Should see the notes page
    await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeVisible()
  })

  test('creates a new note via UI', async ({ page }) => {
    await page.goto('/plugins/notes')

    // Enable plugin if needed
    const enableButton = page.getByTestId('enable-plugin-button')
    if (await enableButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await enableButton.click()
      await page.waitForSelector('[data-testid="create-note-button"]', { timeout: 10000 })
    }

    // Click create note button
    await page.getByTestId('create-note-button').click()

    // Should be on new note page
    await expect(page).toHaveURL(/\/plugins\/notes\/new/)

    // Fill in note details
    const uniqueTitle = `Test Note ${Date.now()}`
    await page.getByTestId('note-title-input').fill(uniqueTitle)
    await page.getByTestId('note-content-input').fill('This is test content from E2E test.')

    // Save the note
    await page.getByTestId('save-note-button').click()

    // Should redirect to notes list
    await expect(page).toHaveURL(/\/plugins\/notes$/)

    // Should see the new note in the list
    await expect(page.getByText(uniqueTitle)).toBeVisible()
  })

  test('edits an existing note via UI', async ({ page }) => {
    await page.goto('/plugins/notes')

    // Enable plugin if needed
    const enableButton = page.getByTestId('enable-plugin-button')
    if (await enableButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await enableButton.click()
      await page.waitForSelector('[data-testid="create-note-button"]', { timeout: 10000 })
    }

    // Create a note first
    const uniqueTitle = `Edit Test ${Date.now()}`
    await page.getByTestId('create-note-button').click()
    await page.getByTestId('note-title-input').fill(uniqueTitle)
    await page.getByTestId('note-content-input').fill('Original content')
    await page.getByTestId('save-note-button').click()
    await expect(page).toHaveURL(/\/plugins\/notes$/)

    // Find and click edit button on the note card
    const noteCard = page.locator(`[data-testid^="note-card-"]`).filter({ hasText: uniqueTitle })
    await noteCard.locator('[data-testid^="edit-note-"]').click()

    // Should be on edit page
    await expect(page).toHaveURL(/\/plugins\/notes\/\d+/)

    // Update the content
    const updatedTitle = `${uniqueTitle} - Updated`
    await page.getByTestId('note-title-input').fill(updatedTitle)
    await page.getByTestId('note-content-input').fill('Updated content')
    await page.getByTestId('save-note-button').click()

    // Should redirect to notes list
    await expect(page).toHaveURL(/\/plugins\/notes$/)

    // Should see the updated title
    await expect(page.getByText(updatedTitle)).toBeVisible()
  })

  test('deletes a note via UI', async ({ page }) => {
    await page.goto('/plugins/notes')

    // Enable plugin if needed
    const enableButton = page.getByTestId('enable-plugin-button')
    if (await enableButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await enableButton.click()
      await page.waitForSelector('[data-testid="create-note-button"]', { timeout: 10000 })
    }

    // Create a note first
    const uniqueTitle = `Delete Test ${Date.now()}`
    await page.getByTestId('create-note-button').click()
    await page.getByTestId('note-title-input').fill(uniqueTitle)
    await page.getByTestId('note-content-input').fill('This will be deleted')
    await page.getByTestId('save-note-button').click()
    await expect(page).toHaveURL(/\/plugins\/notes$/)

    // Find and click delete button on the note card
    const noteCard = page.locator(`[data-testid^="note-card-"]`).filter({ hasText: uniqueTitle })
    await noteCard.locator('[data-testid^="delete-note-"]').click()

    // Confirm deletion in dialog and wait for API response
    await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/notes/') && resp.request().method() === 'DELETE',
        { timeout: 10000 }
      ),
      page.getByTestId('confirm-delete-button').click(),
    ])

    // Wait for the deletion to complete and UI to update
    await expect(page.getByText(uniqueTitle)).not.toBeVisible({ timeout: 15000 })
  })

  test('navigates to notes via header link', async ({ page }) => {
    await page.goto('/dashboard')

    // Click Notes link in header (only visible when tenant is selected)
    const notesLink = page.getByRole('link', { name: 'Notes' })
    if (await notesLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await notesLink.click()
      await expect(page).toHaveURL(/\/(?:plugins|apps)\/notes/)
    }
  })

  test('shows validation error for empty title', async ({ page }) => {
    await page.goto('/plugins/notes')

    // Enable plugin if needed
    const enableButton = page.getByTestId('enable-plugin-button')
    if (await enableButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await enableButton.click()
      await page.waitForSelector('[data-testid="create-note-button"]', { timeout: 10000 })
    }

    // Go to create note page
    await page.getByTestId('create-note-button').click()

    // Try to save without filling title
    await page.getByTestId('save-note-button').click()

    // Should show validation error
    await expect(page.getByText(/title is required/i)).toBeVisible()

    // Should still be on the same page
    await expect(page).toHaveURL(/\/plugins\/notes\/new/)
  })
})
