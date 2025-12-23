import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserMenu } from "@/components/user-menu";
import type { UserDTO, SubscriptionTierDTO, SubscriptionDTO } from "@saas/shared";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock the auth context
const mockLogout = vi.fn();
const mockUseAuth = vi.fn();
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

function createMockTier(slug: string, level: number): SubscriptionTierDTO {
  return {
    id: level + 1,
    slug,
    name: slug === "free" ? "Free" : slug === "tier1" ? "Tier 1" : "Tier 2",
    level,
    maxTeamMembers: slug === "free" ? 5 : slug === "tier1" ? 20 : null,
    priceMonthly: null,
    yearlyDiscountPercent: null,
    features: null,
    isActive: true,
  };
}

function createMockSubscription(tierSlug: string, expiresAt: string | null = null): SubscriptionDTO {
  const tier = createMockTier(tierSlug, tierSlug === "free" ? 0 : tierSlug === "tier1" ? 1 : 2);
  return {
    id: 1,
    subscriberType: "team",
    subscriberId: 1,
    tier,
    status: "active",
    startsAt: new Date().toISOString(),
    expiresAt,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
}

function createMockUser(overrides: Partial<UserDTO> = {}): UserDTO {
  return {
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
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("UserMenu Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when user is not authenticated", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        logout: mockLogout,
      });
    });

    it("renders nothing when no user", () => {
      const { container } = render(<UserMenu />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("when regular user is authenticated", () => {
    const regularUser = createMockUser({
      email: "user@example.com",
      fullName: "Regular User",
    });

    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: regularUser,
        logout: mockLogout,
      });
    });

    it("renders avatar button", () => {
      render(<UserMenu />);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("displays user initials in avatar", () => {
      render(<UserMenu />);
      expect(screen.getByText("RU")).toBeInTheDocument();
    });

    it("opens menu on click", async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button"));

      expect(screen.getByText("Profile")).toBeInTheDocument();
      expect(screen.getByText("Security")).toBeInTheDocument();
      expect(screen.getByText("Settings")).toBeInTheDocument();
      expect(screen.getByText("Log out")).toBeInTheDocument();
    });

    it("does not display Admin Panel for regular user", async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button"));

      expect(screen.queryByText("Admin Panel")).not.toBeInTheDocument();
    });

    it("displays user email in dropdown", async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button"));

      expect(screen.getByText("user@example.com")).toBeInTheDocument();
    });

    it("displays user name in dropdown", async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button"));

      expect(screen.getByText("Regular User")).toBeInTheDocument();
    });

    it("navigates to profile on Profile click", async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button"));
      await user.click(screen.getByText("Profile"));

      expect(mockPush).toHaveBeenCalledWith("/profile");
    });

    it("navigates to security on Security click", async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button"));
      await user.click(screen.getByText("Security"));

      expect(mockPush).toHaveBeenCalledWith("/profile/security");
    });

    it("calls logout on Log out click", async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button"));
      await user.click(screen.getByText("Log out"));

      expect(mockLogout).toHaveBeenCalled();
    });
  });

  describe("when admin user is authenticated", () => {
    const adminUser = createMockUser({
      email: "admin@example.com",
      fullName: "Admin User",
      role: "admin",
    });

    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: adminUser,
        logout: mockLogout,
      });
    });

    it("displays Admin Panel for admin user", async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button"));

      expect(screen.getByText("Admin Panel")).toBeInTheDocument();
    });

    it("navigates to admin dashboard on Admin Panel click", async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button"));
      await user.click(screen.getByText("Admin Panel"));

      expect(mockPush).toHaveBeenCalledWith("/admin/dashboard");
    });

    it("also displays standard menu items", async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button"));

      expect(screen.getByText("Profile")).toBeInTheDocument();
      expect(screen.getByText("Security")).toBeInTheDocument();
      expect(screen.getByText("Settings")).toBeInTheDocument();
      expect(screen.getByText("Log out")).toBeInTheDocument();
    });
  });

  describe("when guest user is authenticated", () => {
    const guestUser = createMockUser({
      email: "guest@example.com",
      fullName: "Guest User",
      role: "guest",
      emailVerified: false,
    });

    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: guestUser,
        logout: mockLogout,
      });
    });

    it("does not display Admin Panel for guest user", async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button"));

      expect(screen.queryByText("Admin Panel")).not.toBeInTheDocument();
    });

    it("displays standard menu items for guest", async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button"));

      expect(screen.getByText("Profile")).toBeInTheDocument();
      expect(screen.getByText("Security")).toBeInTheDocument();
      expect(screen.getByText("Settings")).toBeInTheDocument();
      expect(screen.getByText("Log out")).toBeInTheDocument();
    });
  });

  describe("avatar display", () => {
    it("displays first letter of email when no fullName", async () => {
      const userWithoutName = createMockUser({
        email: "test@example.com",
        fullName: null,
      });

      mockUseAuth.mockReturnValue({
        user: userWithoutName,
        logout: mockLogout,
      });

      render(<UserMenu />);
      expect(screen.getByText("T")).toBeInTheDocument();
    });

    it("displays initials from fullName", () => {
      const userWithName = createMockUser({
        email: "test@example.com",
        fullName: "John Doe",
      });

      mockUseAuth.mockReturnValue({
        user: userWithName,
        logout: mockLogout,
      });

      render(<UserMenu />);
      expect(screen.getByText("JD")).toBeInTheDocument();
    });
  });

  describe("Team link visibility", () => {
    it("does not show Team link for user without team", async () => {
      const userWithoutTeam = createMockUser();

      mockUseAuth.mockReturnValue({
        user: userWithoutTeam,
        logout: mockLogout,
      });

      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button"));

      expect(screen.queryByText("Team")).not.toBeInTheDocument();
    });

    it("does not show Team link for user with free tier team", async () => {
      const userWithFreeTeam = createMockUser({
        currentTeamId: 1,
        currentTeam: {
          id: 1,
          name: "Free Team",
          slug: "free-team",
          subscription: null,
        },
        effectiveSubscriptionTier: createMockTier("free", 0),
      });

      mockUseAuth.mockReturnValue({
        user: userWithFreeTeam,
        logout: mockLogout,
      });

      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button"));

      expect(screen.queryByText("Team")).not.toBeInTheDocument();
    });

    it("shows Team link for user with tier1 team", async () => {
      const userWithTier1Team = createMockUser({
        currentTeamId: 1,
        currentTeam: {
          id: 1,
          name: "Premium Team",
          slug: "premium-team",
          subscription: createMockSubscription("tier1", "2025-12-31T00:00:00.000Z"),
        },
        effectiveSubscriptionTier: createMockTier("tier1", 1),
      });

      mockUseAuth.mockReturnValue({
        user: userWithTier1Team,
        logout: mockLogout,
      });

      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button"));

      expect(screen.getByText("Team")).toBeInTheDocument();
    });

    it("shows Team link for user with tier2 team", async () => {
      const userWithTier2Team = createMockUser({
        currentTeamId: 1,
        currentTeam: {
          id: 1,
          name: "Enterprise Team",
          slug: "enterprise-team",
          subscription: createMockSubscription("tier2"),
        },
        effectiveSubscriptionTier: createMockTier("tier2", 2),
      });

      mockUseAuth.mockReturnValue({
        user: userWithTier2Team,
        logout: mockLogout,
      });

      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button"));

      expect(screen.getByText("Team")).toBeInTheDocument();
    });

    it("navigates to team page when Team link clicked", async () => {
      const userWithPaidTeam = createMockUser({
        currentTeamId: 1,
        currentTeam: {
          id: 1,
          name: "Premium Team",
          slug: "premium-team",
          subscription: createMockSubscription("tier1", "2025-12-31T00:00:00.000Z"),
        },
        effectiveSubscriptionTier: createMockTier("tier1", 1),
      });

      mockUseAuth.mockReturnValue({
        user: userWithPaidTeam,
        logout: mockLogout,
      });

      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button"));
      await user.click(screen.getByText("Team"));

      expect(mockPush).toHaveBeenCalledWith("/team");
    });

    it("does not show Team link when user has currentTeamId but effective tier is free", async () => {
      const userWithTeamButFreeTier = createMockUser({
        currentTeamId: 1,
        currentTeam: {
          id: 1,
          name: "My Team",
          slug: "my-team",
          subscription: null,
        },
        effectiveSubscriptionTier: createMockTier("free", 0),
      });

      mockUseAuth.mockReturnValue({
        user: userWithTeamButFreeTier,
        logout: mockLogout,
      });

      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button"));

      expect(screen.queryByText("Team")).not.toBeInTheDocument();
    });
  });
});
