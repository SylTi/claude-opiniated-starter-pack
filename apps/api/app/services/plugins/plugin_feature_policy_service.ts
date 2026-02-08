import type {
  PluginFeaturePolicyService,
  PluginHttpContext,
  PluginManifest,
} from '@saas/plugins-core'
import { getHardDisabledFeaturesForPlugin } from '#config/plugin_feature_policy'

type PluginFeaturePolicyInput = {
  pluginId: string
  manifest: PluginManifest
  hardDisabledFeatures?: ReadonlySet<string>
}

function readTenantFeatureOverrides(ctx: PluginHttpContext): Record<string, boolean> {
  const config = ctx.plugin?.state?.config
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return {}
  }

  const features = (config as Record<string, unknown>).features
  if (!features || typeof features !== 'object' || Array.isArray(features)) {
    return {}
  }

  const overrides: Record<string, boolean> = {}
  for (const [featureId, value] of Object.entries(features)) {
    if (typeof value === 'boolean') {
      overrides[featureId] = value
    }
  }

  return overrides
}

export class PluginFeatureDisabledError extends Error {
  readonly status = 403 as const
  readonly code = 'E_FEATURE_DISABLED' as const
  readonly pluginId: string
  readonly featureId: string

  constructor(pluginId: string, featureId: string) {
    super(`Feature ${featureId} is disabled for this tenant`)
    this.name = 'PluginFeatureDisabledError'
    this.pluginId = pluginId
    this.featureId = featureId
  }

  toResponse(): { error: string; message: string } {
    return {
      error: this.code,
      message: `Feature ${this.featureId} is disabled for this tenant`,
    }
  }
}

class DefaultPluginFeaturePolicyService implements PluginFeaturePolicyService {
  private readonly pluginId: string
  private readonly manifestFeatures: ReadonlyMap<string, boolean>
  private readonly hardDisabledFeatures: ReadonlySet<string>

  constructor(input: PluginFeaturePolicyInput) {
    this.pluginId = input.pluginId
    this.manifestFeatures = new Map(
      Object.entries(input.manifest.features ?? {}).map(([featureId, definition]) => [
        featureId,
        definition.defaultEnabled,
      ])
    )
    this.hardDisabledFeatures =
      input.hardDisabledFeatures ?? getHardDisabledFeaturesForPlugin(input.pluginId)
  }

  async has(featureId: string, ctx: PluginHttpContext): Promise<boolean> {
    if (!this.manifestFeatures.has(featureId)) {
      return false
    }

    if (this.hardDisabledFeatures.has(featureId)) {
      return false
    }

    const overrides = readTenantFeatureOverrides(ctx)
    if (Object.hasOwn(overrides, featureId)) {
      return overrides[featureId]
    }

    return this.manifestFeatures.get(featureId) ?? false
  }

  async require(featureId: string, ctx: PluginHttpContext): Promise<void> {
    const enabled = await this.has(featureId, ctx)
    if (!enabled) {
      throw new PluginFeatureDisabledError(this.pluginId, featureId)
    }
  }
}

export function createPluginFeaturePolicyService(
  input: PluginFeaturePolicyInput
): PluginFeaturePolicyService {
  return new DefaultPluginFeaturePolicyService(input)
}
