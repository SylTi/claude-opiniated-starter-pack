const SENSITIVE_KEY_PATTERN =
  /(secret|password|apikey|privatekey|accesstoken|refreshtoken|bearertoken|signingsecret|sastoken)/i

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item))
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const source = value as Record<string, unknown>
  const redacted: Record<string, unknown> = {}

  for (const [key, nestedValue] of Object.entries(source)) {
    const normalizedKey = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    if (SENSITIVE_KEY_PATTERN.test(normalizedKey)) {
      redacted[key] = '[REDACTED]'
      continue
    }

    redacted[key] = redactValue(nestedValue)
  }

  return redacted
}

export function redactSensitiveConfig(config: unknown): unknown {
  return redactValue(config)
}
