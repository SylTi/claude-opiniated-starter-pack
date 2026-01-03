# E2E Failing Tests Summary

**Status**: ~670 passed, ~125 failed (estimated from recent runs)

## Fixed Test Files (Fully Passing)
- ✅ e2e/team/team-display.spec.ts (9/9 pass)
- ✅ e2e/team/team-members.spec.ts (25/25 pass)
- ✅ e2e/dashboard/feature-cards.spec.ts (17/17 pass)

## Partially Fixed Test Files
- e2e/team/invite-members.spec.ts (8/13 pass) - email input selector issues
- e2e/team/pending-invitations.spec.ts (partial) - needs similar fixes
- e2e/team/team-access.spec.ts (partial) - 1 failing

## Key Fixes Applied

### 1. Mock Data Structure
Changed from:
```typescript
{ tier: 'tier1' }
```
To:
```typescript
{
  subscription: {
    id: 1,
    tier: { slug: 'tier1', name: 'Tier 1' },
    status: 'active',
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }
}
```

### 2. Field Naming
Changed `joinedAt` to `createdAt` for team members

### 3. Missing Invitations Mock
Always add:
```typescript
await page.route('**/api/v1/teams/1/invitations', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: [] }),
  })
})
```

### 4. Helper Function Pattern
Use this pattern for team tests:
```typescript
async function setupTeamMock(page, teamData = mockTeamData, invitations = []) {
  await page.route('**/api/v1/teams/1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: teamData }),
    })
  })
  await page.route('**/api/v1/teams/1/invitations', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: invitations }),
    })
  })
}
```

### 5. Selector Fixes
- Use `.first()` for locators that match multiple elements
- Use `getByRole` for accessibility
- Avoid CSS class selectors for Tailwind classes on SVGs

## Remaining Test Files to Fix
- e2e/admin/*.spec.ts
- e2e/auth/forgot-password.spec.ts
- e2e/billing/*.spec.ts
- e2e/errors/*.spec.ts
- e2e/forms/form-validation.spec.ts
- e2e/navigation/*.spec.ts
- e2e/profile/*.spec.ts

## Commands to Run
```bash
# Run specific test file
pnpm exec playwright test e2e/team/team-members.spec.ts --reporter=list

# Run all tests
pnpm exec playwright test --reporter=list

# Show test report
pnpm exec playwright show-report
```
