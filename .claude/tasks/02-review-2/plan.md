# Code Review Analysis & Implementation Plan

## Findings Verification

### CRITICAL Issues (Confirmed)

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 1 | Missing Rate Limiting | ✅ VALID | No limiter in `kernel.ts`, auth routes unprotected |
| 4 | Race Condition (addMember) | ✅ VALID | Check at line 275, write at 297 - no transaction |
| 3 | Zombie Teams | ✅ VALID | Migration uses `SET NULL`, `getSubscriberInfo()` accesses `team.owner.email` without null check |

### HIGH Issues (Confirmed)

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 5 | User Enumeration | ✅ VALID | `register()` returns 409 with specific message (line 29-33) |
| 2B | Webhook error leaking | ✅ VALID | Controller returns error.message to Stripe (line 47-48) |

### MEDIUM Issues (Confirmed)

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 7 | Middleware bottleneck | ✅ VALID | `fetch()` on every admin request (middleware.ts:73) |
| 8 | Missing CSP/HSTS | ✅ VALID | SecurityHeadersMiddleware missing these headers |
| 10 | Wrong URL config | ✅ VALID | Uses APP_URL for frontend links (teams_controller.ts:551) |

### LOW Issues (Confirmed)

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 6 | Docker port exposure | ✅ VALID | No localhost binding, but dev-only |
| 9 | Hardcoded strings | ✅ VALID | 'admin', 'free' scattered throughout |
| 12 | console.error usage | ✅ VALID | Should use AdonisJS Logger |

### INVALID/Already Fixed

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 2B | Webhook Idempotency | ❌ INVALID | Already implemented in `stripe_provider.ts:159-167` |
| 11 | Avatar XSS | ❌ LIKELY INVALID | VineJS `url()` validates http/https by default |

---

## Implementation Plan

### Phase 1: Critical Security Fixes

#### 1.1 Rate Limiting
**Files:**
- `apps/api/start/kernel.ts`
- `apps/api/start/routes.ts`
- `apps/api/adonisrc.ts`
- `apps/api/config/limiter.ts` (new)

**Steps:**
1. Install `@adonisjs/limiter`
2. Configure limiter in `adonisrc.ts`
3. Add named middleware in `kernel.ts`
4. Apply to auth routes: `/login`, `/register`, `/forgot-password`, `/reset-password`
5. Apply stricter limits to admin routes
6. **Disable rate limiting in test environment** (check `NODE_ENV !== 'test'`)

**Thresholds (Strict):**
- Login: 5 attempts per 15 minutes
- Register: 3 per hour per IP
- Forgot password: 3 per hour per email

#### 1.2 Race Condition Fix (addMember)
**Files:**
- `apps/api/app/controllers/teams_controller.ts`

**Steps:**
1. Wrap `addMember()` check-and-write in `db.transaction()` with row locking
2. Use `FOR UPDATE` on team query to prevent concurrent modifications
3. Apply same pattern to `acceptInvitation()` and registration with invitation

#### 1.3 Zombie Teams Fix
**Files:**
- `apps/api/database/migrations/XXXX_fix_teams_owner_constraint.ts` (new)
- `apps/api/app/services/payment_service.ts`

**Steps:**
1. Create migration to change `owner_id` constraint from `SET NULL` to `RESTRICT`
2. Add null check in `getSubscriberInfo()` with proper error handling
3. Update user deletion logic to require ownership transfer first

### Phase 2: High Priority Security

#### 2.1 User Enumeration Fix
**Files:**
- `apps/api/app/controllers/auth_controller.ts`

**Steps:**
1. Change `register()` to return 201 with generic message even if email exists
2. Send verification email regardless (silently skip if exists)
3. **Add random timing delay (100-300ms)** to prevent timing-based enumeration
4. Frontend shows same message: "Check your email to verify"

#### 2.2 Webhook Error Handling
**Files:**
- `apps/api/app/controllers/webhook_controller.ts`

**Steps:**
1. Return generic 400 error to Stripe (no error.message)
2. Log detailed errors internally using Logger
3. Add structured error logging with event context

### Phase 3: Performance & Security Hardening

#### 3.1 Middleware Performance (JWT-like Cookie)
**Files:**
- `apps/web/middleware.ts`
- `apps/api/app/controllers/auth_controller.ts`
- `apps/api/config/session.ts`

**Steps:**
1. Create signed cookie with user role/id on login
2. Update middleware to read role from cookie instead of API call
3. Invalidate cookie on logout
4. Set appropriate expiry matching session

#### 3.2 Security Headers
**Files:**
- `apps/api/app/middleware/security_headers_middleware.ts`

**Steps:**
1. Add `Content-Security-Policy` header
2. Add `Strict-Transport-Security` header (production only)
3. Consider installing `@adonisjs/shield` for full protection

#### 3.3 URL Configuration
**Files:**
- `apps/api/app/controllers/teams_controller.ts`
- `apps/api/start/env.ts`

**Steps:**
1. Add `FRONTEND_URL` to env schema
2. Update invitation link to use `FRONTEND_URL`
3. Update email templates if any use APP_URL for frontend links

### Phase 4: Code Quality (Low Priority)

#### 4.1 Docker Port Binding
**Files:**
- `docker-compose.yml`

**Steps:**
1. Change `5432:5432` to `127.0.0.1:5432:5432`
2. Same for test DB port

#### 4.2 Constants/Enums
**Files:**
- `packages/shared/src/types/constants.ts` (new)
- Various controllers

**Steps:**
1. Create UserRole enum
2. Create SubscriptionTier enum
3. Replace hardcoded strings

#### 4.3 Logger Migration
**Files:**
- All controllers with `console.error`

**Steps:**
1. Import AdonisJS Logger
2. Replace `console.error` with `logger.error`
3. Add structured context to log calls

---

## Decisions Made

- **Middleware fix:** JWT-like signed cookie (no API calls)
- **Rate limiting:** Strict thresholds, disabled in test environment
- **Timing protection:** Random 100-300ms delay on registration

---

## Test Coverage Required

Each fix requires corresponding tests:
- Rate limiting: Unit tests for middleware behavior
- Race condition: Integration test with concurrent requests
- Zombie teams: Unit test for null owner handling
- User enumeration: Functional test verifying same response for existing/new emails
- Webhook errors: Unit test for generic error responses
