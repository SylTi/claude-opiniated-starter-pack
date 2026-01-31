/**
 * Enterprise route imports - consolidated.
 *
 * This file exists on both branches:
 * - main (private): imports all enterprise routes
 * - public/main: empty file (no imports)
 *
 * This allows cherry-picks from private to public without conflicts
 * on the main routes.ts file.
 */

// @ts-ignore - Enterprise feature: module may not exist
await import('#start/routes_sso').catch(() => {})
// @ts-ignore - Enterprise feature: module may not exist
await import('#start/routes_enterprise').catch(() => {})
// @ts-ignore - Enterprise feature: module may not exist
await import('#start/routes_encryption').catch(() => {})
// @ts-ignore - Enterprise feature: module may not exist
await import('#start/routes_byok').catch(() => {})
// @ts-ignore - Enterprise feature: module may not exist
await import('#start/routes_vaults').catch(() => {})
// @ts-ignore - Enterprise feature: module may not exist
await import('#start/routes_audit_log').catch(() => {})
// @ts-ignore - Enterprise feature: module may not exist
await import('#start/routes_audit_sink').catch(() => {})
// @ts-ignore - Enterprise feature: module may not exist
await import('#start/routes_backup').catch(() => {})
// @ts-ignore - Enterprise feature: module may not exist
await import('#start/routes_rbac_extensions').catch(() => {})
// @ts-ignore - Enterprise feature: module may not exist
await import('#start/routes_dlp').catch(() => {})
