import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import type { UserDTO, SubscriptionTierDTO } from "@saas/shared";

// Mock auth API
const mockMe = vi.fn();
const mockLogin = vi.fn();
const mockLogout = vi.fn();
vi.mock("@/lib/auth", () => ({
  authApi: {
    me: () => mockMe(),
    login: (...args: unknown[]) => mockLogin(...args),
    logout: () => mockLogout(),
  },
}));

function createMockTier(slug: string, level: number): SubscriptionTierDTO {
  return {
    id: level + 1,
    slug,
    name: slug === "free" ? "Free" : slug === "tier1" ? "Tier 1" : "Tier 2",
    description: `${slug} tier description`,
    level,
    maxTeamMembers: slug === "free" ? 5 : slug === "tier1" ? 20 : null,
    priceMonthly: null,
    yearlyDiscountPercent: null,
    features: null,
    isActive: true,
  };
}

const mockUser: UserDTO = {
  id: 1,
  email: "user@example.com",
  fullName: "Test User",
  role: "user",
  subscription: null,
  currentTeamId: null,
  currentTeam: null,
  effectiveSubscriptionTier: createMockTier("free", 0),
  emailVerified: true,
  mfaEnabled: false,
  avatarUrl: null,
  balance: 0,
  balanceCurrency: "usd",
  createdAt: "2024-01-01T00:00:00.000Z",
};

// Test component that uses the auth context
function TestComponent(): React.ReactElement {
  const { user, isLoading, isAuthenticated, login, logout, refreshUser } =
    useAuth();

  return (
    <div>
      <div data-testid="loading">{isLoading ? "loading" : "not-loading"}</div>
      <div data-testid="authenticated">
        {isAuthenticated ? "authenticated" : "not-authenticated"}
      </div>
      <div data-testid="user">{user ? user.email : "no-user"}</div>
      <button onClick={() => login("test@example.com", "password")}>
        Login
      </button>
      <button onClick={() => login("test@example.com", "password", "123456")}>
        Login with MFA
      </button>
      <button onClick={logout}>Logout</button>
      <button onClick={refreshUser}>Refresh</button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogout.mockResolvedValue(undefined);
  });

  describe("initialization", () => {
    it("starts with loading state", () => {
      mockMe.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId("loading")).toHaveTextContent("loading");
    });

    it("sets user when authenticated", async () => {
      mockMe.mockResolvedValue(mockUser);
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("not-loading");
      });

      expect(screen.getByTestId("user")).toHaveTextContent("user@example.com");
      expect(screen.getByTestId("authenticated")).toHaveTextContent(
        "authenticated"
      );
    });

    it("sets user to null when not authenticated", async () => {
      mockMe.mockRejectedValue(new Error("Unauthorized"));
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("not-loading");
      });

      expect(screen.getByTestId("user")).toHaveTextContent("no-user");
      expect(screen.getByTestId("authenticated")).toHaveTextContent(
        "not-authenticated"
      );
    });
  });

  describe("login", () => {
    beforeEach(() => {
      mockMe.mockRejectedValue(new Error("Unauthorized"));
    });

    it("calls authApi.login with credentials", async () => {
      mockLogin.mockResolvedValue({ user: mockUser });
      const user = userEvent.setup();
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("not-loading");
      });

      await user.click(screen.getByText("Login"));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: "test@example.com",
          password: "password",
          mfaCode: undefined,
        });
      });
    });

    it("calls authApi.login with MFA code", async () => {
      mockLogin.mockResolvedValue({ user: mockUser });
      const user = userEvent.setup();
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("not-loading");
      });

      await user.click(screen.getByText("Login with MFA"));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: "test@example.com",
          password: "password",
          mfaCode: "123456",
        });
      });
    });

    it("sets user after successful login", async () => {
      mockLogin.mockResolvedValue({ user: mockUser });
      const user = userEvent.setup();
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("not-loading");
      });

      await user.click(screen.getByText("Login"));

      await waitFor(() => {
        expect(screen.getByTestId("user")).toHaveTextContent("user@example.com");
        expect(screen.getByTestId("authenticated")).toHaveTextContent(
          "authenticated"
        );
      });
    });

    it("returns requiresMfa when MFA is required", async () => {
      mockLogin.mockResolvedValue({ requiresMfa: true });

      let loginResult: { requiresMfa?: boolean } = {};
      function TestLoginComponent(): React.ReactElement {
        const { login } = useAuth();
        return (
          <button
            onClick={async () => {
              loginResult = await login("test@example.com", "password");
            }}
          >
            Login
          </button>
        );
      }

      const user = userEvent.setup();
      render(
        <AuthProvider>
          <TestLoginComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Login")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Login"));

      await waitFor(() => {
        expect(loginResult.requiresMfa).toBe(true);
      });
    });
  });

  describe("logout", () => {
    beforeEach(() => {
      mockMe.mockResolvedValue(mockUser);
    });

    it("calls authApi.logout", async () => {
      const user = userEvent.setup();
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("user")).toHaveTextContent("user@example.com");
      });

      await user.click(screen.getByText("Logout"));

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });
    });

    it("clears user after logout", async () => {
      const user = userEvent.setup();
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("user")).toHaveTextContent("user@example.com");
      });

      await user.click(screen.getByText("Logout"));

      await waitFor(() => {
        expect(screen.getByTestId("user")).toHaveTextContent("no-user");
        expect(screen.getByTestId("authenticated")).toHaveTextContent(
          "not-authenticated"
        );
      });
    });
  });

  describe("refreshUser", () => {
    beforeEach(() => {
      mockMe.mockResolvedValue(mockUser);
    });

    it("refetches user data", async () => {
      const updatedUser = { ...mockUser, fullName: "Updated Name" };
      mockMe.mockResolvedValueOnce(mockUser).mockResolvedValueOnce(updatedUser);

      const user = userEvent.setup();
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("user")).toHaveTextContent("user@example.com");
      });

      await user.click(screen.getByText("Refresh"));

      await waitFor(() => {
        expect(mockMe).toHaveBeenCalledTimes(2);
      });
    });

    it("clears user if refresh fails", async () => {
      mockMe
        .mockResolvedValueOnce(mockUser)
        .mockRejectedValueOnce(new Error("Unauthorized"));

      const user = userEvent.setup();
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("user")).toHaveTextContent("user@example.com");
      });

      await user.click(screen.getByText("Refresh"));

      await waitFor(() => {
        expect(screen.getByTestId("user")).toHaveTextContent("no-user");
      });
    });
  });
});

describe("useAuth", () => {
  it("throws error when used outside AuthProvider", () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow("useAuth must be used within an AuthProvider");

    consoleSpy.mockRestore();
  });
});
