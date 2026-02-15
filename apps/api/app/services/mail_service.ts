import { Resend } from 'resend'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'

/**
 * Escape HTML special characters to prevent HTML injection in emails.
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  }
  return text.replace(/[&<>"']/g, (char) => map[char])
}

interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}

interface SendResult {
  success: boolean
  id?: string
  error?: string
}

export default class MailService {
  private resend: Resend | null
  private fromEmail: string
  private fromName: string
  private frontendUrl: string

  constructor() {
    const apiKey = env.get('RESEND_API_KEY')
    if (apiKey) {
      this.resend = new Resend(apiKey)
    } else {
      this.resend = null
      console.warn('RESEND_API_KEY is not set. Emails will be logged to console instead.')
    }
    this.fromEmail = env.get('MAIL_FROM_ADDRESS', 'noreply@example.com')
    this.fromName = env.get('MAIL_FROM_NAME', 'SaaS App')
    this.frontendUrl = env.get('FRONTEND_URL', 'http://localhost:3000')
  }

  /**
   * Send an email using Resend
   */
  async send(options: EmailOptions): Promise<SendResult> {
    // If no Resend client, log to console (for development/test)
    if (!this.resend) {
      console.log('=== EMAIL (dev mode - no RESEND_API_KEY) ===')
      console.log(`To: ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`)
      console.log(`Subject: ${options.subject}`)
      console.log(`From: ${this.fromName} <${this.fromEmail}>`)
      console.log(
        `Body: [redacted] (htmlLength=${options.html.length}, textLength=${options.text?.length ?? 0})`
      )
      console.log('=== END EMAIL ===')
      return { success: true, id: 'dev-mode' }
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
      })

      if (error) {
        logger.error({ err: error }, 'Resend API error')
        return { success: false, error: error.message }
      }

      return { success: true, id: data?.id }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logger.error({ message }, 'Mail send error')
      return { success: false, error: message }
    }
  }

  /**
   * Send email verification email
   */
  async sendVerificationEmail(
    email: string,
    token: string,
    userName?: string
  ): Promise<SendResult> {
    const verifyUrl = `${this.frontendUrl}/verify-email?token=${token}`
    const name = escapeHtml(userName || 'there')

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to ${this.fromName}!</h1>
  </div>
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #eee; border-top: none;">
    <p>Hi ${name},</p>
    <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verifyUrl}" style="background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Verify Email Address</a>
    </div>
    <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
    <p style="color: #667eea; word-break: break-all; font-size: 14px;">${verifyUrl}</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 12px;">This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
  </div>
</body>
</html>`

    const text = `
Hi ${name},

Thank you for signing up for ${this.fromName}!

Please verify your email address by visiting:
${verifyUrl}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.
`

    return this.send({
      to: email,
      subject: `Verify your email address - ${this.fromName}`,
      html,
      text,
    })
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    token: string,
    userName?: string
  ): Promise<SendResult> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`
    const name = escapeHtml(userName || 'there')

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Password Reset Request</h1>
  </div>
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #eee; border-top: none;">
    <p>Hi ${name},</p>
    <p>We received a request to reset your password. Click the button below to create a new password:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="background: #f5576c; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Reset Password</a>
    </div>
    <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
    <p style="color: #f5576c; word-break: break-all; font-size: 14px;">${resetUrl}</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 12px;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email - your password will remain unchanged.</p>
  </div>
</body>
</html>`

    const text = `
Hi ${name},

We received a request to reset your password for your ${this.fromName} account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email - your password will remain unchanged.
`

    return this.send({
      to: email,
      subject: `Reset your password - ${this.fromName}`,
      html,
      text,
    })
  }

  /**
   * Send tenant invitation email
   */
  async sendTenantInvitationEmail(
    email: string,
    tenantName: string,
    inviterName: string,
    token: string,
    role: string,
    expiresAt: Date
  ): Promise<SendResult> {
    const inviteUrl = `${this.frontendUrl}/tenant/invite?token=${token}`
    const expiryDate = expiresAt.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    // Escape user-provided values to prevent HTML injection
    const safeTenantName = escapeHtml(tenantName)
    const safeInviterName = escapeHtml(inviterName)
    const safeRole = escapeHtml(role)

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Workspace Invitation</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited!</h1>
  </div>
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #eee; border-top: none;">
    <p>Hi there,</p>
    <p><strong>${safeInviterName}</strong> has invited you to join <strong>${safeTenantName}</strong> as a <strong>${safeRole}</strong>.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${inviteUrl}" style="background: #11998e; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Accept Invitation</a>
    </div>
    <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
    <p style="color: #11998e; word-break: break-all; font-size: 14px;">${inviteUrl}</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 12px;">This invitation will expire on ${expiryDate}. If you don't want to join this workspace, you can safely ignore this email.</p>
  </div>
</body>
</html>`

    const text = `
Hi there,

${safeInviterName} has invited you to join "${safeTenantName}" as a ${safeRole}.

Click the link below to accept the invitation:
${inviteUrl}

This invitation will expire on ${expiryDate}.

If you don't want to join this workspace, you can safely ignore this email.
`

    return this.send({
      to: email,
      subject: `You've been invited to join ${safeTenantName}`,
      html,
      text,
    })
  }

  /**
   * Send subscription expiration email
   */
  async sendSubscriptionExpirationEmail(
    email: string,
    userName: string,
    tenantName: string,
    expiredTier: string
  ): Promise<SendResult> {
    const renewUrl = `${this.frontendUrl}/dashboard/billing`

    // Escape user-provided values to prevent HTML injection
    const safeName = escapeHtml(userName || 'there')
    const safeTenantName = escapeHtml(tenantName)
    const safeTier = escapeHtml(expiredTier)

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Expired</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: #333; margin: 0; font-size: 24px;">Subscription Expired</h1>
  </div>
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #eee; border-top: none;">
    <p>Hi ${safeName},</p>
    <p>Your <strong>${safeTier}</strong> subscription for <strong>${safeTenantName}</strong> has expired.</p>
    <p>Your workspace has been downgraded to the free tier. To regain access to premium features, please renew your subscription.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${renewUrl}" style="background: #fcb69f; color: #333; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Renew Subscription</a>
    </div>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 12px;">If you have any questions about your subscription, please contact our support team.</p>
  </div>
</body>
</html>`

    const text = `
Hi ${safeName},

Your ${safeTier} subscription for "${safeTenantName}" has expired.

Your workspace has been downgraded to the free tier. To regain access to premium features, please renew your subscription:
${renewUrl}

If you have any questions about your subscription, please contact our support team.
`

    return this.send({
      to: email,
      subject: `Your subscription has expired - ${this.fromName}`,
      html,
      text,
    })
  }
}
