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

## Collab Plugin

Base prefix: `/api/v1/apps/collab`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/comments` | Create comment |
| GET | `/comments` | List comments for a resource |
| DELETE | `/comments/:id` | Delete comment |
| POST | `/shares` | Create or update a share |
| GET | `/shares` | List shares for a resource |
| DELETE | `/shares/:id` | Revoke share |
| GET | `/mentions` | List unresolved mentions |
| POST | `/mentions/:id/read` | Mark mention as read |

Feature gates:
- Disabled route features return `403` with `E_FEATURE_DISABLED`.
- Threaded comments (`parent_id`) require `threads`.
- Mention side effects require `mentions`.

---

## Files Plugin

Base prefix: `/api/v1/apps/files`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/config/validate` | Validate local/cloud storage config (requires `files.policy.manage`) |
| GET | `/admin/rbac` | Read tenant RBAC policy for files plugin |
| PUT | `/admin/rbac` | Update tenant RBAC policy for files plugin |
| POST | `/upload` | Upload file object |
| GET | `/objects` | List visible file metadata |
| GET | `/objects/:id` | Get one file metadata record |
| GET | `/objects/:id/content` | Download file bytes |
| DELETE | `/objects/:id` | Soft-delete file |

Feature gates:
- Disabled route features return `403` with `E_FEATURE_DISABLED`.
- `admin_config` gates `/admin/config/validate`.
- `admin_config` gates `/admin/rbac` (GET/PUT).
- `uploads` gates `/upload`.
- `downloads` gates all GET object routes.
- `deletes` gates `DELETE /objects/:id`.

Storage config examples:
- Local: `{ "storageMode": "local", "local": { "basePath": "/var/app/files" } }`
- Cloud: `{ "storageMode": "cloud", "cloud": { "provider": "aws_s3", "aws_s3": { "bucket": "...", "region": "...", "accessKeyId": "...", "secretAccessKey": "..." } } }`
- Supported cloud providers: `aws_s3`, `cloudflare_r2`, `backblaze_b2`, `gcs`, `azure_blob`.
- RBAC policy: `config.rbac.roles.{owner|admin|member}.{upload|read|delete|manage}`.
- Abilities enforced through core authz namespace `files.`:
  - `files.file.upload`
  - `files.file.read`
  - `files.file.delete`
  - `files.policy.manage`

---

## Webhooks Plugin

Base prefix: `/api/v1/apps/webhooks`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/endpoints` | List tenant webhook endpoints |
| POST | `/admin/endpoints` | Create webhook endpoint |
| PUT | `/admin/endpoints/:id` | Update webhook endpoint |
| DELETE | `/admin/endpoints/:id` | Soft-delete webhook endpoint |
| GET | `/admin/subscriptions` | List endpoint subscriptions |
| POST | `/admin/subscriptions` | Create webhook subscription |
| PUT | `/admin/subscriptions/:id` | Update webhook subscription |
| POST | `/admin/events` | Queue webhook event for matching subscriptions |
| GET | `/admin/deliveries` | List webhook deliveries |
| GET | `/admin/deliveries/:id` | Get one webhook delivery |
| POST | `/admin/deliveries/:id/replay` | Queue replay for one delivery |
| POST | `/admin/deliveries/dispatch` | Run delivery dispatch loop for due jobs |

Feature gates:
- Disabled route features return `403` with `E_FEATURE_DISABLED`.
- `endpoint_management` gates endpoint CRUD routes.
- `subscriptions` gates subscription routes and event enqueue route.
- `deliveries_read` gates delivery read routes.
- `replay` gates replay and dispatch routes.

Abilities enforced through core authz namespace `webhooks.`:
- `webhooks.endpoint.manage`
- `webhooks.subscription.manage`
- `webhooks.delivery.read`
- `webhooks.delivery.replay`

---

## Workers Plugin

Base prefix: `/api/v1/apps/workers`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/stats` | Read worker queue counters |
| GET | `/admin/tasks` | List worker tasks |
| GET | `/admin/tasks/:id` | Get one worker task |
| GET | `/admin/tasks/:id/attempts` | List attempt history for one task |
| POST | `/admin/tasks` | Enqueue worker task |
| POST | `/admin/tasks/:id/cancel` | Cancel pending/failed/processing task |
| POST | `/admin/tasks/:id/requeue` | Requeue terminal task |
| POST | `/admin/dispatch` | Run worker dispatch loop for due jobs |

Feature gates:
- Disabled route features return `403` with `E_FEATURE_DISABLED`.
- `monitoring` gates stats/list/read/attempt routes.
- `enqueue` gates `POST /admin/tasks`.
- `manage` gates `POST /admin/tasks/:id/cancel`.
- `replay` gates `POST /admin/tasks/:id/requeue`.
- `dispatch` gates `POST /admin/dispatch`.

Abilities enforced through core authz namespace `workers.`:
- `workers.task.enqueue`
- `workers.task.read`
- `workers.task.dispatch`
- `workers.task.manage`

Execution model:
- Generic queue with retries and dead-letter state.
- Handlers: `noop`, `fail_test`, `http_request`, `hook_action`, `webhooks_event`.
- `webhooks_event` is optional integration; it only succeeds if the `webhooks` plugin is enabled for the tenant.

---

## Wiki Plugin

Base prefix: `/api/v1/apps/wiki`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/spaces` | List wiki spaces |
| POST | `/spaces` | Create wiki space |
| PUT | `/spaces/:id` | Update wiki space |
| DELETE | `/spaces/:id` | Soft-delete wiki space |
| GET | `/pages` | List wiki pages |
| POST | `/pages` | Create wiki page |
| GET | `/pages/:id` | Get wiki page |
| PUT | `/pages/:id` | Update wiki page |
| DELETE | `/pages/:id` | Soft-delete wiki page |
| POST | `/pages/:id/publish` | Publish page |
| POST | `/pages/:id/unpublish` | Unpublish page |
| GET | `/pages/:id/revisions` | List page revisions |
| POST | `/pages/:id/revisions/:revisionId/restore` | Restore page revision |
| POST | `/pages/:id/comments` | Optional comments endpoint (collab integration) |
| POST | `/pages/:id/attachments` | Optional attachment endpoint (files integration) |

Feature gates:
- Disabled route features return `403` with `E_FEATURE_DISABLED`.
- `spaces` gates all `/spaces` routes.
- `pages` gates all `/pages` CRUD routes.
- `publishing` gates publish/unpublish routes.
- `history` gates revision routes.
- `comments` gates comments integration route.
- `attachments` gates attachment integration route.

Abilities enforced through core authz namespace `wiki.`:
- `wiki.space.manage`
- `wiki.page.read`
- `wiki.page.write`
- `wiki.page.publish`
- `wiki.page.delete`

---

## Calendar Plugin

Base prefix: `/api/v1/apps/calendar`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/events` | List calendar events |
| POST | `/events` | Create event |
| GET | `/events/:id` | Get one event |
| PUT | `/events/:id` | Update event |
| DELETE | `/events/:id` | Soft-delete event |
| POST | `/events/:id/attendees` | Add attendee |
| DELETE | `/events/:id/attendees/:userId` | Remove attendee |
| POST | `/events/:id/rsvp` | RSVP for current user attendee row |
| POST | `/events/:id/reminders` | Schedule reminder |
| DELETE | `/events/:id/reminders/:reminderId` | Cancel reminder |
| POST | `/events/:id/recurrence` | Configure recurrence rule |
| DELETE | `/events/:id/recurrence` | Clear recurrence rule |
| GET | `/admin/booking/config` | Read booking page config |
| PUT | `/admin/booking/config` | Update booking page config |
| POST | `/admin/reminders/dispatch` | Process due reminders |
| GET | `/public/booking/:tenantId/:pageSlug/slots` | Public: list available slots for a date |
| POST | `/public/booking/:tenantId/:pageSlug/reservations` | Public: reserve one slot |

Feature gates:
- Disabled route features return `403` with `E_FEATURE_DISABLED`.
- `events` gates event CRUD routes.
- `attendees` gates attendee and RSVP routes.
- `reminders` gates reminder CRUD and dispatch route.
- `recurrence` gates recurrence set/clear routes.
- `booking` gates `/admin/booking/config` read/update.
- Public booking routes validate plugin state/feature/page config in-handler.

Abilities enforced through core authz namespace `calendar.`:
- `calendar.event.create`
- `calendar.event.read`
- `calendar.event.update`
- `calendar.event.delete`
- `calendar.event.manage_attendees`
- `calendar.reminder.manage`

Booking behavior:
- `slotDurationMinutes` is tenant-configured by admin.
- Public reservations are accepted only for generated slots matching that duration exactly.

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
  "subscriptionTier": "tier1"
}
```

### Get Tenant Quotas

```
GET /api/v1/admin/tenants/:id/quotas
```

**Authentication:** Required (Admin)

**Response:**
```json
{
  "data": {
    "tenantId": 1,
    "maxMembers": null,
    "quotaOverrides": {
      "maxPendingInvitations": 25,
      "maxAuthTokensPerTenant": 500,
      "maxAuthTokensPerUser": 100
    },
    "effectiveLimits": {
      "members": 20,
      "pendingInvitations": 25,
      "authTokensPerTenant": 500,
      "authTokensPerUser": 100
    }
  }
}
```

### Update Tenant Quotas

```
PUT /api/v1/admin/tenants/:id/quotas
```

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "maxMembers": 25,
  "maxPendingInvitations": 25,
  "maxAuthTokensPerTenant": 500,
  "maxAuthTokensPerUser": 100
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

## Payment Provider Configuration

The application supports multiple payment providers. Only one provider is active at a time, configured via the `PAYMENT_PROVIDER` environment variable.

**Supported providers:** `stripe` (default), `paddle`, `lemonsqueezy`, `polar`

The `provider` field on Products and Prices records identifies which provider owns that record. All four webhook endpoints remain active regardless of the selected provider to handle in-flight events during migration.

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
  "data": { "received": true, "processed": true, "eventType": "checkout.session.completed" }
}
```

**Error Response (400):**
```json
{
  "error": "WebhookError",
  "message": "Webhook processing failed"
}
```

### Handle Paddle Webhook

Receives and processes Paddle webhook events.

```
POST /api/v1/webhooks/paddle
```

**Authentication:** Paddle signature verification (no user auth)

**Headers:**
- `paddle-signature`: Paddle webhook signature (`ts=TIMESTAMP;h1=HMAC_SHA256`)

**Supported Events:**
- `transaction.completed` - Creates subscription after successful checkout
- `subscription.updated` - Handles subscription changes
- `subscription.canceled` - Handles subscription cancellation
- `transaction.payment_failed` - Logs payment failures

**Response:** Same format as Stripe webhook.

### Handle LemonSqueezy Webhook

Receives and processes LemonSqueezy webhook events.

```
POST /api/v1/webhooks/lemonsqueezy
```

**Authentication:** LemonSqueezy signature verification (no user auth)

**Headers:**
- `x-signature`: HMAC-SHA256 hex digest of the raw body

**Supported Events:**
- `order_created` - Creates subscription after successful checkout
- `subscription_updated` - Handles subscription changes
- `subscription_cancelled` - Handles subscription cancellation
- `subscription_payment_failed` - Logs payment failures
- `subscription_payment_success` - Updates subscription expiration

**Response:** Same format as Stripe webhook.

### Handle Polar Webhook

Receives and processes Polar webhook events.

```
POST /api/v1/webhooks/polar
```

**Authentication:** Polar/Standard Webhooks signature verification (no user auth)

**Headers:**
- `webhook-signature`: Standard Webhooks signature (`v1,BASE64_HMAC`)

**Supported Events:**
- `checkout.created` (status: succeeded) - Creates subscription after successful checkout
- `subscription.updated` - Handles subscription changes
- `subscription.revoked` / `subscription.canceled` - Handles subscription cancellation
- `order.created` - Updates subscription expiration on payment success

**Response:** Same format as Stripe webhook.

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
  "email": "member@example.com",
  "role": "member"
}
```

### Update Member Role

```
PUT /api/v1/tenants/:id/members/:userId/role
```

**Authentication:** Required (must be owner)

**Request Body:**
```json
{
  "role": "viewer"
}
```

### Remove Member

```
DELETE /api/v1/tenants/:id/members/:userId
```

**Authentication:** Required (must be admin)

### Get Tenant Quotas

```
GET /api/v1/tenants/:id/quotas
```

**Authentication:** Required (must be tenant member)

### Update Tenant Quotas

```
PUT /api/v1/tenants/:id/quotas
```

**Authentication:** Required (must be owner or admin)

**Request Body:**
```json
{
  "maxMembers": 25,
  "maxPendingInvitations": 25,
  "maxAuthTokensPerTenant": 500,
  "maxAuthTokensPerUser": 100
}
```

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
  "role": "viewer"
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

### Plugin Route Namespacing

Per spec §5.2, all plugin routes (including main-app plugins) are namespaced under:

```
/api/v1/apps/{pluginId}/...
```

For example, the notarium plugin routes are at:
- `/api/v1/apps/notarium/records`
- `/api/v1/apps/notarium/onboarding/status`
- `/api/v1/apps/notarium/comments`
- etc.

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

---

## Plugin: Notarium (Token APIs)

Notarium uses the core `/api/v1/auth-tokens` endpoints for profile-managed tokens.
Plugin-namespaced token routes (if present) are considered legacy and are not recommended for new integrations.

**Base URL:** `/api/v1/apps/notarium`

### List MCP Integration Tokens

```
GET /api/v1/apps/notarium/integration-tokens
```

**Authentication:** Required
**Headers:**
- `X-Tenant-ID`: Required tenant ID

### Create MCP Integration Token

```
POST /api/v1/apps/notarium/integration-tokens
```

**Authentication:** Required
**Headers:**
- `X-Tenant-ID`: Required tenant ID

**Request Body:**
```json
{
  "name": "Claude Desktop",
  "scopes": ["mcp:read", "mcp:bookmark_write"],
  "expiresAt": "2026-12-31T00:00:00.000Z",
  "rateLimits": {
    "bookmarksPerHour": 30,
    "draftsPerDay": 10
  }
}
```

### Revoke MCP Integration Token

```
DELETE /api/v1/apps/notarium/integration-tokens/:id
```

**Authentication:** Required
**Headers:**
- `X-Tenant-ID`: Required tenant ID

### List Browser Extension Tokens

```
GET /api/v1/apps/notarium/browser-ext-tokens
```

### Create Browser Extension Token

```
POST /api/v1/apps/notarium/browser-ext-tokens
```

### Revoke Browser Extension Token

```
DELETE /api/v1/apps/notarium/browser-ext-tokens/:id
```

---

## Plugin: Analytics

SaaS KPI tracking plugin. Subscribes to auth and billing hooks to track DAU/MAU, MRR/ARR, Churn, LTV, and ARPU.

**Base URL:** `/api/v1/apps/analytics`

**Note:** This plugin requires the tenant to have it enabled first via `POST /api/v1/plugins/analytics/enable`.

### Overview

```
GET /api/v1/apps/analytics/overview
```

**Authentication:** Required
**Headers:**
- `X-Tenant-ID`: Required tenant ID

**Response:**
```json
{
  "data": {
    "dau": 42,
    "mau": 350,
    "mrr": 499900,
    "arr": 5998800,
    "churnRate": 2.5,
    "ltv": 1200000,
    "arpu": 14283,
    "currency": "usd",
    "asOf": "2026-02-06T12:00:00.000Z"
  }
}
```

All monetary values are in cents (e.g., 499900 = $4,999.00).

### Active Users

```
GET /api/v1/apps/analytics/active-users?from=2026-01-01&to=2026-01-31
```

**Authentication:** Required
**Headers:**
- `X-Tenant-ID`: Required tenant ID

**Query Parameters:**
- `from` (optional): Start date (YYYY-MM-DD). Defaults to 30 days ago.
- `to` (optional): End date (YYYY-MM-DD). Defaults to today.

**Response:**
```json
{
  "data": {
    "period": {
      "from": "2026-01-01",
      "to": "2026-01-31"
    },
    "points": [
      { "date": "2026-01-01", "count": 42 },
      { "date": "2026-01-02", "count": 38 }
    ]
  }
}
```

### MRR

```
GET /api/v1/apps/analytics/mrr?from=2026-01-01&to=2026-01-31
```

**Authentication:** Required
**Headers:**
- `X-Tenant-ID`: Required tenant ID

**Query Parameters:**
- `from` (optional): Start date (YYYY-MM-DD). Defaults to 30 days ago.
- `to` (optional): End date (YYYY-MM-DD). Defaults to today.

**Response:**
```json
{
  "data": {
    "period": {
      "from": "2026-01-01",
      "to": "2026-01-31"
    },
    "points": [
      {
        "date": "2026-01-01",
        "mrr": 499900,
        "arr": 5998800,
        "currency": "usd",
        "newSubscriptions": 3,
        "cancellations": 1
      }
    ]
  }
}
```

### Revenue

```
GET /api/v1/apps/analytics/revenue?from=2026-01-01&to=2026-01-31
```

**Authentication:** Required
**Headers:**
- `X-Tenant-ID`: Required tenant ID

**Query Parameters:**
- `from` (optional): Start date (YYYY-MM-DD). Defaults to 30 days ago.
- `to` (optional): End date (YYYY-MM-DD). Defaults to today.

**Response:**
```json
{
  "data": {
    "totalRevenue": 1500000,
    "currency": "usd",
    "ltv": 750000,
    "invoiceCount": 25,
    "period": {
      "from": "2026-01-01",
      "to": "2026-01-31"
    }
  }
}
```

### Cohorts

```
GET /api/v1/apps/analytics/cohorts?from=2026-01-01&to=2026-03-31
```

**Authentication:** Required
**Headers:**
- `X-Tenant-ID`: Required tenant ID

**Response:**
```json
{
  "data": {
    "period": {
      "from": "2026-01-01",
      "to": "2026-03-31"
    },
    "cohorts": [
      {
        "cohortDate": "2026-01-01",
        "cohortSize": 100,
        "day7Count": 45,
        "day14Count": 37,
        "day30Count": 21,
        "day7RetentionRate": 45,
        "day14RetentionRate": 37,
        "day30RetentionRate": 21
      }
    ]
  }
}
```

### Funnels

```
GET /api/v1/apps/analytics/funnels?from=2026-01-01&to=2026-01-31
```

**Authentication:** Required
**Headers:**
- `X-Tenant-ID`: Required tenant ID

**Response:**
```json
{
  "data": {
    "period": {
      "from": "2026-01-01",
      "to": "2026-01-31"
    },
    "steps": [
      {
        "id": "active_users",
        "label": "Active users",
        "count": 350,
        "conversionFromPrevious": null
      },
      {
        "id": "subscriptions_created",
        "label": "Subscriptions created",
        "count": 30,
        "conversionFromPrevious": 8.57
      }
    ],
    "overallConversionRate": 6,
    "failedPaymentCount": 2
  }
}
```

### Alerts and Threshold Evaluation

```
GET /api/v1/apps/analytics/alerts/evaluate?from=2026-01-01&to=2026-01-31
```

**Authentication:** Required
**Headers:**
- `X-Tenant-ID`: Required tenant ID

**Response:**
```json
{
  "data": {
    "evaluatedAt": "2026-02-13T12:00:00.000Z",
    "triggeredCount": 1,
    "evaluations": [
      {
        "rule": {
          "id": "alert-high-churn",
          "name": "High churn warning",
          "metric": "churnRate",
          "operator": "gt",
          "threshold": 5,
          "severity": "warning",
          "enabled": true
        },
        "currentValue": 7.2,
        "triggered": true
      }
    ]
  }
}
```

### Custom Reports

```
GET /api/v1/apps/analytics/reports/custom
```

Runs saved report definitions from analytics admin config.

**Authentication:** Required
**Headers:**
- `X-Tenant-ID`: Required tenant ID

### Run Ad-hoc Report

```
POST /api/v1/apps/analytics/reports/run
```

**Authentication:** Required
**Headers:**
- `X-Tenant-ID`: Required tenant ID

**Request Body:**
```json
{
  "dataset": "funnel",
  "from": "2026-01-01",
  "to": "2026-01-31"
}
```

Supported datasets:
- `overview`
- `active_users`
- `mrr`
- `revenue`
- `cohort`
- `funnel`

### Data Export (CSV / Excel / PDF)

```
GET /api/v1/apps/analytics/exports?format=csv&dataset=overview&from=2026-01-01&to=2026-01-31
```

**Authentication:** Required
**Headers:**
- `X-Tenant-ID`: Required tenant ID

**Query Parameters:**
- `format` (required): `csv`, `excel`, or `pdf`
- `dataset` (required): one of the supported datasets
- `from` (optional): Start date (YYYY-MM-DD)
- `to` (optional): End date (YYYY-MM-DD)

### Admin Config (Owner/Admin only)

```
GET /api/v1/apps/analytics/admin/config
PUT /api/v1/apps/analytics/admin/config
```

Admin config schema:
```json
{
  "customReports": [
    {
      "id": "report-overview-30d",
      "name": "Overview (30d)",
      "dataset": "overview",
      "fromDaysAgo": 30,
      "toDaysAgo": 0
    }
  ],
  "alertRules": [
    {
      "id": "alert-high-churn",
      "name": "High churn warning",
      "metric": "churnRate",
      "operator": "gt",
      "threshold": 5,
      "severity": "warning",
      "enabled": true
    }
  ],
  "funnelSteps": ["Active users", "Subscriptions created", "Invoices paid"]
}
```

---

## Chatbot Plugin

Base prefix: `/api/v1/apps/chatbot`

All routes require authentication and the `chat` feature to be enabled.

### Admin Configuration (admin/owner only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/config` | Get current provider config (API key masked), available tiers, and model options |
| PUT | `/config` | Upsert provider config (provider, model, mode, API key, tier, temperature, etc.) |

#### PUT `/config` body:

```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "mode": "support",
  "apiKey": "sk-...",
  "requiredTierSlug": "tier1",
  "systemPrompt": "Custom instructions...",
  "temperature": 0.7,
  "maxTokens": 4096
}
```

- `apiKey` is optional on updates (omit to keep existing key)
- `requiredTierSlug` can be `null` for no tier restriction

### Knowledge Base (admin/owner only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/knowledge` | List knowledge documents for tenant |
| POST | `/knowledge` | Create knowledge document |
| PUT | `/knowledge/:id` | Update knowledge document |
| DELETE | `/knowledge/:id` | Delete knowledge document |

### Conversations (authenticated users, tier-gated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/conversations` | List user's conversations (paginated via `?limit=`) |
| POST | `/conversations` | Create new conversation |
| GET | `/conversations/:id` | Get conversation with all messages |
| DELETE | `/conversations/:id` | Delete conversation (owner only) |

### Messages (streaming)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/conversations/:id/messages` | Send message, returns streaming text response |

#### POST `/conversations/:id/messages` body:

```json
{
  "content": "Hello, can you help me?"
}
```

Response is a streamed text response (`text/plain; charset=utf-8`).

### Tier Gating

When `required_tier_slug` is set on the provider config, conversation and message routes check the tenant's subscription tier level. Returns `403` with:
```json
{
  "error": "TIER_REQUIRED",
  "message": "Your subscription plan does not include chatbot access"
}
```

### Modes

- **support**: AI answers from admin-managed knowledge base documents
- **assistant**: AI has tool access to search notes, list calendar events, and search wiki pages

---

## Notifications Plugin

Base prefix: `/api/v1/apps/notifications`

All routes require authentication and the `preferences` feature to be enabled.

### Preferences

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/preferences` | List current user's notification preferences |
| PUT | `/preferences` | Batch upsert preferences |
| GET | `/preferences/types` | List known notification types with labels |

#### PUT `/preferences` body:

```json
{
  "preferences": [
    { "notificationType": "messaging.message.received", "channel": "in_app", "enabled": true },
    { "notificationType": "messaging.message.received", "channel": "email", "enabled": false }
  ]
}
```

- `preferences` must be an array of 1-50 items
- `notificationType` must be alphanumeric with dots (max 200 chars)
- `channel` must be one of: `in_app`, `email`
- `enabled` must be a boolean
- Uses `ON CONFLICT` upsert: creates new or updates existing preference

#### GET `/preferences/types` response:

Returns known notification types with descriptions and available channels:

```json
{
  "data": [
    {
      "type": "messaging.message.received",
      "label": "New message",
      "description": "When you receive a direct or group message",
      "channels": ["in_app", "email"]
    }
  ]
}
```

### Database

- `plugin_notifications_preferences` (tenant-scoped, RLS)
  - UNIQUE constraint: `(tenant_id, user_id, notification_type, channel)`

---

## Messaging Plugin

Base prefix: `/api/v1/apps/messaging`

All routes require authentication and the `messaging` feature to be enabled.

### Conversations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/conversations` | List user's conversations with unread counts + last message + participants |
| POST | `/conversations` | Create direct or group conversation |
| GET | `/conversations/:id` | Get conversation with participants + recent messages |
| PUT | `/conversations/:id` | Update group name (group admin only) |
| DELETE | `/conversations/:id` | Leave conversation |

#### POST `/conversations` body (direct):

```json
{
  "type": "direct",
  "participantIds": [42]
}
```

- Exactly 1 other participant required (self auto-added)
- Deduplicates: returns existing direct conversation if one exists with same participants

#### POST `/conversations` body (group):

```json
{
  "type": "group",
  "name": "Project Team",
  "participantIds": [42, 43, 44]
}
```

- At least 2 other participants required (self auto-added as admin)
- `name` is required for groups (max 200 chars)
- Max 50 participants total

#### PUT `/conversations/:id` body:

```json
{
  "name": "New Group Name"
}
```

- Group admin only, group conversations only

### Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/conversations/:id/messages` | Paginated messages (`?limit=50&beforeId=X&afterId=Y`) |
| POST | `/conversations/:id/messages` | Send message (notifies other participants) |
| PUT | `/conversations/:id/messages/:messageId` | Edit own message |
| DELETE | `/conversations/:id/messages/:messageId` | Soft-delete own message |

#### POST `/conversations/:id/messages` body:

```json
{
  "content": "Hello everyone!"
}
```

- Content max 10,000 characters
- Sends notification (`messaging.message.received`) to other participants
- Auto-marks conversation as read for sender
- Dispatches `messaging:message.sent` hook

#### Pagination

- `beforeId` — fetch older messages (DESC, reversed to chronological)
- `afterId` — fetch newer messages (ASC)
- Default limit: 50, max: 100

### Read Markers

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/conversations/:id/read` | Mark conversation as read (sets last_read_message_id) |

### Participants

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/conversations/:id/participants` | Add participants (group admin only) |
| DELETE | `/conversations/:id/participants/:userId` | Remove participant (group admin only) |

#### POST `/conversations/:id/participants` body:

```json
{
  "userIds": [45, 46]
}
```

- Group conversations only, admin role required
- Skips already-existing participants (ON CONFLICT DO NOTHING)
- Returns updated participant list with user details

### User Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/search` | Search tenant users (`?q=term&limit=20`) |

- Minimum 2 characters for query
- Max 20 results
- Uses `UsersFacade` if available, falls back to direct DB query

### Unread Count

Unread count = messages where `id > participant.last_read_message_id AND sender_id != current_user AND deleted_at IS NULL`.

### Database

- `plugin_messaging_conversations` (tenant-scoped, RLS)
- `plugin_messaging_participants` (tenant-scoped, RLS) — UNIQUE `(conversation_id, user_id)`
- `plugin_messaging_messages` (tenant-scoped, RLS)

### Hooks

- `messaging:conversation.created` — dispatched when a conversation is created
- `messaging:message.sent` — dispatched when a message is sent

---

## Forms Plugin

Base prefix: `/api/v1/apps/forms`

Typeform-like feedback and satisfaction surveys with conversational UX. Tier C plugin.

### Forms CRUD (authenticated)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/forms` | List forms for tenant | `forms.form.read` |
| POST | `/forms` | Create new form | `forms.form.write` |
| GET | `/forms/:id` | Get form details | `forms.form.read` |
| PUT | `/forms/:id` | Update form | `forms.form.write` |
| DELETE | `/forms/:id` | Delete form | `forms.form.delete` |
| POST | `/forms/:id/publish` | Publish form | `forms.form.write` |
| POST | `/forms/:id/close` | Close form | `forms.form.write` |

### Responses (authenticated)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/forms/:id/responses` | List responses (paginated, searchable) | `forms.response.read` |
| GET | `/forms/:id/responses/:rid` | Get single response | `forms.response.read` |
| DELETE | `/forms/:id/responses/:rid` | Delete response | `forms.response.delete` |

### Analytics & Export (authenticated)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/forms/:id/analytics` | Get form analytics summary (90 days) | `forms.analytics.read` |
| GET | `/forms/:id/export/csv` | Export responses as CSV | `forms.response.read` |

### Public Routes (no auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/public/:slug` | Get published form by slug |
| POST | `/public/:slug/submit` | Submit response (rate limited: 10/min per IP) |

#### POST `/public/:slug/submit` body:

```json
{
  "respondentEmail": "user@example.com",
  "respondentName": "John Doe",
  "answers": [
    { "questionId": "q1", "value": "Very satisfied" },
    { "questionId": "q2", "value": 9 }
  ],
  "metadata": {
    "durationSeconds": 120
  }
}
```

### Abilities

- `forms.form.read` — all roles
- `forms.form.write` — owner, admin, member
- `forms.form.delete` — owner, admin
- `forms.response.read` — owner, admin, member
- `forms.response.delete` — owner, admin
- `forms.analytics.read` — owner, admin, member

### Hooks

- `forms:form.published` — dispatched when a form is published
- `forms:form.closed` — dispatched when a form is closed
- `forms:response.submitted` — dispatched when a new response is submitted

### Question Types

`short_text`, `long_text`, `email`, `phone`, `url`, `number`, `dropdown`, `multiple_choice`, `checkboxes`, `rating`, `opinion_scale`, `yes_no`, `date`, `nps`, `welcome_screen`, `statement`

### Database

- `plugin_forms_forms` (tenant-scoped, RLS) — form definitions with questions as JSONB
- `plugin_forms_responses` (tenant-scoped, RLS) — submitted responses with answers as JSONB
- `plugin_forms_form_analytics` (tenant-scoped, RLS) — daily analytics (views, starts, completions)

---

## Support Plugin

Base prefix: `/api/v1/apps/support`

### User Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/categories` | List active categories |
| GET | `/config/mode` | Get support mode (chatbot availability, bypass categories) |
| POST | `/tickets` | Create a new ticket (subject, description, categorySlug) |
| GET | `/tickets` | List own tickets (filterable by status, cursor pagination) |
| GET | `/tickets/:id` | Get ticket detail with public comments |
| POST | `/tickets/:id/comments` | Add comment to own ticket |
| POST | `/tickets/:id/reopen` | Reopen a resolved/closed ticket |
| POST | `/tickets/:id/csat` | Submit CSAT rating (1-5) on resolved ticket |

### Admin Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/tickets` | List all tickets cross-tenant (filters: status, priority, category, assignee, tenant) |
| GET | `/admin/tickets/:id` | Get ticket detail with all comments (including internal) |
| PUT | `/admin/tickets/:id` | Update ticket status/priority |
| POST | `/admin/tickets/:id/assign` | Assign ticket to user |
| POST | `/admin/tickets/:id/comments` | Add comment (public or internal) |
| GET | `/admin/tickets/:id/activity` | Get ticket activity log |
| GET | `/admin/stats` | Get support stats (open, unassigned, SLA %, avg response, avg CSAT) |
| GET | `/admin/config` | Get support configuration |
| PUT | `/admin/config` | Update support configuration (categories, SLA, auto-close) |

### Authorization

- `support.ticket.create` — owner, admin, member (NOT viewer)
- `support.ticket.read` — all roles
- `support.ticket.comment` — owner, admin, member (NOT viewer)
- `support.admin.read` — owner, admin
- `support.admin.manage` — owner, admin

### Hooks

**Defined (emitted by support plugin):**
- `support:ticket.created` — when a ticket is created
- `support:ticket.updated` — when ticket status/priority changes
- `support:ticket.assigned` — when a ticket is assigned
- `support:ticket.resolved` — when a ticket is resolved
- `support:ticket.closed` — when a ticket is closed
- `support:comment.added` — when a comment is added
- `support:csat.submitted` — when CSAT rating is submitted

**Listened (consumed by support plugin):**
- `chatbot:conversation.escalated` — creates a ticket from chatbot escalation
- `team:member_removed` — unassigns tickets from removed member

### Chatbot Escalation Route

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/apps/chatbot/conversations/:id/escalate` | Escalate conversation to human support (dispatches `chatbot:conversation.escalated` hook) |

### Database

- `plugin_support_tickets` (tenant-scoped, RLS) — support tickets with SLA tracking and CSAT
- `plugin_support_comments` (tenant-scoped, RLS) — ticket comments (public/internal)
- `plugin_support_activity_log` (tenant-scoped, RLS) — ticket activity history
- `plugin_chatbot_conversations.escalated_at` — added column for escalation tracking
- `plugin_chatbot_conversations.support_ticket_id` — FK to support ticket

---

## Experiments Plugin (A/B Testing)

Base prefix: `/api/v1/apps/experiments`

### Admin Routes (require app admin role)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/experiments` | List all experiments (optional `?status=running`) |
| GET | `/experiments/:id` | Get experiment with variants |
| POST | `/experiments` | Create experiment (name, key, type, trafficPercentage, targetingRules) |
| PUT | `/experiments/:id` | Update experiment |
| DELETE | `/experiments/:id` | Delete experiment (cascades variants, assignments, events) |
| POST | `/experiments/:id/start` | Start experiment (draft/paused -> running) |
| POST | `/experiments/:id/pause` | Pause experiment (running -> paused) |
| POST | `/experiments/:id/complete` | Complete experiment (set winner, running/paused -> completed) |

### Variant Routes (admin only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/experiments/:id/variants` | List variants for experiment |
| POST | `/experiments/:id/variants` | Create variant (name, key, weight, isControl, featureOverrides) |
| PUT | `/experiments/:id/variants/:vid` | Update variant |
| DELETE | `/experiments/:id/variants/:vid` | Delete variant |

### Assignment & Tracking (any authenticated user)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/resolve/:experimentKey` | Resolve variant for current user (sticky assignment) |
| POST | `/events` | Track conversion/engagement event (experimentKey, eventType, eventValue, metadata) |

### Results (admin only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/experiments/:id/results` | Get results with statistical analysis (Z-test) |
| GET | `/experiments/:id/assignments` | List all assignments for experiment (paginated) |

### Request/Response Examples

**Create experiment:**
```json
POST /api/v1/apps/experiments/experiments
{
  "name": "New Onboarding Flow",
  "key": "new-onboarding-flow",
  "description": "Test the new step-by-step onboarding",
  "hypothesis": "New onboarding will increase activation rate by 15%",
  "type": "ab_test",
  "trafficPercentage": 80,
  "targetingRules": {
    "tenantIds": [1, 2],
    "roles": ["member", "admin"],
    "emailDomains": ["company.com"]
  }
}
```

**Create variant:**
```json
POST /api/v1/apps/experiments/experiments/1/variants
{
  "name": "Control",
  "key": "control",
  "weight": 50,
  "isControl": true
}
```

**Resolve variant (response):**
```json
GET /api/v1/apps/experiments/resolve/new-onboarding-flow
{
  "data": {
    "inExperiment": true,
    "experimentId": 1,
    "experimentKey": "new-onboarding-flow",
    "variantId": 2,
    "variantKey": "treatment-a",
    "featureOverrides": { "new_onboarding": true }
  }
}
```

**Track event:**
```json
POST /api/v1/apps/experiments/events
{
  "experimentKey": "new-onboarding-flow",
  "eventType": "conversion",
  "eventValue": 1,
  "metadata": { "step": "signup_complete" }
}
```

**Complete experiment:**
```json
POST /api/v1/apps/experiments/experiments/1/complete
{
  "winnerVariantId": 2
}
```

### Authorization

Admin-only routes check `user.role === 'admin'` (app-level admin, not tenant role). Regular users can only resolve variants and track events.

### Abilities

- `experiments.experiment.read` — admin only (via route handler check)
- `experiments.experiment.write` — admin only
- `experiments.experiment.delete` — admin only
- `experiments.assignment.read` — any authenticated user (own only via resolve)
- `experiments.event.write` — any authenticated user
- `experiments.results.read` — admin only

### Hooks

- `experiments:experiment.started` — dispatched when experiment status changes to running
- `experiments:experiment.completed` — dispatched when experiment is completed (includes winnerVariantId)
- `experiments:variant.assigned` — dispatched when a user is auto-assigned to a variant
- `experiments:event.tracked` — dispatched when a conversion/engagement event is tracked

### Statistical Analysis

Results endpoint performs Z-test for two proportions:
- Compares conversion rates between control and test variants
- Reports: p-value, confidence level, uplift, z-score
- Flags `isSignificant` when p < 0.05
- Flags `sampleSizeSufficient` when both variants have n >= 30
- For multivariate tests: compares each variant against control independently

### Database

- `plugin_experiments_experiments` (permissive SELECT RLS) — experiment definitions with targeting rules
- `plugin_experiments_variants` (permissive SELECT RLS) — variant definitions with feature overrides
- `plugin_experiments_assignments` (permissive SELECT RLS) — sticky user-to-variant assignments (unique per experiment+user)
- `plugin_experiments_events` (permissive SELECT RLS) — conversion/engagement events per assignment
