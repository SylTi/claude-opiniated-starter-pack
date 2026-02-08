/**
 * Deployment-level hard-disable policy for plugin features.
 *
 * These disables are fail-closed and cannot be overridden by tenant plugin config.
 */
export const pluginFeatureHardDisables: Readonly<Record<string, readonly string[]>> = Object.freeze(
  {}
)

export function getHardDisabledFeaturesForPlugin(pluginId: string): ReadonlySet<string> {
  return new Set(pluginFeatureHardDisables[pluginId] ?? [])
}
