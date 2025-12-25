import { test } from '@japa/runner'
import sinon from 'sinon'
import MailService from '#services/mail_service'

// Type for accessing private resend property
type MailServiceWithResend = MailService & {
  resend: { emails: { send: sinon.SinonStub } } | null
}

test.group('MailService', (group) => {
  let sendStub: sinon.SinonStub
  let mailService: MailService

  group.each.setup(() => {
    // Create the MailService instance
    mailService = new MailService()

    // Create the stub for resend.emails.send
    sendStub = sinon.stub().resolves({ data: { id: 'mock-email-id' }, error: null })

    // Access the private resend property and stub its emails.send method
    const serviceWithResend = mailService as MailServiceWithResend
    if (serviceWithResend.resend) {
      serviceWithResend.resend.emails.send = sendStub
    }
  })

  group.each.teardown(() => {
    sinon.restore()
  })

  // ==================== send() method tests ====================

  test('send calls resend.emails.send with correct parameters', async ({ assert }) => {
    const result = await mailService.send({
      to: 'recipient@example.com',
      subject: 'Test Subject',
      html: '<p>Test HTML content</p>',
      text: 'Test text content',
      replyTo: 'reply@example.com',
    })

    assert.isTrue(result.success)
    assert.equal(result.id, 'mock-email-id')
    assert.isTrue(sendStub.calledOnce)

    const callArgs = sendStub.firstCall.args[0]
    assert.equal(callArgs.from, 'Test App <noreply@test.com>')
    assert.equal(callArgs.to, 'recipient@example.com')
    assert.equal(callArgs.subject, 'Test Subject')
    assert.equal(callArgs.html, '<p>Test HTML content</p>')
    assert.equal(callArgs.text, 'Test text content')
    assert.equal(callArgs.replyTo, 'reply@example.com')
  })

  test('send handles array of recipients', async ({ assert }) => {
    const recipients = ['user1@example.com', 'user2@example.com']

    const result = await mailService.send({
      to: recipients,
      subject: 'Multi-recipient test',
      html: '<p>Content</p>',
    })

    assert.isTrue(result.success)
    assert.isTrue(sendStub.calledOnce)

    const callArgs = sendStub.firstCall.args[0]
    assert.deepEqual(callArgs.to, recipients)
  })

  test('send returns error when Resend returns an error', async ({ assert }) => {
    sendStub.resolves({ data: null, error: { message: 'Invalid API key' } })

    const result = await mailService.send({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    })

    assert.isFalse(result.success)
    assert.equal(result.error, 'Invalid API key')
  })

  test('send handles exception from Resend', async ({ assert }) => {
    sendStub.rejects(new Error('Network error'))

    const result = await mailService.send({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    })

    assert.isFalse(result.success)
    assert.equal(result.error, 'Network error')
  })

  // ==================== sendVerificationEmail() tests ====================

  test('sendVerificationEmail sends with correct subject', async ({ assert }) => {
    await mailService.sendVerificationEmail('user@example.com', 'token123', 'John')

    assert.isTrue(sendStub.calledOnce)
    const callArgs = sendStub.firstCall.args[0]
    assert.equal(callArgs.subject, 'Verify your email address - Test App')
    assert.equal(callArgs.to, 'user@example.com')
  })

  test('sendVerificationEmail includes verification link with token in HTML', async ({
    assert,
  }) => {
    await mailService.sendVerificationEmail('user@example.com', 'my-verification-token', 'John')

    const callArgs = sendStub.firstCall.args[0]
    assert.include(callArgs.html, 'http://localhost:3000/verify-email?token=my-verification-token')
    assert.include(callArgs.html, 'Verify Email Address')
  })

  test('sendVerificationEmail includes verification link in text version', async ({ assert }) => {
    await mailService.sendVerificationEmail('user@example.com', 'my-verification-token', 'John')

    const callArgs = sendStub.firstCall.args[0]
    assert.include(callArgs.text, 'http://localhost:3000/verify-email?token=my-verification-token')
  })

  test('sendVerificationEmail personalizes email with username', async ({ assert }) => {
    await mailService.sendVerificationEmail('user@example.com', 'token', 'Jane Doe')

    const callArgs = sendStub.firstCall.args[0]
    assert.include(callArgs.html, 'Hi Jane Doe')
    assert.include(callArgs.text, 'Hi Jane Doe')
  })

  test('sendVerificationEmail uses fallback greeting without username', async ({ assert }) => {
    await mailService.sendVerificationEmail('user@example.com', 'token')

    const callArgs = sendStub.firstCall.args[0]
    assert.include(callArgs.html, 'Hi there')
    assert.include(callArgs.text, 'Hi there')
  })

  // ==================== sendPasswordResetEmail() tests ====================

  test('sendPasswordResetEmail sends with correct subject', async ({ assert }) => {
    await mailService.sendPasswordResetEmail('user@example.com', 'reset-token', 'John')

    assert.isTrue(sendStub.calledOnce)
    const callArgs = sendStub.firstCall.args[0]
    assert.equal(callArgs.subject, 'Reset your password - Test App')
    assert.equal(callArgs.to, 'user@example.com')
  })

  test('sendPasswordResetEmail includes reset link with token in HTML', async ({ assert }) => {
    await mailService.sendPasswordResetEmail('user@example.com', 'my-reset-token', 'John')

    const callArgs = sendStub.firstCall.args[0]
    assert.include(callArgs.html, 'http://localhost:3000/reset-password?token=my-reset-token')
    assert.include(callArgs.html, 'Reset Password')
  })

  test('sendPasswordResetEmail includes reset link in text version', async ({ assert }) => {
    await mailService.sendPasswordResetEmail('user@example.com', 'my-reset-token', 'John')

    const callArgs = sendStub.firstCall.args[0]
    assert.include(callArgs.text, 'http://localhost:3000/reset-password?token=my-reset-token')
  })

  test('sendPasswordResetEmail personalizes email with username', async ({ assert }) => {
    await mailService.sendPasswordResetEmail('user@example.com', 'token', 'Bob Smith')

    const callArgs = sendStub.firstCall.args[0]
    assert.include(callArgs.html, 'Hi Bob Smith')
    assert.include(callArgs.text, 'Hi Bob Smith')
  })

  test('sendPasswordResetEmail uses fallback greeting without username', async ({ assert }) => {
    await mailService.sendPasswordResetEmail('user@example.com', 'token')

    const callArgs = sendStub.firstCall.args[0]
    assert.include(callArgs.html, 'Hi there')
    assert.include(callArgs.text, 'Hi there')
  })

  // ==================== sendTeamInvitationEmail() tests ====================

  test('sendTeamInvitationEmail sends with correct subject', async ({ assert }) => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await mailService.sendTeamInvitationEmail(
      'invitee@example.com',
      'Awesome Team',
      'John Doe',
      'invite-token',
      'member',
      expiresAt
    )

    assert.isTrue(sendStub.calledOnce)
    const callArgs = sendStub.firstCall.args[0]
    assert.equal(callArgs.subject, "You've been invited to join Awesome Team")
    assert.equal(callArgs.to, 'invitee@example.com')
  })

  test('sendTeamInvitationEmail includes invite link with token', async ({ assert }) => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await mailService.sendTeamInvitationEmail(
      'invitee@example.com',
      'Awesome Team',
      'John Doe',
      'my-invite-token',
      'admin',
      expiresAt
    )

    const callArgs = sendStub.firstCall.args[0]
    assert.include(callArgs.html, 'http://localhost:3000/team/invite?token=my-invite-token')
    assert.include(callArgs.text, 'http://localhost:3000/team/invite?token=my-invite-token')
  })

  test('sendTeamInvitationEmail includes team name and inviter name', async ({ assert }) => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await mailService.sendTeamInvitationEmail(
      'invitee@example.com',
      'My Super Team',
      'Alice Johnson',
      'token',
      'member',
      expiresAt
    )

    const callArgs = sendStub.firstCall.args[0]
    assert.include(callArgs.html, 'Alice Johnson')
    assert.include(callArgs.html, 'My Super Team')
    assert.include(callArgs.text, 'Alice Johnson')
    assert.include(callArgs.text, 'My Super Team')
  })

  test('sendTeamInvitationEmail includes role information', async ({ assert }) => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await mailService.sendTeamInvitationEmail(
      'invitee@example.com',
      'Team',
      'Inviter',
      'token',
      'admin',
      expiresAt
    )

    const callArgs = sendStub.firstCall.args[0]
    assert.include(callArgs.html, '<strong>admin</strong>')
    assert.include(callArgs.text, 'as a admin')
  })

  test('sendTeamInvitationEmail includes expiration date', async ({ assert }) => {
    const expiresAt = new Date('2025-12-31T00:00:00.000Z')

    await mailService.sendTeamInvitationEmail(
      'invitee@example.com',
      'Team',
      'Inviter',
      'token',
      'member',
      expiresAt
    )

    const callArgs = sendStub.firstCall.args[0]
    // The formatted date will include "December" and "2025"
    assert.include(callArgs.html, 'December')
    assert.include(callArgs.html, '2025')
  })

  // ==================== sendSubscriptionExpirationEmail() tests ====================

  test('sendSubscriptionExpirationEmail sends with correct subject', async ({ assert }) => {
    await mailService.sendSubscriptionExpirationEmail(
      'user@example.com',
      'John Doe',
      'user',
      'John Doe',
      'tier2'
    )

    assert.isTrue(sendStub.calledOnce)
    const callArgs = sendStub.firstCall.args[0]
    assert.equal(callArgs.subject, 'Your subscription has expired - Test App')
    assert.equal(callArgs.to, 'user@example.com')
  })

  test('sendSubscriptionExpirationEmail for user subscription', async ({ assert }) => {
    await mailService.sendSubscriptionExpirationEmail(
      'user@example.com',
      'John Doe',
      'user',
      'John Doe',
      'Premium'
    )

    const callArgs = sendStub.firstCall.args[0]
    assert.include(callArgs.html, 'Hi John Doe')
    assert.include(callArgs.html, '<strong>Premium</strong>')
    assert.include(callArgs.html, 'your account')
    assert.notInclude(callArgs.html, 'the team')
  })

  test('sendSubscriptionExpirationEmail for team subscription', async ({ assert }) => {
    await mailService.sendSubscriptionExpirationEmail(
      'owner@example.com',
      'Jane Doe',
      'team',
      'Awesome Team',
      'Enterprise'
    )

    const callArgs = sendStub.firstCall.args[0]
    assert.include(callArgs.html, 'Hi Jane Doe')
    assert.include(callArgs.html, '<strong>Enterprise</strong>')
    assert.include(callArgs.html, 'the team "Awesome Team"')
  })

  test('sendSubscriptionExpirationEmail includes renewal link', async ({ assert }) => {
    await mailService.sendSubscriptionExpirationEmail(
      'user@example.com',
      'John',
      'user',
      'John',
      'tier1'
    )

    const callArgs = sendStub.firstCall.args[0]
    assert.include(callArgs.html, 'http://localhost:3000/dashboard/billing')
    assert.include(callArgs.text, 'http://localhost:3000/dashboard/billing')
    assert.include(callArgs.html, 'Renew Subscription')
  })

  test('sendSubscriptionExpirationEmail mentions downgrade to free tier', async ({ assert }) => {
    await mailService.sendSubscriptionExpirationEmail(
      'user@example.com',
      'John',
      'user',
      'John',
      'Pro'
    )

    const callArgs = sendStub.firstCall.args[0]
    assert.include(callArgs.html, 'downgraded to the free tier')
    assert.include(callArgs.text, 'downgraded to the free tier')
  })

  // ==================== Dev mode tests (no API key) ====================

  test('send logs to console in dev mode when RESEND_API_KEY is not set', async ({ assert }) => {
    // Create a service that simulates no API key by setting resend to null
    const DevMailService = class extends MailService {
      constructor() {
        super()
        // Override the resend to null to simulate dev mode
        ;(this as unknown as { resend: null }).resend = null
      }
    }

    const devMailService = new DevMailService()
    const consoleSpy = sinon.spy(console, 'log')

    const result = await devMailService.send({
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test HTML</p>',
    })

    assert.isTrue(result.success)
    assert.equal(result.id, 'dev-mode')
    assert.isTrue(consoleSpy.called)

    // Check that email details were logged
    const logCalls = consoleSpy.getCalls().map((call) => call.args.join(' '))
    assert.isTrue(logCalls.some((log) => log.includes('test@example.com')))
    assert.isTrue(logCalls.some((log) => log.includes('Test Subject')))

    consoleSpy.restore()
  })
})
