import { describe, it, expect, vi, beforeEach } from "vitest";
import { authApi } from "@/lib/auth";
import { api } from "@/lib/api";

// Mock the api module
vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
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
});
