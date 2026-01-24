import { test } from '@japa/runner'
import {
  can,
  canWithOwnership,
  canAll,
  canAny,
  getPermissionsForRole,
  getDeniedActions,
  isSensitiveAction,
} from '#services/rbac_service'
import { ACTIONS, ALL_ACTIONS, ROLE_PERMISSIONS } from '#constants/permissions'
import { TENANT_ROLES } from '#constants/roles'

test.group('RBAC Service - can()', () => {
  // Owner tests
  test('owner can perform all actions', ({ assert }) => {
    for (const action of ALL_ACTIONS) {
      assert.isTrue(can(TENANT_ROLES.OWNER, action), `owner should be able to ${action}`)
    }
  })

  // Admin tests
  test('admin can update tenant', ({ assert }) => {
    assert.isTrue(can(TENANT_ROLES.ADMIN, ACTIONS.TENANT_UPDATE))
  })

  test('admin cannot delete tenant', ({ assert }) => {
    assert.isFalse(can(TENANT_ROLES.ADMIN, ACTIONS.TENANT_DELETE))
  })

  test('admin cannot cancel subscription', ({ assert }) => {
    assert.isFalse(can(TENANT_ROLES.ADMIN, ACTIONS.SUBSCRIPTION_CANCEL))
  })

  test('admin cannot update member roles', ({ assert }) => {
    assert.isFalse(can(TENANT_ROLES.ADMIN, ACTIONS.MEMBER_UPDATE_ROLE))
  })

  test('admin can add members', ({ assert }) => {
    assert.isTrue(can(TENANT_ROLES.ADMIN, ACTIONS.MEMBER_ADD))
  })

  test('admin can remove members', ({ assert }) => {
    assert.isTrue(can(TENANT_ROLES.ADMIN, ACTIONS.MEMBER_REMOVE))
  })

  test('admin can send invitations', ({ assert }) => {
    assert.isTrue(can(TENANT_ROLES.ADMIN, ACTIONS.INVITATION_SEND))
  })

  test('admin can upgrade subscription', ({ assert }) => {
    assert.isTrue(can(TENANT_ROLES.ADMIN, ACTIONS.SUBSCRIPTION_UPGRADE))
  })

  // Member tests
  test('member can only read tenant', ({ assert }) => {
    assert.isTrue(can(TENANT_ROLES.MEMBER, ACTIONS.TENANT_READ))
  })

  test('member cannot update tenant', ({ assert }) => {
    assert.isFalse(can(TENANT_ROLES.MEMBER, ACTIONS.TENANT_UPDATE))
  })

  test('member cannot delete tenant', ({ assert }) => {
    assert.isFalse(can(TENANT_ROLES.MEMBER, ACTIONS.TENANT_DELETE))
  })

  test('member can list members', ({ assert }) => {
    assert.isTrue(can(TENANT_ROLES.MEMBER, ACTIONS.MEMBER_LIST))
  })

  test('member cannot add members', ({ assert }) => {
    assert.isFalse(can(TENANT_ROLES.MEMBER, ACTIONS.MEMBER_ADD))
  })

  test('member cannot send invitations', ({ assert }) => {
    assert.isFalse(can(TENANT_ROLES.MEMBER, ACTIONS.INVITATION_SEND))
  })

  test('member can view billing', ({ assert }) => {
    assert.isTrue(can(TENANT_ROLES.MEMBER, ACTIONS.BILLING_VIEW))
  })

  test('member cannot manage billing', ({ assert }) => {
    assert.isFalse(can(TENANT_ROLES.MEMBER, ACTIONS.BILLING_MANAGE))
  })

  test('member can view subscription', ({ assert }) => {
    assert.isTrue(can(TENANT_ROLES.MEMBER, ACTIONS.SUBSCRIPTION_VIEW))
  })

  test('member cannot upgrade subscription', ({ assert }) => {
    assert.isFalse(can(TENANT_ROLES.MEMBER, ACTIONS.SUBSCRIPTION_UPGRADE))
  })

  // Unknown role tests (deny by default)
  test('unknown role is denied by default', ({ assert }) => {
    assert.isFalse(can('unknown', ACTIONS.TENANT_READ))
  })

  test('empty string role is denied', ({ assert }) => {
    assert.isFalse(can('', ACTIONS.TENANT_READ))
  })
})

test.group('RBAC Service - canWithOwnership()', () => {
  test('resource owner can perform any action regardless of role', ({ assert }) => {
    const context = { ownerId: 1, userId: 1 }
    assert.isTrue(canWithOwnership(context, TENANT_ROLES.MEMBER, ACTIONS.TENANT_DELETE))
  })

  test('non-owner falls back to role check', ({ assert }) => {
    const context = { ownerId: 2, userId: 1 }
    assert.isFalse(canWithOwnership(context, TENANT_ROLES.MEMBER, ACTIONS.TENANT_DELETE))
    assert.isTrue(canWithOwnership(context, TENANT_ROLES.OWNER, ACTIONS.TENANT_DELETE))
  })

  test('admin non-owner can perform admin actions', ({ assert }) => {
    const context = { ownerId: 2, userId: 1 }
    assert.isTrue(canWithOwnership(context, TENANT_ROLES.ADMIN, ACTIONS.MEMBER_REMOVE))
  })

  test('admin non-owner cannot perform owner-only actions', ({ assert }) => {
    const context = { ownerId: 2, userId: 1 }
    assert.isFalse(canWithOwnership(context, TENANT_ROLES.ADMIN, ACTIONS.SUBSCRIPTION_CANCEL))
  })
})

test.group('RBAC Service - isSensitiveAction()', () => {
  test('TENANT_DELETE is sensitive', ({ assert }) => {
    assert.isTrue(isSensitiveAction(ACTIONS.TENANT_DELETE))
  })

  test('MEMBER_REMOVE is sensitive', ({ assert }) => {
    assert.isTrue(isSensitiveAction(ACTIONS.MEMBER_REMOVE))
  })

  test('MEMBER_UPDATE_ROLE is sensitive', ({ assert }) => {
    assert.isTrue(isSensitiveAction(ACTIONS.MEMBER_UPDATE_ROLE))
  })

  test('BILLING_MANAGE is sensitive', ({ assert }) => {
    assert.isTrue(isSensitiveAction(ACTIONS.BILLING_MANAGE))
  })

  test('SUBSCRIPTION_CANCEL is sensitive', ({ assert }) => {
    assert.isTrue(isSensitiveAction(ACTIONS.SUBSCRIPTION_CANCEL))
  })

  test('TENANT_READ is not sensitive', ({ assert }) => {
    assert.isFalse(isSensitiveAction(ACTIONS.TENANT_READ))
  })

  test('MEMBER_LIST is not sensitive', ({ assert }) => {
    assert.isFalse(isSensitiveAction(ACTIONS.MEMBER_LIST))
  })

  test('BILLING_VIEW is not sensitive', ({ assert }) => {
    assert.isFalse(isSensitiveAction(ACTIONS.BILLING_VIEW))
  })
})

test.group('RBAC Service - getPermissionsForRole()', () => {
  test('returns all permissions for owner', ({ assert }) => {
    const permissions = getPermissionsForRole(TENANT_ROLES.OWNER)
    assert.equal(permissions.length, ALL_ACTIONS.length)
  })

  test('returns correct permissions for admin', ({ assert }) => {
    const permissions = getPermissionsForRole(TENANT_ROLES.ADMIN)
    assert.isTrue(permissions.includes(ACTIONS.TENANT_UPDATE))
    assert.isFalse(permissions.includes(ACTIONS.TENANT_DELETE))
    assert.isFalse(permissions.includes(ACTIONS.SUBSCRIPTION_CANCEL))
  })

  test('returns limited permissions for member', ({ assert }) => {
    const permissions = getPermissionsForRole(TENANT_ROLES.MEMBER)
    assert.equal(permissions.length, 4) // tenant:read, member:list, billing:view, subscription:view
    assert.isTrue(permissions.includes(ACTIONS.TENANT_READ))
    assert.isTrue(permissions.includes(ACTIONS.MEMBER_LIST))
    assert.isTrue(permissions.includes(ACTIONS.BILLING_VIEW))
    assert.isTrue(permissions.includes(ACTIONS.SUBSCRIPTION_VIEW))
  })

  test('returns empty array for unknown role', ({ assert }) => {
    const permissions = getPermissionsForRole('unknown')
    assert.isArray(permissions)
    assert.isEmpty(permissions)
  })
})

test.group('RBAC Service - canAll()', () => {
  test('owner can perform all actions', ({ assert }) => {
    assert.isTrue(canAll(TENANT_ROLES.OWNER, ALL_ACTIONS))
  })

  test('admin can perform allowed actions together', ({ assert }) => {
    assert.isTrue(
      canAll(TENANT_ROLES.ADMIN, [ACTIONS.TENANT_UPDATE, ACTIONS.MEMBER_ADD, ACTIONS.MEMBER_REMOVE])
    )
  })

  test('admin fails if one action is not allowed', ({ assert }) => {
    assert.isFalse(canAll(TENANT_ROLES.ADMIN, [ACTIONS.TENANT_UPDATE, ACTIONS.TENANT_DELETE]))
  })

  test('member can perform read-only actions', ({ assert }) => {
    assert.isTrue(
      canAll(TENANT_ROLES.MEMBER, [ACTIONS.TENANT_READ, ACTIONS.MEMBER_LIST, ACTIONS.BILLING_VIEW])
    )
  })

  test('empty actions array returns true', ({ assert }) => {
    assert.isTrue(canAll(TENANT_ROLES.MEMBER, []))
  })
})

test.group('RBAC Service - canAny()', () => {
  test('member can perform at least one read action', ({ assert }) => {
    assert.isTrue(canAny(TENANT_ROLES.MEMBER, [ACTIONS.TENANT_UPDATE, ACTIONS.TENANT_READ]))
  })

  test('member cannot perform any write actions', ({ assert }) => {
    assert.isFalse(canAny(TENANT_ROLES.MEMBER, [ACTIONS.TENANT_UPDATE, ACTIONS.TENANT_DELETE]))
  })

  test('unknown role cannot perform any action', ({ assert }) => {
    assert.isFalse(canAny('unknown', [ACTIONS.TENANT_READ, ACTIONS.MEMBER_LIST]))
  })

  test('empty actions array returns false', ({ assert }) => {
    assert.isFalse(canAny(TENANT_ROLES.OWNER, []))
  })
})

test.group('RBAC Service - getDeniedActions()', () => {
  test('owner has no denied actions', ({ assert }) => {
    const denied = getDeniedActions(TENANT_ROLES.OWNER, ALL_ACTIONS)
    assert.isEmpty(denied)
  })

  test('admin denied tenant:delete and subscription:cancel', ({ assert }) => {
    const denied = getDeniedActions(TENANT_ROLES.ADMIN, [
      ACTIONS.TENANT_UPDATE,
      ACTIONS.TENANT_DELETE,
      ACTIONS.SUBSCRIPTION_CANCEL,
    ])
    assert.lengthOf(denied, 2)
    assert.includeMembers(denied, [ACTIONS.TENANT_DELETE, ACTIONS.SUBSCRIPTION_CANCEL])
  })

  test('member denied most write actions', ({ assert }) => {
    const denied = getDeniedActions(TENANT_ROLES.MEMBER, [
      ACTIONS.TENANT_READ,
      ACTIONS.TENANT_UPDATE,
      ACTIONS.MEMBER_ADD,
    ])
    assert.lengthOf(denied, 2)
    assert.includeMembers(denied, [ACTIONS.TENANT_UPDATE, ACTIONS.MEMBER_ADD])
  })

  test('empty actions returns empty denied list', ({ assert }) => {
    const denied = getDeniedActions(TENANT_ROLES.MEMBER, [])
    assert.isEmpty(denied)
  })
})

test.group('RBAC Service - Role Permission Consistency', () => {
  test('owner has all permissions that admin has', ({ assert }) => {
    const ownerPerms = ROLE_PERMISSIONS[TENANT_ROLES.OWNER]
    const adminPerms = ROLE_PERMISSIONS[TENANT_ROLES.ADMIN]

    for (const perm of adminPerms) {
      assert.isTrue(ownerPerms.includes(perm), `owner should have admin permission: ${perm}`)
    }
  })

  test('admin has all permissions that member has', ({ assert }) => {
    const adminPerms = ROLE_PERMISSIONS[TENANT_ROLES.ADMIN]
    const memberPerms = ROLE_PERMISSIONS[TENANT_ROLES.MEMBER]

    for (const perm of memberPerms) {
      assert.isTrue(adminPerms.includes(perm), `admin should have member permission: ${perm}`)
    }
  })

  test('all actions are assigned to at least one role', ({ assert }) => {
    const allAssignedActions = new Set<string>()
    for (const role of Object.values(TENANT_ROLES)) {
      for (const action of ROLE_PERMISSIONS[role]) {
        allAssignedActions.add(action)
      }
    }

    for (const action of ALL_ACTIONS) {
      assert.isTrue(allAssignedActions.has(action), `action ${action} should be assigned to a role`)
    }
  })
})
