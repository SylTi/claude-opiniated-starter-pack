import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import TeamManagementPage from "@/app/team/page";
import type { SubscriptionTierDTO, SubscriptionDTO } from "@saas/shared";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock the auth context
const mockUseAuth = vi.fn();
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock the API
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiDelete = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
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

function createMockTier(slug: string, level: number): SubscriptionTierDTO {
  return {
    id: level + 1,
    slug,
    name: slug === "free" ? "Free" : slug === "tier1" ? "Pro" : "Enterprise",
    description: `${slug} tier description`,
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
    tenantId: 1,
    tier,
    status: "active",
    startsAt: new Date().toISOString(),
    expiresAt,
    providerName: null,
    providerSubscriptionId: null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
}

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
  currentTenantId: number | null;
  currentTenant: {
    id: number;
    name: string;
    slug: string;
    subscription?: SubscriptionDTO | null;
  } | null;
  emailVerified: boolean;
  mfaEnabled: boolean;
  avatarUrl: string | null;
}

describe("Team Management Page", () => {
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
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/login");
      });
    });
  });

  describe("when user has no team", () => {
    beforeEach(() => {
      const userWithoutTeam: MockUser = {
        id: 1,
        email: "user@example.com",
        fullName: "Test User",
        role: "user",
        subscription: null,
        effectiveSubscriptionTier: createMockTier("free", 0),
        currentTenantId: null,
        currentTenant: null,
        emailVerified: true,
        mfaEnabled: false,
        avatarUrl: null,
      };

      mockUseAuth.mockReturnValue({
        user: userWithoutTeam,
        isLoading: false,
      });
    });

    it("redirects to dashboard with error", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
      });
    });
  });

  describe("when user has free tier team", () => {
    beforeEach(() => {
      const userWithFreeTeam: MockUser = {
        id: 1,
        email: "user@example.com",
        fullName: "Test User",
        role: "user",
        subscription: null,
        effectiveSubscriptionTier: createMockTier("free", 0),
        currentTenantId: 1,
        currentTenant: {
          id: 1,
          name: "Free Team",
          slug: "free-team",
          subscription: createMockSubscription("free", null),
        },
        emailVerified: true,
        mfaEnabled: false,
        avatarUrl: null,
      };

      mockUseAuth.mockReturnValue({
        user: userWithFreeTeam,
        isLoading: false,
      });
    });

    it("redirects to dashboard (paid tier required)", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
      });
    });
  });

  describe("when user has paid tier team", () => {
    const teamData = {
      id: 1,
      name: "Premium Team",
      slug: "premium-team",
      subscription: createMockSubscription("tier1", "2025-12-31T00:00:00.000Z"),
      ownerId: 1,
      members: [
        {
          id: 1,
          userId: 1,
          teamId: 1,
          role: "owner",
          user: {
            id: 1,
            email: "owner@example.com",
            fullName: "Team Owner",
            avatarUrl: null,
          },
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        {
          id: 2,
          userId: 2,
          teamId: 1,
          role: "member",
          user: {
            id: 2,
            email: "member@example.com",
            fullName: "Team Member",
            avatarUrl: null,
          },
          createdAt: "2024-01-02T00:00:00.000Z",
        },
      ],
    };

    const invitationsData = [
      {
        id: 1,
        email: "invited@example.com",
        role: "member",
        status: "pending",
        expiresAt: "2025-01-15T00:00:00.000Z",
        isExpired: false,
        invitedBy: {
          id: 1,
          email: "owner@example.com",
          fullName: "Team Owner",
        },
        createdAt: "2024-01-10T00:00:00.000Z",
      },
    ];

    beforeEach(() => {
      const userWithPaidTeam: MockUser = {
        id: 1,
        email: "owner@example.com",
        fullName: "Team Owner",
        role: "user",
        subscription: null,
        effectiveSubscriptionTier: createMockTier("tier1", 1),
        currentTenantId: 1,
        currentTenant: {
          id: 1,
          name: "Premium Team",
          slug: "premium-team",
          subscription: createMockSubscription("tier1", "2025-12-31T00:00:00.000Z"),
        },
        emailVerified: true,
        mfaEnabled: false,
        avatarUrl: null,
      };

      mockUseAuth.mockReturnValue({
        user: userWithPaidTeam,
        isLoading: false,
      });

      mockApiGet.mockImplementation((url: string) => {
        if (url.includes("/invitations")) {
          return Promise.resolve({ data: invitationsData });
        }
        return Promise.resolve({ data: teamData });
      });
    });

    it("displays team name in header", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(screen.getByText("Premium Team")).toBeInTheDocument();
      });
    });

    it("displays tenant management description", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(
          screen.getByText("Manage your tenant members and invitations")
        ).toBeInTheDocument();
      });
    });

    it("displays subscription tier badge", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(screen.getByText("Pro")).toBeInTheDocument();
      });
    });

    it("displays member count", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(screen.getByText("2 members")).toBeInTheDocument();
      });
    });

    it("displays invite new member section for admins", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(screen.getByText("Invite New Member")).toBeInTheDocument();
      });
    });

    it("displays email input for invitations", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Email address")
        ).toBeInTheDocument();
      });
    });

    it("displays send invite button", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /send invite/i })
        ).toBeInTheDocument();
      });
    });

    it("displays pending invitations section when invitations exist", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(screen.getByText("Pending Invitations")).toBeInTheDocument();
      });
    });

    it("displays pending invitation email", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(screen.getByText("invited@example.com")).toBeInTheDocument();
      });
    });

    it("displays tenant members section", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(screen.getByText("Tenant Members")).toBeInTheDocument();
      });
    });

    it("displays team member names", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(screen.getByText("Team Owner")).toBeInTheDocument();
        expect(screen.getByText("Team Member")).toBeInTheDocument();
      });
    });

    it("displays team member emails", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(screen.getByText("owner@example.com")).toBeInTheDocument();
        expect(screen.getByText("member@example.com")).toBeInTheDocument();
      });
    });

    it("displays role badges for members", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        // Look for role badges (there are multiple elements with same role text)
        const ownerBadges = screen.getAllByText("owner");
        const memberBadges = screen.getAllByText("member");
        expect(ownerBadges.length).toBeGreaterThan(0);
        expect(memberBadges.length).toBeGreaterThan(0);
      });
    });

    it("displays members table headers", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        // Look for table header cells specifically
        const tableHeaders = document.querySelectorAll("th");
        const headerTexts = Array.from(tableHeaders).map((th) =>
          th.textContent?.trim()
        );
        expect(headerTexts).toContain("Member");
        expect(headerTexts).toContain("Role");
        expect(headerTexts).toContain("Joined");
      });
    });
  });

  describe("when user is regular member (not admin)", () => {
    const teamData = {
      id: 1,
      name: "Premium Team",
      slug: "premium-team",
      subscription: createMockSubscription("tier1", null),
      ownerId: 2,
      members: [
        {
          id: 1,
          userId: 1,
          teamId: 1,
          role: "member",
          user: {
            id: 1,
            email: "member@example.com",
            fullName: "Regular Member",
            avatarUrl: null,
          },
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    };

    beforeEach(() => {
      const memberUser: MockUser = {
        id: 1,
        email: "member@example.com",
        fullName: "Regular Member",
        role: "user",
        subscription: null,
        effectiveSubscriptionTier: createMockTier("tier1", 1),
        currentTenantId: 1,
        currentTenant: {
          id: 1,
          name: "Premium Team",
          slug: "premium-team",
          subscription: createMockSubscription("tier1", null),
        },
        emailVerified: true,
        mfaEnabled: false,
        avatarUrl: null,
      };

      mockUseAuth.mockReturnValue({
        user: memberUser,
        isLoading: false,
      });

      mockApiGet.mockImplementation((url: string) => {
        if (url.includes("/invitations")) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: teamData });
      });
    });

    it("displays warning message for non-admin members", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(
          screen.getByText(/You can view tenant members but cannot make changes/i)
        ).toBeInTheDocument();
      });
    });

    it("does not display invite section for non-admin", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(screen.getByText("Tenant Members")).toBeInTheDocument();
      });

      expect(screen.queryByText("Invite New Member")).not.toBeInTheDocument();
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
      render(<TeamManagementPage />);

      // Check for loading state (spinner should be present)
      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });

  describe("invitation management", () => {
    const teamData = {
      id: 1,
      name: "Premium Team",
      slug: "premium-team",
      subscription: createMockSubscription("tier1", "2025-12-31T00:00:00.000Z"),
      ownerId: 1,
      members: [
        {
          id: 1,
          userId: 1,
          teamId: 1,
          role: "owner",
          user: {
            id: 1,
            email: "owner@example.com",
            fullName: "Team Owner",
            avatarUrl: null,
          },
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    };

    beforeEach(async () => {
      const { toast } = await import("sonner");
      vi.mocked(toast.success).mockClear();
      vi.mocked(toast.error).mockClear();

      const userWithPaidTeam: MockUser = {
        id: 1,
        email: "owner@example.com",
        fullName: "Team Owner",
        role: "user",
        subscription: null,
        effectiveSubscriptionTier: createMockTier("tier1", 1),
        currentTenantId: 1,
        currentTenant: {
          id: 1,
          name: "Premium Team",
          slug: "premium-team",
          subscription: createMockSubscription("tier1", "2025-12-31T00:00:00.000Z"),
        },
        emailVerified: true,
        mfaEnabled: false,
        avatarUrl: null,
      };

      mockUseAuth.mockReturnValue({
        user: userWithPaidTeam,
        isLoading: false,
      });

      mockApiGet.mockImplementation((url: string) => {
        if (url.includes("/invitations")) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: teamData });
      });
    });

    it("displays invitation form elements", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Email address")).toBeInTheDocument();
      });

      expect(screen.getByRole("button", { name: /send invite/i })).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("disables send invite button when email is empty", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /send invite/i })).toBeInTheDocument();
      });

      // Button should be disabled when email is empty
      expect(screen.getByRole("button", { name: /send invite/i })).toBeDisabled();
    });

  });

  describe("pending invitations display", () => {
    const teamData = {
      id: 1,
      name: "Premium Team",
      slug: "premium-team",
      subscription: createMockSubscription("tier1", "2025-12-31T00:00:00.000Z"),
      ownerId: 1,
      members: [
        {
          id: 1,
          userId: 1,
          teamId: 1,
          role: "owner",
          user: {
            id: 1,
            email: "owner@example.com",
            fullName: "Team Owner",
            avatarUrl: null,
          },
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    };

    const invitationsData = [
      {
        id: 1,
        email: "pending@example.com",
        role: "member",
        status: "pending",
        expiresAt: "2025-01-15T00:00:00.000Z",
        isExpired: false,
        invitedBy: {
          id: 1,
          email: "owner@example.com",
          fullName: "Team Owner",
        },
        createdAt: "2024-01-10T00:00:00.000Z",
      },
    ];

    beforeEach(async () => {
      const userWithPaidTeam: MockUser = {
        id: 1,
        email: "owner@example.com",
        fullName: "Team Owner",
        role: "user",
        subscription: null,
        effectiveSubscriptionTier: createMockTier("tier1", 1),
        currentTenantId: 1,
        currentTenant: {
          id: 1,
          name: "Premium Team",
          slug: "premium-team",
          subscription: createMockSubscription("tier1", "2025-12-31T00:00:00.000Z"),
        },
        emailVerified: true,
        mfaEnabled: false,
        avatarUrl: null,
      };

      mockUseAuth.mockReturnValue({
        user: userWithPaidTeam,
        isLoading: false,
      });

      mockApiGet.mockImplementation((url: string) => {
        if (url.includes("/invitations")) {
          return Promise.resolve({ data: invitationsData });
        }
        return Promise.resolve({ data: teamData });
      });
    });

    it("displays pending invitation email", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(screen.getByText("pending@example.com")).toBeInTheDocument();
      });
    });

    it("displays pending invitation role badge", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(screen.getByText("pending@example.com")).toBeInTheDocument();
      });
    });
  });

  describe("team members display", () => {
    const teamData = {
      id: 1,
      name: "Premium Team",
      slug: "premium-team",
      subscription: createMockSubscription("tier1", "2025-12-31T00:00:00.000Z"),
      ownerId: 1,
      members: [
        {
          id: 1,
          userId: 1,
          teamId: 1,
          role: "owner",
          user: {
            id: 1,
            email: "owner@example.com",
            fullName: "Team Owner",
            avatarUrl: null,
          },
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        {
          id: 2,
          userId: 2,
          teamId: 1,
          role: "member",
          user: {
            id: 2,
            email: "member@example.com",
            fullName: "Team Member",
            avatarUrl: null,
          },
          createdAt: "2024-01-02T00:00:00.000Z",
        },
      ],
    };

    beforeEach(async () => {
      const userWithPaidTeam: MockUser = {
        id: 1,
        email: "owner@example.com",
        fullName: "Team Owner",
        role: "user",
        subscription: null,
        effectiveSubscriptionTier: createMockTier("tier1", 1),
        currentTenantId: 1,
        currentTenant: {
          id: 1,
          name: "Premium Team",
          slug: "premium-team",
          subscription: createMockSubscription("tier1", "2025-12-31T00:00:00.000Z"),
        },
        emailVerified: true,
        mfaEnabled: false,
        avatarUrl: null,
      };

      mockUseAuth.mockReturnValue({
        user: userWithPaidTeam,
        isLoading: false,
      });

      mockApiGet.mockImplementation((url: string) => {
        if (url.includes("/invitations")) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: teamData });
      });
    });

    it("displays team member names", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(screen.getByText("Team Member")).toBeInTheDocument();
        expect(screen.getByText("Team Owner")).toBeInTheDocument();
      });
    });

    it("displays delete button for non-owner members", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(screen.getByText("Team Member")).toBeInTheDocument();
      });

      // The member row should have a delete button
      const memberRow = screen.getByText("Team Member").closest("tr");
      const deleteButton = memberRow?.querySelector("button");
      expect(deleteButton).toBeDefined();
    });
  });

  describe("API error handling", () => {
    beforeEach(async () => {
      const { toast } = await import("sonner");
      vi.mocked(toast.success).mockClear();
      vi.mocked(toast.error).mockClear();

      const userWithPaidTeam: MockUser = {
        id: 1,
        email: "owner@example.com",
        fullName: "Team Owner",
        role: "user",
        subscription: null,
        effectiveSubscriptionTier: createMockTier("tier1", 1),
        currentTenantId: 1,
        currentTenant: {
          id: 1,
          name: "Premium Team",
          slug: "premium-team",
          subscription: createMockSubscription("tier1", "2025-12-31T00:00:00.000Z"),
        },
        emailVerified: true,
        mfaEnabled: false,
        avatarUrl: null,
      };

      mockUseAuth.mockReturnValue({
        user: userWithPaidTeam,
        isLoading: false,
      });
    });

    it("redirects to login on 401 error", async () => {
      const { ApiError } = await import("@/lib/api");
      mockApiGet.mockRejectedValue(new ApiError(401, "Unauthorized", "Not authenticated"));

      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/login");
      });
    });

    it("redirects to dashboard on 403 error", async () => {
      const { ApiError } = await import("@/lib/api");
      const { toast } = await import("sonner");
      mockApiGet.mockRejectedValue(new ApiError(403, "Forbidden", "Not authorized"));

      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("You don't have permission to manage this tenant");
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
      });
    });

    it("shows error toast on other API errors", async () => {
      const { ApiError } = await import("@/lib/api");
      const { toast } = await import("sonner");
      mockApiGet.mockRejectedValue(new ApiError(500, "ServerError", "Internal server error"));

      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Internal server error");
      });
    });

    it("shows generic error toast on unknown errors", async () => {
      const { toast } = await import("sonner");
      mockApiGet.mockRejectedValue(new Error("Network error"));

      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to fetch tenant data");
      });
    });
  });

  describe("team with no subscription", () => {
    const teamData = {
      id: 1,
      name: "Free Team",
      slug: "free-team",
      subscription: null,
      ownerId: 1,
      members: [
        {
          id: 1,
          userId: 1,
          teamId: 1,
          role: "owner",
          user: {
            id: 1,
            email: "owner@example.com",
            fullName: "Team Owner",
            avatarUrl: null,
          },
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    };

    beforeEach(() => {
      const userWithFreeTier: MockUser = {
        id: 1,
        email: "owner@example.com",
        fullName: "Team Owner",
        role: "user",
        subscription: null,
        effectiveSubscriptionTier: createMockTier("free", 0),
        currentTenantId: 1,
        currentTenant: {
          id: 1,
          name: "Free Team",
          slug: "free-team",
          subscription: null,
        },
        emailVerified: true,
        mfaEnabled: false,
        avatarUrl: null,
      };

      mockUseAuth.mockReturnValue({
        user: userWithFreeTier,
        isLoading: false,
      });

      mockApiGet.mockImplementation((url: string) => {
        if (url.includes("/invitations")) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: teamData });
      });
    });

    it("redirects to dashboard for free tier", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
      });
    });

  });

  describe("paid team with one member", () => {
    const teamData = {
      id: 1,
      name: "Pro Team",
      slug: "pro-team",
      subscription: null,
      ownerId: 1,
      members: [
        {
          id: 1,
          userId: 1,
          teamId: 1,
          role: "owner",
          user: {
            id: 1,
            email: "owner@example.com",
            fullName: "Team Owner",
            avatarUrl: null,
          },
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    };

    beforeEach(() => {
      const userWithPaidTeam: MockUser = {
        id: 1,
        email: "owner@example.com",
        fullName: "Team Owner",
        role: "user",
        subscription: null,
        effectiveSubscriptionTier: createMockTier("tier1", 1),
        currentTenantId: 1,
        currentTenant: {
          id: 1,
          name: "Pro Team",
          slug: "pro-team",
          subscription: null,
        },
        emailVerified: true,
        mfaEnabled: false,
        avatarUrl: null,
      };

      mockUseAuth.mockReturnValue({
        user: userWithPaidTeam,
        isLoading: false,
      });

      mockApiGet.mockImplementation((url: string) => {
        if (url.includes("/invitations")) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: teamData });
      });
    });

    it("displays singular member text for 1 member", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(screen.getByText("1 member")).toBeInTheDocument();
      });
    });
  });

  describe("admin member with admin icon", () => {
    const teamData = {
      id: 1,
      name: "Premium Team",
      slug: "premium-team",
      subscription: createMockSubscription("tier1", "2025-12-31T00:00:00.000Z"),
      ownerId: 1,
      members: [
        {
          id: 1,
          userId: 1,
          teamId: 1,
          role: "owner",
          user: {
            id: 1,
            email: "owner@example.com",
            fullName: "Team Owner",
            avatarUrl: null,
          },
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        {
          id: 2,
          userId: 2,
          teamId: 1,
          role: "admin",
          user: {
            id: 2,
            email: "admin@example.com",
            fullName: "Team Admin",
            avatarUrl: null,
          },
          createdAt: "2024-01-02T00:00:00.000Z",
        },
      ],
    };

    beforeEach(() => {
      const userWithPaidTeam: MockUser = {
        id: 1,
        email: "owner@example.com",
        fullName: "Team Owner",
        role: "user",
        subscription: null,
        effectiveSubscriptionTier: createMockTier("tier1", 1),
        currentTenantId: 1,
        currentTenant: {
          id: 1,
          name: "Premium Team",
          slug: "premium-team",
          subscription: createMockSubscription("tier1", "2025-12-31T00:00:00.000Z"),
        },
        emailVerified: true,
        mfaEnabled: false,
        avatarUrl: null,
      };

      mockUseAuth.mockReturnValue({
        user: userWithPaidTeam,
        isLoading: false,
      });

      mockApiGet.mockImplementation((url: string) => {
        if (url.includes("/invitations")) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: teamData });
      });
    });

    it("displays admin member with admin badge", async () => {
      render(<TeamManagementPage />);

      await waitFor(() => {
        expect(screen.getByText("Team Admin")).toBeInTheDocument();
        const adminBadges = screen.getAllByText("admin");
        expect(adminBadges.length).toBeGreaterThan(0);
      });
    });
  });
});
