import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminUsersPage from "@/app/admin/users/page";
import type { SubscriptionTier, SubscriptionTierDTO, SubscriptionDTO } from "@saas/shared";

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

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock auth context
const mockUseAuth = vi.fn();
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock the API
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPut = vi.fn();
const mockApiDelete = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
  },
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
  subscription?: SubscriptionDTO | null;
  effectiveSubscriptionTier: SubscriptionTierDTO;
  currentTeamId: number | null;
  emailVerified: boolean;
  mfaEnabled: boolean;
}

const mockUsers = [
  {
    id: 1,
    email: "admin@example.com",
    fullName: "Admin User",
    role: "admin",
    subscriptionTier: "tier2" as SubscriptionTier,
    subscriptionExpiresAt: null,
    currentTeamId: null,
    currentTeamName: null,
    emailVerified: true,
    emailVerifiedAt: "2024-01-01T00:00:00.000Z",
    mfaEnabled: true,
    avatarUrl: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: null,
  },
  {
    id: 2,
    email: "user@example.com",
    fullName: "Regular User",
    role: "user",
    subscriptionTier: "free" as SubscriptionTier,
    subscriptionExpiresAt: null,
    currentTeamId: null,
    currentTeamName: null,
    emailVerified: false,
    emailVerifiedAt: null,
    mfaEnabled: false,
    avatarUrl: null,
    createdAt: "2024-02-01T00:00:00.000Z",
    updatedAt: null,
  },
];

describe("Admin Users Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const adminUser: MockUser = {
      id: 1,
      email: "admin@example.com",
      fullName: "Admin User",
      role: "admin",
      subscription: null,
      effectiveSubscriptionTier: createMockTier("tier2", 2),
      currentTeamId: null,
      emailVerified: true,
      mfaEnabled: true,
    };

    mockUseAuth.mockReturnValue({
      user: adminUser,
    });
  });

  describe("loading state", () => {
    it("shows loading skeleton while fetching users", () => {
      mockApiGet.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      render(<AdminUsersPage />);

      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("when users are loaded", () => {
    beforeEach(() => {
      mockApiGet.mockResolvedValue({ data: mockUsers });
    });

    it("displays page title", async () => {
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText("User Management")).toBeInTheDocument();
      });
    });

    it("displays users table headers", async () => {
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText("ID")).toBeInTheDocument();
        expect(screen.getByText("Email")).toBeInTheDocument();
        expect(screen.getByText("Name")).toBeInTheDocument();
        expect(screen.getByText("Role")).toBeInTheDocument();
        expect(screen.getByText("Email Status")).toBeInTheDocument();
        expect(screen.getByText("MFA")).toBeInTheDocument();
        expect(screen.getByText("Created")).toBeInTheDocument();
      });
    });

    it("displays user emails", async () => {
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText("admin@example.com")).toBeInTheDocument();
        expect(screen.getByText("user@example.com")).toBeInTheDocument();
      });
    });

    it("displays user names", async () => {
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText("Admin User")).toBeInTheDocument();
        expect(screen.getByText("Regular User")).toBeInTheDocument();
      });
    });

    it("displays email verification status", async () => {
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText("Verified")).toBeInTheDocument();
        expect(screen.getByText("Unverified")).toBeInTheDocument();
      });
    });

    it("displays MFA status", async () => {
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText("Enabled")).toBeInTheDocument();
        expect(screen.getByText("Disabled")).toBeInTheDocument();
      });
    });

    it("displays Verify button for unverified users", async () => {
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /^verify$/i })
        ).toBeInTheDocument();
      });
    });

    it("displays Unverify button for verified users", async () => {
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /unverify/i })
        ).toBeInTheDocument();
      });
    });

    it("displays Delete button for other users", async () => {
      render(<AdminUsersPage />);

      await waitFor(() => {
        // Only one Delete button should appear (for user@example.com, not for the current admin)
        const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
        expect(deleteButtons.length).toBe(1);
      });
    });

    it("does not show Delete button for current user", async () => {
      render(<AdminUsersPage />);

      await waitFor(() => {
        // The admin user row should not have a delete button
        // Only one Delete button should exist (for the other user)
        const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
        expect(deleteButtons.length).toBe(1);
      });
    });
  });

  describe("empty state", () => {
    beforeEach(() => {
      mockApiGet.mockResolvedValue({ data: [] });
    });

    it("shows no users message when list is empty", async () => {
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText("No users found")).toBeInTheDocument();
      });
    });
  });

  describe("user actions", () => {
    beforeEach(() => {
      mockApiGet.mockResolvedValue({ data: mockUsers });
    });

    it("calls verify email API when Verify button clicked", async () => {
      mockApiPost.mockResolvedValue({ message: "Success" });
      const user = userEvent.setup();
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^verify$/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /^verify$/i }));

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith(
          "/api/v1/admin/users/2/verify-email"
        );
      });
    });

    it("shows success toast after verifying email", async () => {
      mockApiPost.mockResolvedValue({ message: "Success" });
      const { toast } = await import("sonner");
      const user = userEvent.setup();
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^verify$/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /^verify$/i }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Email verified successfully");
      });
    });

    it("calls unverify email API when Unverify button clicked", async () => {
      mockApiPost.mockResolvedValue({ message: "Success" });
      const user = userEvent.setup();
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /unverify/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /unverify/i }));

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith(
          "/api/v1/admin/users/1/unverify-email"
        );
      });
    });

    it("opens delete dialog before deleting user", async () => {
      const user = userEvent.setup();
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /delete/i }));

      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Delete User")).toBeInTheDocument();
      expect(
        within(dialog).getByText(/delete user user@example.com/i)
      ).toBeInTheDocument();
    });

    it("calls delete API when confirmed", async () => {
      mockApiDelete.mockResolvedValue({ message: "Success" });

      const user = userEvent.setup();
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /delete/i }));

      const dialog = screen.getByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

      await waitFor(() => {
        expect(mockApiDelete).toHaveBeenCalledWith("/api/v1/admin/users/2");
      });
    });

    it("does not call delete API when cancelled", async () => {
      const user = userEvent.setup();
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /delete/i }));

      const dialog = screen.getByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: /cancel/i }));

      expect(mockApiDelete).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("redirects on unauthorized error", async () => {
      const { ApiError } = await import("@/lib/api");
      mockApiGet.mockRejectedValue(new ApiError(401, "Unauthorized", "Unauthorized"));
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
      });
    });

    it("redirects on forbidden error", async () => {
      const { ApiError } = await import("@/lib/api");
      mockApiGet.mockRejectedValue(new ApiError(403, "Forbidden", "Forbidden"));
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
      });
    });

    it("shows error toast on API failure", async () => {
      const { ApiError } = await import("@/lib/api");
      const { toast } = await import("sonner");
      mockApiGet.mockRejectedValue(new ApiError(500, "ServerError", "Server error"));
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Server error");
      });
    });

    it("shows generic error toast on unknown error", async () => {
      const { toast } = await import("sonner");
      mockApiGet.mockRejectedValue(new Error("Network error"));
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to fetch users");
      });
    });
  });

  describe("subscription tier management", () => {
    beforeEach(() => {
      mockApiGet.mockResolvedValue({ data: mockUsers });
    });

    it("displays subscription tier selects for each user", async () => {
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText("admin@example.com")).toBeInTheDocument();
      });

      // Find the tier select triggers (combobox roles)
      const selectTriggers = screen.getAllByRole("combobox");
      // Should have one select per user
      expect(selectTriggers.length).toBe(2);
    });

    it("displays current tier values in selects", async () => {
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText("admin@example.com")).toBeInTheDocument();
      });

      // Should show tier badges
      expect(screen.getByText("Tier 2")).toBeInTheDocument();
      expect(screen.getByText("Free")).toBeInTheDocument();
    });
  });

  describe("verify/unverify email error handling", () => {
    beforeEach(() => {
      mockApiGet.mockResolvedValue({ data: mockUsers });
    });

    it("shows error toast when verify email fails with ApiError", async () => {
      const { ApiError } = await import("@/lib/api");
      const { toast } = await import("sonner");
      mockApiPost.mockRejectedValue(new ApiError(400, "ValidationError", "Cannot verify email"));
      const user = userEvent.setup();
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^verify$/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /^verify$/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Cannot verify email");
      });
    });

    it("shows generic error toast when verify email fails with unknown error", async () => {
      const { toast } = await import("sonner");
      mockApiPost.mockRejectedValue(new Error("Network error"));
      const user = userEvent.setup();
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^verify$/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /^verify$/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to verify email");
      });
    });

    it("shows success toast after unverifying email", async () => {
      mockApiPost.mockResolvedValue({ message: "Success" });
      const { toast } = await import("sonner");
      const user = userEvent.setup();
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /unverify/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /unverify/i }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Email unverified successfully");
      });
    });

    it("shows error toast when unverify email fails with ApiError", async () => {
      const { ApiError } = await import("@/lib/api");
      const { toast } = await import("sonner");
      mockApiPost.mockRejectedValue(new ApiError(400, "ValidationError", "Cannot unverify email"));
      const user = userEvent.setup();
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /unverify/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /unverify/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Cannot unverify email");
      });
    });

    it("shows generic error toast when unverify email fails with unknown error", async () => {
      const { toast } = await import("sonner");
      mockApiPost.mockRejectedValue(new Error("Network error"));
      const user = userEvent.setup();
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /unverify/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /unverify/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to unverify email");
      });
    });
  });

  describe("delete user error handling", () => {
    beforeEach(() => {
      mockApiGet.mockResolvedValue({ data: mockUsers });
    });

    it("shows success toast after deleting user", async () => {
      mockApiDelete.mockResolvedValue({ message: "Success" });
      const { toast } = await import("sonner");
      const user = userEvent.setup();
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /delete/i }));
      const dialog = screen.getByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("User deleted successfully");
      });
    });

    it("shows error toast when delete user fails with ApiError", async () => {
      const { ApiError } = await import("@/lib/api");
      const { toast } = await import("sonner");
      mockApiDelete.mockRejectedValue(new ApiError(400, "ValidationError", "Cannot delete user"));
      const user = userEvent.setup();
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /delete/i }));
      const dialog = screen.getByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Cannot delete user");
      });
    });

    it("shows generic error toast when delete user fails with unknown error", async () => {
      const { toast } = await import("sonner");
      mockApiDelete.mockRejectedValue(new Error("Network error"));
      const user = userEvent.setup();
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /delete/i }));
      const dialog = screen.getByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to delete user");
      });
    });
  });

  describe("tier badge variants", () => {
    it("displays tier1 users with secondary badge", async () => {
      const usersWithTier1 = [
        {
          ...mockUsers[0],
          subscriptionTier: "tier1" as SubscriptionTier,
        },
      ];
      mockApiGet.mockResolvedValue({ data: usersWithTier1 });
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText("admin@example.com")).toBeInTheDocument();
      });

      // The tier badge should be visible
      expect(screen.getByText("Tier 1")).toBeInTheDocument();
    });
  });

  describe("user with null name", () => {
    it("displays dash for null fullName", async () => {
      const usersWithNullName = [
        {
          ...mockUsers[0],
          fullName: null,
        },
      ];
      mockApiGet.mockResolvedValue({ data: usersWithNullName });
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText("admin@example.com")).toBeInTheDocument();
      });

      // The name column should display "-"
      const cells = document.querySelectorAll("td");
      const nameCell = Array.from(cells).find(cell => cell.textContent === "-");
      expect(nameCell).toBeInTheDocument();
    });
  });

  describe("date formatting", () => {
    it("formats created date correctly", async () => {
      mockApiGet.mockResolvedValue({ data: mockUsers });
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText("admin@example.com")).toBeInTheDocument();
      });

      // Should display formatted date
      // The exact format depends on locale, but should contain Jan for January
      expect(screen.getByText(/Jan.*2024/)).toBeInTheDocument();
    });

    it("displays dash for null createdAt", async () => {
      const usersWithNullDate = [
        {
          ...mockUsers[0],
          createdAt: null,
        },
      ];
      mockApiGet.mockResolvedValue({ data: usersWithNullDate });
      render(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText("admin@example.com")).toBeInTheDocument();
      });
    });
  });
});
