import { test } from '@japa/runner'
import sinon from 'sinon'
import OAuthController from '#controllers/oauth_controller'

function createRedirectContext(options?: { provider?: string; callbackUrl?: string }) {
  const redirectUrlStub = sinon
    .stub()
    .resolves('https://accounts.google.com/o/oauth2/auth?state=test-state')

  return {
    ally: {
      use: sinon.stub().returns({
        redirectUrl: redirectUrlStub,
      }),
    },
    params: {
      provider: options?.provider ?? 'google',
    },
    request: {
      input: sinon.stub().callsFake((key: string) => {
        if (key === 'callbackUrl') {
          return options?.callbackUrl
        }
        return undefined
      }),
    },
    session: {
      get: sinon.stub().returns({}),
      put: sinon.stub(),
    },
    response: {
      redirect: sinon.stub().returnsThis(),
      badRequest: sinon.stub().returnsThis(),
    },
  }
}

test.group('OAuthController', () => {
  test('stores valid callbackUrl in session keyed by OAuth state', async ({ assert }) => {
    const controller = new OAuthController()
    const ctx = createRedirectContext({ callbackUrl: '/dashboard?tab=billing' })

    await controller.redirect(ctx as never)

    assert.isTrue(ctx.response.redirect.calledOnce)
    assert.isTrue(ctx.session.put.calledOnce)
    const [sessionKey, callbacks] = ctx.session.put.firstCall.args as [
      string,
      Record<string, string>,
    ]
    assert.equal(sessionKey, 'oauth_callbacks')
    assert.equal(callbacks['test-state'], '/dashboard?tab=billing')
  })

  test('does not store oversized callbackUrl to prevent session bloat', async ({ assert }) => {
    const controller = new OAuthController()
    const oversized = `/${'a'.repeat(3000)}`
    const ctx = createRedirectContext({ callbackUrl: oversized })

    await controller.redirect(ctx as never)

    assert.isTrue(ctx.response.redirect.calledOnce)
    assert.isFalse(ctx.session.put.called)
  })

  test('limits pending callbackUrl entries to avoid oversized session payloads', async ({
    assert,
  }) => {
    const controller = new OAuthController()
    const existingCallbacks: Record<string, string> = {
      state1: '/dashboard',
      state2: '/profile',
      state3: '/billing',
    }
    const ctx = createRedirectContext({ callbackUrl: '/apps/notes' })
    ctx.session.get = sinon.stub().returns(existingCallbacks)

    await controller.redirect(ctx as never)

    assert.isTrue(ctx.session.put.calledOnce)
    const [, callbacks] = ctx.session.put.firstCall.args as [string, Record<string, string>]
    assert.isAtMost(Object.keys(callbacks).length, 3)
    assert.equal(callbacks['test-state'], '/apps/notes')
  })
})
