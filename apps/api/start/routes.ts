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
const DashboardController = () => import('#controllers/dashboard_controller')
const TeamsController = () => import('#controllers/teams_controller')
const PaymentController = () => import('#controllers/payment_controller')
const WebhookController = () => import('#controllers/webhook_controller')

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
        router.get('/stats', [AdminController, 'getStats'])
        router.get('/users', [AdminController, 'listUsers'])
        router.post('/users/:id/verify-email', [AdminController, 'verifyUserEmail'])
        router.post('/users/:id/unverify-email', [AdminController, 'unverifyUserEmail'])
        router.put('/users/:id/tier', [AdminController, 'updateUserTier'])
        router.delete('/users/:id', [AdminController, 'deleteUser'])
        router.get('/teams', [AdminController, 'listTeams'])
        router.put('/teams/:id/tier', [AdminController, 'updateTeamTier'])

        // Subscription Tiers Management
        router.get('/tiers', [AdminController, 'listTiers'])
        router.post('/tiers', [AdminController, 'createTier'])
        router.put('/tiers/:id', [AdminController, 'updateTier'])

        // Products Management (Tier <-> Stripe Product)
        router.get('/products', [AdminController, 'listProducts'])
        router.post('/products', [AdminController, 'createProduct'])
        router.put('/products/:id', [AdminController, 'updateProduct'])
        router.delete('/products/:id', [AdminController, 'deleteProduct'])

        // Prices Management
        router.get('/prices', [AdminController, 'listPrices'])
        router.post('/prices', [AdminController, 'createPrice'])
        router.put('/prices/:id', [AdminController, 'updatePrice'])
        router.delete('/prices/:id', [AdminController, 'deletePrice'])
      })
      .prefix('/admin')
      .use([middleware.auth(), middleware.admin()])

    // Dashboard - Protected routes (any logged-in user)
    router
      .group(() => {
        router.get('/stats', [DashboardController, 'getUserStats'])
      })
      .prefix('/dashboard')
      .use(middleware.auth())

    // Teams - Protected routes
    router
      .group(() => {
        router.get('/', [TeamsController, 'index'])
        router.post('/', [TeamsController, 'store'])
        router.get('/:id', [TeamsController, 'show'])
        router.put('/:id', [TeamsController, 'update'])
        router.post('/:id/switch', [TeamsController, 'switchTeam'])
        router.post('/:id/members', [TeamsController, 'addMember'])
        router.delete('/:id/members/:userId', [TeamsController, 'removeMember'])
        router.post('/:id/leave', [TeamsController, 'leave'])
        router.delete('/:id', [TeamsController, 'destroy'])
        // Invitations
        router.post('/:id/invitations', [TeamsController, 'sendInvitation'])
        router.get('/:id/invitations', [TeamsController, 'listInvitations'])
        router.delete('/:id/invitations/:invitationId', [TeamsController, 'cancelInvitation'])
      })
      .prefix('/teams')
      .use(middleware.auth())

    // Invitations - Public route (get invitation details by token)
    router.get('/invitations/:token', [TeamsController, 'getInvitationByToken'])

    // Invitations - Protected routes (accept/decline)
    router
      .group(() => {
        router.post('/:token/accept', [TeamsController, 'acceptInvitation'])
        router.post('/:token/decline', [TeamsController, 'declineInvitation'])
      })
      .prefix('/invitations')
      .use(middleware.auth())

    // Billing - Public routes (pricing page)
    router.get('/billing/tiers', [PaymentController, 'getTiers'])

    // Billing - Protected routes
    router
      .group(() => {
        router.post('/checkout', [PaymentController, 'createCheckout'])
        router.post('/portal', [PaymentController, 'createPortal'])
        router.get('/subscription', [PaymentController, 'getSubscription'])
        router.post('/cancel', [PaymentController, 'cancelSubscription'])
      })
      .prefix('/billing')
      .use(middleware.auth())

    // Webhooks - No auth (uses signature verification)
    router
      .group(() => {
        router.post('/stripe', [WebhookController, 'handleStripe']).use(middleware.rawBody())
      })
      .prefix('/webhooks')
  })
  .prefix('/api/v1')
