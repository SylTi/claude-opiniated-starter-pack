import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import OAuthAccount from '#models/oauth_account'
import LoginHistory from '#models/login_history'
import Tenant from '#models/tenant'
import TenantMembership from '#models/tenant_membership'

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
  declare currentTenantId: number | null

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

  @belongsTo(() => Tenant, { foreignKey: 'currentTenantId' })
  declare currentTenant: BelongsTo<typeof Tenant>

  @hasMany(() => TenantMembership)
  declare tenantMemberships: HasMany<typeof TenantMembership>

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
   * Check if user has a current tenant set
   */
  hasTenant(): boolean {
    return this.currentTenantId !== null
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
   * Add credit to user's balance (for personal expenses, not tenant billing)
   * @deprecated Use Tenant.addCredit() instead - Tenant is the billing unit
   */
  async addCredit(amount: number, currency?: string): Promise<number> {
    if (this.balanceCurrency && currency && currency !== this.balanceCurrency) {
      throw new Error(`Currency mismatch: expected ${this.balanceCurrency}, got ${currency}`)
    }
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
   * @deprecated Use Tenant.getBalance() instead - Tenant is the billing unit
   */
  getBalance(): { balance: number; currency: string } {
    return {
      balance: this.balance || 0,
      currency: this.balanceCurrency || 'usd',
    }
  }
}
