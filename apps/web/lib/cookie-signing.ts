import { jwtVerify } from "jose";

/**
 * Payload for user info cookie - only contains role, no PII
 */
export interface UserInfoPayload {
  role: string;
}

const secret = process.env.USER_COOKIE_SECRET ?? process.env.APP_KEY;
const encodedKey = secret ? new TextEncoder().encode(secret) : null;

/**
 * Verify and decode a JWT cookie from the API.
 * Returns the payload if valid, null if invalid or expired.
 */
function unwrapSignedCookie(token: string): string | null {
  if (!token.startsWith("s:")) {
    return token;
  }

  const payload = token.slice(2).split(".")[0];
  if (!payload) {
    return null;
  }

  try {
    const decoded = JSON.parse(atob(payload));
    return typeof decoded?.message === "string" ? decoded.message : null;
  } catch {
    return null;
  }
}

export async function decryptUserCookie(
  token: string,
): Promise<UserInfoPayload | null> {
  if (!encodedKey) {
    console.error("USER_COOKIE_SECRET is not configured");
    return null;
  }

  try {
    const jwt = unwrapSignedCookie(token);
    if (!jwt) {
      return null;
    }

    const { payload } = await jwtVerify(jwt, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload as unknown as UserInfoPayload;
  } catch {
    return null;
  }
}
