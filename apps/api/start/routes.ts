/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const UsersController = () => import('#controllers/users_controller')
const AuthController = () => import('#controllers/auth_controller')
const MfaController = () => import('#controllers/mfa_controller')
const OAuthController = () => import('#controllers/oauth_controller')
const AdminController = () => import('#controllers/admin_controller')

router.get('/', async () => {
  return {
    hello: 'world',
  }
})

router
  .group(() => {
    // Users
    router.get('/users', [UsersController, 'index'])
    router.get('/users/:id', [UsersController, 'show'])

    // Auth - Public routes
    router
      .group(() => {
        router.post('/register', [AuthController, 'register'])
        router.post('/login', [AuthController, 'login'])
        router.post('/forgot-password', [AuthController, 'forgotPassword'])
        router.post('/reset-password', [AuthController, 'resetPassword'])
        router.get('/verify-email/:token', [AuthController, 'verifyEmail'])
      })
      .prefix('/auth')

    // Auth - Protected routes
    router
      .group(() => {
        router.post('/logout', [AuthController, 'logout'])
        router.get('/me', [AuthController, 'me'])
        router.put('/profile', [AuthController, 'updateProfile'])
        router.put('/password', [AuthController, 'changePassword'])
        router.post('/resend-verification', [AuthController, 'resendVerification'])
        router.get('/login-history', [AuthController, 'loginHistory'])
      })
      .prefix('/auth')
      .use(middleware.auth())

    // MFA - Protected routes
    router
      .group(() => {
        router.post('/setup', [MfaController, 'setup'])
        router.post('/enable', [MfaController, 'enable'])
        router.post('/disable', [MfaController, 'disable'])
        router.get('/status', [MfaController, 'status'])
        router.post('/regenerate-backup-codes', [MfaController, 'regenerateBackupCodes'])
      })
      .prefix('/auth/mfa')
      .use(middleware.auth())

    // OAuth - Public routes (redirects)
    router
      .group(() => {
        router.get('/:provider/redirect', [OAuthController, 'redirect'])
        router.get('/:provider/callback', [OAuthController, 'callback'])
      })
      .prefix('/auth/oauth')

    // OAuth - Protected routes (linking/unlinking)
    router
      .group(() => {
        router.get('/accounts', [OAuthController, 'accounts'])
        router.get('/:provider/link', [OAuthController, 'link'])
        router.get('/:provider/link/callback', [OAuthController, 'linkCallback'])
        router.delete('/:provider/unlink', [OAuthController, 'unlink'])
      })
      .prefix('/auth/oauth')
      .use(middleware.auth())

    // Admin - Protected routes (admin only)
    router
      .group(() => {
        router.get('/users', [AdminController, 'listUsers'])
        router.post('/users/:id/verify-email', [AdminController, 'verifyUserEmail'])
        router.post('/users/:id/unverify-email', [AdminController, 'unverifyUserEmail'])
        router.delete('/users/:id', [AdminController, 'deleteUser'])
      })
      .prefix('/admin')
      .use(middleware.auth())
  })
  .prefix('/api/v1')
