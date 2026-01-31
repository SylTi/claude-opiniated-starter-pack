import { DateTime } from 'luxon'
import { column, belongsTo } from '@adonisjs/lucid/orm'
import BaseModel from '#models/base_model'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Tenant from '#models/tenant'

/**
 * Plugin State Model
 *
 * Tracks which plugins are enabled for each tenant.
 * This table uses RLS for tenant isolation.
 */
export default class PluginState extends BaseModel {
  static table = 'plugin_states'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenantId: number

  @column()
  declare pluginId: string

  @column()
  declare version: string

  @column()
  declare enabled: boolean

  /**
   * Plugin configuration stored as JSONB.
   * PostgreSQL driver handles object serialization automatically.
   */
  @column()
  declare config: Record<string, unknown> | null

  @column.dateTime()
  declare installedAt: DateTime

  @column.dateTime({ autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  /**
   * Get enabled plugins for a tenant.
   */
  static async getEnabledForTenant(tenantId: number): Promise<PluginState[]> {
    return this.query().where('tenant_id', tenantId).where('enabled', true)
  }

  /**
   * Get plugin state for a specific plugin and tenant.
   */
  static async getForPlugin(tenantId: number, pluginId: string): Promise<PluginState | null> {
    return this.query().where('tenant_id', tenantId).where('plugin_id', pluginId).first()
  }

  /**
   * Check if a plugin is enabled for a tenant.
   */
  static async isEnabled(tenantId: number, pluginId: string): Promise<boolean> {
    const state = await this.getForPlugin(tenantId, pluginId)
    return state?.enabled ?? false
  }

  /**
   * Enable a plugin for a tenant.
   */
  static async enable(
    tenantId: number,
    pluginId: string,
    version: string,
    config?: Record<string, unknown>
  ): Promise<PluginState> {
    const existing = await this.getForPlugin(tenantId, pluginId)

    if (existing) {
      existing.enabled = true
      existing.version = version
      if (config !== undefined) {
        existing.config = config
      }
      await existing.save()
      return existing
    }

    return this.create({
      tenantId,
      pluginId,
      version,
      enabled: true,
      config: config ?? null,
      installedAt: DateTime.now(),
    })
  }

  /**
   * Disable a plugin for a tenant.
   */
  static async disable(tenantId: number, pluginId: string): Promise<boolean> {
    const state = await this.getForPlugin(tenantId, pluginId)
    if (!state) return false

    state.enabled = false
    await state.save()
    return true
  }

  /**
   * Update plugin config.
   */
  static async updateConfig(
    tenantId: number,
    pluginId: string,
    config: Record<string, unknown>
  ): Promise<PluginState | null> {
    const state = await this.getForPlugin(tenantId, pluginId)
    if (!state) return null

    state.config = config
    await state.save()
    return state
  }
}
