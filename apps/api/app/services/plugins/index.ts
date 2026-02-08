/**
 * Plugin Services Index
 *
 * Re-exports all plugin service implementations.
 */

export { default as PluginBootService, pluginBootService } from './plugin_boot_service.js'
export { default as PluginSchemaChecker, pluginSchemaChecker } from './plugin_schema_checker.js'
export { default as PluginRouteMounter, pluginRouteMounter } from './plugin_route_mounter.js'
export {
  default as PluginCapabilityService,
  pluginCapabilityService,
} from './plugin_capability_service.js'
export { RoutesRegistrar, createRoutesRegistrar } from './routes_registrar.js'
export type { RouteHandler, RouteDefinition, RegisteredRoute } from './routes_registrar.js'
export {
  setPluginSchemaVersion,
  getPluginSchemaVersion,
  getAllPluginSchemaVersions,
  updatePluginMigrationInfo,
} from './schema_version_helper.js'
export {
  default as ResourceProviderRegistry,
  resourceProviderRegistry,
} from './resource_provider_registry.js'
export {
  default as PluginAbilityRegistry,
  pluginAbilityRegistry,
} from './plugin_ability_registry.js'
export {
  default as PluginPermissionGrantService,
  pluginPermissionGrantService,
} from './plugin_permission_grant_service.js'
export { createCoreFacadeFactory } from './core_facade_factory.js'
