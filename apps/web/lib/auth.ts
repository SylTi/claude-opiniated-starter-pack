/**
 * Auth utilities and API calls
 */

import { api, ApiError, API_BASE_URL } from "./api";
import type {
  UserDTO,
  LoginDTO,
  CreateUserDTO,
  MfaSetupDTO,
  MfaStatusDTO,
  LoginHistoryDTO,
  OAuthAccountDTO,
} from "@saas/shared";

// Auth API endpoints
export const authApi = {
  /**
   * Register a new user
   */
  async register(data: CreateUserDTO): Promise<UserDTO> {
    const response = await api.post<UserDTO>("/api/v1/auth/register", data);
    return response.data!;
  },

  /**
   * Login user
   */
  async login(
    data: LoginDTO,
  ): Promise<{ user?: UserDTO; requiresMfa?: boolean }> {
    const response = await api.post<UserDTO & { requiresMfa?: boolean }>(
      "/api/v1/auth/login",
      data,
    );

    // If MFA is required, return that flag
    if (response.data?.requiresMfa) {
      return { requiresMfa: true };
    }

    // Otherwise, the response contains the user data directly
    if (response.data?.id) {
      return { user: response.data as UserDTO };
    }

    return {};
  },

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    await api.post("/api/v1/auth/logout");
  },

  /**
   * Get current user
   */
  async me(): Promise<UserDTO | null> {
    try {
      const response = await api.get<UserDTO>("/api/v1/auth/me");
      return response.data || null;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Update profile
   */
  async updateProfile(data: {
    fullName?: string;
    avatarUrl?: string | null;
  }): Promise<UserDTO> {
    const response = await api.put<UserDTO>("/api/v1/auth/profile", data);
    return response.data!;
  },

  /**
   * Change password
   */
  async changePassword(data: {
    currentPassword: string;
    newPassword: string;
    newPasswordConfirmation: string;
  }): Promise<void> {
    await api.put("/api/v1/auth/password", data);
  },

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<void> {
    await api.post("/api/v1/auth/forgot-password", { email });
  },

  /**
   * Reset password
   */
  async resetPassword(data: {
    token: string;
    password: string;
    passwordConfirmation: string;
  }): Promise<void> {
    await api.post("/api/v1/auth/reset-password", data);
  },

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<void> {
    await api.get(`/api/v1/auth/verify-email/${token}`);
  },

  /**
   * Resend verification email
   */
  async resendVerification(): Promise<void> {
    await api.post("/api/v1/auth/resend-verification");
  },

  /**
   * Get login history
   */
  async getLoginHistory(): Promise<LoginHistoryDTO[]> {
    const response = await api.get<LoginHistoryDTO[]>(
      "/api/v1/auth/login-history",
    );
    return response.data || [];
  },
};

// MFA API endpoints
export const mfaApi = {
  /**
   * Get MFA setup data
   */
  async setup(): Promise<MfaSetupDTO> {
    const response = await api.post<MfaSetupDTO>("/api/v1/auth/mfa/setup");
    return response.data!;
  },

  /**
   * Enable MFA
   */
  async enable(data: {
    code: string;
    secret: string;
    backupCodes: string[];
  }): Promise<void> {
    await api.post("/api/v1/auth/mfa/enable", data);
  },

  /**
   * Disable MFA
   */
  async disable(code: string): Promise<void> {
    await api.post("/api/v1/auth/mfa/disable", { code });
  },

  /**
   * Get MFA status
   */
  async status(): Promise<MfaStatusDTO> {
    const response = await api.get<MfaStatusDTO>("/api/v1/auth/mfa/status");
    return response.data!;
  },

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(code: string): Promise<string[]> {
    const response = await api.post<{ backupCodes: string[] }>(
      "/api/v1/auth/mfa/regenerate-backup-codes",
      { code },
    );
    return response.data!.backupCodes;
  },
};

/**
 * Supported OAuth providers
 * Must match backend oauth_controller.ts SupportedProvider type
 */
export type OAuthProvider = "google" | "github";

// OAuth API endpoints
export const oauthApi = {
  /**
   * Get OAuth redirect URL
   */
  getRedirectUrl(provider: OAuthProvider): string {
    return `${API_BASE_URL}/api/v1/auth/oauth/${provider}/redirect`;
  },

  /**
   * Get linked OAuth accounts
   */
  async getAccounts(): Promise<OAuthAccountDTO[]> {
    const response = await api.get<OAuthAccountDTO[]>(
      "/api/v1/auth/oauth/accounts",
    );
    return response.data || [];
  },

  /**
   * Unlink OAuth account
   */
  async unlink(provider: OAuthProvider): Promise<void> {
    await api.delete(`/api/v1/auth/oauth/${provider}/unlink`);
  },

  /**
   * Get link URL
   */
  getLinkUrl(provider: OAuthProvider): string {
    return `${API_BASE_URL}/api/v1/auth/oauth/${provider}/link`;
  },
};
