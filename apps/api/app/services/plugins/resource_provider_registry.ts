import type {
  ResourceMeta,
  ResourceProvider,
  ResourceResolverContext,
  ResourceTypeDefinition,
} from '@saas/plugins-core'

/**
 * Global registry for resource providers contributed by plugins.
 *
 * Collision rule: each resource type can only be owned by one provider.
 */
export default class ResourceProviderRegistry {
  private providersByType: Map<string, ResourceProvider> = new Map()
  private definitionsByType: Map<string, ResourceTypeDefinition> = new Map()

  register(provider: ResourceProvider): void {
    const definitions = provider.types()
    for (const definition of definitions) {
      const existing = this.definitionsByType.get(definition.type)
      if (existing) {
        throw new Error(
          `Resource type collision for "${definition.type}" between ` +
            `"${existing.ownerPluginId}" and "${definition.ownerPluginId}"`
        )
      }

      this.definitionsByType.set(definition.type, definition)
      this.providersByType.set(definition.type, provider)
    }
  }

  getRegisteredTypes(): ResourceTypeDefinition[] {
    return Array.from(this.definitionsByType.values()).sort((a, b) => a.type.localeCompare(b.type))
  }

  getProvider(type: string): ResourceProvider | null {
    return this.providersByType.get(type) ?? null
  }

  async resolve(
    type: string,
    id: string | number,
    resolverContext: ResourceResolverContext
  ): Promise<ResourceMeta | null> {
    const provider = this.providersByType.get(type)
    if (!provider) {
      return null
    }

    return provider.resolve(type, id, resolverContext)
  }

  async exists(
    type: string,
    id: string | number,
    resolverContext: ResourceResolverContext
  ): Promise<boolean> {
    const provider = this.providersByType.get(type)
    if (!provider) {
      return false
    }

    return provider.exists(type, id, resolverContext)
  }

  clear(): void {
    this.providersByType.clear()
    this.definitionsByType.clear()
  }
}

export const resourceProviderRegistry = new ResourceProviderRegistry()
