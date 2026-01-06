import { SignJWT, jwtVerify } from 'jose'
import env from '#start/env'

/**
 * Payload for user info cookie - only contains role/status, not PII
 */
export interface UserInfoPayload {
  role: string
  [key: string]: unknown // Required for JWTPayload compatibility
}

/**
 * Service for creating signed cookies using jose (JWT with HS256).
 * Compatible with Next.js Edge Runtime.
 */
export default class CookieSigningService {
  private encodedKey: Uint8Array

  constructor() {
    // Use USER_COOKIE_SECRET if set, otherwise fall back to APP_KEY
    const secret = env.get('USER_COOKIE_SECRET') || env.get('APP_KEY')
    this.encodedKey = new TextEncoder().encode(secret)
  }

  /**
   * Create a signed JWT containing user role info.
   * Only signs role/status - no PII.
   */
  async sign(payload: UserInfoPayload): Promise<string> {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h') // Match session expiry
      .sign(this.encodedKey)
  }

  /**
   * Verify and decode a JWT.
   * Returns the payload if valid, null if invalid or expired.
   */
  async verify(token: string): Promise<UserInfoPayload | null> {
    try {
      const { payload } = await jwtVerify(token, this.encodedKey, {
        algorithms: ['HS256'],
      })
      return payload as unknown as UserInfoPayload
    } catch {
      return null
    }
  }
}
