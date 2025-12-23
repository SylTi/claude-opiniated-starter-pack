import { test } from '@japa/runner'
import MailService from '#services/mail_service'

test.group('MailService', () => {
  test('send logs to console when RESEND_API_KEY is not set', async ({ assert }) => {
    const mailService = new MailService()

    const result = await mailService.send({
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test HTML</p>',
    })

    assert.isTrue(result.success)
    assert.equal(result.id, 'dev-mode')
  })

  test('send handles array of recipients', async ({ assert }) => {
    const mailService = new MailService()

    const result = await mailService.send({
      to: ['test1@example.com', 'test2@example.com'],
      subject: 'Test Subject',
      html: '<p>Test HTML</p>',
    })

    assert.isTrue(result.success)
    assert.equal(result.id, 'dev-mode')
  })

  test('sendVerificationEmail sends verification email', async ({ assert }) => {
    const mailService = new MailService()

    const result = await mailService.sendVerificationEmail(
      'test@example.com',
      'verification-token-123',
      'John Doe'
    )

    assert.isTrue(result.success)
  })

  test('sendVerificationEmail works without username', async ({ assert }) => {
    const mailService = new MailService()

    const result = await mailService.sendVerificationEmail('test@example.com', 'verification-token')

    assert.isTrue(result.success)
  })

  test('sendPasswordResetEmail sends password reset email', async ({ assert }) => {
    const mailService = new MailService()

    const result = await mailService.sendPasswordResetEmail(
      'test@example.com',
      'reset-token-123',
      'Jane Doe'
    )

    assert.isTrue(result.success)
  })

  test('sendPasswordResetEmail works without username', async ({ assert }) => {
    const mailService = new MailService()

    const result = await mailService.sendPasswordResetEmail('test@example.com', 'reset-token')

    assert.isTrue(result.success)
  })

  test('sendTeamInvitationEmail sends team invitation email', async ({ assert }) => {
    const mailService = new MailService()

    const result = await mailService.sendTeamInvitationEmail(
      'invitee@example.com',
      'Awesome Team',
      'John Doe',
      'invitation-token-123',
      'member',
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    )

    assert.isTrue(result.success)
  })

  test('sendSubscriptionExpirationEmail sends expiration email for user', async ({ assert }) => {
    const mailService = new MailService()

    const result = await mailService.sendSubscriptionExpirationEmail(
      'user@example.com',
      'John Doe',
      'user',
      'John Doe',
      'tier1'
    )

    assert.isTrue(result.success)
  })

  test('sendSubscriptionExpirationEmail sends expiration email for team', async ({ assert }) => {
    const mailService = new MailService()

    const result = await mailService.sendSubscriptionExpirationEmail(
      'owner@example.com',
      'Jane Doe',
      'team',
      'Awesome Team',
      'tier2'
    )

    assert.isTrue(result.success)
  })
})
