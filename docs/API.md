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

Create a checkout session for subscription purchase.

```
POST /api/v1/billing/checkout
```

**Authentication:** Required

**Request Body:**
```json
{
  "priceId": 1,
  "subscriberType": "user",       // Optional: "user" | "team"
  "subscriberId": 1,              // Optional: required if subscriberType is "team"
  "discountCode": "SUMMER20"      // Optional: discount code to apply
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

**Authentication:** Required

**Request Body:**
```json
{
  "returnUrl": "https://example.com/billing",
  "subscriberType": "user",       // Optional
  "subscriberId": 1               // Optional
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

Get the current user's or team's subscription status.

```
GET /api/v1/billing/subscription
```

**Authentication:** Required

**Query Parameters:**
- `subscriberType` (optional): "user" | "team"
- `subscriberId` (optional): Required if subscriberType is "team"

**Response:**
```json
{
  "data": {
    "subscription": {
      "id": 1,
      "subscriberType": "user",
      "subscriberId": 1,
      "tier": { ... },
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

**Authentication:** Required

**Request Body:**
```json
{
  "subscriberType": "user",       // Optional
  "subscriberId": 1               // Optional
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
  "priceId": 1
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
      "maxUsesPerUser": 1,
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

Redeem a coupon to add credit to the user's or team's balance.

```
POST /api/v1/billing/redeem-coupon
```

**Authentication:** Required

**Request Body:**
```json
{
  "code": "GIFT50",
  "teamId": 1         // Optional: redeem for team instead of user
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
    "message": "Coupon redeemed successfully! $50.00 has been added to your balance."
  }
}
```

### Get Balance

Get the current credit balance for user or team.

```
GET /api/v1/billing/balance
```

**Authentication:** Required

**Query Parameters:**
- `teamId` (optional): Get balance for a specific team

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
      "maxUsesPerUser": 1,
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
  "maxUsesPerUser": 1,                     // Optional: per-user limit
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
      "currentTeamId": null,
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

## Admin - Teams

Admin endpoints for managing teams.

### List Teams

```
GET /api/v1/admin/teams
```

**Authentication:** Required (Admin)

**Response includes balance and balanceCurrency fields.**

### Get Team

```
GET /api/v1/admin/teams/:id
```

**Authentication:** Required (Admin)
