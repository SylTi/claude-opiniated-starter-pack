# Code Review 5: Critical Data Leak & Financial Integrity Vulnerabilities

I have continued the analysis and uncovered a **Critical Data Leak** alongside significant financial integrity issues (Double Spending).

## 1. CRITICAL: Public User Directory (PII Exposure)
*   **Vulnerability:** The route `GET /api/v1/users` (mapped to `UsersController.index`) is defined **outside** of any authentication middleware in `apps/api/start/routes.ts`.
*   **Impact:** Any unauthenticated user (or bot) can query this endpoint and receive a JSON list of **all users** in your system, including their `email`, `fullName`, and IDs. This allows for trivial email harvesting and targeted phishing attacks.
*   **Fix:**
    1.  Move this route inside the `middleware.auth()` group.
    2.  Or better, restrict it to `middleware.admin()`. Regular users rarely need to list *all* other users.

## 2. CRITICAL: Admin Denial of Service (DoS)
*   **Vulnerability:** The Admin API endpoints `listUsers` and `listTenants` (`apps/api/app/controllers/admin_controller.ts`) return **all records** in the database without pagination.
*   **Performance Impact:**
    *   **Memory/CPU:** Loading 10,000+ users into memory will crash the Node.js process.
    *   **N+1 Queries:** The controller iterates over every user to fetch subscription status individually (`users.map(async ... await Subscription...)`). For 1,000 users, this executes 1,001 database queries per request.
*   **Fix:** Implement pagination (`.paginate(page, limit)`) and use `.preload()` or joins to fetch related data efficiently.

## 3. HIGH: Coupon Double Spending (Race Condition)
*   **Vulnerability:** `CouponService.redeemCouponForTenant` checks the status of a coupon and then updates it. It does not use a database transaction or row locking (`forUpdate()`).
*   **Scenario:** If two requests (from the same or different users) attempt to redeem the same coupon code simultaneously, both may pass the `isRedeemable()` check before either writes to the database. Both will succeed, effectively doubling the credit amount granted.
*   **Fix:** Wrap the redemption logic in `db.transaction` and use `.forUpdate()` when querying the coupon to lock the row.

## 4. HIGH: MFA Backup Codes Stored in Plaintext
*   **Vulnerability:** `MfaService` generates backup codes and stores them directly in the database as a JSON string (`User.mfaBackupCodes`).
*   **Impact:** If the database is compromised (SQL Injection or backup theft), the attacker gains immediate access to bypass 2FA for all users.
*   **Fix:** Store backup codes as **hashes** (e.g., bcrypt/scrypt), similar to passwords. Verify them by hashing the input code and checking for a match.

## 5. HIGH: OAuth Account Takeover Risk
*   **Vulnerability:** In `OAuthController`, the application trusts the email address returned by the provider (GitHub/Google) without explicitly verifying if the provider considers it "verified".
*   **Scenario:** An attacker creates a GitHub account with an unverified email address that belongs to a target victim (e.g., `ceo@company.com`). If they log in via OAuth, your application might link this malicious GitHub account to the existing `ceo@company.com` account, allowing a takeover.
*   **Fix:** Ensure you check the `email_verified` flag from the Ally user object before linking or creating accounts.

## 6. MINOR: Discount Code Usage Limits
*   **Vulnerability:** Similar to coupons, `DiscountCodeService.validateCode` checks usage limits before the actual checkout occurs. Under high concurrency, a discount code limited to 100 uses could be used slightly more (e.g., 105 times).
*   **Recommendation:** Acceptable risk for most SaaS, but strictly enforcing inventory requires transactions.
