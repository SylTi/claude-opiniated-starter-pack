# E2E Test Fixes - Progress Context

## Date: 2025-12-28

## Summary
Started fixing 100 failing E2E tests. Made significant progress on Auth and Billing tests.

## Tests Status

### Completed (Fixed)
1. **Auth tests (3 tests)** - All 3 passing now
   - Fixed MFA login test - Updated mock response format to return user data directly in `data` field instead of `{ data: { user: {...}, token: '...' } }`
   - OAuth callback test - Was already passing
   - Reset password test - Was already passing

2. **Billing tests (16 tests)** - 14 of 16 fixed
   - **Main fix**: Changed route pattern from `**/api/v1/billing/validate-discount-code/*` to `**/api/v1/billing/validate-discount-code` (removed trailing wildcard since API uses POST with body, not path params)
   - Fixed in both `discount-code.spec.ts` and `checkout.spec.ts`

### Remaining Billing Tests (2 failing)
- `checkout.spec.ts:260` - Loading state: should disable other upgrade buttons while loading
- `pricing-plans.spec.ts:434` - Unauthenticated user sign in message (flaky - passed in isolation)

## Tests Still Pending (17 categories)

3. Accessibility tests (6 tests)
4. API Error Handling tests (7 tests)
5. Error Pages tests (3 tests)
6. Loading States tests (1 test)
7. Responsive tests (2 tests)
8. Toast Notifications tests (6 tests)
9. Form Validation tests (6 tests)
10. Profile Edit tests (7 tests)
11. Security MFA tests (14 tests)
12. Security Password tests (4 tests)
13. Settings Activity tests (6 tests)
14. Settings Linked Accounts test (1 test)
15. Team Invite Members tests (5 tests)
16. Team Pending Invitations tests (10 tests)
17. Team Access/Members tests (3 tests)

## Files Modified
1. `/apps/web/e2e/auth/login.spec.ts` - Lines 245-290 (MFA mock response format)
2. `/apps/web/e2e/billing/discount-code.spec.ts` - All 12 occurrences of validate-discount-code route
3. `/apps/web/e2e/billing/checkout.spec.ts` - Line 177 (validate-discount-code route)

## Key Patterns Discovered

### Issue 1: API Response Format
Tests were returning mock data in wrong format. The API expects:
```json
{ "data": { "id": 1, "email": "...", ... } }
```
Not:
```json
{ "data": { "user": { "id": 1, ... }, "token": "..." } }
```

### Issue 2: Route Pattern Mismatch
The discount code validation API uses POST with body, not path parameters:
- Wrong: `**/api/v1/billing/validate-discount-code/*`
- Correct: `**/api/v1/billing/validate-discount-code`

## Failing Tests List
See `/apps/web/failing.md` for complete list of failing tests organized by category.

## Commands to Continue

Run all E2E tests:
```bash
pnpm exec playwright test --reporter=line 2>&1 | tail -50
```

Run specific test:
```bash
pnpm exec playwright test "path/to/test.spec.ts:LINE" --reporter=line
```

## Next Steps
1. Investigate remaining 2 billing test failures
2. Move to Accessibility tests (6 tests)
3. Continue through remaining test categories

## Todo List Status
```
1. [completed] Fix Auth tests (3 tests)
2. [in_progress] Fix Billing tests (16 tests) - 14 fixed, 2 remaining
3-17. [pending] All other test categories
```
