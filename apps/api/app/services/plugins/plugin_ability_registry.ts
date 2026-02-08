import type { AbilityDefinition } from '@saas/plugins-core'
import { PluginBootError } from '#exceptions/plugin_errors'

/**
 * Boot-time ability registry for plugin namespaces.
 *
 * This tracks registered ability definitions and enforces namespace/id format.
 * Registrations are idempotent (upsert semantics).
 */
export default class PluginAbilityRegistry {
  private abilitiesByPlugin: Map<string, Map<string, AbilityDefinition>> = new Map()

  registerAbilities(pluginId: string, abilities: AbilityDefinition[]): void {
    const namespacePrefix = `${pluginId}.`
    const pluginAbilities =
      this.abilitiesByPlugin.get(pluginId) ?? new Map<string, AbilityDefinition>()

    for (const ability of abilities) {
      if (!ability.id.startsWith(namespacePrefix)) {
        throw new PluginBootError(
          pluginId,
          'capabilities',
          `Ability "${ability.id}" must be prefixed with "${namespacePrefix}"`
        )
      }

      if (ability.id.includes(':')) {
        throw new PluginBootError(
          pluginId,
          'capabilities',
          `Ability "${ability.id}" is invalid. Ability IDs must use "." separators, not ":".`
        )
      }

      if (!ability.description || typeof ability.description !== 'string') {
        throw new PluginBootError(
          pluginId,
          'capabilities',
          `Ability "${ability.id}" must include a non-empty description`
        )
      }

      pluginAbilities.set(ability.id, {
        id: ability.id,
        description: ability.description,
        resourceType: ability.resourceType,
      })
    }

    this.abilitiesByPlugin.set(pluginId, pluginAbilities)
  }

  getAbilities(pluginId: string): AbilityDefinition[] {
    return Array.from(this.abilitiesByPlugin.get(pluginId)?.values() ?? [])
  }

  hasAbility(pluginId: string, abilityId: string): boolean {
    return this.abilitiesByPlugin.get(pluginId)?.has(abilityId) ?? false
  }

  clear(pluginId?: string): void {
    if (pluginId) {
      this.abilitiesByPlugin.delete(pluginId)
      return
    }

    this.abilitiesByPlugin.clear()
  }
}

export const pluginAbilityRegistry = new PluginAbilityRegistry()
