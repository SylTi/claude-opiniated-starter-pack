# E2E Test Implementation Plan

## Overview

This document contains the complete plan for implementing E2E tests using Playwright for the SaaS web application. The tests cover all functionalities grouped by feature area.

## Tech Stack

- **Framework**: Playwright (`@playwright/test` v1.57.0)
- **Config**: `apps/web/playwright.config.ts`
- **Test Directory**: `apps/web/e2e/`
- **Browsers**: Chromium only (WSL compatibility)
- **Base URL**: `http://localhost:3000`

## Commands

```bash
# Run all E2E tests
pnpm run web:e2e

# Run with UI
pnpm run web:e2e:ui

# Run headed (visible browser)
pnpm run web:e2e:headed

# Show report
pnpm run web:e2e:report
```

---

## Application Context

### API Base URL
All API calls go to `/api/v1/*`

### Authentication
- JWT-based authentication
- MFA support (TOTP 6-digit codes)
- OAuth providers: Google, GitHub
- Session stored in cookies/localStorage

### User Roles
- `user`: Regular user
- `admin`: Admin access to `/admin/*` routes

### Subscription Tiers
- `free`: Basic features
- `tier1`: Team features, advanced analytics
- `tier2`: White-label, custom integrations

---

## Directory Structure

```
apps/web/e2e/
├── auth/
│   ├── register.spec.ts
│   ├── login.spec.ts
│   ├── forgot-password.spec.ts
│   ├── reset-password.spec.ts
│   ├── logout.spec.ts
│   └── oauth-callback.spec.ts
├── navigation/
│   ├── header.spec.ts
│   ├── protected-routes.spec.ts
│   └── user-menu.spec.ts
├── dashboard/
│   ├── stats.spec.ts
│   ├── subscription-info.spec.ts
│   ├── quick-actions.spec.ts
│   ├── recent-activity.spec.ts
│   └── feature-cards.spec.ts
├── profile/
│   ├── profile-edit.spec.ts
│   ├── security-mfa.spec.ts
│   ├── security-password.spec.ts
│   ├── settings-linked.spec.ts
│   └── settings-activity.spec.ts
├── team/
│   ├── team-access.spec.ts
│   ├── team-display.spec.ts
│   ├── invite-members.spec.ts
│   ├── pending-invitations.spec.ts
│   └── team-members.spec.ts
├── billing/
│   ├── balance.spec.ts
│   ├── coupon-redeem.spec.ts
│   ├── subscription-status.spec.ts
│   ├── pricing-plans.spec.ts
│   ├── discount-code.spec.ts
│   ├── checkout.spec.ts
│   └── success-cancel.spec.ts
├── admin/
│   ├── admin-access.spec.ts
│   ├── admin-dashboard.spec.ts
│   ├── users-table.spec.ts
│   ├── users-actions.spec.ts
│   ├── discount-codes.spec.ts
│   └── coupons.spec.ts
├── forms/
│   ├── email-validation.spec.ts
│   ├── password-validation.spec.ts
│   ├── required-fields.spec.ts
│   └── submit-states.spec.ts
├── errors/
│   ├── api-errors.spec.ts
│   ├── auth-errors.spec.ts
│   └── not-found.spec.ts
├── fixtures/
│   ├── auth.fixture.ts
│   ├── user.fixture.ts
│   └── api-mock.fixture.ts
├── helpers/
│   ├── navigation.ts
│   ├── forms.ts
│   └── assertions.ts
└── setup/
    └── global-setup.ts
```

---

## Test Specifications by Category

### 1. Authentication Tests (`e2e/auth/`)

#### `register.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| Successful registration | Fill form with valid data, submit, see success message | POST `/api/v1/auth/register` |
| Invalid email format | Enter invalid email, see validation error | Client-side |
| Password too short | Enter < 8 chars, see validation error | Client-side |
| Password mismatch | Passwords don't match, see error | Client-side |
| Email already exists | Register with existing email, see API error | POST `/api/v1/auth/register` |
| OAuth buttons visible | Google and GitHub buttons are present and clickable | - |

**Form Fields:**
- `fullName` (optional): 2-255 chars
- `email` (required): valid email
- `password` (required): 8-128 chars
- `passwordConfirmation` (required): must match password

---

#### `login.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| Successful login | Valid credentials, redirect to /dashboard | POST `/api/v1/auth/login` |
| Invalid credentials | Wrong email/password, see error alert | POST `/api/v1/auth/login` |
| MFA required | Login returns requiresMfa, show MFA input | POST `/api/v1/auth/login` |
| MFA valid code | Enter correct 6-digit code, login succeeds | POST `/api/v1/auth/login` |
| MFA invalid code | Enter wrong code, see error | POST `/api/v1/auth/login` |
| OAuth buttons visible | Google and GitHub buttons present | - |

**Form Fields:**
- `email` (required): valid email
- `password` (required): required
- `mfaCode` (conditional): 6 digits only

---

#### `forgot-password.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| Submit request | Enter email, submit, see success message | POST `/api/v1/auth/forgot-password` |
| Invalid email | Enter invalid email, see validation error | Client-side |
| Non-existent email | API may return success (security) or error | POST `/api/v1/auth/forgot-password` |

---

#### `reset-password.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| Valid token reset | With valid token, reset password, redirect to login | POST `/api/v1/auth/reset-password` |
| Invalid token | Shows error page | POST `/api/v1/auth/reset-password` |
| Password too short | Validation error on client | Client-side |
| Password mismatch | Passwords don't match error | Client-side |

**URL**: `/reset-password?token={token}`

---

#### `logout.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| Logout from menu | Click logout in user menu, redirect to /login | POST `/api/v1/auth/logout` |
| Session cleared | After logout, protected routes redirect to login | - |

---

#### `oauth-callback.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| Success new user | `?success=true&isNewUser=true` → redirect to /profile | - |
| Success existing user | `?success=true` → redirect to /dashboard | - |
| Error callback | `?error=message` → show error, link to login | - |
| Loading state | Shows spinner while processing | - |

---

### 2. Navigation Tests (`e2e/navigation/`)

#### `header.spec.ts`
| Scenario | Description |
|----------|-------------|
| Unauthenticated header | Shows "Sign in" and "Get started" buttons |
| Authenticated header | Shows Dashboard link, user avatar/menu |
| Admin header | Shows "Admin Panel" link |
| Loading state | Shows pulse animation while auth loading |

---

#### `protected-routes.spec.ts`
| Scenario | Description |
|----------|-------------|
| /dashboard unauthenticated | Redirects to /login |
| /profile unauthenticated | Redirects to /login |
| /profile/security unauthenticated | Redirects to /login |
| /profile/settings unauthenticated | Redirects to /login |
| /team without tier1 | Redirects to /dashboard |
| /team without team | Redirects to /dashboard |
| /admin/* non-admin | Redirects to /dashboard with error |

---

#### `user-menu.spec.ts`
| Scenario | Description |
|----------|-------------|
| Menu opens on click | Avatar click opens dropdown |
| Dashboard link | Navigates to /dashboard |
| Profile link | Navigates to /profile |
| Security link | Navigates to /profile/security |
| Settings link | Navigates to /profile/settings |
| Team link (tier1+) | Visible only with tier1+, navigates to /team |
| Admin link (admin) | Visible only for admin role |
| Logout button | Logs out user |

---

### 3. Dashboard Tests (`e2e/dashboard/`)

#### `stats.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| Stats cards display | All 4 stats cards visible | GET `/api/v1/dashboard/stats` |
| Account age format | Shows days/months/years correctly | - |
| Login count | Shows number of logins | - |
| Email verified status | Shows Verified/Unverified badge | - |
| Security status | Shows Protected (MFA) or Basic | - |

---

#### `subscription-info.spec.ts`
| Scenario | Description |
|----------|-------------|
| Plan badge | Shows current subscription tier |
| Expiration date | Shows subscription end date |
| Team info | Shows team name and slug |
| Manage Team button | Visible for tier1+ users |

---

#### `quick-actions.spec.ts`
| Scenario | Description |
|----------|-------------|
| Edit Profile | Navigates to /profile |
| Security Settings | Navigates to /profile/security |
| Connected Accounts | Navigates to /profile/settings |
| Account Settings | Navigates to /profile/settings |

---

#### `recent-activity.spec.ts`
| Scenario | Description |
|----------|-------------|
| Activity list | Shows recent login attempts |
| Success indicator | Green check for successful logins |
| Failure indicator | Red X for failed logins |
| Login method | Shows password/oauth/mfa method |
| Empty state | Shows message when no activity |

---

#### `feature-cards.spec.ts`
| Scenario | Description |
|----------|-------------|
| Free tier card | Always visible with basic features |
| Tier 1 card | Content visible only for tier1+ users |
| Tier 2 card | Content visible only for tier2 users |

---

### 4. Profile Tests (`e2e/profile/`)

#### `profile-edit.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| Update full name | Change name, submit, see success | PUT `/api/v1/profile/update` |
| Update avatar | Change avatar URL, submit, see success | PUT `/api/v1/profile/update` |
| Invalid avatar URL | Enter invalid URL, see error | Client-side |
| Name too short | Enter < 2 chars, see error | Client-side |
| Email read-only | Email field is disabled | - |
| Avatar fallback | Shows initials when no avatar | - |

---

#### `security-mfa.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| MFA disabled state | Shows setup button, warning | - |
| Setup MFA | Click setup, see QR code | POST `/api/v1/mfa/setup` |
| Backup codes display | Shows backup codes in grid | - |
| Copy backup codes | Click copy, codes copied | - |
| Enable MFA | Enter valid code, enable | POST `/api/v1/mfa/enable` |
| Invalid enable code | Enter wrong code, see error | POST `/api/v1/mfa/enable` |
| MFA enabled state | Shows Protected badge, disable button | - |
| Disable MFA | Enter code, disable | POST `/api/v1/mfa/disable` |

---

#### `security-password.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| Change password | All fields valid, success | POST `/api/v1/auth/change-password` |
| Current password required | Empty current password, error | Client-side |
| New password too short | < 8 chars, error | Client-side |
| Password mismatch | Confirmation doesn't match, error | Client-side |
| Wrong current password | API returns error | POST `/api/v1/auth/change-password` |

---

#### `settings-linked.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| Google linked | Shows connected email | - |
| GitHub linked | Shows connected email | - |
| Link account | Click link, redirects to OAuth | - |
| Unlink account | Click unlink, account removed | DELETE `/api/v1/oauth/{provider}/unlink` |

---

#### `settings-activity.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| Activity table | Shows login history | GET `/api/v1/auth/login-history` |
| Method icons | Password, Google, GitHub, MFA icons | - |
| IP address | Shows IP for each login | - |
| Status badges | Success (green), Failed (red) | - |
| Empty state | Shows message when no history | - |

---

### 5. Team Tests (`e2e/team/`)

#### `team-access.spec.ts`
| Scenario | Description |
|----------|-------------|
| Requires auth | Unauthenticated → /login |
| Requires tier1+ | Free tier → /dashboard |
| Requires team | No currentTeamId → /dashboard |

---

#### `team-display.spec.ts`
| Scenario | Description |
|----------|-------------|
| Team name | Displays team name |
| Team slug | Displays team slug |
| Tier badge | Shows subscription tier |
| Member count | Shows number of members |

---

#### `invite-members.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| Admin visibility | Form visible for admin/owner | - |
| Non-admin hidden | Form not visible for members | - |
| Send invite | Fill form, submit, success | POST `/api/v1/teams/{teamId}/invitations` |
| Invalid email | Enter invalid email, error | Client-side |
| Role selection | Select Member or Admin | - |

---

#### `pending-invitations.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| Table display | Shows pending invitations | - |
| Email column | Shows invited email | - |
| Role badge | Shows invited role | - |
| Expiration | Shows expiration date | - |
| Delete invitation | Click delete, confirm, removed | DELETE `/api/v1/teams/{teamId}/invitations/{id}` |

---

#### `team-members.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| Members table | Shows all team members | - |
| Name and email | Shows member info | - |
| Role badges | Shows role with icons | - |
| Joined date | Shows when member joined | - |
| Delete member (admin) | Admin can delete members | DELETE `/api/v1/teams/{teamId}/members/{userId}` |
| Cannot delete self | Delete button disabled for self | - |
| Cannot delete owner | Delete button disabled for owner | - |
| Non-admin warning | Shows limited permissions alert | - |

---

### 6. Billing Tests (`e2e/billing/`)

#### `balance.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| Balance display | Shows current balance | GET `/api/v1/billing/balance` |
| Currency format | Correct currency symbol | - |
| Loading state | Shows spinner while loading | - |
| Error state | Shows error message on failure | - |

---

#### `coupon-redeem.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| Valid coupon | Enter code, redeem, see new balance | POST `/api/v1/billing/redeem-coupon` |
| Invalid coupon | Enter wrong code, see error | POST `/api/v1/billing/redeem-coupon` |
| Success display | Shows amount added, new balance | - |
| Redeem another | Can redeem another coupon | - |
| Uppercase input | Code input converts to uppercase | - |

---

#### `subscription-status.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| Plan display | Shows current plan name | GET `/api/v1/billing/subscription` |
| Active status | Green Active badge | - |
| Trialing status | Yellow Trialing badge | - |
| Past due status | Orange Past Due badge | - |
| Cancelled status | Gray Cancelled badge | - |
| Renewal date | Shows next billing date | - |
| Manage billing | Opens customer portal | - |
| Cancel subscription | Confirmation dialog, cancels | - |

---

#### `pricing-plans.spec.ts`
| Scenario | Description |
|----------|-------------|
| Monthly tab | Shows monthly prices |
| Yearly tab | Shows yearly prices |
| Save 20% badge | Visible on yearly tab |
| Currency selector | Can change currency |
| Plan cards | All plans displayed with features |

---

#### `discount-code.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| Apply valid code | Enter code, shows discount | POST `/api/v1/billing/validate-discount-code/{priceId}` |
| Invalid code | Enter wrong code, shows error | POST `/api/v1/billing/validate-discount-code/{priceId}` |
| Discount calculation | Shows original, discount, new price | - |
| Clear button | X button clears code | - |
| Loading state | Shows loading during validation | - |

---

#### `checkout.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| Subscribe click | Triggers checkout | POST `/api/v1/billing/checkout` |
| With discount | Discount code included | POST `/api/v1/billing/checkout` |
| Loading state | Button shows loading | - |

---

#### `success-cancel.spec.ts`
| Scenario | Description |
|----------|-------------|
| Success page | Shows success message |
| Countdown | 5 second countdown visible |
| Auto redirect | Redirects to /billing after countdown |
| Go now button | Immediate navigation to /billing |
| Cancel page | Shows cancellation message |
| View plans button | Navigates to billing |
| Dashboard button | Navigates to dashboard |

---

### 7. Admin Tests (`e2e/admin/`)

#### `admin-access.spec.ts`
| Scenario | Description |
|----------|-------------|
| Admin can access | Admin role can view /admin/* |
| User cannot access | User role redirects to /dashboard |
| Error toast | Shows error message for non-admin |

---

#### `admin-dashboard.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| Stats cards | All 4 stats visible | GET `/api/v1/admin/stats` |
| Total users | Count with new this month | - |
| Verified users | Count with percentage | - |
| MFA users | Count with adoption rate | - |
| Active this week | Unique logins count | - |
| Role distribution | Shows users by role | - |
| Quick actions | Manage Users navigates | - |

---

#### `users-table.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| Table display | Shows all users | GET `/api/v1/admin/users` |
| ID column | Monospace user IDs | - |
| Email column | User emails | - |
| Name column | User names | - |
| Role badges | Admin/User badges | - |
| Subscription dropdown | Tier selector | - |
| Email status | Verified/Unverified badges | - |
| MFA status | Enabled/Disabled badges | - |
| Created date | Formatted dates | - |

---

#### `users-actions.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| Verify email | Click verify, email verified | POST `/api/v1/admin/users/{id}/verify-email` |
| Unverify email | Click unverify, email unverified | POST `/api/v1/admin/users/{id}/unverify-email` |
| Update tier | Select tier, tier updated | PUT `/api/v1/admin/users/{id}/tier` |
| Delete user | Confirm delete, user removed | DELETE `/api/v1/admin/users/{id}` |
| Cannot delete self | Delete disabled for current user | - |

---

#### `discount-codes.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| Table display | Shows all discount codes | GET `/api/v1/admin/discount-codes` |
| Add code dialog | Open dialog, fill form | - |
| Create code | Submit form, code created | POST `/api/v1/admin/discount-codes` |
| Percentage type | Enter percentage discount | - |
| Fixed amount type | Enter fixed amount, select currency | - |
| Edit code | Click edit, modify, save | PUT `/api/v1/admin/discount-codes/{id}` |
| Enable/disable | Toggle active status | POST `/api/v1/admin/discount-codes/{id}` |
| Delete code | Confirm delete, removed | DELETE `/api/v1/admin/discount-codes/{id}` |

---

#### `coupons.spec.ts`
| Scenario | Description | API |
|----------|-------------|-----|
| Table display | Shows all coupons | GET `/api/v1/admin/coupons` |
| Status badges | Active/Inactive/Redeemed/Expired | - |
| Add coupon dialog | Open dialog, fill form | - |
| Create coupon | Submit form, coupon created | POST `/api/v1/admin/coupons` |
| Edit coupon | Modify non-redeemed coupon | PUT `/api/v1/admin/coupons/{id}` |
| Cannot edit redeemed | Error toast for redeemed coupons | - |
| Enable/disable | Toggle active status | PUT `/api/v1/admin/coupons/{id}` |
| Delete coupon | Confirm delete, removed | DELETE `/api/v1/admin/coupons/{id}` |

---

### 8. Form Validation Tests (`e2e/forms/`)

#### `email-validation.spec.ts`
| Scenario | Forms to test |
|----------|---------------|
| Invalid email format | Register, Login, Forgot Password, Team Invite |
| Empty email | All forms with email field |

---

#### `password-validation.spec.ts`
| Scenario | Forms to test |
|----------|---------------|
| Too short (< 8) | Register, Reset Password, Change Password |
| Too long (> 128) | Register, Reset Password, Change Password |
| Mismatch | Register, Reset Password, Change Password |

---

#### `required-fields.spec.ts`
| Scenario | Forms to test |
|----------|---------------|
| Empty required fields | All forms with required fields |
| Error messages display | All forms |

---

#### `submit-states.spec.ts`
| Scenario | Forms to test |
|----------|---------------|
| Button disabled | All forms during submission |
| Loading spinner | All forms during submission |

---

### 9. Error Handling Tests (`e2e/errors/`)

#### `api-errors.spec.ts`
| Scenario | Description |
|----------|-------------|
| Toast on API error | Error toast appears with message |
| Alert displays | Error alert shows in forms |
| Network error | Handles network failures gracefully |

---

#### `auth-errors.spec.ts`
| Scenario | Description |
|----------|-------------|
| 401 redirect | Unauthorized → /login |
| 403 redirect | Forbidden → /dashboard with error |
| Session expired | Handles expired session |

---

#### `not-found.spec.ts`
| Scenario | Description |
|----------|-------------|
| Invalid route | Shows 404 or redirects |
| Invalid IDs | Handles invalid resource IDs |

---

## Test Fixtures

### `fixtures/auth.fixture.ts`
```typescript
// Provides authenticated page contexts
// - loginAsUser(page): Login as regular user
// - loginAsAdmin(page): Login as admin
// - loginAsTier1User(page): Login as tier1 subscriber
// - logout(page): Logout current user
```

### `fixtures/user.fixture.ts`
```typescript
// User data factories
// - createTestUser(): Generate user data
// - createAdminUser(): Generate admin data
// - createTier1User(): Generate tier1 user
```

### `fixtures/api-mock.fixture.ts`
```typescript
// API mocking utilities
// - mockApiResponse(page, endpoint, response)
// - mockApiError(page, endpoint, status, message)
```

---

## Helpers

### `helpers/navigation.ts`
```typescript
// - goto(page, path): Navigate with base URL
// - waitForNavigation(page, path): Wait for navigation
// - getCurrentPath(page): Get current path
```

### `helpers/forms.ts`
```typescript
// - fillForm(page, fields): Fill form fields
// - submitForm(page, buttonText): Submit form
// - getValidationError(page, field): Get error message
```

### `helpers/assertions.ts`
```typescript
// - expectToast(page, message): Assert toast appeared
// - expectRedirect(page, path): Assert redirected
// - expectBadge(page, text): Assert badge visible
```

---

## Implementation Order

1. **Phase 1: Foundation**
   - [ ] Create fixtures and helpers
   - [ ] Create global setup

2. **Phase 2: Authentication** (Priority: Critical)
   - [ ] register.spec.ts
   - [ ] login.spec.ts
   - [ ] forgot-password.spec.ts
   - [ ] reset-password.spec.ts
   - [ ] logout.spec.ts
   - [ ] oauth-callback.spec.ts

3. **Phase 3: Navigation**
   - [ ] header.spec.ts
   - [ ] protected-routes.spec.ts
   - [ ] user-menu.spec.ts

4. **Phase 4: Dashboard**
   - [ ] All dashboard tests

5. **Phase 5: Profile**
   - [ ] All profile tests

6. **Phase 6: Team**
   - [ ] All team tests

7. **Phase 7: Billing**
   - [ ] All billing tests

8. **Phase 8: Admin**
   - [ ] All admin tests

9. **Phase 9: Cross-cutting**
   - [ ] Form validation tests
   - [ ] Error handling tests

---

## Estimated Totals

| Category | Files | Tests |
|----------|-------|-------|
| Authentication | 6 | ~25 |
| Navigation | 3 | ~12 |
| Dashboard | 5 | ~15 |
| Profile | 5 | ~20 |
| Team | 5 | ~18 |
| Billing | 7 | ~25 |
| Admin | 6 | ~30 |
| Forms | 4 | ~15 |
| Errors | 3 | ~10 |
| **Total** | **44** | **~170** |

---

## Key API Endpoints Reference

### Auth
- POST `/api/v1/auth/register`
- POST `/api/v1/auth/login`
- POST `/api/v1/auth/logout`
- POST `/api/v1/auth/forgot-password`
- POST `/api/v1/auth/reset-password`
- POST `/api/v1/auth/change-password`
- GET `/api/v1/auth/login-history`

### MFA
- POST `/api/v1/mfa/setup`
- POST `/api/v1/mfa/enable`
- POST `/api/v1/mfa/disable`

### Profile
- PUT `/api/v1/profile/update`

### OAuth
- DELETE `/api/v1/oauth/{provider}/unlink`

### Dashboard
- GET `/api/v1/dashboard/stats`

### Teams
- POST `/api/v1/teams/{teamId}/invitations`
- DELETE `/api/v1/teams/{teamId}/invitations/{id}`
- DELETE `/api/v1/teams/{teamId}/members/{userId}`

### Billing
- GET `/api/v1/billing/balance`
- GET `/api/v1/billing/subscription`
- POST `/api/v1/billing/redeem-coupon`
- POST `/api/v1/billing/validate-discount-code/{priceId}`
- POST `/api/v1/billing/checkout`

### Admin
- GET `/api/v1/admin/stats`
- GET `/api/v1/admin/users`
- POST `/api/v1/admin/users/{id}/verify-email`
- POST `/api/v1/admin/users/{id}/unverify-email`
- PUT `/api/v1/admin/users/{id}/tier`
- DELETE `/api/v1/admin/users/{id}`
- GET `/api/v1/admin/discount-codes`
- POST `/api/v1/admin/discount-codes`
- PUT `/api/v1/admin/discount-codes/{id}`
- DELETE `/api/v1/admin/discount-codes/{id}`
- GET `/api/v1/admin/coupons`
- POST `/api/v1/admin/coupons`
- PUT `/api/v1/admin/coupons/{id}`
- DELETE `/api/v1/admin/coupons/{id}`

---

## Notes

- All tests should run in isolation (no shared state)
- Use API mocking for external services (payment providers)
- Tests should clean up after themselves
- Use data-testid attributes for stable selectors when possible
- Consider using Page Object Model for complex pages
