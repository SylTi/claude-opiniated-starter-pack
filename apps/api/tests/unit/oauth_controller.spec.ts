import { test } from '@japa/runner'
import sinon from 'sinon'
import OAuthController from '#controllers/oauth_controller'

interface MockSession {
  data: Record<string, unknown>
  get: (key: string) => unknown
  put: (key: string, value: unknown) => void
}

function createMockSession(initialData: Record<string, unknown> = {}): MockSession {
  const data: Record<string, unknown> = { ...initialData }
  return {
    data,
    get: (key: string) => data[key],
    put: (key: string, value: unknown) => {
      data[key] = value
    },
  }
}

function createMockResponse() {
  let redirectedTo: string | null = null
  let badRequestPayload: unknown = null
  let cookieSet: { name: string; value: string } | null = null

  return {
    redirect: (url: string) => {
      redirectedTo = url
    },
    badRequest: (payload: unknown) => {
      badRequestPayload = payload
    },
    cookie: (name: string, value: string) => {
      cookieSet = { name, value }
    },
    getRedirectedTo: () => redirectedTo,
    getBadRequestPayload: () => badRequestPayload,
    getCookieSet: () => cookieSet,
  }
}

test.group('OAuthController callback URL state mapping', (group) => {
  let sandbox: sinon.SinonSandbox

  group.each.setup(() => {
    sandbox = sinon.createSandbox()
  })

  group.each.teardown(() => {
    sandbox.restore()
  })

  test('redirect stores callback URL by OAuth state', async ({ assert }) => {
    const controller = new OAuthController()
    const session = createMockSession()
    const response = createMockResponse()

    const ctx = {
      ally: {
        use: () => ({
          redirectUrl: async () =>
            'https://accounts.google.com/o/oauth2/v2/auth?state=state_redirect_1',
        }),
      },
      params: { provider: 'google' },
      request: {
        input: (key: string) => (key === 'callbackUrl' ? '/apps/notes' : null),
      },
      session,
      response,
    }

    await controller.redirect(ctx as never)

    const callbacks = session.get('oauth_callbacks') as Record<string, string>
    assert.equal(callbacks.state_redirect_1, '/apps/notes')
    assert.equal(
      response.getRedirectedTo(),
      'https://accounts.google.com/o/oauth2/v2/auth?state=state_redirect_1'
    )
  })

  test('callback preserves callback URL entry on state mismatch', async ({ assert }) => {
    const controller = new OAuthController()
    const session = createMockSession({
      oauth_callbacks: {
        state_mismatch_1: '/apps/notes',
      },
    })
    const response = createMockResponse()

    const ctx = {
      ally: {
        use: () => ({
          accessDenied: () => false,
          stateMisMatch: () => true,
          hasError: () => false,
        }),
      },
      params: { provider: 'google' },
      auth: {},
      request: {
        input: (key: string) => (key === 'state' ? 'state_mismatch_1' : null),
        ip: () => '127.0.0.1',
        header: () => undefined,
      },
      session,
      response,
    }

    await controller.callback(ctx as never)

    const callbacks = session.get('oauth_callbacks') as Record<string, string>
    assert.equal(callbacks.state_mismatch_1, '/apps/notes')
    assert.isString(response.getRedirectedTo())
    assert.include(response.getRedirectedTo()!, 'error=')
  })

  test('callback consumes entry and includes callback URL after successful OAuth flow', async ({
    assert,
  }) => {
    const controller = new OAuthController()
    const session = createMockSession({
      oauth_callbacks: {
        state_success_1: '/apps/notes/settings?tab=general',
      },
    })
    const response = createMockResponse()

    const oauth = {
      accessDenied: () => false,
      stateMisMatch: () => false,
      hasError: () => false,
      user: async () => ({
        id: 'oauth-user-1',
        email: 'user@example.com',
        name: 'OAuth User',
        avatarUrl: null,
        token: {
          token: 'access-token',
          refreshToken: 'refresh-token',
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    }

    const loginStub = sandbox.stub().resolves()
    const recordLoginAttemptStub = sandbox.stub().resolves()
    const signStub = sandbox.stub().resolves('signed-user-info')
    const findOrCreateUserStub = sandbox.stub().resolves({
      user: { id: 42, role: 'user' },
      isNewUser: false,
    })

    ;(
      controller as unknown as {
        authService: { recordLoginAttempt: typeof recordLoginAttemptStub }
      }
    ).authService = {
      recordLoginAttempt: recordLoginAttemptStub,
    }
    ;(controller as unknown as { cookieSigning: { sign: typeof signStub } }).cookieSigning = {
      sign: signStub,
    }
    ;(controller as unknown as { findOrCreateUser: typeof findOrCreateUserStub }).findOrCreateUser =
      findOrCreateUserStub

    const ctx = {
      ally: {
        use: () => oauth,
      },
      params: { provider: 'google' },
      auth: {
        use: () => ({
          login: loginStub,
        }),
      },
      request: {
        input: (key: string) => (key === 'state' ? 'state_success_1' : null),
        ip: () => '127.0.0.1',
        header: () => undefined,
      },
      session,
      response,
    }

    await controller.callback(ctx as never)

    const callbacks = session.get('oauth_callbacks') as Record<string, string>
    assert.isUndefined(callbacks.state_success_1)
    assert.isTrue(recordLoginAttemptStub.calledOnce)
    assert.isTrue(loginStub.calledOnce)
    assert.deepEqual(response.getCookieSet(), { name: 'user-info', value: 'signed-user-info' })
    assert.include(response.getRedirectedTo()!, 'success=true')
    assert.include(
      response.getRedirectedTo()!,
      'callbackUrl=%2Fapps%2Fnotes%2Fsettings%3Ftab%3Dgeneral'
    )
  })
})
