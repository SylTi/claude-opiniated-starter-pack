# API Documentation

This document provides an overview of all REST API endpoints available in the application.

Base URL: `/api/v1`

## Authentication

Most endpoints require authentication via session cookies. Protected endpoints return `401 Unauthorized` if not authenticated.

## Response Format

All responses follow this format:

```json
// Success
{ "data": T | T[], "message"?: "Optional" }

// Error
{
  "error": "ErrorType",
  "message": "Human readable",
  "errors"?: [{ "field": "email", "message": "...", "rule": "..." }]
}
```

---

## Admin - Subscription Tiers

### List Subscription Tiers

```
GET /api/v1/admin/tiers
```

**Authentication:** Admin required

### Create Subscription Tier

```
POST /api/v1/admin/tiers
```

**Authentication:** Admin required

**Request Body:**
```json
{
  "slug": "pro",
  "name": "Pro",
  "level": 1,
  "maxTeamMembers": 5,
  "priceMonthly": 999,
  "yearlyDiscountPercent": 20,
  "features": { "support": "email" },
  "isActive": true
}
```

### Update Subscription Tier

```
PUT /api/v1/admin/tiers/:id
```

**Authentication:** Admin required

### Delete Subscription Tier

```
DELETE /api/v1/admin/tiers/:id
```

**Authentication:** Admin required

---

## Billing

### Get Subscription Tiers

Get all available subscription tiers with their prices.

```
GET /api/v1/billing/tiers
```

**Authentication:** Not required

**Response:**
```json
{
  "data": [
    {
      "tier": {
        "id": 1,
        "slug": "free",
        "name": "Free",
        "level": 0,
        "maxTeamMembers": 1,
        "priceMonthly": 0,
        "yearlyDiscountPercent": 0,
        "features": {},
        "isActive": true
      },
      "prices": [
        {
          "id": 1,
          "interval": "month",
          "currency": "usd",
          "unitAmount": 0,
          "taxBehavior": "inclusive",
          "isActive": true
        }
      ]
    }
  ]
}
```

### Create Checkout Session

Create a checkout session for subscription purchase. **Tenant is the billing unit** - all subscriptions are scoped to tenants.

```
POST /api/v1/billing/checkout
```

**Authentication:** Required (must be tenant admin)

**Request Body:**
```json
{
  "priceId": 1,
  "tenantId": 1,                   // Required: tenant to subscribe
  "discountCode": "SUMMER20"       // Optional: discount code to apply
}
```

**Response:**
```json
{
  "data": {
    "sessionId": "cs_xxx",
    "url": "https://checkout.stripe.com/..."
  }
}
```

### Create Customer Portal Session

Create a session to manage billing in the customer portal.

```
POST /api/v1/billing/portal
```

**Authentication:** Required (must be tenant admin)

**Request Body:**
```json
{
  "returnUrl": "https://example.com/billing",
  "tenantId": 1                    // Required: tenant to manage billing for
}
```

**Response:**
```json
{
  "data": {
    "url": "https://billing.stripe.com/..."
  }
}
```

### Get Current Subscription

Get the tenant's current subscription status.

```
GET /api/v1/billing/subscription
```

**Authentication:** Required (must be tenant member)

**Query Parameters:**
- `tenantId` (required): ID of the tenant

**Response:**
```json
{
  "data": {
    "subscription": {
      "id": 1,
      "tenantId": 1,
      "tier": {
        "id": 2,
        "slug": "tier1",
        "name": "Pro",
        "level": 1,
        "maxTeamMembers": 20,
        "priceMonthly": 1999,
        "yearlyDiscountPercent": 20,
        "features": {"support": "email"},
        "isActive": true
      },
      "status": "active",
      "startsAt": "2024-01-01T00:00:00.000Z",
      "expiresAt": "2025-01-01T00:00:00.000Z",
      "providerName": "stripe",
      "providerSubscriptionId": "sub_xxx"
    },
    "canManage": true,
    "hasPaymentMethod": true
  }
}
```

### Cancel Subscription

Cancel the current subscription.

```
POST /api/v1/billing/cancel
```

**Authentication:** Required (must be tenant admin)

**Request Body:**
```json
{
  "tenantId": 1                    // Required: tenant to cancel subscription for
}
```

### Validate Discount Code

Validate a discount code before checkout.

```
POST /api/v1/billing/validate-discount-code
```

**Authentication:** Required

**Request Body:**
```json
{
  "code": "SUMMER20",
  "priceId": 1,
  "tenantId": 1                    // Required: tenant to validate against
}
```

**Response:**
```json
{
  "data": {
    "valid": true,
    "discountCode": {
      "id": 1,
      "code": "SUMMER20",
      "description": "Summer sale",
      "discountType": "percent",
      "discountValue": 20,
      "currency": null,
      "minAmount": null,
      "maxUses": 100,
      "maxUsesPerTenant": 1,
      "timesUsed": 5,
      "expiresAt": "2024-12-31T23:59:59.000Z",
      "isActive": true
    },
    "originalAmount": 1000,
    "discountedAmount": 800,
    "discountApplied": 200,
    "message": "Discount code applied successfully"
  }
}
```

### Redeem Coupon

Redeem a coupon to add credit to the tenant's balance.

```
POST /api/v1/billing/redeem-coupon
```

**Authentication:** Required (must be tenant admin)

**Request Body:**
```json
{
  "code": "GIFT50",
  "tenantId": 1                    // Required: tenant to add credit to
}
```

**Response:**
```json
{
  "data": {
    "success": true,
    "creditAmount": 5000,
    "currency": "usd",
    "newBalance": 5000,
    "message": "Coupon redeemed successfully! $50.00 has been added to your tenant balance."
  }
}
```

### Get Balance

Get the current credit balance for a tenant.

```
GET /api/v1/billing/balance
```

**Authentication:** Required (must be tenant member)

**Query Parameters:**
- `tenantId` (required): Get balance for the specified tenant

**Response:**
```json
{
  "data": {
    "balance": 5000,
    "currency": "usd"
  }
}
```

---

## Admin - Discount Codes

Admin endpoints for managing discount codes. Requires admin role.

### List Discount Codes

```
GET /api/v1/admin/discount-codes
```

**Authentication:** Required (Admin)

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "code": "SUMMER20",
      "description": "Summer sale",
      "discountType": "percent",
      "discountValue": 20,
      "currency": null,
      "minAmount": null,
      "maxUses": 100,
      "maxUsesPerTenant": 1,
      "timesUsed": 5,
      "expiresAt": "2024-12-31T23:59:59.000Z",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Get Discount Code

```
GET /api/v1/admin/discount-codes/:id
```

**Authentication:** Required (Admin)

### Create Discount Code

```
POST /api/v1/admin/discount-codes
```

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "code": "SUMMER20",
  "description": "Summer sale",           // Optional
  "discountType": "percent",               // "percent" | "fixed"
  "discountValue": 20,                     // Percentage or cents
  "currency": "usd",                       // Required for "fixed" type
  "minAmount": 1000,                       // Optional: minimum order in cents
  "maxUses": 100,                          // Optional: total usage limit
  "maxUsesPerTenant": 1,                   // Optional: per-tenant limit
  "expiresAt": "2024-12-31",               // Optional: expiration date
  "isActive": true                         // Optional: defaults to true
}
```

### Update Discount Code

```
PUT /api/v1/admin/discount-codes/:id
```

**Authentication:** Required (Admin)

**Request Body:** Same as create (all fields optional)

### Delete Discount Code

```
DELETE /api/v1/admin/discount-codes/:id
```

**Authentication:** Required (Admin)

---

## Admin - Coupons

Admin endpoints for managing single-use coupons. Requires admin role.

### List Coupons

```
GET /api/v1/admin/coupons
```

**Authentication:** Required (Admin)

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "code": "GIFT50",
      "description": "Gift coupon",
      "creditAmount": 5000,
      "currency": "usd",
      "expiresAt": "2024-12-31T23:59:59.000Z",
      "isActive": true,
      "redeemedByUserId": null,
      "redeemedByUserEmail": null,
      "redeemedForTenantId": null,
      "redeemedForTenantName": null,
      "redeemedAt": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Get Coupon

```
GET /api/v1/admin/coupons/:id
```

**Authentication:** Required (Admin)

### Create Coupon

```
POST /api/v1/admin/coupons
```

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "code": "GIFT50",
  "description": "Gift coupon",           // Optional
  "creditAmount": 5000,                    // Amount in cents
  "currency": "usd",                       // Optional: defaults to "usd"
  "expiresAt": "2024-12-31",               // Optional: expiration date
  "isActive": true                         // Optional: defaults to true
}
```

### Update Coupon

```
PUT /api/v1/admin/coupons/:id
```

**Authentication:** Required (Admin)

**Request Body:** Same as create (all fields optional)

**Note:** Cannot update a coupon that has been redeemed.

### Delete Coupon

```
DELETE /api/v1/admin/coupons/:id
```

**Authentication:** Required (Admin)

---

## Admin - Users

Admin endpoints for managing users.

### List Users

```
GET /api/v1/admin/users
```

**Authentication:** Required (Admin)

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "email": "user@example.com",
      "fullName": "John Doe",
      "role": "user",
      "emailVerified": true,
      "mfaEnabled": false,
      "avatarUrl": null,
      "balance": 0,
      "balanceCurrency": "usd",
      "currentTenantId": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Get User

```
GET /api/v1/admin/users/:id
```

**Authentication:** Required (Admin)

### Update User

```
PUT /api/v1/admin/users/:id
```

**Authentication:** Required (Admin)

---

## Admin - Tenants

Admin endpoints for managing tenants.

### List Tenants

```
GET /api/v1/admin/tenants
```

**Authentication:** Required (Admin)

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Acme Corp",
      "slug": "acme-corp",
      "type": "team",
      "ownerId": 1,
      "maxMembers": null,
      "balance": 5000,
      "balanceCurrency": "usd",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Update Tenant Tier

```
PUT /api/v1/admin/tenants/:id/tier
```

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "tierId": 2
}
```

---

## Admin - Users (Additional Actions)

### Verify User Email

Manually verify a user's email address.

```
POST /api/v1/admin/users/:id/verify-email
```

**Authentication:** Required (Admin)

### Unverify User Email

Remove email verification from a user.

```
POST /api/v1/admin/users/:id/unverify-email
```

**Authentication:** Required (Admin)

### Update User Tier

```
PUT /api/v1/admin/users/:id/tier
```

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "tierId": 2
}
```

### Delete User

```
DELETE /api/v1/admin/users/:id
```

**Authentication:** Required (Admin)

---

## Admin - Products

Admin endpoints for managing payment products (Stripe integration). Requires admin role.

### List Products

```
GET /api/v1/admin/products
```

**Authentication:** Required (Admin)

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "tierId": 2,
      "provider": "stripe",
      "providerProductId": "prod_xxx",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Create Product

Link a Stripe product to a subscription tier.

```
POST /api/v1/admin/products
```

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "tierId": 2,
  "provider": "stripe",
  "providerProductId": "prod_xxx"
}
```

### Update Product

```
PUT /api/v1/admin/products/:id
```

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "providerProductId": "prod_yyy"
}
```

### Delete Product

```
DELETE /api/v1/admin/products/:id
```

**Authentication:** Required (Admin)

---

## Admin - Prices

Admin endpoints for managing payment prices (Stripe integration). Requires admin role.

### List Prices

```
GET /api/v1/admin/prices
```

**Authentication:** Required (Admin)

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "productId": 1,
      "provider": "stripe",
      "providerPriceId": "price_xxx",
      "interval": "month",
      "currency": "usd",
      "unitAmount": 1999,
      "taxBehavior": "exclusive",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Create Price

Link a Stripe price to a product.

```
POST /api/v1/admin/prices
```

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "productId": 1,
  "provider": "stripe",
  "providerPriceId": "price_xxx",
  "interval": "month",
  "currency": "usd",
  "unitAmount": 1999,
  "taxBehavior": "exclusive",
  "isActive": true
}
```

### Update Price

```
PUT /api/v1/admin/prices/:id
```

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "isActive": false
}
```

### Delete Price

```
DELETE /api/v1/admin/prices/:id
```

**Authentication:** Required (Admin)

---

## Webhooks

### Handle Stripe Webhook

Receives and processes Stripe webhook events. Uses signature verification for security.

```
POST /api/v1/webhooks/stripe
```

**Authentication:** Stripe signature verification (no user auth)

**Headers:**
- `stripe-signature`: Stripe webhook signature

**Supported Events:**
- `checkout.session.completed` - Creates/updates subscription after successful checkout
- `customer.subscription.updated` - Handles subscription changes (plan upgrades/downgrades)
- `customer.subscription.deleted` - Handles subscription cancellation
- `invoice.payment_failed` - Logs payment failures, optionally marks subscription as past_due
- `invoice.payment_succeeded` - Updates subscription expiration, sends confirmation

**Response:**
```json
{
  "received": true
}
```

**Error Response (400):**
```json
{
  "error": "Webhook Error",
  "message": "Invalid signature"
}
```

---

## Tenants

User-facing endpoints for managing tenants.

### List User's Tenants

```
GET /api/v1/tenants
```

**Authentication:** Required

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Personal Workspace",
      "slug": "personal-1",
      "type": "personal",
      "ownerId": 1,
      "role": "owner",
      "memberCount": 1
    },
    {
      "id": 2,
      "name": "Acme Corp",
      "slug": "acme-corp",
      "type": "team",
      "ownerId": 5,
      "role": "member",
      "memberCount": 10
    }
  ]
}
```

### Create Tenant

```
POST /api/v1/tenants
```

**Authentication:** Required

**Request Body:**
```json
{
  "name": "My Team",
  "slug": "my-team"
}
```

**Response:**
```json
{
  "data": {
    "id": 3,
    "name": "My Team",
    "slug": "my-team",
    "type": "team",
    "ownerId": 1
  }
}
```

### Get Tenant

```
GET /api/v1/tenants/:id
```

**Authentication:** Required (must be member)

### Update Tenant

```
PUT /api/v1/tenants/:id
```

**Authentication:** Required (must be admin)

**Request Body:**
```json
{
  "name": "New Name",
  "slug": "new-slug"
}
```

### Switch to Tenant

Switch the current user's active tenant.

```
POST /api/v1/tenants/:id/switch
```

**Authentication:** Required (must be member)

**Response:**
```json
{
  "data": null,
  "message": "Switched to tenant successfully"
}
```

### Add Member

```
POST /api/v1/tenants/:id/members
```

**Authentication:** Required (must be admin)

**Request Body:**
```json
{
  "userId": 5,
  "role": "member"
}
```

### Remove Member

```
DELETE /api/v1/tenants/:id/members/:userId
```

**Authentication:** Required (must be admin)

### Leave Tenant

```
POST /api/v1/tenants/:id/leave
```

**Authentication:** Required (must be member, cannot leave if owner)

### Delete Tenant

```
DELETE /api/v1/tenants/:id
```

**Authentication:** Required (must be owner)

### Send Invitation

```
POST /api/v1/tenants/:id/invitations
```

**Authentication:** Required (must be admin)

**Request Body:**
```json
{
  "email": "invitee@example.com",
  "role": "member"
}
```

### List Invitations

```
GET /api/v1/tenants/:id/invitations
```

**Authentication:** Required (must be admin)

### Cancel Invitation

```
DELETE /api/v1/tenants/:id/invitations/:invitationId
```

**Authentication:** Required (must be admin)

### Get Invitation by Token (Public)

```
GET /api/v1/invitations/:token
```

**Authentication:** Not required

### Accept Invitation

```
POST /api/v1/invitations/:token/accept
```

**Authentication:** Required

### Decline Invitation

```
POST /api/v1/invitations/:token/decline
```

**Authentication:** Required

---

## Navigation

### Get Navigation Model

Get the composed navigation model for the authenticated user. This endpoint is the single source of truth for navigation composition, running the full pipeline including hooks registered by plugins.

```
GET /api/v1/navigation/model
```

**Authentication:** Required

**Response:**
```json
{
  "data": {
    "nav": {
      "main": [
        {
          "id": "core.main",
          "label": "Main",
          "order": 100,
          "items": [
            {
              "id": "core.dashboard",
              "label": "Dashboard",
              "href": "/dashboard",
              "icon": "Home",
              "order": 100
            }
          ]
        }
      ],
      "admin": [],
      "userMenu": [
        {
          "id": "core.account",
          "label": "Account",
          "order": 9000,
          "items": [
            {
              "id": "core.logout",
              "label": "Log out",
              "href": "#",
              "icon": "LogOut",
              "order": 9999,
              "onClick": "logout"
            }
          ]
        }
      ]
    },
    "designId": "main-app",
    "isSafeMode": false
  }
}
```

**Error Response (503 - Design Not Registered):**
```json
{
  "error": "DesignNotRegistered",
  "message": "No design registered. Plugin system may not be fully initialized."
}
```

**Error Response (500 - Navigation Build Failed):**
```json
{
  "error": "NavigationBuildFailed",
  "message": "Navigation model could not be built: [collision details]"
}
```

---

## Dashboard

### Get User Stats

Get statistics for the current user's dashboard.

```
GET /api/v1/dashboard/stats
```

**Authentication:** Required

**Response:**
```json
{
  "data": {
    "totalTenants": 2,
    "ownedTenants": 1,
    "memberTenants": 1,
    "currentTenant": {
      "id": 1,
      "name": "Personal Workspace",
      "type": "personal"
    },
    "currentSubscription": {
      "tier": "pro",
      "status": "active",
      "expiresAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

---

## Admin - Stats

### Get Admin Stats

Get system-wide statistics for admin dashboard.

```
GET /api/v1/admin/stats
```

**Authentication:** Required (Admin)

**Response:**
```json
{
  "data": {
    "totalUsers": 150,
    "totalTenants": 45,
    "activeSubscriptions": 78,
    "revenue": {
      "monthly": 15000,
      "yearly": 180000
    }
  }
}
```

---

## Plugins

Plugin management endpoints for enabling/disabling plugins per tenant.

### List Available Plugins

```
GET /api/v1/plugins
```

**Authentication:** Required
**Headers:**
- `X-Tenant-ID`: Required tenant ID

**Response:**
```json
{
  "data": [
    {
      "pluginId": "notes",
      "displayName": "Notes",
      "description": "A note-taking plugin",
      "version": "1.0.0",
      "tier": "B",
      "status": "active"
    }
  ]
}
```

### Get Plugin Status

```
GET /api/v1/plugins/:pluginId/status
```

**Authentication:** Required
**Headers:**
- `X-Tenant-ID`: Required tenant ID

**Response:**
```json
{
  "data": {
    "pluginId": "notes",
    "enabled": true,
    "version": "1.0.0",
    "installedAt": "2024-01-15T10:30:00Z",
    "config": {}
  }
}
```

### Enable Plugin

```
POST /api/v1/plugins/:pluginId/enable
```

**Authentication:** Required (owner or admin role)
**Headers:**
- `X-Tenant-ID`: Required tenant ID

**Response:**
```json
{
  "data": {
    "pluginId": "notes",
    "enabled": true,
    "message": "Plugin \"notes\" enabled successfully"
  }
}
```

### Disable Plugin

```
POST /api/v1/plugins/:pluginId/disable
```

**Authentication:** Required (owner or admin role)
**Headers:**
- `X-Tenant-ID`: Required tenant ID

**Response:**
```json
{
  "data": {
    "pluginId": "notes",
    "enabled": false,
    "message": "Plugin \"notes\" disabled successfully"
  }
}
```

### Update Plugin Config

```
PUT /api/v1/plugins/:pluginId/config
```

**Authentication:** Required (owner or admin role)
**Headers:**
- `X-Tenant-ID`: Required tenant ID

**Request Body:**
```json
{
  "setting1": "value1",
  "setting2": true
}
```

**Response:**
```json
{
  "data": {
    "pluginId": "notes",
    "config": {
      "setting1": "value1",
      "setting2": true
    },
    "message": "Plugin config updated successfully"
  }
}
```

---

## Plugin: Notes (Example)

The Notes plugin demonstrates a Tier B plugin with CRUD operations.

**Base URL:** `/api/v1/apps/notes`

**Note:** This plugin requires the tenant to have it enabled first via `POST /api/v1/plugins/notes/enable`.

### List Notes

```
GET /api/v1/apps/notes/notes
```

**Authentication:** Required
**Headers:**
- `X-Tenant-ID`: Required tenant ID

### Get Note

```
GET /api/v1/apps/notes/notes/:id
```

**Authentication:** Required
**Headers:**
- `X-Tenant-ID`: Required tenant ID

### Create Note

```
POST /api/v1/apps/notes/notes
```

**Authentication:** Required
**Headers:**
- `X-Tenant-ID`: Required tenant ID

**Request Body:**
```json
{
  "title": "My Note",
  "content": "Note content here"
}
```

### Update Note

```
PUT /api/v1/apps/notes/notes/:id
```

**Authentication:** Required
**Headers:**
- `X-Tenant-ID`: Required tenant ID

**Request Body:**
```json
{
  "title": "Updated Title",
  "content": "Updated content"
}
```

### Delete Note

```
DELETE /api/v1/apps/notes/notes/:id
```

**Authentication:** Required
**Headers:**
- `X-Tenant-ID`: Required tenant ID
