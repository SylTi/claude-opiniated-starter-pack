# Brutal Code Review Report

Date: January 2, 2026
Project: SaaS Monorepo (AdonisJS API + Next.js Web)

## 🚨 Critical Issues (Immediate Action Required)

### 1. Missing Rate Limiting
*   **Location**: `apps/api/start/kernel.ts`, `apps/api/start/routes.ts`
*   **Vulnerability**: The API lacks any rate limiting middleware (e.g., `@adonisjs/limiter`).
*   **Impact**: Authentication endpoints (`/login`, `/register`, `/forgot-password`) are wide open to brute-force attacks and credential stuffing.
*   **Fix**: Install `@adonisjs/limiter` and apply it to all auth and sensitive billing routes.

### 2. Financial Integrity & Webhook Security
*   **Location**: `apps/api/app/controllers/webhook_controller.ts`
*   **Vulnerability A (Signature Verification)**: The controller passes `request.rawBody` to the service. If the body parser runs before this (consuming the stream) or modifies the payload, the signature verification will fail or, worse, be bypassed. The controller also catches all errors and returns specific error messages to the provider (Stripe), potentially leaking internal state.
*   **Vulnerability B (Idempotency)**: The controller processes webhooks blindly without checking if the event ID has already been processed (`ProcessedWebhookEvent`).
*   **Impact**: Double-crediting user balances, duplicate subscription provisioning, or denial of service via payload manipulation.
*   **Fix**: 
    1. Ensure `RawBodyMiddleware` runs strictly before body parsing for webhook routes.
    2. Check `ProcessedWebhookEvent` before processing.
    3. Return generic 400 errors to the outside world, logging specifics internally.

### 3. Database Integrity: "Zombie Teams"
*   **Location**: `apps/api/database/migrations/1765740372230_create_teams_table.ts`
*   **Issue**: `table.integer('owner_id')...onDelete('SET NULL')`.
*   **Impact**: When a user is deleted, their owned teams remain with `owner_id: null`.
*   **Exploit**: `PaymentService.getSubscriberInfo` relies on accessing `team.owner.email`. If a team has no owner, this throws a 500 Error, crashing the billing system for that context.
*   **Fix**: Change constraint to `RESTRICT` (prevent user deletion if they own teams) or force ownership transfer before deletion.

### 4. Race Condition: Plan Limit Bypass
*   **Location**: `apps/api/app/controllers/teams_controller.ts` (`addMember`)
*   **Issue**: The check `team.canAddMember()` and the write `TeamMember.create()` are not atomic.
*   **Exploit**: Two concurrent requests can add members simultaneously, bypassing the hard limit of the "Free" tier (e.g., adding 6 members to a 5-member limit team).
*   **Fix**: Wrap the check-and-write logic in `db.transaction()` with `SERIALIZABLE` isolation or usage of table locks.

## 🟠 Major Issues

### 5. User Enumeration
*   **Location**: `apps/api/app/controllers/auth_controller.ts`
*   **Issue**: Registration returns `409 Conflict` with `message: 'An account with this email already exists'`.
*   **Impact**: Allows attackers to scrape and build a list of all registered email addresses.
*   **Fix**: Return `201 Created` with a generic message ("If the email is valid, a verification link has been sent") even if the user exists.

### 6. Infrastructure: Exposed Database Ports
*   **Location**: `docker-compose.yml`
*   **Issue**: `ports: - "5432:5432"` binds the database to `0.0.0.0` on the host.
*   **Impact**: If the host machine is directly connected to the internet (common in VPS), the database is exposed.
*   **Fix**: Bind to localhost only: `127.0.0.1:5432:5432`.

### 7. Performance: Middleware Bottleneck
*   **Location**: `apps/web/middleware.ts`
*   **Issue**: Synchronous `fetch` to the API (`/api/v1/auth/me`) is performed on **every** request to admin routes.
*   **Impact**: Doubles the latency for all admin page loads and creates a heavy load on the API.
*   **Fix**: Encrypt the user role/status in the session cookie (or a separate signed cookie) so the middleware can verify access without an HTTP call.

### 8. Security Headers & CSRF
*   **Location**: `apps/api/config/session.ts`, `SecurityHeadersMiddleware.ts`
*   **Issue**: 
    *   Reliance solely on `SameSite: Strict` for CSRF protection (missing "Defense in Depth" tokens).
    *   Missing `Content-Security-Policy` (CSP) and `Strict-Transport-Security` (HSTS).
*   **Fix**: Implement `@adonisjs/shield` and add missing headers.

## 🟡 Minor Issues & Best Practices

### 9. Hardcoded Strings & Magic Numbers
*   **Location**: Various Controllers & Models.
*   **Issue**: Roles ('admin', 'user') and subscription slugs ('free') are hardcoded strings.
*   **Fix**: Use TypeScript Enums or a constants file to ensure type safety and easier refactoring.

### 10. URL Configuration
*   **Location**: `TeamsController.ts`
*   **Issue**: Uses `APP_URL` for constructing invitation links. In many setups, `APP_URL` is the backend, while `FRONTEND_URL` is the user-facing site.
*   **Fix**: Verify environment variables and ensure email links point to the Next.js frontend.

### 11. Stored XSS Risk (Avatar)
*   **Location**: `apps/api/app/validators/auth.ts` (`updateProfileValidator`)
*   **Issue**: Accepts `avatarUrl` as a string.
*   **Risk**: If the validator allows `javascript:` URIs and the frontend renders it in `<img src="...">`, it triggers XSS.
*   **Fix**: Ensure `vine.string().url()` enforces `http/https` protocols strictly.

### 12. Logging
*   **Location**: General
*   **Issue**: Extensive use of `console.error` instead of a structured logger.
*   **Fix**: Use AdonisJS `Logger` for proper log levels and formatting.

## Summary of Critical Actions Required:
   1. **Rate Limiting**: Implement @adonisjs/limiter to protect auth routes.
   2. **Financial Safety**: Fix the Webhook signature verification flow and implement idempotency checks.
   3. **Data Integrity**: Fix the "Zombie Teams" issue by changing the database foreign key constraint.
   4. **Concurrency**: Fix the race condition in team member addition using database transactions.