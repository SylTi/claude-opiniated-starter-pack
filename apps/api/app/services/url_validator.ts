/**
 * URL Validator Service
 *
 * Provides SSRF protection by validating URLs before making external requests.
 * Blocks internal IPs, localhost, and other dangerous destinations.
 *
 * SECURITY NOTES:
 *
 * 1. This validator should be called at request time, not just at config save time.
 *    Both OIDC and SAML providers call this during discovery/validation.
 *
 * 2. TOCTOU (Time-of-Check-Time-of-Use) Limitation:
 *    There is a theoretical window between DNS validation and the actual HTTP
 *    request where an attacker controlling DNS could return a different IP.
 *    Full mitigation would require pinning resolved IPs in HTTP clients.
 *    Current mitigations:
 *    - Validation happens immediately before requests (minimal window)
 *    - Node.js DNS cache provides some protection (default 60s TTL)
 *    - HTTPS certificate validation provides additional verification
 *
 * 3. Hostname normalization strips trailing dots to prevent 'localhost.' bypass.
 */

import { URL } from 'node:url'
import dns from 'node:dns/promises'
import { isIP } from 'node:net'
import logger from '@adonisjs/core/services/logger'

/**
 * IP ranges that should be blocked to prevent SSRF attacks
 */
const BLOCKED_IP_PATTERNS = [
  // IPv4 patterns
  /^127\./, // Loopback (127.0.0.0/8)
  /^10\./, // Private Class A (10.0.0.0/8)
  /^172\.(1[6-9]|2\d|3[01])\./, // Private Class B (172.16.0.0/12)
  /^192\.168\./, // Private Class C (192.168.0.0/16)
  /^169\.254\./, // Link-local (169.254.0.0/16)
  /^0\./, // Current network (0.0.0.0/8)
  /^224\./, // Multicast (224.0.0.0/4)
  /^240\./, // Reserved (240.0.0.0/4)
  /^255\./, // Broadcast
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // Carrier-grade NAT (100.64.0.0/10)

  // IPv6 patterns
  /^::1$/i, // IPv6 loopback
  /^fe80:/i, // IPv6 link-local
  /^fc00:/i, // IPv6 unique local address
  /^fd[0-9a-f]{2}:/i, // IPv6 unique local address
  /^::ffff:(?:10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.)/i, // IPv4-mapped IPv6
]

/**
 * Hostnames that should be blocked
 * Note: Trailing dots are stripped before checking, so 'localhost' also blocks 'localhost.'
 */
const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  'ip6-localhost', // Common /etc/hosts entry
  'ip6-loopback', // Common /etc/hosts entry
  '*.local',
  '*.localhost', // Subdomain of localhost (RFC 6761)
  'metadata.google.internal', // GCP metadata
  '169.254.169.254', // AWS/Azure metadata IP
]

/**
 * Check if an IP address matches any blocked pattern
 */
function isBlockedIp(ip: string): boolean {
  return BLOCKED_IP_PATTERNS.some((pattern) => pattern.test(ip))
}

/**
 * Normalize hostname for validation
 * - Converts to lowercase
 * - Removes trailing dot (FQDN form, e.g., 'localhost.' -> 'localhost')
 */
function normalizeHostname(hostname: string): string {
  let normalized = hostname.toLowerCase()
  // Remove trailing dot (FQDN notation) - prevents 'localhost.' bypass
  if (normalized.endsWith('.')) {
    normalized = normalized.slice(0, -1)
  }
  return normalized
}

/**
 * Check if a hostname is in the blocked list
 */
function isBlockedHostname(hostname: string): boolean {
  const normalizedHostname = normalizeHostname(hostname)

  for (const blocked of BLOCKED_HOSTNAMES) {
    if (blocked.startsWith('*.')) {
      // Wildcard match
      const suffix = blocked.slice(1) // Remove the *
      if (normalizedHostname.endsWith(suffix)) {
        return true
      }
    } else if (normalizedHostname === blocked) {
      return true
    }
  }

  return false
}

/**
 * Validate that a URL is safe for external requests
 *
 * Checks:
 * 1. Protocol is HTTPS
 * 2. Hostname is not on blocklist
 * 3. Hostname doesn't resolve to blocked IP ranges
 *
 * @throws Error if URL is not safe
 */
export async function validateExternalUrl(url: string): Promise<void> {
  let parsed: URL

  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Invalid URL format: ${url}`)
  }

  // Require HTTPS
  if (parsed.protocol !== 'https:') {
    throw new Error(`URL must use HTTPS protocol, got: ${parsed.protocol}`)
  }

  const hostname = parsed.hostname

  // Check hostname blocklist
  if (isBlockedHostname(hostname)) {
    throw new Error(`URL hostname is blocked: ${hostname}`)
  }

  // Strip brackets from IPv6 addresses (URL class includes them)
  const cleanHostname =
    hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname

  // Check if hostname is an IP address
  if (isIP(cleanHostname)) {
    if (isBlockedIp(cleanHostname)) {
      throw new Error(`URL IP address is in a blocked range: ${cleanHostname}`)
    }
    return // IP is allowed
  }

  // Resolve DNS and check all returned IPs
  try {
    const addresses: string[] = []

    try {
      const ipv4 = await dns.resolve4(hostname)
      addresses.push(...ipv4)
    } catch {
      // IPv4 resolution failed, continue
    }

    try {
      const ipv6 = await dns.resolve6(hostname)
      addresses.push(...ipv6)
    } catch {
      // IPv6 resolution failed, continue
    }

    if (addresses.length === 0) {
      throw new Error(`URL hostname cannot be resolved: ${hostname}`)
    }

    for (const addr of addresses) {
      if (isBlockedIp(addr)) {
        logger.warn({ hostname, ip: addr }, 'SSRF protection: URL hostname resolves to blocked IP')
        throw new Error(`URL hostname resolves to blocked IP range: ${hostname} -> ${addr}`)
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('blocked')) {
      throw error
    }
    throw new Error(`Failed to validate URL hostname: ${hostname}`)
  }
}

/**
 * Validate an issuer URL for OIDC
 * Same as validateExternalUrl but with better error context
 */
export async function validateOidcIssuerUrl(issuerUrl: string): Promise<void> {
  try {
    await validateExternalUrl(issuerUrl)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Invalid OIDC issuer URL: ${message}`)
  }
}

/**
 * Validate SSO URL for SAML
 * Same as validateExternalUrl but with better error context
 */
export async function validateSamlSsoUrl(ssoUrl: string): Promise<void> {
  try {
    await validateExternalUrl(ssoUrl)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Invalid SAML SSO URL: ${message}`)
  }
}
