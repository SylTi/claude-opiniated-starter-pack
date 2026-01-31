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
