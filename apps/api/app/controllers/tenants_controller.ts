import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import Tenant from '#models/tenant'
import TenantMembership from '#models/tenant_membership'
import TenantInvitation from '#models/tenant_invitation'
import User from '#models/user'
import string from '@adonisjs/core/helpers/string'
import env from '#start/env'
import MailService from '#services/mail_service'
import db from '@adonisjs/lucid/services/db'
import {
  createTenantValidator,
  updateTenantValidator,
  addMemberValidator,
  sendInvitationValidator,
} from '#validators/tenant'
import { TENANT_ROLES } from '#constants/roles'
import {
  AlreadyMemberError,
  MemberLimitReachedError,
  isAlreadyMemberError,
  isMemberLimitReachedError,
} from '#exceptions/tenant_errors'
import { RbacGuard } from '#services/rbac_guard'
import { ACTIONS } from '#constants/permissions'
import type { TenantRole } from '#constants/roles'
import { AuditContext } from '#services/audit_context'
import { AUDIT_EVENT_TYPES } from '#constants/audit_events'
import { systemOps } from '#services/system_operation_service'

export default class TenantsController {
  private mailService = new MailService()

  /**
   * Helper to get membership and create RbacGuard.
   * Returns null if user is not a member of the tenant.
   */
  private async getMembershipWithGuard(
    userId: number,
    tenantId: number
  ): Promise<{ membership: TenantMembership; guard: RbacGuard } | null> {
    const membership = await TenantMembership.query()
      .where('userId', userId)
      .where('tenantId', tenantId)
      .first()

    if (!membership) {
      return null
    }

    const guard = new RbacGuard({
      id: tenantId,
      membership: {
        id: membership.id,
        tenantId: membership.tenantId,
        userId: membership.userId,
        role: membership.role as TenantRole,
      },
    })

    return { membership, guard }
  }
  /**
   * List all tenants for the current user
   */
  async index({ auth, response }: HttpContext): Promise<void> {
    const user = auth.user!

    const memberships = await TenantMembership.query().where('userId', user.id).preload('tenant')

    response.json({
      data: memberships.map((m) => ({
        id: m.tenant.id,
        name: m.tenant.name,
        slug: m.tenant.slug,
        role: m.role,
        isCurrentTenant: m.tenant.id === user.currentTenantId,
        createdAt: m.tenant.createdAt.toISO(),
      })),
    })
  }

  /**
   * Create a new tenant
   *
   * Uses system RLS context because:
   * - tenants and tenant_memberships tables have RLS policies
   * - We're creating a NEW tenant, so no tenant context exists yet
   * - The user is authenticated but not yet a member of the new tenant
   */
  async store(ctx: HttpContext): Promise<void> {
    const { auth, request, response } = ctx
    const audit = new AuditContext(ctx)
    const user = auth.user!
    const { name } = await request.validateUsing(createTenantValidator)

    // Use system context because tenants/memberships have RLS and we're creating new records
    const tenant = await systemOps.withSystemContext(async (trx) => {
      // Generate unique slug (lowercase for URL-friendly format)
      const baseSlug = string.slug(name).toLowerCase()
      let slug = baseSlug

      // Check if slug exists within transaction
      const existingTeam = await Tenant.query({ client: trx }).where('slug', slug).first()

      if (existingTeam) {
        // Add random suffix to avoid collision
        slug = `${baseSlug}-${string.random(4).toLowerCase()}`
      }

      // Create tenant
      const newTenant = await Tenant.create(
        {
          name: name.trim(),
          slug,
          ownerId: user.id,
        },
        { client: trx }
      )

      // Add creator as owner
      await TenantMembership.create(
        {
          userId: user.id,
          tenantId: newTenant.id,
          role: TENANT_ROLES.OWNER,
        },
        { client: trx }
      )

      // Set as current tenant (users table has no RLS)
      user.currentTenantId = newTenant.id
      user.useTransaction(trx)
      await user.save()

      return newTenant
    })

    // Emit audit event for tenant creation
    audit.emitForTenant(AUDIT_EVENT_TYPES.TENANT_CREATE, tenant.id, {
      type: 'tenant',
      id: tenant.id,
    })

    response.created({
      data: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        ownerId: tenant.ownerId,
        createdAt: tenant.createdAt.toISO(),
      },
      message: 'Tenant created successfully',
    })
  }

  /**
   * Get tenant details
   */
  async show({ auth, params, response }: HttpContext): Promise<void> {
    const user = auth.user!
    const tenantId = params.id

    // Check membership and RBAC permission
    const result = await this.getMembershipWithGuard(user.id, tenantId)
    if (!result) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'You are not a member of this tenant',
      })
    }

    // Verify TENANT_READ permission (all roles have this, but enforces consistency)
    if (!result.guard.can(ACTIONS.TENANT_READ)) {
      return response.forbidden({
        error: 'RbacDenied',
        message: 'You do not have permission to view this tenant',
        deniedActions: [ACTIONS.TENANT_READ],
      })
    }

    const tenant = await Tenant.query()
      .where('id', tenantId)
      .preload('memberships', (query) => {
        query.preload('user')
      })
      .firstOrFail()

    response.json({
      data: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        ownerId: tenant.ownerId,
        members: tenant.memberships.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          user: {
            id: m.user.id,
            email: m.user.email,
            fullName: m.user.fullName,
            avatarUrl: m.user.avatarUrl,
          },
          createdAt: m.createdAt.toISO(),
        })),
        createdAt: tenant.createdAt.toISO(),
        updatedAt: tenant.updatedAt?.toISO() ?? null,
      },
    })
  }

  /**
   * Update tenant
   */
  async update(ctx: HttpContext): Promise<void> {
    const { auth, params, request, response } = ctx
    const audit = new AuditContext(ctx)
    const user = auth.user!
    const tenantId = params.id

    // Check membership and RBAC permission
    const result = await this.getMembershipWithGuard(user.id, tenantId)
    if (!result) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'You are not a member of this tenant',
      })
    }

    // Check TENANT_UPDATE permission (owner + admin)
    if (!result.guard.can(ACTIONS.TENANT_UPDATE)) {
      return response.forbidden({
        error: 'RbacDenied',
        message: 'You do not have permission to update this tenant',
        deniedActions: [ACTIONS.TENANT_UPDATE],
      })
    }

    const tenant = await Tenant.findOrFail(tenantId)
    const data = await request.validateUsing(updateTenantValidator)

    if (data.name !== undefined) {
      tenant.name = data.name
    }

    await tenant.save()

    // Emit audit event for tenant update
    audit.emitForTenant(
      AUDIT_EVENT_TYPES.TENANT_UPDATE,
      tenant.id,
      { type: 'tenant', id: tenant.id },
      { updatedFields: Object.keys(data) }
    )

    response.json({
      data: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        updatedAt: tenant.updatedAt?.toISO() ?? null,
      },
      message: 'Tenant updated successfully',
    })
  }

  /**
   * Switch current tenant
   */
  async switchTenant(ctx: HttpContext): Promise<void> {
    const { auth, params, response } = ctx
    const audit = new AuditContext(ctx)
    const user = auth.user!
    const tenantId = params.id
    const previousTenantId = user.currentTenantId

    // Check if user is a member
    const membership = await TenantMembership.query()
      .where('userId', user.id)
      .where('tenantId', tenantId)
      .first()

    if (!membership) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'You are not a member of this tenant',
      })
    }

    user.currentTenantId = tenantId
    await user.save()

    const tenant = await Tenant.findOrFail(tenantId)

    // Emit audit event for tenant switch
    audit.emitForTenant(
      AUDIT_EVENT_TYPES.TENANT_SWITCH,
      tenant.id,
      { type: 'tenant', id: tenant.id },
      { previousTenantId }
    )

    response.json({
      data: {
        currentTenantId: user.currentTenantId,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
        },
      },
      message: 'Switched to tenant successfully',
    })
  }

  /**
   * Add member to tenant
   * Uses transaction with row locking to prevent race conditions
   */
  async addMember(ctx: HttpContext): Promise<void> {
    const { auth, params, request, response } = ctx
    const audit = new AuditContext(ctx)
    const user = auth.user!
    const tenantId = params.id

    // Check membership and RBAC permission
    const result = await this.getMembershipWithGuard(user.id, tenantId)
    if (!result) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'You are not a member of this tenant',
      })
    }

    // Check MEMBER_ADD permission (owner + admin)
    if (!result.guard.can(ACTIONS.MEMBER_ADD)) {
      return response.forbidden({
        error: 'RbacDenied',
        message: 'You do not have permission to add members',
        deniedActions: [ACTIONS.MEMBER_ADD],
      })
    }

    const { email, role = TENANT_ROLES.MEMBER } = await request.validateUsing(addMemberValidator)

    const newMember = await User.findBy('email', email)
    if (!newMember) {
      return response.notFound({
        error: 'NotFound',
        message: 'User not found with this email',
      })
    }

    // Use system context with row locking to prevent race condition
    // when multiple requests try to add members simultaneously.
    // System context needed because we're modifying another user's currentTenantId.
    try {
      await systemOps.withTenantContext(
        Number(tenantId),
        async (trx) => {
          // Lock the tenant row to prevent concurrent modifications
          const tenant = await Tenant.query({ client: trx })
            .where('id', tenantId)
            .forUpdate()
            .preload('memberships')
            .firstOrFail()

          // Double-check membership inside transaction
          const existingMembership = await TenantMembership.query({ client: trx })
            .where('userId', newMember.id)
            .where('tenantId', tenantId)
            .first()

          if (existingMembership) {
            throw new AlreadyMemberError()
          }

          // Check max members limit (inside transaction with lock)
          if (!(await tenant.canAddMember(tenant.memberships.length, trx))) {
            const maxMembers = await tenant.getEffectiveMaxMembers(trx)
            throw new MemberLimitReachedError(maxMembers ?? 0)
          }

          // Create member inside transaction
          await TenantMembership.create(
            {
              userId: newMember.id,
              tenantId: Number(tenantId),
              role: role ?? TENANT_ROLES.MEMBER,
            },
            { client: trx }
          )

          // Set as current tenant (users table has no RLS)
          newMember.currentTenantId = Number(tenantId)
          newMember.useTransaction(trx)
          await newMember.save()
        },
        user.id
      )

      // Emit audit event for member addition
      audit.emitForTenant(
        AUDIT_EVENT_TYPES.MEMBER_ADD,
        Number(tenantId),
        { type: 'user', id: newMember.id },
        { role: role ?? TENANT_ROLES.MEMBER }
      )

      response.created({
        data: {
          userId: newMember.id,
          email: newMember.email,
          fullName: newMember.fullName,
          role: role ?? TENANT_ROLES.MEMBER,
        },
        message: 'Member added successfully',
      })
    } catch (error) {
      if (isAlreadyMemberError(error)) {
        return response.badRequest({
          error: 'ValidationError',
          message: error.message,
        })
      }
      if (isMemberLimitReachedError(error)) {
        return response.badRequest({
          error: 'LimitReached',
          message: `${error.message}. Upgrade your subscription to add more.`,
        })
      }
      throw error
    }
  }

  /**
   * Remove member from tenant
   *
   * Uses tenant RLS context because:
   * - tenant_memberships table has RLS policies requiring tenant context
   * - We need to query and delete membership records within tenant scope
   * - Also updates removed user's currentTenantId (users table has no RLS)
   */
  async removeMember(ctx: HttpContext): Promise<void> {
    const { auth, params, response } = ctx
    const audit = new AuditContext(ctx)
    const user = auth.user!
    const { id: tenantId, userId: memberUserId } = params

    // Check membership and RBAC permission
    const result = await this.getMembershipWithGuard(user.id, tenantId)
    if (!result) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'You are not a member of this tenant',
      })
    }

    // Check MEMBER_REMOVE permission (owner + admin)
    if (!result.guard.can(ACTIONS.MEMBER_REMOVE)) {
      return response.forbidden({
        error: 'RbacDenied',
        message: 'You do not have permission to remove members',
        deniedActions: [ACTIONS.MEMBER_REMOVE],
      })
    }

    // Use tenant context for RLS-protected operations
    const removedRole = await systemOps.withTenantContext(
      Number(tenantId),
      async (trx) => {
        const memberToRemove = await TenantMembership.query({ client: trx })
          .where('userId', memberUserId)
          .where('tenantId', tenantId)
          .first()

        if (!memberToRemove) {
          return null
        }

        // Can't remove owner
        if (memberToRemove.role === TENANT_ROLES.OWNER) {
          return 'OWNER'
        }

        const role = memberToRemove.role
        await memberToRemove.delete()

        // Clear the user's current tenant if it was this tenant
        // Note: users table has no RLS, but we're within transaction
        const removedUser = await User.find(memberUserId, { client: trx })
        if (removedUser && removedUser.currentTenantId === Number(tenantId)) {
          removedUser.currentTenantId = null
          removedUser.useTransaction(trx)
          await removedUser.save()
        }

        return role
      },
      user.id
    )

    if (removedRole === null) {
      return response.notFound({
        error: 'NotFound',
        message: 'Member not found',
      })
    }

    if (removedRole === 'OWNER') {
      return response.badRequest({
        error: 'ValidationError',
        message: 'Cannot remove the tenant owner',
      })
    }

    // Emit audit event for member removal
    audit.emitForTenant(
      AUDIT_EVENT_TYPES.MEMBER_REMOVE,
      Number(tenantId),
      { type: 'user', id: Number(memberUserId) },
      { removedRole }
    )

    response.json({
      message: 'Member removed successfully',
    })
  }

  /**
   * Leave tenant
   */
  async leave(ctx: HttpContext): Promise<void> {
    const { auth, params, response } = ctx
    const audit = new AuditContext(ctx)
    const user = auth.user!
    const tenantId = params.id

    const membership = await TenantMembership.query()
      .where('userId', user.id)
      .where('tenantId', tenantId)
      .first()

    if (!membership) {
      return response.notFound({
        error: 'NotFound',
        message: 'You are not a member of this tenant',
      })
    }

    // Owner can't leave
    if (membership.role === TENANT_ROLES.OWNER) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'Tenant owner cannot leave. Transfer ownership first or delete the tenant.',
      })
    }

    await membership.delete()

    // Clear current tenant
    if (user.currentTenantId === Number(tenantId)) {
      user.currentTenantId = null
      await user.save()
    }

    // Emit audit event for member leaving
    audit.emitForTenant(
      AUDIT_EVENT_TYPES.MEMBER_LEAVE,
      Number(tenantId),
      { type: 'tenant', id: Number(tenantId) },
      { previousRole: membership.role }
    )

    response.json({
      message: 'Left tenant successfully',
    })
  }

  /**
   * Delete tenant
   */
  async destroy(ctx: HttpContext): Promise<void> {
    const { auth, params, response } = ctx
    const audit = new AuditContext(ctx)
    const user = auth.user!
    const tenantId = params.id

    const tenant = await Tenant.find(tenantId)
    if (!tenant) {
      return response.notFound({
        error: 'NotFound',
        message: 'Tenant not found',
      })
    }

    // Check membership and RBAC permission
    const result = await this.getMembershipWithGuard(user.id, tenantId)
    if (!result) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'You are not a member of this tenant',
      })
    }

    // Check TENANT_DELETE permission (owner only)
    if (!result.guard.can(ACTIONS.TENANT_DELETE)) {
      return response.forbidden({
        error: 'RbacDenied',
        message: 'Only the tenant owner can delete the tenant',
        deniedActions: [ACTIONS.TENANT_DELETE],
      })
    }

    // Clear currentTenantId for all members using centralized system operation service.
    // RBAC has already verified the user is the tenant owner with TENANT_DELETE permission.
    await systemOps.clearMembersCurrentTenant(tenantId, user.id)

    // Emit audit event before deletion (tenant will no longer exist after)
    audit.emit(
      AUDIT_EVENT_TYPES.TENANT_DELETE,
      { type: 'tenant', id: Number(tenantId) },
      { tenantName: tenant.name }
    )

    await tenant.delete()

    response.json({
      message: 'Tenant deleted successfully',
    })
  }

  /**
   * Send tenant invitation
   *
   * Uses tenant RLS context with row locking because:
   * - tenant_invitations table has RLS policies requiring tenant context
   * - Need to prevent race conditions when checking member limits
   * - Multiple concurrent invitation requests could exceed limits without locking
   */
  async sendInvitation(ctx: HttpContext): Promise<void> {
    const { auth, params, request, response } = ctx
    const audit = new AuditContext(ctx)
    const user = auth.user!
    const tenantId = params.id

    // Check membership and RBAC permission
    const result = await this.getMembershipWithGuard(user.id, tenantId)
    if (!result) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'You are not a member of this tenant',
      })
    }

    // Check INVITATION_SEND permission (owner + admin)
    if (!result.guard.can(ACTIONS.INVITATION_SEND)) {
      return response.forbidden({
        error: 'RbacDenied',
        message: 'You do not have permission to send invitations',
        deniedActions: [ACTIONS.INVITATION_SEND],
      })
    }

    const { email, role = TENANT_ROLES.MEMBER } =
      await request.validateUsing(sendInvitationValidator)

    const inviteRole = role ?? TENANT_ROLES.MEMBER

    // Use tenant context with row locking to prevent race conditions
    try {
      const invitationResult = await systemOps.withTenantContext(
        Number(tenantId),
        async (trx) => {
          // Lock the tenant row to prevent concurrent invitation creation
          const tenant = await Tenant.query({ client: trx })
            .where('id', tenantId)
            .forUpdate()
            .preload('memberships')
            .firstOrFail()

          // Check if tenant has paid subscription
          const tenantTier = await tenant.getSubscriptionTier(trx)
          if (tenantTier.slug === 'free') {
            return { error: 'FREE_TIER' as const }
          }

          // Check max members limit (with lock held)
          const pendingInvitations = await TenantInvitation.query({ client: trx })
            .where('tenantId', tenantId)
            .where('status', 'pending')

          const totalPotentialMembers = tenant.memberships.length + pendingInvitations.length
          if (!(await tenant.canAddMember(totalPotentialMembers, trx))) {
            const maxMembers = await tenant.getEffectiveMaxMembers(trx)
            return { error: 'LIMIT_REACHED' as const, maxMembers }
          }

          // Check if already a member
          const existingUser = await User.findBy('email', email, { client: trx })
          if (existingUser) {
            const existingMembership = await TenantMembership.query({ client: trx })
              .where('userId', existingUser.id)
              .where('tenantId', tenantId)
              .first()

            if (existingMembership) {
              return { error: 'ALREADY_MEMBER' as const }
            }
          }

          // Check for existing pending invitation
          const existingInvitation = await TenantInvitation.query({ client: trx })
            .where('email', email)
            .where('tenantId', tenantId)
            .where('status', 'pending')
            .first()

          if (existingInvitation) {
            return { error: 'INVITATION_EXISTS' as const }
          }

          // Create invitation within locked transaction
          const invitation = await TenantInvitation.create(
            {
              tenantId: Number(tenantId),
              invitedById: user.id,
              email,
              token: TenantInvitation.generateToken(),
              status: 'pending',
              role: inviteRole,
              expiresAt: DateTime.now().plus({ days: 7 }),
            },
            { client: trx }
          )

          return { success: true as const, invitation, tenantName: tenant.name }
        },
        user.id
      )

      // Handle errors from transaction
      if ('error' in invitationResult) {
        switch (invitationResult.error) {
          case 'FREE_TIER':
            return response.forbidden({
              error: 'Forbidden',
              message: 'Tenant must have a paid subscription to send invitations',
            })
          case 'LIMIT_REACHED':
            return response.badRequest({
              error: 'LimitReached',
              message: `Tenant would exceed the maximum of ${invitationResult.maxMembers} members with pending invitations. Upgrade your subscription to add more.`,
            })
          case 'ALREADY_MEMBER':
            return response.badRequest({
              error: 'ValidationError',
              message: 'User is already a member of this tenant',
            })
          case 'INVITATION_EXISTS':
            return response.badRequest({
              error: 'ValidationError',
              message: 'An invitation has already been sent to this email',
            })
        }
      }

      const { invitation, tenantName } = invitationResult

      // Generate invitation link using FRONTEND_URL
      const frontendUrl = env.get('FRONTEND_URL', 'http://localhost:3000')
      const invitationLink = `${frontendUrl}/invitations/${invitation.token}`

      // Send invitation email (non-blocking, after transaction commits)
      this.mailService
        .sendTenantInvitationEmail(
          email,
          tenantName,
          user.fullName ?? user.email,
          invitation.token,
          inviteRole,
          invitation.expiresAt.toJSDate()
        )
        .catch((err) => logger.error({ err }, 'Failed to send tenant invitation email'))

      // Emit audit event for invitation sent
      audit.emitForTenant(
        AUDIT_EVENT_TYPES.INVITATION_SEND,
        Number(tenantId),
        { type: 'invitation', id: invitation.id },
        { invitedRole: inviteRole }
      )

      response.created({
        data: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt.toISO(),
          invitationLink,
        },
        message: 'Invitation sent successfully',
      })
    } catch (error) {
      throw error
    }
  }

  /**
   * List pending invitations for a tenant
   *
   * Uses tenant RLS context because:
   * - tenant_invitations table has RLS policies requiring tenant context
   * - Without tenant context, query would only return invitations to user's own email
   */
  async listInvitations({ auth, params, response }: HttpContext): Promise<void> {
    const user = auth.user!
    const tenantId = params.id

    // Check membership and RBAC permission
    const result = await this.getMembershipWithGuard(user.id, tenantId)
    if (!result) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'You are not a member of this tenant',
      })
    }

    // Check INVITATION_LIST permission (owner + admin)
    if (!result.guard.can(ACTIONS.INVITATION_LIST)) {
      return response.forbidden({
        error: 'RbacDenied',
        message: 'You do not have permission to view invitations',
        deniedActions: [ACTIONS.INVITATION_LIST],
      })
    }

    // Use tenant context for RLS-protected query
    const invitations = await systemOps.withTenantContext(
      Number(tenantId),
      async (trx) => {
        return TenantInvitation.query({ client: trx })
          .where('tenantId', tenantId)
          .preload('invitedBy')
          .orderBy('createdAt', 'desc')
      },
      user.id
    )

    response.json({
      data: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        expiresAt: inv.expiresAt.toISO(),
        isExpired: inv.isExpired(),
        invitedBy: {
          id: inv.invitedBy.id,
          email: inv.invitedBy.email,
          fullName: inv.invitedBy.fullName,
        },
        createdAt: inv.createdAt.toISO(),
      })),
    })
  }

  /**
   * Cancel a pending invitation
   *
   * Uses tenant RLS context because:
   * - tenant_invitations table has RLS policies requiring tenant context
   * - Need tenant context to query and delete invitation records
   */
  async cancelInvitation(ctx: HttpContext): Promise<void> {
    const { auth, params, response } = ctx
    const audit = new AuditContext(ctx)
    const user = auth.user!
    const { id: tenantId, invitationId } = params

    // Check membership and RBAC permission
    const result = await this.getMembershipWithGuard(user.id, tenantId)
    if (!result) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'You are not a member of this tenant',
      })
    }

    // Check INVITATION_CANCEL permission (owner + admin)
    if (!result.guard.can(ACTIONS.INVITATION_CANCEL)) {
      return response.forbidden({
        error: 'RbacDenied',
        message: 'You do not have permission to cancel invitations',
        deniedActions: [ACTIONS.INVITATION_CANCEL],
      })
    }

    // Use tenant context for RLS-protected operations
    const deleted = await systemOps.withTenantContext(
      Number(tenantId),
      async (trx) => {
        const invitation = await TenantInvitation.query({ client: trx })
          .where('id', invitationId)
          .where('tenantId', tenantId)
          .where('status', 'pending')
          .first()

        if (!invitation) {
          return false
        }

        await invitation.delete()
        return true
      },
      user.id
    )

    if (!deleted) {
      return response.notFound({
        error: 'NotFound',
        message: 'Invitation not found or already processed',
      })
    }

    // Emit audit event for invitation cancellation
    audit.emitForTenant(AUDIT_EVENT_TYPES.INVITATION_CANCEL, Number(tenantId), {
      type: 'invitation',
      id: Number(invitationId),
    })

    response.json({
      message: 'Invitation cancelled successfully',
    })
  }

  /**
   * Get invitation details by token (public route)
   *
   * Uses SECURITY DEFINER function to bypass RLS (unauthenticated access)
   */
  async getInvitationByToken({ params, response }: HttpContext): Promise<void> {
    const { token } = params

    // Use SECURITY DEFINER function to bypass RLS for public access
    const result = await db.rawQuery<{
      rows: Array<{
        id: number
        tenant_id: number
        email: string
        role: string
        status: string
        expires_at: Date
        invited_by_id: number
        tenant_name: string
        tenant_slug: string
        inviter_full_name: string | null
        inviter_email: string
      }>
    }>('SELECT * FROM app_get_invitation_by_token(?)', [token])

    const invitation = result.rows[0]

    if (!invitation) {
      return response.notFound({
        error: 'NotFound',
        message: 'Invitation not found',
      })
    }

    if (invitation.status !== 'pending') {
      return response.badRequest({
        error: 'InvalidInvitation',
        message: `This invitation has been ${invitation.status}`,
      })
    }

    // Check if expired
    const expiresAt = DateTime.fromJSDate(invitation.expires_at)
    if (expiresAt < DateTime.now()) {
      // Update status using SECURITY DEFINER function
      await db.rawQuery('SELECT app_update_invitation_status(?, ?)', [token, 'expired'])
      return response.badRequest({
        error: 'InvitationExpired',
        message: 'This invitation has expired',
      })
    }

    response.json({
      data: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        tenant: {
          id: invitation.tenant_id,
          name: invitation.tenant_name,
          slug: invitation.tenant_slug,
        },
        invitedBy: {
          id: invitation.invited_by_id,
          email: invitation.inviter_email,
          fullName: invitation.inviter_full_name,
        },
        expiresAt: expiresAt.toISO(),
      },
    })
  }

  /**
   * Accept invitation (for authenticated users)
   * Uses transaction with row locking to prevent race conditions
   */
  async acceptInvitation(ctx: HttpContext): Promise<void> {
    const { auth, params, response } = ctx
    const audit = new AuditContext(ctx)
    const user = auth.user!
    const { token } = params

    const invitation = await TenantInvitation.query()
      .where('token', token)
      .preload('tenant', (query) => {
        query.preload('memberships')
      })
      .first()

    if (!invitation) {
      return response.notFound({
        error: 'NotFound',
        message: 'Invitation not found',
      })
    }

    if (!invitation.isValid()) {
      return response.badRequest({
        error: 'InvalidInvitation',
        message: invitation.isExpired()
          ? 'This invitation has expired'
          : `This invitation has been ${invitation.status}`,
      })
    }

    // Check if invitation email matches user email
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'This invitation was sent to a different email address',
      })
    }

    // Use tenant context with row locking to prevent race condition.
    // We use tenant context because this is a user joining a specific tenant.
    try {
      await systemOps.withTenantContext(
        invitation.tenantId,
        async (trx) => {
          // Lock the tenant row to prevent concurrent modifications
          const tenant = await Tenant.query({ client: trx })
            .where('id', invitation.tenantId)
            .forUpdate()
            .preload('memberships')
            .firstOrFail()

          // Double-check membership inside transaction
          const existingMembership = await TenantMembership.query({ client: trx })
            .where('userId', user.id)
            .where('tenantId', invitation.tenantId)
            .first()

          if (existingMembership) {
            invitation.status = 'accepted'
            invitation.useTransaction(trx)
            await invitation.save()
            throw new Error('ALREADY_MEMBER')
          }

          // Check tenant member limit (inside transaction with lock)
          if (!(await tenant.canAddMember(tenant.memberships.length, trx))) {
            throw new Error('LIMIT_REACHED')
          }

          // Add user to tenant
          await TenantMembership.create(
            {
              userId: user.id,
              tenantId: invitation.tenantId,
              role: invitation.role,
            },
            { client: trx }
          )

          // Update user (users table has no RLS)
          user.currentTenantId = invitation.tenantId
          user.useTransaction(trx)
          await user.save()

          // Mark invitation as accepted
          invitation.status = 'accepted'
          invitation.useTransaction(trx)
          await invitation.save()
        },
        user.id
      )

      // Emit audit event for invitation acceptance
      audit.emitForTenant(
        AUDIT_EVENT_TYPES.INVITATION_ACCEPT,
        invitation.tenantId,
        { type: 'invitation', id: invitation.id },
        { role: invitation.role }
      )

      response.json({
        data: {
          tenantId: invitation.tenantId,
          tenantName: invitation.tenant.name,
          role: invitation.role,
        },
        message: 'You have joined the tenant successfully',
      })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'ALREADY_MEMBER') {
          return response.badRequest({
            error: 'AlreadyMember',
            message: 'You are already a member of this tenant',
          })
        }
        if (error.message === 'LIMIT_REACHED') {
          return response.badRequest({
            error: 'LimitReached',
            message: 'This tenant has reached its member limit',
          })
        }
      }
      throw error
    }
  }

  /**
   * Decline invitation (for authenticated users)
   */
  async declineInvitation(ctx: HttpContext): Promise<void> {
    const { auth, params, response } = ctx
    const audit = new AuditContext(ctx)
    const user = auth.user!
    const { token } = params

    const invitation = await TenantInvitation.query().where('token', token).first()

    if (!invitation) {
      return response.notFound({
        error: 'NotFound',
        message: 'Invitation not found',
      })
    }

    // Check if invitation email matches user email
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'This invitation was sent to a different email address',
      })
    }

    if (invitation.status !== 'pending') {
      return response.badRequest({
        error: 'InvalidInvitation',
        message: `This invitation has been ${invitation.status}`,
      })
    }

    invitation.status = 'declined'
    await invitation.save()

    // Emit audit event for invitation decline
    audit.emitForTenant(AUDIT_EVENT_TYPES.INVITATION_DECLINE, invitation.tenantId, {
      type: 'invitation',
      id: invitation.id,
    })

    response.json({
      message: 'Invitation declined',
    })
  }
}
