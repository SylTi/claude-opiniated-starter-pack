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

export default class TenantsController {
  private mailService = new MailService()
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
   */
  async store({ auth, request, response }: HttpContext): Promise<void> {
    const user = auth.user!
    const { name } = await request.validateUsing(createTenantValidator)

    // Use transaction to prevent race conditions
    const tenant = await db.transaction(async (trx) => {
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

      // Set as current tenant
      user.currentTenantId = newTenant.id
      user.useTransaction(trx)
      await user.save()

      return newTenant
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
  async update({ auth, params, request, response }: HttpContext): Promise<void> {
    const user = auth.user!
    const tenantId = params.id

    // Check if user is admin
    const membership = await TenantMembership.query()
      .where('userId', user.id)
      .where('tenantId', tenantId)
      .first()

    if (!membership || !membership.isAdmin()) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'You must be a tenant admin to update the tenant',
      })
    }

    const tenant = await Tenant.findOrFail(tenantId)
    const data = await request.validateUsing(updateTenantValidator)

    if (data.name !== undefined) {
      tenant.name = data.name
    }

    await tenant.save()

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
  async switchTenant({ auth, params, response }: HttpContext): Promise<void> {
    const user = auth.user!
    const tenantId = params.id

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
  async addMember({ auth, params, request, response }: HttpContext): Promise<void> {
    const user = auth.user!
    const tenantId = params.id

    // Check if user is admin
    const membership = await TenantMembership.query()
      .where('userId', user.id)
      .where('tenantId', tenantId)
      .first()

    if (!membership || !membership.isAdmin()) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'You must be a tenant admin to add members',
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

    // Use transaction with row locking to prevent race condition
    // when multiple requests try to add members simultaneously
    try {
      await db.transaction(async (trx) => {
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
        if (!(await tenant.canAddMember(tenant.memberships.length))) {
          const maxMembers = await tenant.getEffectiveMaxMembers()
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

        // Set as current tenant
        newMember.currentTenantId = Number(tenantId)
        newMember.useTransaction(trx)
        await newMember.save()
      })

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
   */
  async removeMember({ auth, params, response }: HttpContext): Promise<void> {
    const user = auth.user!
    const { id: tenantId, userId: memberUserId } = params

    // Check if user is admin
    const membership = await TenantMembership.query()
      .where('userId', user.id)
      .where('tenantId', tenantId)
      .first()

    if (!membership || !membership.isAdmin()) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'You must be a tenant admin to remove members',
      })
    }

    const memberToRemove = await TenantMembership.query()
      .where('userId', memberUserId)
      .where('tenantId', tenantId)
      .first()

    if (!memberToRemove) {
      return response.notFound({
        error: 'NotFound',
        message: 'Member not found',
      })
    }

    // Can't remove owner
    if (memberToRemove.role === TENANT_ROLES.OWNER) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'Cannot remove the tenant owner',
      })
    }

    await memberToRemove.delete()

    // Clear the user's current tenant if it was this tenant
    const removedUser = await User.find(memberUserId)
    if (removedUser && removedUser.currentTenantId === Number(tenantId)) {
      removedUser.currentTenantId = null
      await removedUser.save()
    }

    response.json({
      message: 'Member removed successfully',
    })
  }

  /**
   * Leave tenant
   */
  async leave({ auth, params, response }: HttpContext): Promise<void> {
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

    response.json({
      message: 'Left tenant successfully',
    })
  }

  /**
   * Delete tenant
   */
  async destroy({ auth, params, response }: HttpContext): Promise<void> {
    const user = auth.user!
    const tenantId = params.id

    const tenant = await Tenant.find(tenantId)
    if (!tenant) {
      return response.notFound({
        error: 'NotFound',
        message: 'Tenant not found',
      })
    }

    // Only owner can delete
    if (tenant.ownerId !== user.id) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'Only the tenant owner can delete the tenant',
      })
    }

    // Clear currentTenantId for all members
    await User.query().where('currentTenantId', tenantId).update({ currentTenantId: null })

    await tenant.delete()

    response.json({
      message: 'Tenant deleted successfully',
    })
  }

  /**
   * Send tenant invitation
   */
  async sendInvitation({ auth, params, request, response }: HttpContext): Promise<void> {
    const user = auth.user!
    const tenantId = params.id

    // Check if user is admin
    const membership = await TenantMembership.query()
      .where('userId', user.id)
      .where('tenantId', tenantId)
      .first()

    if (!membership || !membership.isAdmin()) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'You must be a tenant admin to send invitations',
      })
    }

    const { email, role = TENANT_ROLES.MEMBER } =
      await request.validateUsing(sendInvitationValidator)

    const tenant = await Tenant.query().where('id', tenantId).preload('memberships').firstOrFail()

    // Check if tenant has paid subscription
    const tenantTier = await tenant.getSubscriptionTier()
    if (tenantTier.slug === 'free') {
      return response.forbidden({
        error: 'Forbidden',
        message: 'Tenant must have a paid subscription to send invitations',
      })
    }

    // Check max members limit
    const pendingInvitations = await TenantInvitation.query()
      .where('tenantId', tenantId)
      .where('status', 'pending')

    const totalPotentialMembers = tenant.memberships.length + pendingInvitations.length
    if (!(await tenant.canAddMember(totalPotentialMembers))) {
      const maxMembers = await tenant.getEffectiveMaxMembers()
      return response.badRequest({
        error: 'LimitReached',
        message: `Tenant would exceed the maximum of ${maxMembers} members with pending invitations. Upgrade your subscription to add more.`,
      })
    }

    // Check if already a member
    const existingUser = await User.findBy('email', email)
    if (existingUser) {
      const existingMembership = await TenantMembership.query()
        .where('userId', existingUser.id)
        .where('tenantId', tenantId)
        .first()

      if (existingMembership) {
        return response.badRequest({
          error: 'ValidationError',
          message: 'User is already a member of this tenant',
        })
      }
    }

    // Check for existing pending invitation
    const existingInvitation = await TenantInvitation.query()
      .where('email', email)
      .where('tenantId', tenantId)
      .where('status', 'pending')
      .first()

    if (existingInvitation) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'An invitation has already been sent to this email',
      })
    }

    const inviteRole = role ?? TENANT_ROLES.MEMBER

    const invitation = await TenantInvitation.create({
      tenantId: Number(tenantId),
      invitedById: user.id,
      email,
      token: TenantInvitation.generateToken(),
      status: 'pending',
      role: inviteRole,
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    // Generate invitation link using FRONTEND_URL
    const frontendUrl = env.get('FRONTEND_URL', 'http://localhost:3000')
    const invitationLink = `${frontendUrl}/invitations/${invitation.token}`

    // Send invitation email (non-blocking)
    this.mailService
      .sendTenantInvitationEmail(
        email,
        tenant.name,
        user.fullName ?? user.email,
        invitation.token,
        inviteRole,
        invitation.expiresAt.toJSDate()
      )
      .catch((err) => logger.error({ err }, 'Failed to send tenant invitation email'))

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
  }

  /**
   * List pending invitations for a tenant
   */
  async listInvitations({ auth, params, response }: HttpContext): Promise<void> {
    const user = auth.user!
    const tenantId = params.id

    // Check if user is admin
    const membership = await TenantMembership.query()
      .where('userId', user.id)
      .where('tenantId', tenantId)
      .first()

    if (!membership || !membership.isAdmin()) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'You must be a tenant admin to view invitations',
      })
    }

    const invitations = await TenantInvitation.query()
      .where('tenantId', tenantId)
      .preload('invitedBy')
      .orderBy('createdAt', 'desc')

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
   */
  async cancelInvitation({ auth, params, response }: HttpContext): Promise<void> {
    const user = auth.user!
    const { id: tenantId, invitationId } = params

    // Check if user is admin
    const membership = await TenantMembership.query()
      .where('userId', user.id)
      .where('tenantId', tenantId)
      .first()

    if (!membership || !membership.isAdmin()) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'You must be a tenant admin to cancel invitations',
      })
    }

    const invitation = await TenantInvitation.query()
      .where('id', invitationId)
      .where('tenantId', tenantId)
      .where('status', 'pending')
      .first()

    if (!invitation) {
      return response.notFound({
        error: 'NotFound',
        message: 'Invitation not found or already processed',
      })
    }

    await invitation.delete()

    response.json({
      message: 'Invitation cancelled successfully',
    })
  }

  /**
   * Get invitation details by token (public route)
   */
  async getInvitationByToken({ params, response }: HttpContext): Promise<void> {
    const { token } = params

    const invitation = await TenantInvitation.query()
      .where('token', token)
      .preload('tenant')
      .preload('invitedBy')
      .first()

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

    if (invitation.isExpired()) {
      invitation.status = 'expired'
      await invitation.save()
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
          id: invitation.tenant.id,
          name: invitation.tenant.name,
          slug: invitation.tenant.slug,
        },
        invitedBy: {
          id: invitation.invitedBy.id,
          email: invitation.invitedBy.email,
          fullName: invitation.invitedBy.fullName,
        },
        expiresAt: invitation.expiresAt.toISO(),
      },
    })
  }

  /**
   * Accept invitation (for authenticated users)
   * Uses transaction with row locking to prevent race conditions
   */
  async acceptInvitation({ auth, params, response }: HttpContext): Promise<void> {
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

    // Use transaction with row locking to prevent race condition
    try {
      await db.transaction(async (trx) => {
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
        if (!(await tenant.canAddMember(tenant.memberships.length))) {
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

        // Update user
        user.currentTenantId = invitation.tenantId
        user.useTransaction(trx)
        await user.save()

        // Mark invitation as accepted
        invitation.status = 'accepted'
        invitation.useTransaction(trx)
        await invitation.save()
      })

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
  async declineInvitation({ auth, params, response }: HttpContext): Promise<void> {
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

    response.json({
      message: 'Invitation declined',
    })
  }
}
