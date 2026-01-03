# E2E Test Implementation Progress

## Status: In Progress

**Last Updated:** 2025-12-26

---

## Completed Work

### Phase 0: Setup & Analysis

- [x] **Playwright Configuration** - Already configured in `apps/web/playwright.config.ts`
  - Test directory: `./e2e`
  - Base URL: `http://localhost:3000`
  - Browser: Chromium only (WSL compatibility)
  - Reporter: HTML + List
  - Web server auto-start configured

- [x] **Codebase Exploration** - Analyzed all pages for selectors and form fields

### Phase 1: Foundation (COMPLETED)

- [x] **Directory Structure Created**
  ```
  apps/web/e2e/
  ├── auth/
  ├── navigation/
  ├── dashboard/
  ├── profile/
  ├── team/
  ├── billing/
  ├── admin/
  ├── forms/
  ├── errors/
  ├── fixtures/
  ├── helpers/
  └── setup/
  ```

- [x] **Fixtures Implemented** (`e2e/fixtures/`)
  - `auth.fixture.ts` - Authentication helpers (loginAsUser, loginAsAdmin, loginAsTier1User, logout)
  - `user.fixture.ts` - User data factories (createTestUser, createAdminUser, createTier1User, etc.)
  - `api-mock.fixture.ts` - API mocking utilities (mockApiResponse, mockApiError, mockAuthenticatedUser, etc.)
  - `index.ts` - Re-exports all fixtures

- [x] **Helpers Implemented** (`e2e/helpers/`)
  - `navigation.ts` - Navigation helpers (goto, waitForNavigation, goToLogin, openUserMenu, etc.)
  - `forms.ts` - Form helpers (fillForm, submitForm, getValidationError, selectOption, etc.)
  - `assertions.ts` - Assertion helpers (expectToast, expectAlert, expectBadge, expectDialog, etc.)
  - `index.ts` - Re-exports all helpers

- [x] **Global Setup** (`e2e/setup/`)
  - `global-setup.ts` - Pre-test setup (server check, logging)

- [x] **Playwright Config Updated**
  - Added `globalSetup` reference

### Phase 2: Authentication Tests (COMPLETED)

- [x] **Register Tests** (`e2e/auth/register.spec.ts`)
  - Page elements display
  - Successful registration flow
  - Client-side validation (email, password, mismatch)
  - API error handling (email exists, server error)
  - Loading states
  - OAuth buttons

- [x] **Login Tests** (`e2e/auth/login.spec.ts`)
  - Page elements display
  - Successful login (regular user, admin)
  - Invalid credentials handling
  - MFA flow (show input, valid/invalid code)
  - Client-side validation
  - Loading states
  - OAuth buttons

- [x] **Forgot Password Tests** (`e2e/auth/forgot-password.spec.ts`)
  - Page elements display
  - Successful request
  - Client-side validation
  - API error handling (rate limit, server error)
  - Loading states
  - Success state display

- [x] **Reset Password Tests** (`e2e/auth/reset-password.spec.ts`)
  - Page elements display
  - Token validation (missing, invalid, expired)
  - Successful reset with redirect
  - Client-side validation (short password, mismatch)
  - Loading states
  - Navigation

- [x] **Logout Tests** (`e2e/auth/logout.spec.ts`)
  - Logout from user menu
  - Session cleared after logout
  - Protected routes redirect after logout
  - API error handling
  - Logout from different pages

- [x] **OAuth Callback Tests** (`e2e/auth/oauth-callback.spec.ts`)
  - Success callbacks (new user, existing user)
  - Error callbacks (various error types)
  - Loading state
  - Edge cases (empty params, malformed)
  - Provider-specific callbacks
  - Navigation from error state

### Phase 3: Navigation Tests (COMPLETED)

- [x] **Header Tests** (`e2e/navigation/header.spec.ts`)
  - Unauthenticated header (Sign in, Get started buttons)
  - Authenticated header (Dashboard link, user avatar)
  - Admin header (Admin Panel link)
  - Loading state
  - Responsive behavior

- [x] **Protected Routes Tests** (`e2e/navigation/protected-routes.spec.ts`)
  - Unauthenticated access (redirect to /login)
  - Regular user restrictions (admin routes)
  - Tier1 user access (team page)
  - Admin user access (all admin routes)
  - Error handling (403 Forbidden)
  - Public routes accessibility

- [x] **User Menu Tests** (`e2e/navigation/user-menu.spec.ts`)
  - Menu opening/closing
  - Menu items for regular user
  - Menu items for tier1 user (Team link)
  - Menu items for admin user (Admin link)
  - Navigation from menu items
  - User info display
  - Accessibility (ARIA roles, keyboard navigation)

### Phase 4: Dashboard Tests (COMPLETED)

- [x] **Stats Tests** (`e2e/dashboard/stats.spec.ts`)
  - 4 stats cards display
  - Account age formatting (days/months/years)
  - Login count display
  - Email verified/unverified status
  - Security status (Protected/Basic)
  - Loading and error states

- [x] **Subscription Info Tests** (`e2e/dashboard/subscription-info.spec.ts`)
  - Free tier display
  - Tier1 subscriber info
  - Tier2 subscriber info
  - Team info display
  - Manage Team navigation

- [x] **Quick Actions Tests** (`e2e/dashboard/quick-actions.spec.ts`)
  - Edit Profile action
  - Security Settings action
  - Connected Accounts action
  - Account Settings action
  - Navigation from actions
  - Accessibility

- [x] **Recent Activity Tests** (`e2e/dashboard/recent-activity.spec.ts`)
  - Activity list display
  - Success/failure indicators
  - Login method display (password, OAuth, MFA)
  - Empty state
  - Timestamps
  - Loading state

- [x] **Feature Cards Tests** (`e2e/dashboard/feature-cards.spec.ts`)
  - Free tier feature card
  - Tier1/Tier2 feature visibility
  - Unlock/Upgrade buttons
  - Feature card interactions
  - Tier badge display

### Phase 5: Profile Tests (COMPLETED)

- [x] **Profile Edit Tests** (`e2e/profile/profile-edit.spec.ts`)
  - Form elements display
  - Update full name
  - Update avatar URL
  - Avatar display (fallback/image)
  - API error handling
  - Loading states
  - Sidebar navigation

- [x] **Security MFA Tests** (`e2e/profile/security-mfa.spec.ts`)
  - MFA disabled state
  - MFA setup flow (QR code, backup codes)
  - Enable MFA with valid/invalid code
  - MFA enabled state
  - Disable MFA

- [x] **Security Password Tests** (`e2e/profile/security-password.spec.ts`)
  - Form elements display
  - Successful password change
  - Client-side validation
  - API error handling (wrong password)
  - Loading states

- [x] **Settings Linked Accounts Tests** (`e2e/profile/settings-linked.spec.ts`)
  - No linked accounts state
  - Google/GitHub linked states
  - Link account action
  - Unlink account action
  - Provider icons

- [x] **Settings Activity Tests** (`e2e/profile/settings-activity.spec.ts`)
  - Activity table display
  - Method icons (password, Google, GitHub, MFA)
  - Status badges (success/failed)
  - Empty state
  - Loading state

### Phase 6: Team Tests (COMPLETED)

- [x] **Team Access Tests** (`e2e/team/team-access.spec.ts`)
  - Authentication required (redirect to /login)
  - Free tier user redirect to /dashboard
  - Tier1/Tier2 user with team can access
  - User without team redirect to /dashboard
  - Admin with team can access
  - Error handling (team fetch error, team not found)

- [x] **Team Display Tests** (`e2e/team/team-display.spec.ts`)
  - Team name and slug display
  - Subscription tier badge
  - Member count display
  - Team info card with icons
  - Tier2 team badge
  - Loading state
  - Single member team handling

- [x] **Invite Members Tests** (`e2e/team/invite-members.spec.ts`)
  - Invite form display for owner
  - Email input and role selector
  - Send invite button
  - Successful invitation flow
  - Invalid email validation
  - Role options (Member, Admin)
  - Member cannot see invite form
  - API error handling (duplicate invitation, existing member, server error)
  - Loading states

- [x] **Pending Invitations Tests** (`e2e/team/pending-invitations.spec.ts`)
  - Pending invitations table display
  - Invited email addresses
  - Role badges for each invitation
  - Expiration date display
  - Delete button for invitations
  - Confirmation dialog on delete
  - Cancel invitation after confirmation
  - Delete error handling
  - Empty invitations state
  - Non-admin cannot see pending invitations
  - Dialog cancel closes dialog

- [x] **Team Members Tests** (`e2e/team/team-members.spec.ts`)
  - Members table display
  - Member names, emails, and avatars
  - Role badges for each member
  - Joined date display
  - Owner can delete non-owner members
  - Confirmation dialog on delete
  - Remove member after confirmation
  - Remove member error handling
  - Cannot delete owner
  - Admin can delete regular members
  - Admin cannot delete owner
  - Admin cannot delete self
  - Regular member cannot see delete buttons
  - Role change for owner
  - Cannot change owner role
  - Leave team for non-owner
  - Owner cannot leave team
  - Single member team handling

### Phase 7: Billing Tests (COMPLETED)

- [x] **Balance Card Tests** (`e2e/billing/balance.spec.ts`)
  - Balance display with amount
  - Zero balance display
  - Currency formatting (USD, EUR)
  - Balance description text
  - Loading state
  - Error state handling
  - Wallet icon display

- [x] **Coupon Redemption Tests** (`e2e/billing/coupon-redeem.spec.ts`)
  - Coupon card display
  - Input field and Redeem button
  - Uppercase conversion
  - Valid coupon redemption flow
  - Credited amount display
  - New balance display
  - "Redeem another" functionality
  - Invalid/expired/used coupon errors
  - Loading state
  - Keyboard submit (Enter)

- [x] **Subscription Status Tests** (`e2e/billing/subscription-status.spec.ts`)
  - Subscription card with plan name
  - Status badges (Active, Trialing, Past Due, Cancelled)
  - Renewal date display
  - "Access until" for cancelled
  - No subscription state
  - Manage Billing button
  - Cancel Subscription with confirmation
  - Provider info display

- [x] **Pricing Plans Tests** (`e2e/billing/pricing-plans.spec.ts`)
  - Available Plans heading
  - All plan cards display
  - Plan descriptions and features
  - Team member limits
  - Monthly/Yearly tabs
  - Save 20% badge
  - Currency selector
  - Free plan card
  - Current plan indicator
  - Upgrade buttons
  - Unauthenticated user view
  - Loading state
  - Tax info display

- [x] **Discount Code Tests** (`e2e/billing/discount-code.spec.ts`)
  - Discount code input
  - Uppercase conversion
  - Clear button behavior
  - Validation on plan click
  - Discount applied display
  - Original price strikethrough
  - Discounted price in green
  - Percentage/amount badges
  - Invalid code errors
  - Loading state
  - Clear discount after validation
  - Validation hint text

- [x] **Checkout Tests** (`e2e/billing/checkout.spec.ts`)
  - Trigger checkout on upgrade
  - Correct priceId in request
  - Monthly/Yearly pricing
  - Success/Cancel URLs
  - Discount code inclusion
  - Loading state
  - Error handling
  - Different tier checkout
  - Current plan button disabled

- [x] **Success/Cancel Pages Tests** (`e2e/billing/success-cancel.spec.ts`)
  - Success page display
  - Thank you message
  - Green checkmark icon
  - Countdown timer
  - Auto redirect to /billing
  - "Go to Billing Now" button
  - Cancel page display
  - No charges message
  - View Plans button
  - Go to Dashboard button
  - Button styles and layout

### Phase 8: Admin Tests (COMPLETED)

- [x] **Admin Access Control Tests** (`e2e/admin/admin-access.spec.ts`)
  - Admin user can access /admin/dashboard
  - Regular user redirected to /dashboard
  - Unauthenticated user redirected to /login
  - All admin routes protected (/admin/dashboard, /admin/users, /admin/discount-codes, /admin/coupons)
  - Admin layout with sidebar
  - Navigation links display
  - Active navigation link highlight
  - Loading state while checking auth

- [x] **Admin Dashboard Tests** (`e2e/admin/admin-dashboard.spec.ts`)
  - 4 stats cards display (Total Users, Verified, MFA Enabled, Active This Week)
  - Stats values and percentages
  - Users by Role card with distribution
  - Quick Actions card
  - Manage Users button navigation
  - Coming soon badges for View Logs and System Settings
  - Loading and error states
  - Page header and description
  - Icons on stats cards

- [x] **Users Table Tests** (`e2e/admin/users-table.spec.ts`)
  - All column headers display
  - User IDs, emails, and names
  - Role badges (admin, user)
  - Subscription tier badges (Free, Tier 1, Tier 2)
  - Email status badges (Verified, Unverified)
  - MFA status badges (Enabled, Disabled)
  - Created date display
  - Empty state ("No users found")
  - Page header and description
  - Loading skeleton

- [x] **Users Actions Tests** (`e2e/admin/users-actions.spec.ts`)
  - Verify/Unverify email buttons
  - Verify/Unverify API calls
  - Success/error toast messages
  - Delete user button
  - Cannot delete self
  - Delete confirmation dialog
  - Delete API call on confirm
  - Remove user from list after delete
  - Tier selector dropdown
  - Show all tier options
  - Update tier API call
  - Update tier badge after change
  - Loading states on actions

- [x] **Discount Codes Tests** (`e2e/admin/discount-codes.spec.ts`)
  - Page header with Create button
  - Table display with headers
  - Discount codes list
  - Type badges (percentage, fixed)
  - Discount values (%, $)
  - Usage count display
  - Active/Inactive status badges
  - Create dialog with form fields
  - Create API call
  - Edit button and dialog
  - Pre-fill form with existing values
  - Update API call
  - Delete with confirmation
  - Toggle active status
  - Empty, loading, and error states

- [x] **Coupons Tests** (`e2e/admin/coupons.spec.ts`)
  - Page header with Create button
  - Table display with headers
  - Coupon codes and descriptions
  - Discount values (percentage, fixed)
  - Duration badges (once, forever)
  - Active/Expired status badges
  - Redemption count display
  - Create dialog with form fields
  - Discount type and duration selectors
  - Create API call
  - Edit button and dialog
  - Pre-fill form with existing values
  - Update API call
  - Delete with confirmation and Stripe warning
  - Toggle active status
  - Stripe integration info
  - Empty, loading, and error states
  - Stripe API error handling

---

## Selector Reference (From Analysis)

### Authentication Pages

#### Login Page (`/login`)
| Element | Selector |
|---------|----------|
| Email input | `input#email` |
| Password input | `input#password` |
| MFA Code input | `input#mfaCode` (conditional) |
| Submit button | `button:has-text("Sign in")` |
| Google OAuth | `button:has-text("Google")` |
| GitHub OAuth | `button:has-text("GitHub")` |
| Forgot password link | `a[href="/forgot-password"]` |
| Register link | `a[href="/register"]` |

#### Register Page (`/register`)
| Element | Selector |
|---------|----------|
| Full Name input | `input#fullName` |
| Email input | `input#email` |
| Password input | `input#password` |
| Confirm Password input | `input#passwordConfirmation` |
| Submit button | `button:has-text("Create account")` |
| Success heading | `h2:has-text("Check your email")` |

#### Forgot Password Page (`/forgot-password`)
| Element | Selector |
|---------|----------|
| Email input | `input#email` |
| Submit button | `button:has-text("Send reset link")` |
| Back to login | `a[href="/login"]` |

#### Reset Password Page (`/reset-password`)
| Element | Selector |
|---------|----------|
| Password input | `input#password` |
| Confirm Password input | `input#passwordConfirmation` |
| Submit button | `button:has-text("Reset password")` |

### Profile Pages

#### Profile Edit (`/profile`)
| Element | Selector |
|---------|----------|
| Full Name input | `input#fullName` |
| Email input (disabled) | `input#email` |
| Avatar URL input | `input#avatarUrl` |
| Submit button | `button:has-text("Save changes")` |

#### Security Page (`/profile/security`)
| Element | Selector |
|---------|----------|
| Setup 2FA button | `button:has-text("Set up 2FA")` |
| MFA enable code | `input#enableCode` |
| Enable 2FA button | `button:has-text("Enable 2FA")` |
| Disable 2FA button | `button:has-text("Disable 2FA")` |
| MFA disable code | `input#disableCode` |
| Current password | `input#currentPassword` |
| New password | `input#newPassword` |
| Confirm new password | `input#newPasswordConfirmation` |
| Change password button | `button:has-text("Change password")` |

#### Settings Page (`/profile/settings`)
| Element | Selector |
|---------|----------|
| Link Google button | `button:has-text("Link")` (Google card) |
| Unlink Google button | `button:has-text("Unlink")` (Google card) |
| Link GitHub button | `button:has-text("Link")` (GitHub card) |
| Unlink GitHub button | `button:has-text("Unlink")` (GitHub card) |

### Team Page (`/team`)
| Element | Selector |
|---------|----------|
| Invite email input | `input[placeholder="Email address"]` |
| Role select | Role dropdown |
| Send invite button | `button:has-text("Send Invite")` |
| Delete invitation button | Trash icon button |
| Delete member button | Trash icon button |

### Billing Page (`/billing`)
| Element | Selector |
|---------|----------|
| Monthly tab | `button[value="month"]` or `:has-text("Monthly")` |
| Yearly tab | `button[value="year"]` or `:has-text("Yearly")` |
| Currency select | Currency dropdown |
| Discount code input | `input.font-mono.uppercase` |
| Clear discount button | X icon button |
| Subscribe buttons | Per pricing card |

### Admin Pages

#### Admin Users (`/admin/users`)
| Element | Selector |
|---------|----------|
| User table | Table element |
| Verify button | `button:has-text("Verify")` |
| Unverify button | `button:has-text("Unverify")` |
| Delete button | `button:has-text("Delete")` |
| Tier select | Per-row select dropdown |

#### Admin Coupons (`/admin/coupons`)
| Element | Selector |
|---------|----------|
| Add coupon button | `button:has-text("Add Coupon")` |
| Code input | `input#code` |
| Description input | `input#description` |
| Credit amount input | `input#creditAmount` |
| Currency select | `select#currency` |
| Expires input | `input#expiresAt` |

#### Admin Discount Codes (`/admin/discount-codes`)
| Element | Selector |
|---------|----------|
| Add discount code button | `button:has-text("Add Discount Code")` |
| Code input | `input#code` |
| Description input | `input#description` |
| Discount type select | Type dropdown |
| Discount value input | `input#discountValue` |
| Min amount input | `input#minAmount` |
| Max uses input | `input#maxUses` |

---

## Files Created

| File | Description |
|------|-------------|
| `e2e/fixtures/auth.fixture.ts` | Authentication test fixtures |
| `e2e/fixtures/user.fixture.ts` | User data factories |
| `e2e/fixtures/api-mock.fixture.ts` | API mocking utilities |
| `e2e/fixtures/index.ts` | Fixtures barrel export |
| `e2e/helpers/navigation.ts` | Navigation helpers |
| `e2e/helpers/forms.ts` | Form interaction helpers |
| `e2e/helpers/assertions.ts` | Custom assertions |
| `e2e/helpers/index.ts` | Helpers barrel export |
| `e2e/setup/global-setup.ts` | Global test setup |
| `e2e/auth/register.spec.ts` | Registration tests (~20 tests) |
| `e2e/auth/login.spec.ts` | Login tests (~25 tests) |
| `e2e/auth/forgot-password.spec.ts` | Forgot password tests (~12 tests) |
| `e2e/auth/reset-password.spec.ts` | Reset password tests (~15 tests) |
| `e2e/auth/logout.spec.ts` | Logout tests (~10 tests) |
| `e2e/auth/oauth-callback.spec.ts` | OAuth callback tests (~15 tests) |
| `e2e/navigation/header.spec.ts` | Header navigation tests (~15 tests) |
| `e2e/navigation/protected-routes.spec.ts` | Protected routes tests (~20 tests) |
| `e2e/navigation/user-menu.spec.ts` | User menu tests (~20 tests) |
| `e2e/dashboard/stats.spec.ts` | Dashboard stats tests (~15 tests) |
| `e2e/dashboard/subscription-info.spec.ts` | Subscription info tests (~12 tests) |
| `e2e/dashboard/quick-actions.spec.ts` | Quick actions tests (~12 tests) |
| `e2e/dashboard/recent-activity.spec.ts` | Recent activity tests (~10 tests) |
| `e2e/dashboard/feature-cards.spec.ts` | Feature cards tests (~15 tests) |
| `e2e/profile/profile-edit.spec.ts` | Profile edit tests (~15 tests) |
| `e2e/profile/security-mfa.spec.ts` | MFA tests (~20 tests) |
| `e2e/profile/security-password.spec.ts` | Password change tests (~12 tests) |
| `e2e/profile/settings-linked.spec.ts` | Linked accounts tests (~15 tests) |
| `e2e/profile/settings-activity.spec.ts` | Login activity tests (~12 tests) |
| `e2e/team/team-access.spec.ts` | Team page access control tests (~12 tests) |
| `e2e/team/team-display.spec.ts` | Team display/header tests (~12 tests) |
| `e2e/team/invite-members.spec.ts` | Member invitation tests (~15 tests) |
| `e2e/team/pending-invitations.spec.ts` | Pending invitations tests (~15 tests) |
| `e2e/team/team-members.spec.ts` | Team members management tests (~25 tests) |
| `e2e/billing/balance.spec.ts` | Balance card tests (~10 tests) |
| `e2e/billing/coupon-redeem.spec.ts` | Coupon redemption tests (~18 tests) |
| `e2e/billing/subscription-status.spec.ts` | Subscription status tests (~20 tests) |
| `e2e/billing/pricing-plans.spec.ts` | Pricing plans display tests (~25 tests) |
| `e2e/billing/discount-code.spec.ts` | Discount code validation tests (~20 tests) |
| `e2e/billing/checkout.spec.ts` | Checkout flow tests (~15 tests) |
| `e2e/billing/success-cancel.spec.ts` | Success/Cancel pages tests (~20 tests) |
| `e2e/admin/admin-access.spec.ts` | Admin access control tests (~20 tests) |
| `e2e/admin/admin-dashboard.spec.ts` | Admin dashboard stats tests (~20 tests) |
| `e2e/admin/users-table.spec.ts` | Users table display tests (~25 tests) |
| `e2e/admin/users-actions.spec.ts` | User actions tests (~25 tests) |
| `e2e/admin/discount-codes.spec.ts` | Discount codes CRUD tests (~30 tests) |
| `e2e/admin/coupons.spec.ts` | Coupons CRUD tests (~35 tests) |

---

## Implementation Phases

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Foundation (fixtures, helpers, setup) | ✅ COMPLETED |
| Phase 2 | Authentication tests (6 files) | ✅ COMPLETED |
| Phase 3 | Navigation tests (3 files) | ✅ COMPLETED |
| Phase 4 | Dashboard tests (5 files) | ✅ COMPLETED |
| Phase 5 | Profile tests (5 files) | ✅ COMPLETED |
| Phase 6 | Team tests (5 files) | ✅ COMPLETED |
| Phase 7 | Billing tests (7 files) | ✅ COMPLETED |
| Phase 8 | Admin tests (6 files) | ✅ COMPLETED |
| Phase 9 | Cross-cutting tests (7 files) | ✅ COMPLETED |

---

## Next Steps

1. ~~Create directory structure for e2e tests~~ ✅
2. ~~Implement fixtures~~ ✅
3. ~~Implement helpers~~ ✅
4. ~~Create global setup~~ ✅
5. ~~Phase 2: Authentication tests~~ ✅
6. ~~Phase 3: Navigation tests~~ ✅
7. ~~Phase 4: Dashboard tests~~ ✅
8. ~~Phase 5: Profile tests~~ ✅
9. ~~Phase 6: Team tests~~ ✅
10. ~~Phase 7: Billing tests~~ ✅
11. ~~Phase 8: Admin tests~~ ✅
12. ~~Phase 9: Cross-cutting tests~~ ✅

**ALL PHASES COMPLETED!**

Run E2E tests with:
```bash
pnpm run web:e2e          # Run all tests
pnpm run web:e2e:headed   # Run with visible browser
pnpm run web:e2e:ui       # Run with interactive UI
```
