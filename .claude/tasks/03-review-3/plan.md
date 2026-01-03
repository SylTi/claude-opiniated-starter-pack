# Code Review #3 - Implementation Plan

## Issues Summary

| # | Issue | Status | Action |
|---|-------|--------|--------|
| 1 | Zombie Teams | ALREADY FIXED | Migration exists |
| 3 | Missing CSRF/Shield | TO FIX | Install @adonisjs/shield |
| 4 | Open Redirect | TO FIX | Whitelist returnUrl |
| 5 | Admin FOUC | TO FIX | Server Component + signed cookie |
| 6 | DTO Mapping | DEFER | Larger refactor |
| 7 | HTML Injection | TO FIX | Escape user inputs |
| 8 | Fake E2E Tests | DEFER | Per user decision |
| 9 | Restrictive Ownership | TO FIX | Allow multi-team membership |
| 10 | Magic Strings | TO FIX | Apply existing constants |
| 11 | Avatar URL XSS | TO FIX | Add protocol validation |
| 12 | Unused Validators | TO FIX | Remove or validate properly |

---

## Implementation Steps

### Phase 1: Security Fixes (Critical)

#### 1.1 Install and Configure @adonisjs/shield (Issue #3)
**Files to modify:**
- `apps/api/package.json` - Add dependency
- `apps/api/adonisrc.ts` - Register provider
- `apps/api/start/kernel.ts` - Add shield middleware
- `apps/api/config/shield.ts` - Create config (csrf, xss options)

**Steps:**
1. Run `pnpm --filter api add @adonisjs/shield`
2. Run `node ace configure @adonisjs/shield`
3. Configure CSRF protection for state-changing endpoints
4. Keep existing `security_headers_middleware.ts` for additional headers

#### 1.2 Fix Open Redirect in Billing Portal (Issue #4)
**Files to modify:**
- `apps/api/app/controllers/payment_controller.ts`
- `apps/api/app/validators/payment.ts`

**Implementation:**
```typescript
// payment_controller.ts
const allowedHosts = new Set([
  new URL(env.get('FRONTEND_URL')).host,
])

function isValidReturnUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return allowedHosts.has(parsed.host)
  } catch {
    return false
  }
}

// In createPortal method:
const finalReturnUrl = (returnUrl && isValidReturnUrl(returnUrl))
  ? returnUrl
  : `${frontendUrl}/billing`
```

#### 1.3 Fix Avatar URL XSS (Issue #11)
**Files to modify:**
- `apps/api/app/validators/auth.ts`

**Implementation:**
```typescript
avatarUrl: vine.string().url().optional().nullable()
  .regex(/^https?:\/\//) // Only allow http/https protocols
```
Alternative: Create a custom rule that validates URL protocol.

#### 1.4 Fix HTML Injection in Emails (Issue #7)
**Files to modify:**
- `apps/api/app/services/mail_service.ts`

**Implementation:**
1. Add HTML escape utility function:
```typescript
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  }
  return text.replace(/[&<>"']/g, (char) => map[char])
}
```
2. Apply to all user-provided values: `userName`, `teamName`, `inviterName`, `role`, `entityName`, `expiredTier`

---

### Phase 2: Architecture Improvements (Major)

#### 2.1 Convert Admin Layout to Server Component (Issue #5)
**Files to modify:**
- `apps/web/app/admin/layout.tsx`

**Implementation:**
1. Remove `"use client"` directive
2. Make component async
3. Read and verify signed `user-info` cookie server-side
4. Redirect non-admins before rendering
5. Remove `useAuth()` hook usage

```typescript
// New approach
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { decryptUserCookie } from '@/lib/cookie-signing'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const userInfoCookie = cookieStore.get('user-info')

  if (!userInfoCookie?.value) {
    redirect('/dashboard')
  }

  const userInfo = await decryptUserCookie(userInfoCookie.value)
  if (!userInfo || userInfo.role !== 'admin') {
    redirect('/dashboard')
  }

  // Render admin layout without loading states
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      {/* ... */}
    </div>
  )
}
```

#### 2.2 Remove Restrictive Team Ownership (Issue #9)
**Files to modify:**
- `apps/api/app/controllers/teams_controller.ts` (addMember method)
- `apps/api/app/controllers/teams_controller.ts` (sendInvitation method)
- `apps/api/app/controllers/teams_controller.ts` (acceptInvitation method)

**Implementation:**
Remove the check at lines 262-274 in `addMember`:
```typescript
// DELETE THIS BLOCK:
const ownerMembership = await TeamMember.query()
  .where('userId', newMember.id)
  .where('role', 'owner')
  .first()

if (ownerMembership) {
  return response.badRequest({...})
}
```

Also remove similar checks in:
- `sendInvitation` method (lines 538-550)
- `acceptInvitation` method (lines 786-797)

---

### Phase 3: Code Quality (Minor)

#### 3.1 Apply Constants Throughout Codebase (Issue #10)
**Files to modify:**
- `apps/api/app/controllers/teams_controller.ts`
- `apps/api/app/controllers/admin_controller.ts`
- `apps/api/app/controllers/oauth_controller.ts`
- `apps/api/app/controllers/payment_controller.ts`
- `apps/api/app/models/team_member.ts` (if applicable)

**Implementation:**
1. Import constants: `import { USER_ROLES, TEAM_ROLES } from '#constants/roles'`
2. Replace string literals:
   - `'admin'` → `USER_ROLES.ADMIN`
   - `'user'` → `USER_ROLES.USER`
   - `'owner'` → `TEAM_ROLES.OWNER`
   - `'member'` → `TEAM_ROLES.MEMBER`

#### 3.2 Clean Up Unused Validator Fields (Issue #12)
**Files to modify:**
- `apps/api/app/validators/payment.ts`

**Implementation:**
Remove `successUrl` and `cancelUrl` from `createCheckoutValidator` since they're not used:
```typescript
export const createCheckoutValidator = vine.compile(
  vine.object({
    priceId: vine.number().positive(),
    discountCode: vine.string().optional(),
    subscriberType: vine.enum(['user', 'team']).optional(),
    subscriberId: vine.number().positive().optional(),
  })
)
```

---

## Deferred Items

### DTO Layer Refactoring (Issue #6)
- Larger architectural change
- Consider using AdonisJS serialization or a dedicated DTO pattern
- Track in separate task

### Real E2E Tests (Issue #8)
- Per user decision: deferred
- Current mocked tests still validate UI behavior
- Would require running real API during test execution

---

## Testing Requirements

1. **Shield/CSRF**: Test CSRF token validation on POST/PUT/DELETE endpoints
2. **Open Redirect**: Test with malicious URLs in `returnUrl`
3. **Avatar XSS**: Test `javascript:alert()` URL rejection
4. **Email Escaping**: Test with HTML characters in names
5. **Admin Layout**: Verify no loading flash, direct redirect for non-admins
6. **Multi-team**: Test user who owns Team A can join Team B as member

---

## Execution Order

1. Phase 1.1-1.4 (Security) - Can be done in parallel
2. Phase 2.1 (Admin Layout)
3. Phase 2.2 (Team Ownership)
4. Phase 3.1-3.2 (Code Quality)

Total files to modify: ~10
