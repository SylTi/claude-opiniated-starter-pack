import { describe, it, expect, vi, beforeEach } from "vitest";
import { authApi, mfaApi, oauthApi } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";

// Mock the api module
vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  API_BASE_URL: "http://localhost:3333",
  ApiError: class ApiError extends Error {
    constructor(
      public statusCode: number,
      public error: string,
      message: string,
    ) {
      super(message);
      this.name = "ApiError";
    }
  },
}));

describe("authApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("login", () => {
    it("returns user data when login is successful", async () => {
      const mockUserResponse = {
        data: {
          id: 1,
          email: "test@example.com",
          fullName: "Test User",
          role: "user",
          emailVerified: true,
          mfaEnabled: false,
          avatarUrl: null,
        },
        message: "Login successful",
      };

      vi.mocked(api.post).mockResolvedValue(mockUserResponse);

      const result = await authApi.login({
        email: "test@example.com",
        password: "password123",
      });

      expect(result).toEqual({
        user: {
          id: 1,
          email: "test@example.com",
          fullName: "Test User",
          role: "user",
          emailVerified: true,
          mfaEnabled: false,
          avatarUrl: null,
        },
      });
      expect(api.post).toHaveBeenCalledWith("/api/v1/auth/login", {
        email: "test@example.com",
        password: "password123",
      });
    });

    it("returns user data for admin login", async () => {
      const mockAdminResponse = {
        data: {
          id: 1,
          email: "admin@example.com",
          fullName: "Admin User",
          role: "admin",
          emailVerified: true,
          mfaEnabled: true,
          avatarUrl: "https://example.com/avatar.jpg",
        },
        message: "Login successful",
      };

      vi.mocked(api.post).mockResolvedValue(mockAdminResponse);

      const result = await authApi.login({
        email: "admin@example.com",
        password: "password123",
      });

      expect(result.user).toBeDefined();
      expect(result.user?.role).toBe("admin");
      expect(result.requiresMfa).toBeUndefined();
    });

    it("returns requiresMfa flag when MFA is required", async () => {
      const mockMfaResponse = {
        data: {
          requiresMfa: true,
        },
        message: "MFA code required",
      };

      vi.mocked(api.post).mockResolvedValue(mockMfaResponse);

      const result = await authApi.login({
        email: "test@example.com",
        password: "password123",
      });

      expect(result).toEqual({ requiresMfa: true });
      expect(result.user).toBeUndefined();
    });

    it("returns user data after MFA verification", async () => {
      const mockUserResponse = {
        data: {
          id: 1,
          email: "test@example.com",
          fullName: "Test User",
          role: "user",
          emailVerified: true,
          mfaEnabled: true,
          avatarUrl: null,
        },
        message: "Login successful",
      };

      vi.mocked(api.post).mockResolvedValue(mockUserResponse);

      const result = await authApi.login({
        email: "test@example.com",
        password: "password123",
        mfaCode: "123456",
      });

      expect(result.user).toBeDefined();
      expect(result.user?.id).toBe(1);
      expect(result.requiresMfa).toBeUndefined();
    });

    it("returns empty object when response has no data", async () => {
      vi.mocked(api.post).mockResolvedValue({ data: null });

      const result = await authApi.login({
        email: "test@example.com",
        password: "password123",
      });

      expect(result).toEqual({});
    });

    it("correctly wraps user data in user property", async () => {
      // This test specifically ensures the fix for the login bug
      // where user data was returned directly without wrapping
      const mockResponse = {
        data: {
          id: 42,
          email: "user@test.com",
          fullName: "Test",
          role: "user",
          emailVerified: false,
          mfaEnabled: false,
          avatarUrl: null,
        },
      };

      vi.mocked(api.post).mockResolvedValue(mockResponse);

      const result = await authApi.login({
        email: "user@test.com",
        password: "pass",
      });

      // The result should have a 'user' property, not the user data at root level
      expect(result).toHaveProperty("user");
      expect(result.user).toHaveProperty("id", 42);
      expect(result.user).toHaveProperty("email", "user@test.com");
      // Ensure the data is NOT at root level (the bug we fixed)
      expect(result).not.toHaveProperty("id");
      expect(result).not.toHaveProperty("email");
    });
  });

  describe("register", () => {
    it("registers a new user", async () => {
      const mockUser = {
        id: 1,
        email: "new@example.com",
        fullName: "New User",
        role: "user",
        emailVerified: false,
        mfaEnabled: false,
        avatarUrl: null,
      };

      vi.mocked(api.post).mockResolvedValue({ data: mockUser });

      const result = await authApi.register({
        email: "new@example.com",
        password: "password123",
        fullName: "New User",
      });

      expect(result).toEqual(mockUser);
      expect(api.post).toHaveBeenCalledWith("/api/v1/auth/register", {
        email: "new@example.com",
        password: "password123",
        fullName: "New User",
      });
    });
  });

  describe("logout", () => {
    it("logs out the user", async () => {
      vi.mocked(api.post).mockResolvedValue({});

      await authApi.logout();

      expect(api.post).toHaveBeenCalledWith("/api/v1/auth/logout");
    });
  });

  describe("me", () => {
    it("returns user data when authenticated", async () => {
      const mockUser = {
        id: 1,
        email: "test@example.com",
        fullName: "Test User",
        role: "user",
        emailVerified: true,
        mfaEnabled: false,
        avatarUrl: null,
      };

      vi.mocked(api.get).mockResolvedValue({ data: mockUser });

      const result = await authApi.me();

      expect(result).toEqual(mockUser);
      expect(api.get).toHaveBeenCalledWith("/api/v1/auth/me");
    });

    it("returns null when response has no data", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: null });

      const result = await authApi.me();

      expect(result).toBeNull();
    });

    it("returns null on 401 error", async () => {
      vi.mocked(api.get).mockRejectedValue(new ApiError(401, "Unauthorized", "Not authenticated"));

      const result = await authApi.me();

      expect(result).toBeNull();
    });

    it("throws error on non-401 errors", async () => {
      vi.mocked(api.get).mockRejectedValue(new Error("Network error"));

      await expect(authApi.me()).rejects.toThrow("Network error");
    });
  });

  describe("updateProfile", () => {
    it("updates user profile", async () => {
      const mockUser = {
        id: 1,
        email: "test@example.com",
        fullName: "Updated Name",
        role: "user",
        emailVerified: true,
        mfaEnabled: false,
        avatarUrl: "https://example.com/avatar.jpg",
      };

      vi.mocked(api.put).mockResolvedValue({ data: mockUser });

      const result = await authApi.updateProfile({
        fullName: "Updated Name",
        avatarUrl: "https://example.com/avatar.jpg",
      });

      expect(result).toEqual(mockUser);
      expect(api.put).toHaveBeenCalledWith("/api/v1/auth/profile", {
        fullName: "Updated Name",
        avatarUrl: "https://example.com/avatar.jpg",
      });
    });
  });

  describe("changePassword", () => {
    it("changes user password", async () => {
      vi.mocked(api.put).mockResolvedValue({});

      await authApi.changePassword({
        currentPassword: "oldpass",
        newPassword: "newpass123",
        newPasswordConfirmation: "newpass123",
      });

      expect(api.put).toHaveBeenCalledWith("/api/v1/auth/password", {
        currentPassword: "oldpass",
        newPassword: "newpass123",
        newPasswordConfirmation: "newpass123",
      });
    });
  });

  describe("forgotPassword", () => {
    it("sends forgot password request", async () => {
      vi.mocked(api.post).mockResolvedValue({});

      await authApi.forgotPassword("test@example.com");

      expect(api.post).toHaveBeenCalledWith("/api/v1/auth/forgot-password", {
        email: "test@example.com",
      });
    });
  });

  describe("resetPassword", () => {
    it("resets password with token", async () => {
      vi.mocked(api.post).mockResolvedValue({});

      await authApi.resetPassword({
        token: "reset-token",
        password: "newpass123",
        passwordConfirmation: "newpass123",
      });

      expect(api.post).toHaveBeenCalledWith("/api/v1/auth/reset-password", {
        token: "reset-token",
        password: "newpass123",
        passwordConfirmation: "newpass123",
      });
    });
  });

  describe("verifyEmail", () => {
    it("verifies email with token", async () => {
      vi.mocked(api.get).mockResolvedValue({});

      await authApi.verifyEmail("verify-token");

      expect(api.get).toHaveBeenCalledWith("/api/v1/auth/verify-email/verify-token");
    });
  });

  describe("resendVerification", () => {
    it("resends verification email", async () => {
      vi.mocked(api.post).mockResolvedValue({});

      await authApi.resendVerification();

      expect(api.post).toHaveBeenCalledWith("/api/v1/auth/resend-verification");
    });
  });

  describe("getLoginHistory", () => {
    it("returns login history", async () => {
      const mockHistory = [
        {
          id: 1,
          ipAddress: "127.0.0.1",
          userAgent: "Chrome",
          success: true,
          createdAt: "2024-01-01T00:00:00Z",
        },
      ];

      vi.mocked(api.get).mockResolvedValue({ data: mockHistory });

      const result = await authApi.getLoginHistory();

      expect(result).toEqual(mockHistory);
      expect(api.get).toHaveBeenCalledWith("/api/v1/auth/login-history");
    });

    it("returns empty array when no data", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: null });

      const result = await authApi.getLoginHistory();

      expect(result).toEqual([]);
    });
  });
});

describe("mfaApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("setup", () => {
    it("returns MFA setup data", async () => {
      const mockSetup = {
        secret: "secret-key",
        qrCode: "data:image/png;base64,abc123",
        backupCodes: ["code1", "code2", "code3"],
      };

      vi.mocked(api.post).mockResolvedValue({ data: mockSetup });

      const result = await mfaApi.setup();

      expect(result).toEqual(mockSetup);
      expect(api.post).toHaveBeenCalledWith("/api/v1/auth/mfa/setup");
    });
  });

  describe("enable", () => {
    it("enables MFA with code and secret", async () => {
      vi.mocked(api.post).mockResolvedValue({});

      await mfaApi.enable({
        code: "123456",
        secret: "secret-key",
        backupCodes: ["code1", "code2"],
      });

      expect(api.post).toHaveBeenCalledWith("/api/v1/auth/mfa/enable", {
        code: "123456",
        secret: "secret-key",
        backupCodes: ["code1", "code2"],
      });
    });
  });

  describe("disable", () => {
    it("disables MFA with code", async () => {
      vi.mocked(api.post).mockResolvedValue({});

      await mfaApi.disable("123456");

      expect(api.post).toHaveBeenCalledWith("/api/v1/auth/mfa/disable", {
        code: "123456",
      });
    });
  });

  describe("status", () => {
    it("returns MFA status", async () => {
      const mockStatus = {
        mfaEnabled: true,
        backupCodesRemaining: 8,
      };

      vi.mocked(api.get).mockResolvedValue({ data: mockStatus });

      const result = await mfaApi.status();

      expect(result).toEqual(mockStatus);
      expect(api.get).toHaveBeenCalledWith("/api/v1/auth/mfa/status");
    });
  });

  describe("regenerateBackupCodes", () => {
    it("regenerates backup codes", async () => {
      const mockCodes = ["new1", "new2", "new3", "new4"];

      vi.mocked(api.post).mockResolvedValue({ data: { backupCodes: mockCodes } });

      const result = await mfaApi.regenerateBackupCodes("123456");

      expect(result).toEqual(mockCodes);
      expect(api.post).toHaveBeenCalledWith("/api/v1/auth/mfa/regenerate-backup-codes", {
        code: "123456",
      });
    });
  });
});

describe("oauthApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRedirectUrl", () => {
    it("returns Google redirect URL", () => {
      const result = oauthApi.getRedirectUrl("google");

      expect(result).toBe("http://localhost:3333/api/v1/auth/oauth/google/redirect");
    });

    it("returns GitHub redirect URL", () => {
      const result = oauthApi.getRedirectUrl("github");

      expect(result).toBe("http://localhost:3333/api/v1/auth/oauth/github/redirect");
    });

    it("returns Microsoft redirect URL", () => {
      const result = oauthApi.getRedirectUrl("microsoft");

      expect(result).toBe("http://localhost:3333/api/v1/auth/oauth/microsoft/redirect");
    });
  });

  describe("getAccounts", () => {
    it("returns linked OAuth accounts", async () => {
      const mockAccounts = [
        {
          id: 1,
          provider: "google",
          providerId: "123456",
          email: "user@gmail.com",
          createdAt: "2024-01-01T00:00:00Z",
        },
      ];

      vi.mocked(api.get).mockResolvedValue({ data: mockAccounts });

      const result = await oauthApi.getAccounts();

      expect(result).toEqual(mockAccounts);
      expect(api.get).toHaveBeenCalledWith("/api/v1/auth/oauth/accounts");
    });

    it("returns empty array when no accounts", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: null });

      const result = await oauthApi.getAccounts();

      expect(result).toEqual([]);
    });
  });

  describe("unlink", () => {
    it("unlinks OAuth account", async () => {
      vi.mocked(api.delete).mockResolvedValue({});

      await oauthApi.unlink("google");

      expect(api.delete).toHaveBeenCalledWith("/api/v1/auth/oauth/google/unlink");
    });
  });

  describe("getLinkUrl", () => {
    it("returns Google link URL", () => {
      const result = oauthApi.getLinkUrl("google");

      expect(result).toBe("http://localhost:3333/api/v1/auth/oauth/google/link");
    });

    it("returns GitHub link URL", () => {
      const result = oauthApi.getLinkUrl("github");

      expect(result).toBe("http://localhost:3333/api/v1/auth/oauth/github/link");
    });

    it("returns Microsoft link URL", () => {
      const result = oauthApi.getLinkUrl("microsoft");

      expect(result).toBe("http://localhost:3333/api/v1/auth/oauth/microsoft/link");
    });
  });
});
