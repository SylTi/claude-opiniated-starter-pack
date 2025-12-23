import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import DashboardPage from "@/app/dashboard/page";
import type { SubscriptionTier, SubscriptionTierDTO, SubscriptionDTO } from "@saas/shared";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock the auth context
const mockUseAuth = vi.fn();
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock the API
const mockApiGet = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
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

interface MockUser {
  id: number;
  email: string;
  fullName: string | null;
  role: string;
  subscription?: SubscriptionDTO | null;
  currentTeamId: number | null;
  currentTeam: {
    id: number;
    name: string;
    slug: string;
    subscription?: SubscriptionDTO | null;
  } | null;
  effectiveSubscriptionTier: SubscriptionTierDTO;
  emailVerified: boolean;
  mfaEnabled: boolean;
  avatarUrl: string | null;
}

const mockStats = {
  accountAgeDays: 30,
  totalLogins: 15,
  lastLoginAt: "2025-12-15T10:00:00.000Z",
  emailVerified: true,
  mfaEnabled: false,
  subscriptionTier: "free" as SubscriptionTier,
  connectedOAuthAccounts: 2,
  recentActivity: [
    {
      method: "password",
      success: true,
      ipAddress: "127.0.0.1",
      createdAt: "2025-12-15T10:00:00.000Z",
    },
  ],
};

describe("Dashboard Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
  });

  describe("when user is not authenticated", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
      });
    });

    it("redirects to login", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/login");
      });
    });
  });

  describe("loading state", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
      });
    });

    it("displays loading spinner while loading", () => {
      render(<DashboardPage />);

      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });

  describe("when authenticated user with free tier (no team)", () => {
    const freeUser: MockUser = {
      id: 1,
      email: "user@example.com",
      fullName: "Free User",
      role: "user",
      subscription: null,
      currentTeamId: null,
      currentTeam: null,
      effectiveSubscriptionTier: createMockTier("free", 0),
      emailVerified: true,
      mfaEnabled: false,
      avatarUrl: null,
    };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: freeUser,
        isLoading: false,
      });

      mockApiGet.mockResolvedValue({ data: mockStats });
    });

    it("displays welcome message with user name", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/Welcome back, Free User/i)).toBeInTheDocument();
      });
    });

    it("displays account status cards", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Account Age")).toBeInTheDocument();
        expect(screen.getByText("Total Logins")).toBeInTheDocument();
        expect(screen.getByText("Email Status")).toBeInTheDocument();
        expect(screen.getByText("Security")).toBeInTheDocument();
      });
    });

    it("displays email verification status", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Verified")).toBeInTheDocument();
      });
    });

    it("displays quick actions section", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Quick Actions")).toBeInTheDocument();
        expect(screen.getByText("Edit Profile")).toBeInTheDocument();
        // Security Settings appears multiple times, so use getAllByText
        const securityElements = screen.getAllByText("Security Settings");
        expect(securityElements.length).toBeGreaterThan(0);
      });
    });

    it("displays subscription tier sections", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Features by Subscription")).toBeInTheDocument();
        expect(screen.getByText("Free Features")).toBeInTheDocument();
        expect(screen.getByText("Tier 1 Features")).toBeInTheDocument();
        expect(screen.getByText("Tier 2 Features")).toBeInTheDocument();
      });
    });

    it("does NOT display team & subscription info for free user without team", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Quick Actions")).toBeInTheDocument();
      });

      expect(screen.queryByText("Subscription & Team")).not.toBeInTheDocument();
    });

    it("displays free tier content as unlocked", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Basic Dashboard")).toBeInTheDocument();
        expect(screen.getByText("Profile Management")).toBeInTheDocument();
        // Security Settings appears in both quick actions and tier features
        const securityElements = screen.getAllByText("Security Settings");
        expect(securityElements.length).toBeGreaterThan(0);
      });
    });

    it("displays tier 1 content as locked", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Upgrade to Tier 1 to unlock")).toBeInTheDocument();
      });
    });
  });

  describe("when authenticated user with paid tier team", () => {
    const paidTeamUser: MockUser = {
      id: 1,
      email: "member@example.com",
      fullName: "Team Member",
      role: "user",
      subscription: null,
      currentTeamId: 1,
      currentTeam: {
        id: 1,
        name: "Premium Team",
        slug: "premium-team",
        subscription: createMockSubscription("tier1", "2025-12-31T00:00:00.000Z"),
      },
      effectiveSubscriptionTier: createMockTier("tier1", 1),
      emailVerified: true,
      mfaEnabled: true,
      avatarUrl: null,
    };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: paidTeamUser,
        isLoading: false,
      });

      mockApiGet.mockResolvedValue({
        data: { ...mockStats, subscriptionTier: "tier1" },
      });
    });

    it("displays team & subscription info section", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Subscription & Team")).toBeInTheDocument();
      });
    });

    it("displays team name", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Premium Team")).toBeInTheDocument();
      });
    });

    it("displays team slug", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Slug: premium-team")).toBeInTheDocument();
      });
    });

    it("displays subscription tier badge", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        // Tier 1 appears multiple times on page
        const tier1Elements = screen.getAllByText("Tier 1");
        expect(tier1Elements.length).toBeGreaterThan(0);
      });
    });

    it("displays subscription expiration date", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/Expires:/)).toBeInTheDocument();
      });
    });

    it("displays Manage Team link", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Manage Team")).toBeInTheDocument();
      });
    });

    it("has link to team management page", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        const link = screen.getByRole("link", { name: /Manage Team/i });
        expect(link).toHaveAttribute("href", "/team");
      });
    });

    it("displays tier 1 content as unlocked", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Advanced Analytics")).toBeInTheDocument();
        expect(screen.getByText("Priority Support")).toBeInTheDocument();
        expect(screen.getByText("API Access")).toBeInTheDocument();
      });
    });

    it("displays tier 2 content as locked", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Upgrade to Tier 2 to unlock")).toBeInTheDocument();
      });
    });

    it("displays subscription plan via team", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/via Premium Team/)).toBeInTheDocument();
      });
    });
  });

  describe("when authenticated user with tier2 team", () => {
    const tier2TeamUser: MockUser = {
      id: 1,
      email: "enterprise@example.com",
      fullName: "Enterprise User",
      role: "user",
      subscription: null,
      currentTeamId: 2,
      currentTeam: {
        id: 2,
        name: "Enterprise Corp",
        slug: "enterprise-corp",
        subscription: createMockSubscription("tier2", null),
      },
      effectiveSubscriptionTier: createMockTier("tier2", 2),
      emailVerified: true,
      mfaEnabled: false,
      avatarUrl: null,
    };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: tier2TeamUser,
        isLoading: false,
      });

      mockApiGet.mockResolvedValue({
        data: { ...mockStats, subscriptionTier: "tier2" },
      });
    });

    it("displays tier 2 content as unlocked", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("White-label Solution")).toBeInTheDocument();
        expect(screen.getByText("Dedicated Account Manager")).toBeInTheDocument();
        expect(screen.getByText("Custom Integrations")).toBeInTheDocument();
      });
    });

    it("displays Tier 2 badge", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        // Tier 2 appears multiple times on page
        const tier2Elements = screen.getAllByText("Tier 2");
        expect(tier2Elements.length).toBeGreaterThan(0);
      });
    });
  });

  describe("when user has team but subscription expired", () => {
    const expiredTeamUser: MockUser = {
      id: 1,
      email: "expired@example.com",
      fullName: "Expired User",
      role: "user",
      subscription: null,
      currentTeamId: 3,
      currentTeam: {
        id: 3,
        name: "Expired Team",
        slug: "expired-team",
        subscription: createMockSubscription("tier1", "2024-01-01T00:00:00.000Z"),
      },
      effectiveSubscriptionTier: createMockTier("free", 0),
      emailVerified: true,
      mfaEnabled: false,
      avatarUrl: null,
    };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: expiredTeamUser,
        isLoading: false,
      });

      mockApiGet.mockResolvedValue({ data: mockStats });
    });

    it("displays team info but effective tier is free", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Expired Team")).toBeInTheDocument();
      });
    });

    it("does not show Manage Team link for expired subscription", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Expired Team")).toBeInTheDocument();
      });

      expect(screen.queryByText("Manage Team")).not.toBeInTheDocument();
    });
  });

  describe("recent activity", () => {
    const userWithActivity: MockUser = {
      id: 1,
      email: "active@example.com",
      fullName: "Active User",
      role: "user",
      subscription: null,
      currentTeamId: null,
      currentTeam: null,
      effectiveSubscriptionTier: createMockTier("free", 0),
      emailVerified: true,
      mfaEnabled: false,
      avatarUrl: null,
    };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: userWithActivity,
        isLoading: false,
      });

      mockApiGet.mockResolvedValue({
        data: {
          ...mockStats,
          recentActivity: [
            {
              method: "password",
              success: true,
              ipAddress: "127.0.0.1",
              createdAt: "2025-12-15T10:00:00.000Z",
            },
            {
              method: "google",
              success: true,
              ipAddress: "192.168.1.1",
              createdAt: "2025-12-14T09:00:00.000Z",
            },
          ],
        },
      });
    });

    it("displays recent activity section", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Recent Activity")).toBeInTheDocument();
        expect(screen.getByText("Your latest login attempts")).toBeInTheDocument();
      });
    });

    it("displays login methods", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("password")).toBeInTheDocument();
        expect(screen.getByText("google")).toBeInTheDocument();
      });
    });
  });
});
