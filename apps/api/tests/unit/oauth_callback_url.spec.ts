/**
 * Unit tests for OAuth callback URL mapping.
 *
 * Tests the callbackUrl-by-state mapping mechanism that supports
 * concurrent OAuth flows from multiple tabs/windows.
 *
 * Note: Concurrent flows for the SAME provider are limited by Ally's
 * design (single state cookie per provider). The last-started flow wins,
 * and earlier tabs will fail stateMisMatch(). These tests cover the
 * callbackUrl mapping logic that works correctly when OAuth succeeds.
 */

import { test } from '@japa/runner'

/**
 * Simulates the session storage for callback URLs keyed by OAuth state.
 * This is the core data structure used by OAuthController.
 */
interface MockSession {
  data: Record<string, unknown>
  get(key: string): unknown
  put(key: string, value: unknown): void
}

function createMockSession(): MockSession {
  const data: Record<string, unknown> = {}
  return {
    data,
    get(key: string) {
      return data[key]
    },
    put(key: string, value: unknown) {
      data[key] = value
    },
  }
}

const OAUTH_CALLBACKS_KEY = 'oauth_callbacks'
const MAX_PENDING_OAUTH_FLOWS = 10

/**
 * Simulates storing a callback URL keyed by OAuth state.
 * Mirrors OAuthController.redirect() logic.
 */
function storeCallbackUrl(session: MockSession, state: string, callbackUrl: string): void {
  const callbacks = (session.get(OAUTH_CALLBACKS_KEY) as Record<string, string>) || {}

  // Limit entries to prevent session bloat
  const keys = Object.keys(callbacks)
  if (keys.length >= MAX_PENDING_OAUTH_FLOWS) {
    const toRemove = keys.slice(0, keys.length - MAX_PENDING_OAUTH_FLOWS + 1)
    for (const key of toRemove) {
      delete callbacks[key]
    }
  }

  callbacks[state] = callbackUrl
  session.put(OAUTH_CALLBACKS_KEY, callbacks)
}

/**
 * Simulates retrieving and consuming a callback URL by OAuth state.
 * Mirrors OAuthController.retrieveAndClearCallbackUrl() logic.
 */
function retrieveAndClearCallbackUrl(
  session: MockSession,
  state: string | null
): string | undefined {
  if (!state) {
    return undefined
  }

  const callbacks = (session.get(OAUTH_CALLBACKS_KEY) as Record<string, string>) || {}
  const callbackUrl = callbacks[state]

  if (callbackUrl) {
    delete callbacks[state]
    session.put(OAUTH_CALLBACKS_KEY, callbacks)
  }

  return callbackUrl
}

test.group('OAuth Callback URL Mapping', () => {
  test('stores and retrieves callback URL by state', ({ assert }) => {
    const session = createMockSession()
    const state = 'abc123'
    const callbackUrl = '/apps/notes'

    storeCallbackUrl(session, state, callbackUrl)
    const retrieved = retrieveAndClearCallbackUrl(session, state)

    assert.equal(retrieved, callbackUrl)
  })

  test('consumes callback URL on retrieval (one-time use)', ({ assert }) => {
    const session = createMockSession()
    const state = 'abc123'
    const callbackUrl = '/apps/notes'

    storeCallbackUrl(session, state, callbackUrl)

    // First retrieval succeeds
    const first = retrieveAndClearCallbackUrl(session, state)
    assert.equal(first, callbackUrl)

    // Second retrieval returns undefined (consumed)
    const second = retrieveAndClearCallbackUrl(session, state)
    assert.isUndefined(second)
  })

  test('supports multiple concurrent flows with different states', ({ assert }) => {
    const session = createMockSession()

    // Simulate Tab A starting OAuth
    const stateA = 'state_tab_a'
    const urlA = '/apps/notes'
    storeCallbackUrl(session, stateA, urlA)

    // Simulate Tab B starting OAuth (different state)
    const stateB = 'state_tab_b'
    const urlB = '/admin/users'
    storeCallbackUrl(session, stateB, urlB)

    // Tab B completes first - gets correct URL
    const retrievedB = retrieveAndClearCallbackUrl(session, stateB)
    assert.equal(retrievedB, urlB)

    // Tab A completes - gets correct URL
    const retrievedA = retrieveAndClearCallbackUrl(session, stateA)
    assert.equal(retrievedA, urlA)
  })

  test('returns undefined for unknown state', ({ assert }) => {
    const session = createMockSession()
    const result = retrieveAndClearCallbackUrl(session, 'unknown_state')
    assert.isUndefined(result)
  })

  test('returns undefined for null state', ({ assert }) => {
    const session = createMockSession()
    const result = retrieveAndClearCallbackUrl(session, null)
    assert.isUndefined(result)
  })

  test('limits entries to prevent session bloat', ({ assert }) => {
    const session = createMockSession()

    // Store MAX_PENDING_OAUTH_FLOWS + 2 entries
    for (let i = 0; i < MAX_PENDING_OAUTH_FLOWS + 2; i++) {
      storeCallbackUrl(session, `state_${i}`, `/url_${i}`)
    }

    const callbacks = session.get(OAUTH_CALLBACKS_KEY) as Record<string, string>
    const count = Object.keys(callbacks).length

    // Should be limited to MAX_PENDING_OAUTH_FLOWS
    assert.isAtMost(count, MAX_PENDING_OAUTH_FLOWS)

    // Oldest entries should be removed (FIFO)
    assert.isUndefined(callbacks['state_0'])
    assert.isUndefined(callbacks['state_1'])

    // Newest entries should remain
    assert.equal(
      callbacks[`state_${MAX_PENDING_OAUTH_FLOWS + 1}`],
      `/url_${MAX_PENDING_OAUTH_FLOWS + 1}`
    )
  })

  test('handles empty session gracefully', ({ assert }) => {
    const session = createMockSession()
    // No prior data in session
    const result = retrieveAndClearCallbackUrl(session, 'any_state')
    assert.isUndefined(result)
  })
})

test.group('OAuth Callback URL Validation', () => {
  /**
   * Simulates the callback URL validation logic from OAuthController.redirect().
   */
  function isValidCallbackUrl(url: string): boolean {
    return url.startsWith('/') && !url.startsWith('//') && !url.includes('\\')
  }

  test('accepts valid relative paths', ({ assert }) => {
    assert.isTrue(isValidCallbackUrl('/dashboard'))
    assert.isTrue(isValidCallbackUrl('/apps/notes'))
    assert.isTrue(isValidCallbackUrl('/apps/notes/123/edit'))
    assert.isTrue(isValidCallbackUrl('/admin/users?tab=settings'))
  })

  test('rejects protocol-relative URLs (open redirect)', ({ assert }) => {
    assert.isFalse(isValidCallbackUrl('//evil.com/path'))
    assert.isFalse(isValidCallbackUrl('//localhost/path'))
  })

  test('rejects absolute URLs (open redirect)', ({ assert }) => {
    assert.isFalse(isValidCallbackUrl('https://evil.com/path'))
    assert.isFalse(isValidCallbackUrl('http://localhost/path'))
    assert.isFalse(isValidCallbackUrl('javascript:alert(1)'))
  })

  test('rejects backslash paths (path traversal)', ({ assert }) => {
    assert.isFalse(isValidCallbackUrl('/path\\to\\file'))
    assert.isFalse(isValidCallbackUrl('/apps\\notes'))
  })

  test('rejects relative paths without leading slash', ({ assert }) => {
    assert.isFalse(isValidCallbackUrl('dashboard'))
    assert.isFalse(isValidCallbackUrl('apps/notes'))
  })
})
