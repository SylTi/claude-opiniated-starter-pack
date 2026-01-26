# Code Review: RBAC & Audit Events (Commits 76c938e, 93c4464)

## Issues to Address in Future

### Audit Event System

#### 1. ~~Console.error in Production (`audit_event_bus.ts:165`)~~ FIXED
~~Should use proper AdonisJS Logger instead of console.error.~~
**Fixed:** Replaced `console.error` with `logger.error` from `@adonisjs/core/services/logger` with structured logging.

#### 2. No Persistence Layer
The audit event bus is in-memory only. Events are lost on restart. Consider:
- Adding a database sink subscriber
- Adding a file-based fallback
- Queue integration (Redis, RabbitMQ)

#### 3. setImmediate May Drop Events Under Load (`audit_event_bus.ts:115`)
```typescript
setImmediate(() => {
  this.emitter.emit(getEventChannel(event.type), event)
  this.emitter.emit(ALL_EVENTS_CHANNEL, event)
})
```
Under heavy load, setImmediate callbacks could be delayed significantly. Consider a proper queue.

### RBAC System

#### 1. No Audit Trail for Permission Checks
While `RBAC_PERMISSION_DENIED` event exists, successful permission checks aren't logged. For compliance, consider logging all sensitive action checks.

#### 2. ~~Missing Tests for Edge Cases~~ FIXED
~~- What happens when tenant context is missing?~~
~~- What happens with invalid role strings?~~
**Fixed:** Added edge case tests in `rbac_guard.spec.ts`:
- Tests for null/undefined tenant context
- Tests for invalid role strings (unknown, empty, whitespace, case-sensitivity)

### Modified Files

#### `auth_controller.ts`
- Changes look fine, integrated audit events properly

#### `login_history.ts`
- Changes look fine

#### `permissions.ts`
- SSO_VIEW and SSO_MANAGE added correctly
- Properly included in SENSITIVE_ACTIONS

#### `packages/shared/src/types/audit.ts`
- SSO audit event types added correctly
- Structure is clean

## Recommendations

1. Add a database subscriber to persist audit events
2. ~~Replace console.error with Logger in audit_event_bus.ts~~ DONE
3. Add integration tests for audit event flow
4. Consider adding metrics/monitoring for audit event throughput
