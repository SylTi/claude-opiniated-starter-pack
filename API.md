# API Documentation

This document describes all available API endpoints for the SaaS application.

Base URL: `/api/v1`

## Authentication

### Public Auth Routes

| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| POST | `/auth/register` | Register a new user (creates personal tenant) | Yes |
| POST | `/auth/login` | Login with email/password | Yes |
| POST | `/auth/forgot-password` | Request password reset email | Yes |
| POST | `/auth/reset-password` | Reset password with token | Yes |
| GET | `/auth/verify-email/:token` | Verify email address | No |

### Protected Auth Routes (requires auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/logout` | Logout current session |
| GET | `/auth/me` | Get current user info + tenant |
| PUT | `/auth/profile` | Update user profile |
| PUT | `/auth/password` | Change password |
| POST | `/auth/resend-verification` | Resend email verification |
| GET | `/auth/login-history` | Get login history |

### MFA Routes (requires auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/mfa/setup` | Generate MFA secret/QR code |
| POST | `/auth/mfa/enable` | Enable MFA with TOTP code |
| POST | `/auth/mfa/disable` | Disable MFA |
| GET | `/auth/mfa/status` | Get MFA status |
| POST | `/auth/mfa/regenerate-backup-codes` | Regenerate backup codes |

### OAuth Routes

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/auth/oauth/:provider/redirect` | Start OAuth flow | No |
| GET | `/auth/oauth/:provider/callback` | OAuth callback | No |
| GET | `/auth/oauth/accounts` | List linked OAuth accounts | Yes |
| GET | `/auth/oauth/:provider/link` | Link OAuth account | Yes |
| GET | `/auth/oauth/:provider/link/callback` | Link callback | Yes |
| DELETE | `/auth/oauth/:provider/unlink` | Unlink OAuth account | Yes |

### Enterprise SSO Routes (Public)

| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| GET | `/auth/sso/:tenantId/start` | Start SSO flow (redirects to IdP) | Yes |
| GET | `/auth/sso/:tenantId/callback` | OIDC callback (code exchange) | Yes |
| POST | `/auth/sso/:tenantId/callback` | SAML ACS callback (POST binding) | Yes |
| GET | `/auth/sso/:tenantId/metadata` | Get SAML SP metadata XML | No |
| GET | `/auth/sso/:tenantId/check` | Check if SSO is enabled for tenant | No |

**SSO Check Response:**
```json
{
  "data": {
    "ssoEnabled": true,
    "providerType": "oidc",
    "displayName": "Okta",
    "passwordLoginAllowed": false
  }
}
```

---

## Tenants

All tenant routes require authentication. The `X-Tenant-ID` header can be included to specify tenant context.

### Tenant CRUD

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tenants` | List all tenants for current user |
| POST | `/tenants` | Create a new team tenant |
| GET | `/tenants/:id` | Get tenant details with members |
| PUT | `/tenants/:id` | Update tenant (name) |
| DELETE | `/tenants/:id` | Delete tenant (owner only) |

### Tenant Actions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tenants/:id/switch` | Switch current tenant |
| POST | `/tenants/:id/members` | Add member to tenant |
| DELETE | `/tenants/:id/members/:userId` | Remove member from tenant |
| POST | `/tenants/:id/leave` | Leave tenant (owner cannot leave) |

### Tenant Invitations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tenants/:id/invitations` | Send invitation email |
| GET | `/tenants/:id/invitations` | List pending invitations |
| DELETE | `/tenants/:id/invitations/:invitationId` | Cancel invitation |

### Tenant SSO Configuration (requires auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tenants/:id/sso/config` | Get SSO configuration |
| POST | `/tenants/:id/sso/config` | Create SSO configuration |
| PUT | `/tenants/:id/sso/config` | Update SSO configuration |
| DELETE | `/tenants/:id/sso/config` | Delete SSO configuration |
| POST | `/tenants/:id/sso/validate` | Validate SSO configuration |
| POST | `/tenants/:id/sso/enable` | Enable SSO |
| POST | `/tenants/:id/sso/disable` | Disable SSO |

### Invitation Public Routes

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/invitations/:token` | Get invitation details | No |
| POST | `/invitations/:token/accept` | Accept invitation | Yes |
| POST | `/invitations/:token/decline` | Decline invitation | Yes |

---

## Billing

### Public Billing Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/billing/tiers` | Get all subscription tiers with prices |

### Protected Billing Routes (requires auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/billing/checkout` | Create Stripe checkout session |
| POST | `/billing/portal` | Create Stripe customer portal session |
| GET | `/billing/subscription` | Get current subscription status |
| POST | `/billing/cancel` | Cancel subscription |
| POST | `/billing/validate-discount-code` | Validate a discount code |
| POST | `/billing/redeem-coupon` | Redeem a coupon for credit |
| GET | `/billing/balance` | Get tenant balance |

---

## Users (requires auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/me` | Get authenticated user's own profile |
| GET | `/users/:id` | Get user by ID (own profile only) |

**Note:** Users can only access their own profile data. Admin user listing is available via `/admin/users`.

---

## Dashboard (requires auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard/stats` | Get user dashboard stats |

---

## Notifications (requires auth + tenant context)

Notification routes require authentication and tenant context (`X-Tenant-ID` header).
Responses are always scoped to the authenticated user as recipient.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | List notifications for current user in current tenant |
| GET | `/notifications/unread-count` | Get unread notifications count for current user |
| POST | `/notifications/read-all` | Mark all unread notifications as read for current user |
| GET | `/notifications/:id` | Get one notification (recipient-scoped) |
| POST | `/notifications/:id/read` | Mark notification as read |

**List query params**
- `unreadOnly` (`true|false`, optional, default `false`)
- `limit` (integer `1..100`, optional, default `50`)
- `beforeId` (positive integer, optional, for cursor-style pagination)

---

## Admin Routes

All admin routes require authentication and admin role.

### User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/stats` | Get admin dashboard stats |
| GET | `/admin/users` | List all users |
| POST | `/admin/users/:id/verify-email` | Force verify user email |
| POST | `/admin/users/:id/unverify-email` | Unverify user email |
| PUT | `/admin/users/:id/tier` | Update user subscription tier |
| DELETE | `/admin/users/:id` | Delete user |

### Tenant Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/tenants` | List all tenants |
| PUT | `/admin/tenants/:id/tier` | Update tenant subscription tier |

### Subscription Tiers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/tiers` | List all subscription tiers |
| POST | `/admin/tiers` | Create a new tier |
| PUT | `/admin/tiers/:id` | Update a tier |
| DELETE | `/admin/tiers/:id` | Delete a tier |

### Products (Tier to Stripe mapping)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/products` | List all products |
| POST | `/admin/products` | Create a product |
| PUT | `/admin/products/:id` | Update a product |
| DELETE | `/admin/products/:id` | Delete a product |

### Prices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/prices` | List all prices |
| POST | `/admin/prices` | Create a price |
| PUT | `/admin/prices/:id` | Update a price |
| DELETE | `/admin/prices/:id` | Delete a price |

### Discount Codes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/discount-codes` | List all discount codes |
| GET | `/admin/discount-codes/:id` | Get discount code by ID |
| POST | `/admin/discount-codes` | Create a discount code |
| PUT | `/admin/discount-codes/:id` | Update a discount code |
| DELETE | `/admin/discount-codes/:id` | Delete a discount code |

### Coupons

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/coupons` | List all coupons |
| GET | `/admin/coupons/:id` | Get coupon by ID |
| POST | `/admin/coupons` | Create a coupon |
| PUT | `/admin/coupons/:id` | Update a coupon |
| DELETE | `/admin/coupons/:id` | Delete a coupon |

---

## Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhooks/stripe` | Handle Stripe webhooks |

---

## Response Format

### Success Response

```json
{
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response

```json
{
  "error": "ErrorType",
  "message": "Human readable message",
  "errors": [
    { "field": "email", "message": "Invalid email", "rule": "email" }
  ]
}
```

---

## Headers

| Header | Description | Required |
|--------|-------------|----------|
| `X-Tenant-ID` | Current tenant ID for tenant-scoped operations | Optional |
| `X-XSRF-TOKEN` | CSRF token for state-changing requests | Required for POST/PUT/DELETE |
| `Cookie` | Session cookie for authentication | Required for protected routes |

---

## Tenant Types

- `personal`: Auto-created for each user on registration
- `team`: Created by users for team collaboration

## Tenant Roles

- `owner`: Full control, cannot leave tenant
- `admin`: Can manage members and invitations
- `member`: Basic access

## Invitation Roles

- `admin`: Invited as admin
- `member`: Invited as member

---

## RBAC (Role-Based Access Control)

The application uses a code-based RBAC system for tenant-scoped authorization.

### Principles

- **Deny by default**: Unknown roles or actions are denied
- **Explicit allow lists**: Each role has a defined list of permitted actions
- **Pure functions**: Authorization decisions are deterministic and testable
- **Code-based**: Permissions are defined in code, not database, for version control

### Actions

| Action | Description |
|--------|-------------|
| `tenant:read` | View tenant details |
| `tenant:update` | Update tenant name/settings |
| `tenant:delete` | Delete the tenant |
| `member:list` | View member list |
| `member:add` | Add new members |
| `member:remove` | Remove members |
| `member:update_role` | Change member roles |
| `invitation:list` | View pending invitations |
| `invitation:send` | Send new invitations |
| `invitation:cancel` | Cancel pending invitations |
| `billing:view` | View billing information |
| `billing:manage` | Manage payment methods |
| `subscription:view` | View subscription status |
| `subscription:upgrade` | Upgrade subscription |
| `subscription:cancel` | Cancel subscription |
| `sso:view` | View SSO configuration |
| `sso:manage` | Manage SSO configuration |

### Role Permissions Matrix

| Action | Owner | Admin | Member |
|--------|:-----:|:-----:|:------:|
| `tenant:read` | ✓ | ✓ | ✓ |
| `tenant:update` | ✓ | ✓ | ✗ |
| `tenant:delete` | ✓ | ✗ | ✗ |
| `member:list` | ✓ | ✓ | ✓ |
| `member:add` | ✓ | ✓ | ✗ |
| `member:remove` | ✓ | ✓ | ✗ |
| `member:update_role` | ✓ | ✗ | ✗ |
| `invitation:list` | ✓ | ✓ | ✗ |
| `invitation:send` | ✓ | ✓ | ✗ |
| `invitation:cancel` | ✓ | ✓ | ✗ |
| `billing:view` | ✓ | ✓ | ✓ |
| `billing:manage` | ✓ | ✗ | ✗ |
| `subscription:view` | ✓ | ✓ | ✓ |
| `subscription:upgrade` | ✓ | ✓ | ✗ |
| `subscription:cancel` | ✓ | ✗ | ✗ |
| `sso:view` | ✓ | ✓ | ✗ |
| `sso:manage` | ✓ | ✓ | ✗ |

### RBAC Denied Response

When an action is denied due to insufficient permissions:

```json
{
  "error": "RbacDenied",
  "message": "You do not have permission to perform this action",
  "deniedActions": ["tenant:delete"]
}
```

HTTP Status: `403 Forbidden`
