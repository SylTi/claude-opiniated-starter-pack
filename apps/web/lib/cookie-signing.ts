import { jwtVerify } from "jose";

/**
 * Payload for user info cookie - only contains role, no PII
 */
export interface UserInfoPayload {
  role: string;
}

const secret = process.env.USER_COOKIE_SECRET;
const encodedKey = secret ? new TextEncoder().encode(secret) : null;

/**
 * Verify and decode a JWT cookie from the API.
 * Returns the payload if valid, null if invalid or expired.
 */
export async function decryptUserCookie(
  token: string,
): Promise<UserInfoPayload | null> {
  if (!encodedKey) {
    console.error("USER_COOKIE_SECRET is not configured");
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload as unknown as UserInfoPayload;
  } catch {
    return null;
  }
}
