/**
 * Authorization Services Index
 *
 * Re-exports all authorization service implementations.
 */

export { default as AuthzService, authzService } from './authz_service.js'
export { NamespaceRegistry, namespaceRegistry } from './namespace_registry.js'
export type { NamespaceRegistration } from './namespace_registry.js'
