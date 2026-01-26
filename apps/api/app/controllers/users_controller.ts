import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'

/**
 * Users Controller
 *
 * SECURITY: All methods require authentication and proper authorization.
 * - Users can only view their own profile data
 * - Admin listing is available via AdminController (admin-only routes)
 */
export default class UsersController {
  /**
   * Get the authenticated user's own profile
   * GET /api/v1/users/me
   */
  async me({ auth, response }: HttpContext): Promise<void> {
    const user = auth.user!

    response.json({
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        mfaEnabled: user.mfaEnabled,
        currentTenantId: user.currentTenantId,
        createdAt: user.createdAt.toISO(),
        updatedAt: user.updatedAt?.toISO() ?? null,
      },
    })
  }

  /**
   * Get a user by ID
   * GET /api/v1/users/:id
   *
   * SECURITY: Users can only view their own profile.
   * Admin access to all users is available via AdminController.
   */
  async show({ params, auth, response }: HttpContext): Promise<void> {
    const currentUser = auth.user!
    const requestedId = Number(params.id)

    // Users can only view their own profile
    if (currentUser.id !== requestedId) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'You can only view your own profile',
      })
    }

    const user = await User.query()
      .select(
        'id',
        'email',
        'fullName',
        'role',
        'avatarUrl',
        'emailVerified',
        'mfaEnabled',
        'currentTenantId',
        'createdAt',
        'updatedAt'
      )
      .where('id', params.id)
      .firstOrFail()

    response.json({
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        mfaEnabled: user.mfaEnabled,
        currentTenantId: user.currentTenantId,
        createdAt: user.createdAt.toISO(),
        updatedAt: user.updatedAt?.toISO() ?? null,
      },
    })
  }
}
