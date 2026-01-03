import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import Team from '#models/team'
import TeamMember from '#models/team_member'
import TeamInvitation from '#models/team_invitation'
import User from '#models/user'
import string from '@adonisjs/core/helpers/string'
import env from '#start/env'
import MailService from '#services/mail_service'
import db from '@adonisjs/lucid/services/db'
import {
  createTeamValidator,
  updateTeamValidator,
  addMemberValidator,
  sendInvitationValidator,
} from '#validators/team'
import { TEAM_ROLES } from '#constants/roles'

export default class TeamsController {
  private mailService = new MailService()
  /**
   * List all teams for the current user
   */
  async index({ auth, response }: HttpContext): Promise<void> {
    const user = auth.user!

    const memberships = await TeamMember.query().where('userId', user.id).preload('team')

    response.json({
      data: memberships.map((m) => ({
        id: m.team.id,
        name: m.team.name,
        slug: m.team.slug,
        role: m.role,
        isCurrentTeam: m.team.id === user.currentTeamId,
        createdAt: m.team.createdAt.toISO(),
      })),
    })
  }

  /**
   * Create a new team
   */
  async store({ auth, request, response }: HttpContext): Promise<void> {
    const user = auth.user!
    const { name } = await request.validateUsing(createTeamValidator)

    // Use transaction to prevent race conditions
    const team = await db.transaction(async (trx) => {
      // Generate unique slug (lowercase for URL-friendly format)
      const baseSlug = string.slug(name).toLowerCase()
      let slug = baseSlug

      // Check if slug exists within transaction
      const existingTeam = await Team.query({ client: trx }).where('slug', slug).first()

      if (existingTeam) {
        // Add random suffix to avoid collision
        slug = `${baseSlug}-${string.random(4).toLowerCase()}`
      }

      // Create team
      const newTeam = await Team.create(
        {
          name: name.trim(),
          slug,
          ownerId: user.id,
        },
        { client: trx }
      )

      // Add creator as owner
      await TeamMember.create(
        {
          userId: user.id,
          teamId: newTeam.id,
          role: TEAM_ROLES.OWNER,
        },
        { client: trx }
      )

      // Set as current team
      user.currentTeamId = newTeam.id
      user.useTransaction(trx)
      await user.save()

      return newTeam
    })

    response.created({
      data: {
        id: team.id,
        name: team.name,
        slug: team.slug,
        ownerId: team.ownerId,
        createdAt: team.createdAt.toISO(),
      },
      message: 'Team created successfully',
    })
  }

  /**
   * Get team details
   */
  async show({ auth, params, response }: HttpContext): Promise<void> {
    const user = auth.user!
    const teamId = params.id

    // Check if user is a member
    const membership = await TeamMember.query()
      .where('userId', user.id)
      .where('teamId', teamId)
      .first()

    if (!membership) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'You are not a member of this team',
      })
    }

    const team = await Team.query()
      .where('id', teamId)
      .preload('members', (query) => {
        query.preload('user')
      })
      .firstOrFail()

    response.json({
      data: {
        id: team.id,
        name: team.name,
        slug: team.slug,
        ownerId: team.ownerId,
        members: team.members.map((m) => ({
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
        createdAt: team.createdAt.toISO(),
        updatedAt: team.updatedAt?.toISO() ?? null,
      },
    })
  }

  /**
   * Update team
   */
  async update({ auth, params, request, response }: HttpContext): Promise<void> {
    const user = auth.user!
    const teamId = params.id

    // Check if user is admin
    const membership = await TeamMember.query()
      .where('userId', user.id)
      .where('teamId', teamId)
      .first()

    if (!membership || !membership.isAdmin()) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'You must be a team admin to update the team',
      })
    }

    const team = await Team.findOrFail(teamId)
    const data = await request.validateUsing(updateTeamValidator)

    if (data.name !== undefined) {
      team.name = data.name
    }

    await team.save()

    response.json({
      data: {
        id: team.id,
        name: team.name,
        slug: team.slug,
        updatedAt: team.updatedAt?.toISO() ?? null,
      },
      message: 'Team updated successfully',
    })
  }

  /**
   * Switch current team
   */
  async switchTeam({ auth, params, response }: HttpContext): Promise<void> {
    const user = auth.user!
    const teamId = params.id

    // Check if user is a member
    const membership = await TeamMember.query()
      .where('userId', user.id)
      .where('teamId', teamId)
      .first()

    if (!membership) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'You are not a member of this team',
      })
    }

    user.currentTeamId = teamId
    await user.save()

    const team = await Team.findOrFail(teamId)

    response.json({
      data: {
        currentTeamId: user.currentTeamId,
        team: {
          id: team.id,
          name: team.name,
          slug: team.slug,
        },
      },
      message: 'Switched to team successfully',
    })
  }

  /**
   * Add member to team
   * Uses transaction with row locking to prevent race conditions
   */
  async addMember({ auth, params, request, response }: HttpContext): Promise<void> {
    const user = auth.user!
    const teamId = params.id

    // Check if user is admin
    const membership = await TeamMember.query()
      .where('userId', user.id)
      .where('teamId', teamId)
      .first()

    if (!membership || !membership.isAdmin()) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'You must be a team admin to add members',
      })
    }

    const { email, role = TEAM_ROLES.MEMBER } = await request.validateUsing(addMemberValidator)

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
        // Lock the team row to prevent concurrent modifications
        const team = await Team.query({ client: trx })
          .where('id', teamId)
          .forUpdate()
          .preload('members')
          .firstOrFail()

        // Double-check membership inside transaction
        const existingMembership = await TeamMember.query({ client: trx })
          .where('userId', newMember.id)
          .where('teamId', teamId)
          .first()

        if (existingMembership) {
          throw new Error('ALREADY_MEMBER')
        }

        // Check max members limit (inside transaction with lock)
        if (!(await team.canAddMember(team.members.length))) {
          const maxMembers = await team.getEffectiveMaxMembers()
          throw new Error(`LIMIT_REACHED:${maxMembers}`)
        }

        // Create member inside transaction
        await TeamMember.create(
          {
            userId: newMember.id,
            teamId: Number(teamId),
            role: role ?? TEAM_ROLES.MEMBER,
          },
          { client: trx }
        )

        // Set as current team
        newMember.currentTeamId = Number(teamId)
        newMember.useTransaction(trx)
        await newMember.save()
      })

      response.created({
        data: {
          userId: newMember.id,
          email: newMember.email,
          fullName: newMember.fullName,
          role: role ?? TEAM_ROLES.MEMBER,
        },
        message: 'Member added successfully',
      })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'ALREADY_MEMBER') {
          return response.badRequest({
            error: 'ValidationError',
            message: 'User is already a member of this team',
          })
        }
        if (error.message.startsWith('LIMIT_REACHED:')) {
          const maxMembers = error.message.split(':')[1]
          return response.badRequest({
            error: 'LimitReached',
            message: `Team has reached the maximum of ${maxMembers} members. Upgrade your subscription to add more.`,
          })
        }
      }
      throw error
    }
  }

  /**
   * Remove member from team
   */
  async removeMember({ auth, params, response }: HttpContext): Promise<void> {
    const user = auth.user!
    const { id: teamId, userId: memberUserId } = params

    // Check if user is admin
    const membership = await TeamMember.query()
      .where('userId', user.id)
      .where('teamId', teamId)
      .first()

    if (!membership || !membership.isAdmin()) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'You must be a team admin to remove members',
      })
    }

    const memberToRemove = await TeamMember.query()
      .where('userId', memberUserId)
      .where('teamId', teamId)
      .first()

    if (!memberToRemove) {
      return response.notFound({
        error: 'NotFound',
        message: 'Member not found',
      })
    }

    // Can't remove owner
    if (memberToRemove.role === TEAM_ROLES.OWNER) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'Cannot remove the team owner',
      })
    }

    await memberToRemove.delete()

    // Clear the user's current team if it was this team
    const removedUser = await User.find(memberUserId)
    if (removedUser && removedUser.currentTeamId === Number(teamId)) {
      removedUser.currentTeamId = null
      await removedUser.save()
    }

    response.json({
      message: 'Member removed successfully',
    })
  }

  /**
   * Leave team
   */
  async leave({ auth, params, response }: HttpContext): Promise<void> {
    const user = auth.user!
    const teamId = params.id

    const membership = await TeamMember.query()
      .where('userId', user.id)
      .where('teamId', teamId)
      .first()

    if (!membership) {
      return response.notFound({
        error: 'NotFound',
        message: 'You are not a member of this team',
      })
    }

    // Owner can't leave
    if (membership.role === TEAM_ROLES.OWNER) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'Team owner cannot leave. Transfer ownership first or delete the team.',
      })
    }

    await membership.delete()

    // Clear current team
    if (user.currentTeamId === Number(teamId)) {
      user.currentTeamId = null
      await user.save()
    }

    response.json({
      message: 'Left team successfully',
    })
  }

  /**
   * Delete team
   */
  async destroy({ auth, params, response }: HttpContext): Promise<void> {
    const user = auth.user!
    const teamId = params.id

    const team = await Team.find(teamId)
    if (!team) {
      return response.notFound({
        error: 'NotFound',
        message: 'Team not found',
      })
    }

    // Only owner can delete
    if (team.ownerId !== user.id) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'Only the team owner can delete the team',
      })
    }

    // Clear currentTeamId for all members
    await User.query().where('currentTeamId', teamId).update({ currentTeamId: null })

    await team.delete()

    response.json({
      message: 'Team deleted successfully',
    })
  }

  /**
   * Send team invitation
   */
  async sendInvitation({ auth, params, request, response }: HttpContext): Promise<void> {
    const user = auth.user!
    const teamId = params.id

    // Check if user is admin
    const membership = await TeamMember.query()
      .where('userId', user.id)
      .where('teamId', teamId)
      .first()

    if (!membership || !membership.isAdmin()) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'You must be a team admin to send invitations',
      })
    }

    const { email, role = TEAM_ROLES.MEMBER } = await request.validateUsing(sendInvitationValidator)

    const team = await Team.query().where('id', teamId).preload('members').firstOrFail()

    // Check if team has paid subscription
    const teamTier = await team.getSubscriptionTier()
    if (teamTier.slug === 'free') {
      return response.forbidden({
        error: 'Forbidden',
        message: 'Team must have a paid subscription to send invitations',
      })
    }

    // Check max members limit
    const pendingInvitations = await TeamInvitation.query()
      .where('teamId', teamId)
      .where('status', 'pending')

    const totalPotentialMembers = team.members.length + pendingInvitations.length
    if (!(await team.canAddMember(totalPotentialMembers))) {
      const maxMembers = await team.getEffectiveMaxMembers()
      return response.badRequest({
        error: 'LimitReached',
        message: `Team would exceed the maximum of ${maxMembers} members with pending invitations. Upgrade your subscription to add more.`,
      })
    }

    // Check if already a member
    const existingUser = await User.findBy('email', email)
    if (existingUser) {
      const existingMembership = await TeamMember.query()
        .where('userId', existingUser.id)
        .where('teamId', teamId)
        .first()

      if (existingMembership) {
        return response.badRequest({
          error: 'ValidationError',
          message: 'User is already a member of this team',
        })
      }
    }

    // Check for existing pending invitation
    const existingInvitation = await TeamInvitation.query()
      .where('email', email)
      .where('teamId', teamId)
      .where('status', 'pending')
      .first()

    if (existingInvitation) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'An invitation has already been sent to this email',
      })
    }

    const inviteRole = role ?? TEAM_ROLES.MEMBER

    const invitation = await TeamInvitation.create({
      teamId: Number(teamId),
      invitedById: user.id,
      email,
      token: TeamInvitation.generateToken(),
      status: 'pending',
      role: inviteRole,
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    // Generate invitation link using FRONTEND_URL
    const frontendUrl = env.get('FRONTEND_URL', 'http://localhost:3000')
    const invitationLink = `${frontendUrl}/invitations/${invitation.token}`

    // Send invitation email (non-blocking)
    this.mailService
      .sendTeamInvitationEmail(
        email,
        team.name,
        user.fullName ?? user.email,
        invitation.token,
        inviteRole,
        invitation.expiresAt.toJSDate()
      )
      .catch((err) => logger.error({ err }, 'Failed to send team invitation email'))

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
   * List pending invitations for a team
   */
  async listInvitations({ auth, params, response }: HttpContext): Promise<void> {
    const user = auth.user!
    const teamId = params.id

    // Check if user is admin
    const membership = await TeamMember.query()
      .where('userId', user.id)
      .where('teamId', teamId)
      .first()

    if (!membership || !membership.isAdmin()) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'You must be a team admin to view invitations',
      })
    }

    const invitations = await TeamInvitation.query()
      .where('teamId', teamId)
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
    const { id: teamId, invitationId } = params

    // Check if user is admin
    const membership = await TeamMember.query()
      .where('userId', user.id)
      .where('teamId', teamId)
      .first()

    if (!membership || !membership.isAdmin()) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'You must be a team admin to cancel invitations',
      })
    }

    const invitation = await TeamInvitation.query()
      .where('id', invitationId)
      .where('teamId', teamId)
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

    const invitation = await TeamInvitation.query()
      .where('token', token)
      .preload('team')
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
        team: {
          id: invitation.team.id,
          name: invitation.team.name,
          slug: invitation.team.slug,
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

    const invitation = await TeamInvitation.query()
      .where('token', token)
      .preload('team', (query) => {
        query.preload('members')
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
        // Lock the team row to prevent concurrent modifications
        const team = await Team.query({ client: trx })
          .where('id', invitation.teamId)
          .forUpdate()
          .preload('members')
          .firstOrFail()

        // Double-check membership inside transaction
        const existingMembership = await TeamMember.query({ client: trx })
          .where('userId', user.id)
          .where('teamId', invitation.teamId)
          .first()

        if (existingMembership) {
          invitation.status = 'accepted'
          invitation.useTransaction(trx)
          await invitation.save()
          throw new Error('ALREADY_MEMBER')
        }

        // Check team member limit (inside transaction with lock)
        if (!(await team.canAddMember(team.members.length))) {
          throw new Error('LIMIT_REACHED')
        }

        // Add user to team
        await TeamMember.create(
          {
            userId: user.id,
            teamId: invitation.teamId,
            role: invitation.role,
          },
          { client: trx }
        )

        // Update user
        user.currentTeamId = invitation.teamId
        user.useTransaction(trx)
        await user.save()

        // Mark invitation as accepted
        invitation.status = 'accepted'
        invitation.useTransaction(trx)
        await invitation.save()
      })

      response.json({
        data: {
          teamId: invitation.teamId,
          teamName: invitation.team.name,
          role: invitation.role,
        },
        message: 'You have joined the team successfully',
      })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'ALREADY_MEMBER') {
          return response.badRequest({
            error: 'AlreadyMember',
            message: 'You are already a member of this team',
          })
        }
        if (error.message === 'LIMIT_REACHED') {
          return response.badRequest({
            error: 'LimitReached',
            message: 'This team has reached its member limit',
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

    const invitation = await TeamInvitation.query().where('token', token).first()

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
