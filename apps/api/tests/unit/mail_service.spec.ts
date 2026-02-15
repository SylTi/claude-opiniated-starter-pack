import { test } from '@japa/runner'
import sinon from 'sinon'
import MailService from '#services/mail_service'
import env from '#start/env'

test.group('MailService', (group) => {
  const sandbox = sinon.createSandbox()

  group.each.teardown(() => {
    sandbox.restore()
  })

  test('dev fallback logs metadata without exposing tokenized body content', async ({ assert }) => {
    sandbox.stub(env, 'get').callsFake((key: string, defaultValue?: string) => {
      if (key === 'RESEND_API_KEY') {
        return undefined as never
      }

      if (typeof defaultValue === 'string') {
        return defaultValue as never
      }

      return undefined as never
    })

    const logStub = sandbox.stub(console, 'log')
    sandbox.stub(console, 'warn')

    const service = new MailService()
    const token = 'secret-token-123'

    const result = await service.send({
      to: 'user@example.com',
      subject: 'Reset Password',
      html: `<a href="https://localhost/reset-password?token=${token}">reset</a>`,
      text: `https://localhost/reset-password?token=${token}`,
    })

    assert.isTrue(result.success)

    const output = logStub
      .getCalls()
      .flatMap((call) => call.args.map((arg) => String(arg)))
      .join('\n')

    assert.include(output, 'Body: [redacted]')
    assert.isFalse(output.includes(token))
  })
})
