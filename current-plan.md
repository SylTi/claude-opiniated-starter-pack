# Payment Provider Integration Plan (Stripe)

## Overview
Integrate Stripe as a payment provider into the existing AdonisJS 6 SaaS application with a provider-agnostic abstraction layer.

## User Decisions
- **Free tier**: No Stripe product - only local. Free users have no `payment_customer`.
- **Team billing**: Team owner is the Stripe customer. `payment_customers` links to team.
- **Idempotency**: Dedicated `processed_webhook_events` table.
- **Raw body**: Custom middleware (no third-party package).
- **Product sync**: Manual in Stripe Dashboard, then add IDs to local `products`/`prices` tables.
- **Currencies**: USD and EUR (two prices per product/interval).

---

## Phase 1: Environment & Dependencies

### Files to modify:
- `apps/api/.env.example` - Add Stripe env vars
- `apps/api/start/env.ts` - Add Stripe schema validation

### Environment Variables:
```env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

### Dependencies:
```bash
pnpm --filter api add stripe
```

---

## Phase 2: Database Migrations (in order)

### 1. `create_payment_customers_table.ts`
| Column | Type | Notes |
|--------|------|-------|
| id | increments | PK |
| subscriber_type | string(20) | 'user' or 'team' |
| subscriber_id | integer unsigned | |
| provider | string(20) | 'stripe' |
| provider_customer_id | string(255) | unique |
| created_at, updated_at | timestamp | |

**Indexes**: unique(subscriber_type, subscriber_id, provider)

### 2. `create_products_table.ts`
| Column | Type | Notes |
|--------|------|-------|
| id | increments | PK |
| tier_id | FK to subscription_tiers | |
| provider | string(20) | 'stripe' |
| provider_product_id | string(255) | unique |
| created_at, updated_at | timestamp | |

**Indexes**: unique(tier_id, provider)

### 3. `create_prices_table.ts`
| Column | Type | Notes |
|--------|------|-------|
| id | increments | PK |
| product_id | FK to products | |
| provider | string(20) | 'stripe' |
| provider_price_id | string(255) | unique |
| interval | enum('month','year') | |
| currency | string(3) | 'usd' or 'eur' |
| unit_amount | integer | in cents |
| tax_behavior | enum('inclusive','exclusive') | default 'exclusive' |
| is_active | boolean | default true |
| created_at, updated_at | timestamp | |

### 4. `add_provider_fields_to_subscriptions_table.ts`
Add to `subscriptions` table:
- `provider_name` string(20) nullable
- `provider_subscription_id` string(255) nullable unique indexed

### 5. `create_processed_webhook_events_table.ts`
| Column | Type | Notes |
|--------|------|-------|
| id | increments | PK |
| event_id | string(255) | unique |
| provider | string(20) | 'stripe' |
| event_type | string(100) | nullable (debugging) |
| processed_at | timestamp | |
| created_at | timestamp | |

---

## Phase 3: Models

### New Models:
| File | Purpose |
|------|---------|
| `app/models/payment_customer.ts` | Polymorphic link subscriber→Stripe customer |
| `app/models/product.ts` | Link tier→Stripe product |
| `app/models/price.ts` | Stripe prices with interval/currency |
| `app/models/processed_webhook_event.ts` | Idempotency tracking |

### Modify:
- `app/models/subscription.ts` - Add `providerName`, `providerSubscriptionId` columns

---

## Phase 4: Types & Interfaces

### Create: `app/services/types/payment_provider.ts`
```typescript
export interface PaymentProvider {
  readonly name: string
  createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult>
  createCustomerPortalSession(params: CustomerPortalParams): Promise<CustomerPortalResult>
  handleWebhook(event: WebhookEvent): Promise<WebhookResult>
  verifyWebhookSignature(rawPayload: string, signature: string): boolean
}
```

### Create: `packages/shared/src/types/payment.ts`
- `PriceDTO`, `ProductDTO`, `BillingTierDTO`
- `CheckoutSessionDTO`, `CustomerPortalDTO`
- `BillingSubscriptionDTO`

### Modify: `packages/shared/src/types/subscription.ts`
- Add `providerName`, `providerSubscriptionId` to `SubscriptionDTO`

---

## Phase 5: Service Layer

### Create: `app/services/providers/stripe_provider.ts`
Implements `PaymentProvider` interface:
- `createCheckoutSession()` - Uses `client_reference_id: user_123 | team_456`
- `createCustomerPortalSession()` - Billing portal for existing customers
- `handleWebhook()` - Event processing with atomic transactions
- `verifyWebhookSignature()` - HMAC signature validation

### Create: `app/services/payment_service.ts`
High-level orchestration:
- `createCheckoutSession(subscriberType, subscriberId, priceId, successUrl, cancelUrl)`
- `createCustomerPortalSession(subscriberType, subscriberId, returnUrl)`
- `processWebhook(rawPayload, signature)`
- `cancelSubscription(subscription)`

---

## Phase 6: Middleware & Controllers

### Create: `app/middleware/raw_body_middleware.ts`
Preserves raw request body in `ctx.request.rawBody` for webhook signature verification.

### Create: `app/controllers/payment_controller.ts`
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/billing/tiers` | GET | Public | List tiers with prices |
| `/billing/checkout` | POST | Auth | Create checkout session |
| `/billing/portal` | POST | Auth | Create customer portal |
| `/billing/subscription` | GET | Auth | Get current subscription |
| `/billing/cancel` | POST | Auth | Cancel subscription |

### Create: `app/controllers/webhook_controller.ts`
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/webhooks/stripe` | POST | Signature | Handle Stripe webhooks |

---

## Phase 7: Routes & Abilities

### Add to `start/routes.ts`:
```typescript
// Public
router.get('/billing/tiers', [PaymentController, 'getTiers'])

// Protected
router.group(() => {
  router.post('/checkout', [PaymentController, 'createCheckout'])
  router.post('/portal', [PaymentController, 'createPortal'])
  router.get('/subscription', [PaymentController, 'getSubscription'])
  router.post('/cancel', [PaymentController, 'cancelSubscription'])
}).prefix('/billing').use(middleware.auth())

// Webhooks (signature verification, no auth)
router.post('/webhooks/stripe', [WebhookController, 'handleStripe'])
  .use(middleware.rawBody())
```

### Add to `app/abilities/main.ts`:
- `manageBilling(user, subscriberType, subscriberId)` - Can manage billing for user/team
- `accessFeature(user, requiredTierSlug)` - Tier-based feature access

---

## Phase 8: Webhook Events

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create/update PaymentCustomer, cancel old subscription, create new |
| `customer.subscription.updated` | Update subscription status, handle plan changes |
| `customer.subscription.deleted` | Mark cancelled, create free subscription |
| `invoice.payment_failed` | Log warning, optionally mark as past_due |
| `invoice.payment_succeeded` | Update expiresAt, send confirmation |

**Security Flow**:
1. Verify signature (reject 400 if invalid)
2. Check idempotency (skip if already processed)
3. Parse `client_reference_id` → `user_123` or `team_456`
4. Wrap all logic in DB transaction
5. Mark event as processed

---

## Phase 9: Frontend

### API Client (`apps/web/lib/api.ts`):
```typescript
billingApi.getTiers()
billingApi.createCheckout(priceId)
billingApi.createPortal()
billingApi.getSubscription()
billingApi.cancelSubscription()
```

### Pages:
- `app/billing/page.tsx` - Pricing tiers, subscription status
- `app/billing/success/page.tsx` - Post-checkout success
- `app/billing/cancel/page.tsx` - Checkout cancelled

### Components:
- `components/billing/pricing-card.tsx` - Tier display with upgrade button
- `components/billing/subscription-status.tsx` - Current plan, manage/cancel

---

## Phase 10: Tests

### Backend Unit Tests:
- `tests/unit/payment_customer.spec.ts`
- `tests/unit/product.spec.ts`
- `tests/unit/price.spec.ts`
- `tests/unit/processed_webhook_event.spec.ts`
- `tests/unit/payment_service.spec.ts`
- `tests/unit/stripe_provider.spec.ts`

### Backend Functional Tests:
- `tests/functional/billing.spec.ts`
- `tests/functional/webhooks.spec.ts`

### Frontend Tests:
- `tests/pages/billing/page.test.tsx`
- `tests/components/billing/pricing-card.test.tsx`
- `tests/components/billing/subscription-status.test.tsx`

---

## Phase 11: Documentation

- Update `api.md` with new billing routes
- Update `.env.example` with Stripe vars

---

## Implementation Order

1. Environment & Dependencies
2. Database Migrations (run in order)
3. Models (PaymentCustomer, Product, Price, ProcessedWebhookEvent, modify Subscription)
4. Types & Interfaces (payment_provider.ts, shared types)
5. Service Layer (StripeProvider, PaymentService)
6. Middleware (raw_body_middleware)
7. Controllers (PaymentController, WebhookController)
8. Routes & Abilities
9. Backend Tests
10. Frontend (API client, pages, components)
11. Frontend Tests
12. Documentation

---

## Critical Files Summary

| File | Purpose |
|------|---------|
| `app/services/providers/stripe_provider.ts` | Core Stripe integration |
| `app/services/payment_service.ts` | Payment orchestration |
| `app/controllers/webhook_controller.ts` | Webhook handling with security |
| `app/middleware/raw_body_middleware.ts` | Raw body for signature verification |
| `app/models/subscription.ts` | Add provider fields |
| `packages/shared/src/types/payment.ts` | Shared type safety |
