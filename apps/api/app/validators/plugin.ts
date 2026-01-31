import vine from '@vinejs/vine'
import { Buffer } from 'node:buffer'

/**
 * Maximum config size in bytes (64KB).
 * This prevents abuse while allowing reasonable plugin configurations.
 */
export const MAX_PLUGIN_CONFIG_SIZE_BYTES = 64 * 1024

/**
 * Validator for plugin config updates.
 *
 * Plugin config must be a valid JSON object.
 *
 * Size Limit Architecture:
 * 1. Primary defense: bodyparser.json.limit (1MB) in config/bodyparser.ts
 *    - Rejects oversized payloads BEFORE parsing into memory
 * 2. Secondary defense: validatePluginConfigSize() (64KB) in route handler
 *    - Enforces stricter per-route limit after parsing
 *
 * For payloads between 64KB-1MB, memory is consumed but quickly released.
 * The 1MB limit prevents DoS from extremely large payloads.
 */
export const updatePluginConfigValidator = vine.compile(vine.object({}).allowUnknownProperties())

/**
 * Validate plugin config size in bytes.
 * Uses Buffer.byteLength for accurate UTF-8 byte counting (not string length).
 *
 * @throws Error if config exceeds maximum size
 */
export function validatePluginConfigSize(config: Record<string, unknown>): void {
  const serialized = JSON.stringify(config)
  // Use Buffer.byteLength for accurate byte count (handles multi-byte UTF-8 chars)
  const byteSize = Buffer.byteLength(serialized, 'utf8')
  if (byteSize > MAX_PLUGIN_CONFIG_SIZE_BYTES) {
    throw new Error(
      `Plugin config exceeds maximum size of ${MAX_PLUGIN_CONFIG_SIZE_BYTES} bytes (got ${byteSize})`
    )
  }
}
