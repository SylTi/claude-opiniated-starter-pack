
## Key Refactor Strategies 
Proposed:
* Validation: Replace all manual controller checks with VineJS schemas. 
* Security: Install @adonisjs/shield for CSRF and security headers. 
* UX/Performance: Move auth redirects to Server Components to eliminate UI flickering (FOUC) and use randomsuffixes for slugs to prevent DB race conditions. 
* Architecture: Use DTO functions and Service classes to thin out controllers.


I will analyze the tests to find redundancies. A test is only considered "redundant" if checking it in the E2E
  suite (even with a real backend) provides no additional value over the Unit test.

  Criteria for Redundancy:
   1. Client-Side Only Logic: Form validation (email format, required fields), UI element visibility (renders
      input), local state transitions (loading spinners, button disabled states). These do not depend on the
      backend logic.
   2. Mocked Error States (that stay mocked): 500 error pages or network timeouts. Since E2E tests should mock
      destructive errors (we can't easily crash the real server), checking the UI response to that error is faster
      in Unit tests.

  Here is the exhaustive list of redundant E2E tests to delete:

  1. Auth / Login (apps/web/e2e/auth/login.spec.ts)
   * test.describe('Page Elements') - Entire block.
       * should display all form elements
       * should have proper input attributes
       * should not show MFA input initially
       * Reason: Pure React rendering. Covered by apps/web/tests/pages/auth/login.test.tsx ->
         describe('rendering').
   * test.describe('Client-side Validation') - Entire block.
       * should show error for empty email
       * should show error for empty password
       * should show error for invalid email format
       * Reason: Zod/HTML5 validation runs entirely in the browser. Covered by
         apps/web/tests/pages/auth/login.test.tsx -> describe('form validation').
   * test.describe('Loading States')
       * should show loading state during submission
       * Reason: React state check. Even with a real backend, checking for the "spinner" is flaky in E2E and
         deterministic in Unit. Covered by apps/web/tests/pages/auth/login.test.tsx.

  2. Dashboard (apps/web/e2e/dashboard/stats.spec.ts)
   * test.describe('Loading State')
       * should show loading state while fetching stats
       * Reason: React Suspense/State check. Covered by apps/web/tests/pages/dashboard.test.tsx -> displays loading
         spinner while loading.
   * test.describe('Account Age Formatting')
       * should format days correctly
       * should format months correctly
       * should format years correctly
       * Reason: This tests the formatDuration utility function, not the API. E2E should check one case to ensure
         data flows, not every permutation of the formatter.

  3. Admin Access (apps/web/e2e/admin/admin-access.spec.ts)
   * test('should show loading spinner while checking auth')
       * Reason: React state check.

  4. Error Pages (apps/web/e2e/errors/error-pages.spec.ts)
   * test('should display 404 page for unknown route')
       * Reason: Next.js routing logic. Can be tested in Unit/Integration or just once.
   * test('should redirect unauthenticated user to /login') (Repeated in multiple files)
       * Reason: If you have a global middleware.spec.ts or protected-routes.spec.ts, you don't need to test this
         redirect in every single feature spec file (admin-access, profile, dashboard, etc.). Consolidate to one
         suite.

  5. Profile / Settings
   * apps/web/e2e/profile/profile-edit.spec.ts
       * should show error for empty full name (if it exists)
       * Reason: Client-side Zod validation.

  6. Billing
   * apps/web/e2e/billing/checkout.spec.ts
       * Test cases that check if the "Upgrade" button is disabled/enabled based on local UI state.

  Tests that are NOT redundant (Keep these even if similar exist in Unit):
   * should login with valid credentials (Verifies cookie set, redirect, API contract).
   * should show error for invalid credentials (Verifies 401 response handling from real server).
   * should display dashboard stats (Verifies real data flow from DB -> API -> Frontend).