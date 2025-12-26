import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import OAuthAccount from '#models/oauth_account'
import LoginHistory from '#models/login_history'
import Team from '#models/team'
import TeamMember from '#models/team_member'
import Subscription from '#models/subscription'
import SubscriptionTier from '#models/subscription_tier'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export type UserRole = 'admin' | 'user' | 'guest'

export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare fullName: string | null

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string | null

  @column()
  declare role: UserRole

  @column()
  declare emailVerified: boolean

  @column.dateTime()
  declare emailVerifiedAt: DateTime | null

  @column()
  declare mfaEnabled: boolean

  @column({ serializeAs: null })
  declare mfaSecret: string | null

  @column({ serializeAs: null })
  declare mfaBackupCodes: string | null

  @column()
  declare avatarUrl: string | null

  @column()
  declare currentTeamId: number | null

  @column()
  declare balance: number

  @column()
  declare balanceCurrency: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => OAuthAccount)
  declare oauthAccounts: HasMany<typeof OAuthAccount>

  @hasMany(() => LoginHistory)
  declare loginHistory: HasMany<typeof LoginHistory>

  @belongsTo(() => Team, { foreignKey: 'currentTeamId' })
  declare currentTeam: BelongsTo<typeof Team>

  @hasMany(() => TeamMember)
  declare teamMemberships: HasMany<typeof TeamMember>

  /**
   * Check if user has a specific role
   */
  hasRole(role: UserRole): boolean {
    return this.role === role
  }

  /**
   * Check if user is admin
   */
  isAdmin(): boolean {
    return this.role === 'admin'
  }

  /**
   * Get active subscription for this user
   */
  async getActiveSubscription(): Promise<Subscription | null> {
    return Subscription.getActiveForUser(this.id)
  }

  /**
   * Get all subscriptions for this user (including history)
   */
  async getSubscriptions(): Promise<Subscription[]> {
    return Subscription.getAllForUser(this.id)
  }

  /**
   * Get the active subscription tier for this user
   */
  async getSubscriptionTier(): Promise<SubscriptionTier> {
    const subscription = await this.getActiveSubscription()
    if (subscription) {
      return subscription.tier
    }
    return SubscriptionTier.getFreeTier()
  }

  /**
   * Get effective subscription tier (checks team subscription first)
   */
  async getEffectiveSubscriptionTier(): Promise<SubscriptionTier> {
    // Team members use team subscription
    if (this.currentTeamId) {
      const teamSubscription = await Subscription.getActiveForTeam(this.currentTeamId)
      if (teamSubscription && !teamSubscription.isExpired()) {
        return teamSubscription.tier
      }
    }
    // Individual users use personal subscription
    const subscription = await this.getActiveSubscription()
    if (subscription && !subscription.isExpired()) {
      return subscription.tier
    }
    return SubscriptionTier.getFreeTier()
  }

  /**
   * Get effective subscription (checks team subscription first)
   */
  async getEffectiveSubscription(): Promise<Subscription | null> {
    // Team members use team subscription
    if (this.currentTeamId) {
      const teamSubscription = await Subscription.getActiveForTeam(this.currentTeamId)
      if (teamSubscription && !teamSubscription.isExpired()) {
        return teamSubscription
      }
    }
    // Individual users use personal subscription
    return this.getActiveSubscription()
  }

  /**
   * Check if user's subscription is expired
   */
  async isSubscriptionExpired(): Promise<boolean> {
    const subscription = await this.getEffectiveSubscription()
    if (!subscription) return false
    return subscription.isExpired()
  }

  /**
   * Check if user has access to a specific tier
   */
  async hasAccessToTier(tier: SubscriptionTier): Promise<boolean> {
    const effectiveTier = await this.getEffectiveSubscriptionTier()
    return effectiveTier.hasAccessToTier(tier)
  }

  /**
   * Check if user has access to a tier by slug
   */
  async hasAccessToTierBySlug(tierSlug: string): Promise<boolean> {
    const tier = await SubscriptionTier.findBySlugOrFail(tierSlug)
    return this.hasAccessToTier(tier)
  }

  /**
   * Check if user is a team member
   */
  isTeamMember(): boolean {
    return this.currentTeamId !== null
  }

  /**
   * Get parsed MFA backup codes
   */
  getMfaBackupCodes(): string[] {
    if (!this.mfaBackupCodes) return []
    try {
      return JSON.parse(this.mfaBackupCodes)
    } catch {
      return []
    }
  }

  /**
   * Set MFA backup codes
   */
  setMfaBackupCodes(codes: string[]): void {
    this.mfaBackupCodes = JSON.stringify(codes)
  }

  /**
   * Add credit to user's balance
   */
  async addCredit(amount: number, currency?: string): Promise<number> {
    // Only check for currency mismatch if user already has a currency set
    if (this.balanceCurrency && currency && currency !== this.balanceCurrency) {
      throw new Error(`Currency mismatch: expected ${this.balanceCurrency}, got ${currency}`)
    }
    // Ensure both balance and amount are numbers (they might come as strings from DB)
    const currentBalance = Number(this.balance) || 0
    const creditAmount = Number(amount) || 0
    this.balance = currentBalance + creditAmount
    if (!this.balanceCurrency) {
      this.balanceCurrency = currency || 'usd'
    }
    await this.save()
    return this.balance
  }

  /**
   * Get user's balance
   */
  getBalance(): { balance: number; currency: string } {
    return {
      balance: this.balance || 0,
      currency: this.balanceCurrency || 'usd',
    }
  }
}
