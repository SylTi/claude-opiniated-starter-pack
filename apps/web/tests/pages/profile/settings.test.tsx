import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsPage from "@/app/profile/settings/page";
import type { SubscriptionTier } from "@saas/shared";

// Mock auth context
const mockUseAuth = vi.fn();
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock auth lib
const mockGetAccounts = vi.fn();
const mockGetLoginHistory = vi.fn();
const mockGetLinkUrl = vi.fn();
const mockUnlink = vi.fn();
vi.mock("@/lib/auth", () => ({
  oauthApi: {
    getAccounts: () => mockGetAccounts(),
    getLoginHistory: () => mockGetLoginHistory(),
    getLinkUrl: (provider: string) => mockGetLinkUrl(provider),
    unlink: (...args: unknown[]) => mockUnlink(...args),
  },
  authApi: {
    getLoginHistory: () => mockGetLoginHistory(),
  },
}));

// Mock API error
vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    statusCode: number;
    error: string;
    constructor(statusCode: number, error: string, message: string) {
      super(message);
      this.statusCode = statusCode;
      this.error = error;
    }
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

interface MockUser {
  id: number;
  email: string;
  fullName: string | null;
  role: string;
  subscriptionTier: SubscriptionTier;
  emailVerified: boolean;
  mfaEnabled: boolean;
}

const mockLinkedAccounts = [
  {
    id: 1,
    provider: "google",
    providerUserId: "google-123",
    email: "user@gmail.com",
    createdAt: "2024-01-01T00:00:00.000Z",
  },
];

const mockLoginHistory = [
  {
    id: 1,
    loginMethod: "password",
    ipAddress: "192.168.1.1",
    userAgent: "Chrome",
    success: true,
    createdAt: "2024-01-15T10:00:00.000Z",
  },
  {
    id: 2,
    loginMethod: "google",
    ipAddress: "192.168.1.2",
    userAgent: "Firefox",
    success: false,
    createdAt: "2024-01-14T09:00:00.000Z",
  },
];

describe("Settings Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccounts.mockResolvedValue([]);
    mockGetLoginHistory.mockResolvedValue([]);
    mockGetLinkUrl.mockImplementation(
      (provider: string) => `/api/oauth/${provider}/link`
    );
  });

  afterEach(async () => {
    // Flush any pending state updates to avoid act() warnings
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  describe("when user is not authenticated", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
      });
    });

    it("renders nothing when user is null", () => {
      const { container } = render(<SettingsPage />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("when user is authenticated", () => {
    const mockUser: MockUser = {
      id: 1,
      email: "user@example.com",
      fullName: "Test User",
      role: "user",
      subscriptionTier: "free",
      emailVerified: true,
      mfaEnabled: false,
    };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
      });
    });

    describe("loading state", () => {
      it("shows loading spinner while fetching data", async () => {
        let resolveAccounts: (value: unknown[]) => void;
        let resolveHistory: (value: unknown[]) => void;

        mockGetAccounts.mockImplementation(
          () => new Promise((resolve) => { resolveAccounts = resolve; })
        );
        mockGetLoginHistory.mockImplementation(
          () => new Promise((resolve) => { resolveHistory = resolve; })
        );

        render(<SettingsPage />);

        expect(document.querySelector(".animate-spin")).toBeInTheDocument();

        // Resolve promises to avoid dangling async operations
        await act(async () => {
          resolveAccounts!([]);
          resolveHistory!([]);
          await new Promise((resolve) => setTimeout(resolve, 0));
        });
      });
    });

    describe("rendering", () => {
      beforeEach(() => {
        mockGetAccounts.mockResolvedValue([]);
        mockGetLoginHistory.mockResolvedValue([]);
      });

      it("renders page title", async () => {
        render(<SettingsPage />);

        await waitFor(() => {
          expect(screen.getByText("Settings")).toBeInTheDocument();
        });
      });

      it("renders description text", async () => {
        render(<SettingsPage />);

        await waitFor(() => {
          expect(
            screen.getByText("Manage your linked accounts and preferences")
          ).toBeInTheDocument();
        });
      });

      it("renders Linked Accounts card", async () => {
        render(<SettingsPage />);

        await waitFor(() => {
          expect(screen.getByText("Linked Accounts")).toBeInTheDocument();
        });
      });

      it("renders Recent Login Activity card", async () => {
        render(<SettingsPage />);

        await waitFor(() => {
          expect(screen.getByText("Recent Login Activity")).toBeInTheDocument();
        });
      });

      it("renders Google provider", async () => {
        render(<SettingsPage />);

        await waitFor(() => {
          expect(screen.getByText("Google")).toBeInTheDocument();
        });
      });

      it("renders GitHub provider", async () => {
        render(<SettingsPage />);

        await waitFor(() => {
          expect(screen.getByText("GitHub")).toBeInTheDocument();
        });
      });
    });

    describe("linked accounts", () => {
      describe("when no accounts linked", () => {
        beforeEach(() => {
          mockGetAccounts.mockResolvedValue([]);
          mockGetLoginHistory.mockResolvedValue([]);
        });

        it("shows Link buttons for all providers", async () => {
          render(<SettingsPage />);

          await waitFor(() => {
            const linkButtons = screen.getAllByRole("button", { name: /link/i });
            expect(linkButtons.length).toBe(2);
          });
        });
      });

      describe("when Google account is linked", () => {
        beforeEach(() => {
          mockGetAccounts.mockResolvedValue(mockLinkedAccounts);
          mockGetLoginHistory.mockResolvedValue([]);
        });

        it("shows linked email for Google", async () => {
          render(<SettingsPage />);

          await waitFor(() => {
            expect(screen.getByText("user@gmail.com")).toBeInTheDocument();
          });
        });

        it("shows Unlink button for Google", async () => {
          render(<SettingsPage />);

          await waitFor(() => {
            expect(
              screen.getByRole("button", { name: /unlink/i })
            ).toBeInTheDocument();
          });
        });

        it("calls unlink API when Unlink clicked", async () => {
          mockUnlink.mockResolvedValue({ message: "Success" });
          const user = userEvent.setup();
          render(<SettingsPage />);

          await waitFor(() => {
            expect(
              screen.getByRole("button", { name: /unlink/i })
            ).toBeInTheDocument();
          });

          await user.click(screen.getByRole("button", { name: /unlink/i }));

          await waitFor(() => {
            expect(mockUnlink).toHaveBeenCalledWith("google");
          });
        });

        it("shows success toast after unlinking", async () => {
          mockUnlink.mockResolvedValue({ message: "Success" });
          const { toast } = await import("sonner");
          const user = userEvent.setup();
          render(<SettingsPage />);

          await waitFor(() => {
            expect(
              screen.getByRole("button", { name: /unlink/i })
            ).toBeInTheDocument();
          });

          await user.click(screen.getByRole("button", { name: /unlink/i }));

          await waitFor(() => {
            expect(toast.success).toHaveBeenCalledWith("google account unlinked");
          });
        });
      });

      describe("link account", () => {
        beforeEach(() => {
          mockGetAccounts.mockResolvedValue([]);
          mockGetLoginHistory.mockResolvedValue([]);
        });

        it("redirects to OAuth URL when Link clicked", async () => {
          const originalLocation = window.location;
          Object.defineProperty(window, "location", {
            value: { href: "" },
            writable: true,
          });

          const user = userEvent.setup();
          render(<SettingsPage />);

          await waitFor(() => {
            const linkButtons = screen.getAllByRole("button", { name: /link/i });
            expect(linkButtons.length).toBe(2);
          });

          const linkButtons = screen.getAllByRole("button", { name: /link/i });
          await user.click(linkButtons[0]); // First Link button (Google)

          expect(mockGetLinkUrl).toHaveBeenCalledWith("google");

          Object.defineProperty(window, "location", {
            value: originalLocation,
            writable: true,
          });
        });
      });
    });

    describe("login history", () => {
      describe("when no login history", () => {
        beforeEach(() => {
          mockGetAccounts.mockResolvedValue([]);
          mockGetLoginHistory.mockResolvedValue([]);
        });

        it("shows no login history message", async () => {
          render(<SettingsPage />);

          await waitFor(() => {
            expect(
              screen.getByText("No login history available")
            ).toBeInTheDocument();
          });
        });
      });

      describe("when login history exists", () => {
        beforeEach(() => {
          mockGetAccounts.mockResolvedValue([]);
          mockGetLoginHistory.mockResolvedValue(mockLoginHistory);
        });

        it("displays login entries", async () => {
          render(<SettingsPage />);

          await waitFor(() => {
            expect(screen.getByText("password")).toBeInTheDocument();
            expect(screen.getByText("google")).toBeInTheDocument();
          });
        });

        it("displays IP addresses", async () => {
          render(<SettingsPage />);

          await waitFor(() => {
            expect(screen.getByText(/192\.168\.1\.1/)).toBeInTheDocument();
            expect(screen.getByText(/192\.168\.1\.2/)).toBeInTheDocument();
          });
        });

        it("displays success status", async () => {
          render(<SettingsPage />);

          await waitFor(() => {
            expect(screen.getByText("Success")).toBeInTheDocument();
          });
        });

        it("displays failed status", async () => {
          render(<SettingsPage />);

          await waitFor(() => {
            expect(screen.getByText("Failed")).toBeInTheDocument();
          });
        });
      });
    });

    describe("error handling", () => {
      it("shows error message when data fails to load", async () => {
        mockGetAccounts.mockRejectedValue(new Error("Network error"));
        mockGetLoginHistory.mockRejectedValue(new Error("Network error"));
        render(<SettingsPage />);

        await waitFor(() => {
          expect(
            screen.getByText("Failed to load settings")
          ).toBeInTheDocument();
        });
      });

      it("shows error message when unlink fails", async () => {
        const { ApiError } = await import("@/lib/api");
        mockGetAccounts.mockResolvedValue(mockLinkedAccounts);
        mockGetLoginHistory.mockResolvedValue([]);
        mockUnlink.mockRejectedValue(
          new ApiError(400, "CannotUnlink", "Cannot unlink last account")
        );
        const user = userEvent.setup();
        render(<SettingsPage />);

        await waitFor(() => {
          expect(
            screen.getByRole("button", { name: /unlink/i })
          ).toBeInTheDocument();
        });

        await user.click(screen.getByRole("button", { name: /unlink/i }));

        await waitFor(() => {
          expect(
            screen.getByText("Cannot unlink last account")
          ).toBeInTheDocument();
        });
      });
    });
  });
});
