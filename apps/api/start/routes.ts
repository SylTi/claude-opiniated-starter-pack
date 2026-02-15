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
import {
  loginThrottle,
  registerThrottle,
  forgotPasswordThrottle,
  adminThrottle,
  apiThrottle,
} from '#start/limiter'

const UsersController = () => import('#controllers/users_controller')
const AuthController = () => import('#controllers/auth_controller')
const MfaController = () => import('#controllers/mfa_controller')
const OAuthController = () => import('#controllers/oauth_controller')
const AdminController = () => import('#controllers/admin_controller')
const AdminTiersController = () => import('#controllers/admin_tiers_controller')
const DashboardController = () => import('#controllers/dashboard_controller')
const TenantsController = () => import('#controllers/tenants_controller')
const PaymentController = () => import('#controllers/payment_controller')
const WebhookController = () => import('#controllers/webhook_controller')
const DiscountCodesController = () => import('#controllers/discount_codes_controller')
const CouponsController = () => import('#controllers/coupons_controller')
const NavigationController = () => import('#controllers/navigation_controller')
const AuthTokensController = () => import('#controllers/auth_tokens_controller')
const NotificationsController = () => import('#controllers/notifications_controller')

router.get('/', async () => {
  return {
    data: {
      status: 'ok',
      version: 'v1',
    },
  }
})

router
  .group(() => {
    // Auth - Public routes (with rate limiting)
    router
      .group(() => {
        router.post('/register', [AuthController, 'register']).use(registerThrottle)
        router.post('/login', [AuthController, 'login']).use(loginThrottle)
        router
          .post('/forgot-password', [AuthController, 'forgotPassword'])
          .use(forgotPasswordThrottle)
        router
          .post('/reset-password', [AuthController, 'resetPassword'])
          .use(forgotPasswordThrottle)
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
      .use([middleware.auth(), middleware.authContext(), apiThrottle])

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
      .use([middleware.auth(), middleware.authContext(), apiThrottle])

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
      .use([middleware.auth(), middleware.authContext(), apiThrottle])

    // Admin - Protected routes (admin only)
    router
      .group(() => {
        router.get('/stats', [AdminController, 'getStats'])
        router.get('/users', [AdminController, 'listUsers'])
        router.post('/users/:id/verify-email', [AdminController, 'verifyUserEmail'])
        router.post('/users/:id/unverify-email', [AdminController, 'unverifyUserEmail'])
        router.put('/users/:id/tier', [AdminController, 'updateUserTier'])
        router.delete('/users/:id', [AdminController, 'deleteUser'])
        router.get('/tenants', [AdminController, 'listTenants'])
        router.put('/tenants/:id/tier', [AdminController, 'updateTenantTier'])
        router.get('/tenants/:id/quotas', [AdminController, 'getTenantQuotas'])
        router.put('/tenants/:id/quotas', [AdminController, 'updateTenantQuotas'])

        // Subscription Tiers Management
        router.get('/tiers', [AdminTiersController, 'index'])
        router.post('/tiers', [AdminTiersController, 'store'])
        router.put('/tiers/:id', [AdminTiersController, 'update'])
        router.delete('/tiers/:id', [AdminTiersController, 'destroy'])

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

        // Discount Codes Management
        router.get('/discount-codes', [DiscountCodesController, 'index'])
        router.get('/discount-codes/:id', [DiscountCodesController, 'show'])
        router.post('/discount-codes', [DiscountCodesController, 'store'])
        router.put('/discount-codes/:id', [DiscountCodesController, 'update'])
        router.delete('/discount-codes/:id', [DiscountCodesController, 'destroy'])

        // Coupons Management
        router.get('/coupons', [CouponsController, 'index'])
        router.get('/coupons/:id', [CouponsController, 'show'])
        router.post('/coupons', [CouponsController, 'store'])
        router.put('/coupons/:id', [CouponsController, 'update'])
        router.delete('/coupons/:id', [CouponsController, 'destroy'])
      })
      .prefix('/admin')
      .use([
        middleware.auth(),
        middleware.authContext(),
        middleware.admin(),
        middleware.adminContext(),
        adminThrottle,
        apiThrottle,
      ])

    // Dashboard - Protected routes (any logged-in user)
    router
      .group(() => {
        router.get('/stats', [DashboardController, 'getUserStats'])
      })
      .prefix('/dashboard')
      .use([middleware.auth(), middleware.authContext(), apiThrottle])

    // Navigation - Protected routes (any logged-in user)
    // Single source of truth for nav composition with full hook pipeline
    router
      .group(() => {
        router.get('/model', [NavigationController, 'model'])
      })
      .prefix('/navigation')
      .use([middleware.auth(), middleware.authContext(), apiThrottle])

    // Auth Tokens - Protected tenant-scoped routes (user profile integrations)
    router
      .group(() => {
        router.get('/', [AuthTokensController, 'index'])
        router.post('/', [AuthTokensController, 'store'])
        router.delete('/:id', [AuthTokensController, 'destroy'])
      })
      .prefix('/auth-tokens')
      .use([middleware.auth(), middleware.tenant(), apiThrottle])

    // Notifications - Protected tenant-scoped routes (per-recipient inbox)
    router
      .group(() => {
        router.get('/', [NotificationsController, 'index'])
        router.get('/unread-count', [NotificationsController, 'unreadCount'])
        router.post('/read-all', [NotificationsController, 'markAllRead'])
        router.get('/:id', [NotificationsController, 'show'])
        router.post('/:id/read', [NotificationsController, 'markRead'])
      })
      .prefix('/notifications')
      .use([middleware.auth(), middleware.tenant(), apiThrottle])

    // Users - Protected routes (any logged-in user)
    // SECURITY: Users can only access their own data. Admin listing is via /admin/users
    router
      .group(() => {
        router.get('/me', [UsersController, 'me'])
        router.get('/:id', [UsersController, 'show'])
      })
      .prefix('/users')
      .use([middleware.auth(), middleware.authContext(), apiThrottle])

    // Tenants - Protected routes
    // Note: authContext sets user_id for RLS policies on tenants table
    router
      .group(() => {
        router.get('/', [TenantsController, 'index'])
        router.post('/', [TenantsController, 'store'])
        router.get('/:id', [TenantsController, 'show'])
        router.put('/:id', [TenantsController, 'update'])
        router.post('/:id/switch', [TenantsController, 'switchTenant'])
        router.post('/:id/members', [TenantsController, 'addMember'])
        router.put('/:id/members/:userId/role', [TenantsController, 'updateMemberRole'])
        router.delete('/:id/members/:userId', [TenantsController, 'removeMember'])
        router.get('/:id/quotas', [TenantsController, 'getQuotas'])
        router.put('/:id/quotas', [TenantsController, 'updateQuotas'])
        router.post('/:id/leave', [TenantsController, 'leave'])
        router.delete('/:id', [TenantsController, 'destroy'])
        // Invitations
        router.post('/:id/invitations', [TenantsController, 'sendInvitation'])
        router.get('/:id/invitations', [TenantsController, 'listInvitations'])
        router.delete('/:id/invitations/:invitationId', [TenantsController, 'cancelInvitation'])
      })
      .prefix('/tenants')
      .use([middleware.auth(), middleware.authContext(), apiThrottle])

    // Invitations - Public route (get invitation details by token)
    router.get('/invitations/:token', [TenantsController, 'getInvitationByToken'])

    // Invitations - Protected routes (accept/decline)
    router
      .group(() => {
        router.post('/:token/accept', [TenantsController, 'acceptInvitation'])
        router.post('/:token/decline', [TenantsController, 'declineInvitation'])
      })
      .prefix('/invitations')
      .use([middleware.auth(), middleware.authContext(), apiThrottle])

    // Billing - Public routes (pricing page)
    router.get('/billing/tiers', [PaymentController, 'getTiers'])

    // Billing - Protected routes
    // Note: Billing is tenant-specific. tenant() middleware verifies membership,
    // sets both app.user_id and app.tenant_id for RLS policies,
    // and requires X-Tenant-ID header (or tenant_id cookie).
    router
      .group(() => {
        router.post('/checkout', [PaymentController, 'createCheckout'])
        router.post('/portal', [PaymentController, 'createPortal'])
        router.get('/subscription', [PaymentController, 'getSubscription'])
        router.post('/cancel', [PaymentController, 'cancelSubscription'])
        // Discount codes and coupons
        router.post('/validate-discount-code', [DiscountCodesController, 'validate'])
        router.post('/redeem-coupon', [CouponsController, 'redeem'])
        router.get('/balance', [CouponsController, 'getBalance'])
      })
      .prefix('/billing')
      .use([middleware.auth(), middleware.tenant(), apiThrottle])

    // Webhooks - No auth (uses signature verification)
    // Raw body is captured by server-level WebhookRawBodyMiddleware before bodyparser runs
    router
      .group(() => {
        router.post('/stripe', [WebhookController, 'handleStripe'])
        router.post('/paddle', [WebhookController, 'handlePaddle'])
        router.post('/lemonsqueezy', [WebhookController, 'handleLemonSqueezy'])
        router.post('/polar', [WebhookController, 'handlePolar'])
      })
      .prefix('/webhooks')
  })
  .prefix('/api/v1')

// Enterprise features - consolidated in separate file (silently skipped if not available)
await import('#start/routes_enterprise_all').catch(() => {})

// Plugin system routes
await import('#start/routes_plugins').catch(() => {})
