import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import User from '#models/user'

export default class AdminController {
  /**
   * List all users with admin details
   */
  async listUsers({ response }: HttpContext): Promise<void> {
    const users = await User.query()
      .select(
        'id',
        'email',
        'fullName',
        'role',
        'emailVerified',
        'emailVerifiedAt',
        'mfaEnabled',
        'avatarUrl',
        'createdAt',
        'updatedAt'
      )
      .orderBy('createdAt', 'desc')

    response.json({
      data: users.map((user) => ({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt?.toISO() ?? null,
        mfaEnabled: user.mfaEnabled,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt.toISO(),
        updatedAt: user.updatedAt?.toISO() ?? null,
      })),
    })
  }

  /**
   * Manually verify a user's email
   */
  async verifyUserEmail({ params, response }: HttpContext): Promise<void> {
    const user = await User.findOrFail(params.id)

    if (user.emailVerified) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'User email is already verified',
      })
    }

    user.emailVerified = true
    user.emailVerifiedAt = DateTime.now()
    await user.save()

    response.json({
      data: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt?.toISO(),
      },
      message: 'User email has been verified successfully',
    })
  }

  /**
   * Manually unverify a user's email (for testing purposes)
   */
  async unverifyUserEmail({ params, response }: HttpContext): Promise<void> {
    const user = await User.findOrFail(params.id)

    if (!user.emailVerified) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'User email is already unverified',
      })
    }

    user.emailVerified = false
    user.emailVerifiedAt = null
    await user.save()

    response.json({
      data: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        emailVerifiedAt: null,
      },
      message: 'User email has been unverified successfully',
    })
  }

  /**
   * Delete a user
   */
  async deleteUser({ params, auth, response }: HttpContext): Promise<void> {
    const user = await User.findOrFail(params.id)
    const currentUser = auth.user!

    if (user.id === currentUser.id) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'You cannot delete your own account from admin panel',
      })
    }

    await user.delete()

    response.json({
      message: 'User has been deleted successfully',
    })
  }
}
