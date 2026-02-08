import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import PluginPermissionGrant from '#models/plugin_permission_grant'

type GrantScope = {
  tenantId: number
  pluginId: string
  userId: number
  ability: string
  resourceType: string
  resourceId: string | number
}

type GrantInput = GrantScope & {
  grantedBy: number
}

function toResourceId(resourceId: string | number): string {
  return String(resourceId)
}

/**
 * Persistent grant operations for plugin-managed resource abilities.
 */
export default class PluginPermissionGrantService {
  async hasGrant(scope: GrantScope, client: TransactionClientContract): Promise<boolean> {
    const grant = await PluginPermissionGrant.query({ client })
      .where('tenant_id', scope.tenantId)
      .where('plugin_id', scope.pluginId)
      .where('user_id', scope.userId)
      .where('ability', scope.ability)
      .where('resource_type', scope.resourceType)
      .where('resource_id', toResourceId(scope.resourceId))
      .first()

    return Boolean(grant)
  }

  async upsertGrant(input: GrantInput, client: TransactionClientContract): Promise<void> {
    const resourceId = toResourceId(input.resourceId)
    const existing = await PluginPermissionGrant.query({ client })
      .where('tenant_id', input.tenantId)
      .where('plugin_id', input.pluginId)
      .where('user_id', input.userId)
      .where('ability', input.ability)
      .where('resource_type', input.resourceType)
      .where('resource_id', resourceId)
      .first()

    if (existing) {
      existing.grantedBy = input.grantedBy
      await existing.useTransaction(client).save()
      return
    }

    await PluginPermissionGrant.create(
      {
        tenantId: input.tenantId,
        pluginId: input.pluginId,
        userId: input.userId,
        ability: input.ability,
        resourceType: input.resourceType,
        resourceId,
        grantedBy: input.grantedBy,
      },
      { client }
    )
  }

  async revokeGrant(scope: GrantScope, client: TransactionClientContract): Promise<boolean> {
    const grant = await PluginPermissionGrant.query({ client })
      .where('tenant_id', scope.tenantId)
      .where('plugin_id', scope.pluginId)
      .where('user_id', scope.userId)
      .where('ability', scope.ability)
      .where('resource_type', scope.resourceType)
      .where('resource_id', toResourceId(scope.resourceId))
      .first()

    if (!grant) {
      return false
    }

    await grant.useTransaction(client).delete()
    return true
  }
}

export const pluginPermissionGrantService = new PluginPermissionGrantService()
