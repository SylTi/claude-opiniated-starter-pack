import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminTeamsPage from "@/app/admin/teams/page";
import type { AdminTeamDTO, SubscriptionTierDTO } from "@saas/shared";

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

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock the API
const mockAdminTeamsList = vi.fn();
const mockAdminTeamsUpdateTier = vi.fn();
const mockAdminBillingListTiers = vi.fn();
vi.mock("@/lib/api", () => ({
  adminTeamsApi: {
    list: (...args: unknown[]) => mockAdminTeamsList(...args),
    updateTier: (...args: unknown[]) => mockAdminTeamsUpdateTier(...args),
  },
  adminBillingApi: {
    listTiers: (...args: unknown[]) => mockAdminBillingListTiers(...args),
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

const mockTeams: AdminTeamDTO[] = [
  {
    id: 1,
    name: "Alpha Team",
    slug: "alpha-team",
    subscriptionTier: "tier2",
    subscriptionExpiresAt: "2025-12-31T00:00:00.000Z",
    ownerId: 1,
    ownerEmail: "owner@alpha.com",
    memberCount: 5,
    balance: 5000,
    balanceCurrency: "usd",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: null,
  },
  {
    id: 2,
    name: "Beta Team",
    slug: "beta-team",
    subscriptionTier: "free",
    subscriptionExpiresAt: null,
    ownerId: 2,
    ownerEmail: "owner@beta.com",
    memberCount: 2,
    balance: 0,
    balanceCurrency: "usd",
    createdAt: "2024-02-01T00:00:00.000Z",
    updatedAt: null,
  },
];

const mockTiers = [
  createMockTier("free", 0),
  createMockTier("tier1", 1),
  createMockTier("tier2", 2),
];

describe("Admin Teams Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminBillingListTiers.mockResolvedValue(mockTiers);
  });

  describe("loading state", () => {
    it("shows loading skeleton while fetching teams", () => {
      mockAdminTeamsList.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );
      render(<AdminTeamsPage />);

      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("when teams are loaded", () => {
    beforeEach(() => {
      mockAdminTeamsList.mockResolvedValue(mockTeams);
    });

    it("displays page title", async () => {
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(screen.getByText("Team Management")).toBeInTheDocument();
      });
    });

    it("displays page description", async () => {
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(
          screen.getByText(/View and manage all teams/i),
        ).toBeInTheDocument();
      });
    });

    it("displays teams table headers", async () => {
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(screen.getByText("ID")).toBeInTheDocument();
        expect(screen.getByText("Name")).toBeInTheDocument();
        expect(screen.getByText("Slug")).toBeInTheDocument();
        expect(screen.getByText("Owner")).toBeInTheDocument();
        expect(screen.getByText("Members")).toBeInTheDocument();
        expect(screen.getByText("Subscription")).toBeInTheDocument();
        expect(screen.getByText("Balance")).toBeInTheDocument();
        expect(screen.getByText("Expires")).toBeInTheDocument();
        expect(screen.getByText("Created")).toBeInTheDocument();
      });
    });

    it("displays team names", async () => {
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(screen.getByText("Alpha Team")).toBeInTheDocument();
        expect(screen.getByText("Beta Team")).toBeInTheDocument();
      });
    });

    it("displays team slugs", async () => {
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(screen.getByText("alpha-team")).toBeInTheDocument();
        expect(screen.getByText("beta-team")).toBeInTheDocument();
      });
    });

    it("displays owner emails", async () => {
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(screen.getByText("owner@alpha.com")).toBeInTheDocument();
        expect(screen.getByText("owner@beta.com")).toBeInTheDocument();
      });
    });

    it("displays member counts", async () => {
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(screen.getByText("Alpha Team")).toBeInTheDocument();
      });

      // Member counts are displayed in badges - use getAllByText since "2" appears as both team ID and member count
      const fiveElements = screen.getAllByText("5");
      expect(fiveElements.length).toBeGreaterThanOrEqual(1);

      const twoElements = screen.getAllByText("2");
      expect(twoElements.length).toBeGreaterThanOrEqual(1);
    });

    it("displays subscription tier selects for each team", async () => {
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(screen.getByText("Alpha Team")).toBeInTheDocument();
      });

      const selectTriggers = screen.getAllByRole("combobox");
      expect(selectTriggers.length).toBe(2);
    });

    it("displays current tier values in selects", async () => {
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(screen.getByText("Alpha Team")).toBeInTheDocument();
      });

      expect(screen.getByText("Enterprise")).toBeInTheDocument();
      expect(screen.getByText("Free")).toBeInTheDocument();
    });

    it("displays balance for teams with positive balance", async () => {
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(screen.getByText("$50.00")).toBeInTheDocument();
      });
    });

    it("displays dash for teams with zero balance", async () => {
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(screen.getByText("Alpha Team")).toBeInTheDocument();
      });

      // Beta team has 0 balance, should show "-"
      const cells = document.querySelectorAll("td");
      const dashCells = Array.from(cells).filter(
        (cell) => cell.textContent === "-",
      );
      expect(dashCells.length).toBeGreaterThan(0);
    });

    it("displays expiration dates", async () => {
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Dec.*2025/)).toBeInTheDocument();
      });
    });

    it("displays creation dates", async () => {
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Jan.*2024/)).toBeInTheDocument();
        expect(screen.getByText(/Feb.*2024/)).toBeInTheDocument();
      });
    });
  });

  describe("empty state", () => {
    beforeEach(() => {
      mockAdminTeamsList.mockResolvedValue([]);
    });

    it("shows no teams message when list is empty", async () => {
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(screen.getByText("No teams found")).toBeInTheDocument();
      });
    });
  });

  describe("tier update", () => {
    beforeEach(() => {
      mockAdminTeamsList.mockResolvedValue(mockTeams);
      mockAdminTeamsUpdateTier.mockResolvedValue({});
    });

    it("calls update tier API when tier is changed", async () => {
      const user = userEvent.setup();
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(screen.getByText("Alpha Team")).toBeInTheDocument();
      });

      // Click on the first select (Alpha Team)
      const selectTriggers = screen.getAllByRole("combobox");
      await user.click(selectTriggers[0]);

      // Select "Pro" tier
      await user.click(screen.getByRole("option", { name: /Pro/i }));

      await waitFor(() => {
        expect(mockAdminTeamsUpdateTier).toHaveBeenCalledWith(1, {
          subscriptionTier: "tier1",
        });
      });
    });

    it("shows success toast after updating tier", async () => {
      const { toast } = await import("sonner");
      const user = userEvent.setup();
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(screen.getByText("Alpha Team")).toBeInTheDocument();
      });

      const selectTriggers = screen.getAllByRole("combobox");
      await user.click(selectTriggers[0]);
      await user.click(screen.getByRole("option", { name: /Pro/i }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "Team subscription tier updated successfully",
        );
      });
    });

    it("shows error toast when update fails with ApiError", async () => {
      const { ApiError } = await import("@/lib/api");
      const { toast } = await import("sonner");
      mockAdminTeamsUpdateTier.mockRejectedValue(
        new ApiError(400, "ValidationError", "Invalid tier"),
      );
      const user = userEvent.setup();
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(screen.getByText("Alpha Team")).toBeInTheDocument();
      });

      const selectTriggers = screen.getAllByRole("combobox");
      await user.click(selectTriggers[0]);
      await user.click(screen.getByRole("option", { name: /Pro/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Invalid tier");
      });
    });

    it("shows generic error toast when update fails with unknown error", async () => {
      const { toast } = await import("sonner");
      mockAdminTeamsUpdateTier.mockRejectedValue(new Error("Network error"));
      const user = userEvent.setup();
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(screen.getByText("Alpha Team")).toBeInTheDocument();
      });

      const selectTriggers = screen.getAllByRole("combobox");
      await user.click(selectTriggers[0]);
      await user.click(screen.getByRole("option", { name: /Pro/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Failed to update subscription tier",
        );
      });
    });
  });

  describe("error handling", () => {
    it("redirects on unauthorized error", async () => {
      const { ApiError } = await import("@/lib/api");
      mockAdminTeamsList.mockRejectedValue(
        new ApiError(401, "Unauthorized", "Unauthorized"),
      );
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
      });
    });

    it("redirects on forbidden error", async () => {
      const { ApiError } = await import("@/lib/api");
      mockAdminTeamsList.mockRejectedValue(
        new ApiError(403, "Forbidden", "Forbidden"),
      );
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
      });
    });

    it("shows error toast on API failure", async () => {
      const { ApiError } = await import("@/lib/api");
      const { toast } = await import("sonner");
      mockAdminTeamsList.mockRejectedValue(
        new ApiError(500, "ServerError", "Server error"),
      );
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Server error");
      });
    });

    it("shows generic error toast on unknown error", async () => {
      const { toast } = await import("sonner");
      mockAdminTeamsList.mockRejectedValue(new Error("Network error"));
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to fetch teams");
      });
    });
  });

  describe("tier badge variants", () => {
    beforeEach(() => {
      mockAdminTeamsList.mockResolvedValue(mockTeams);
    });

    it("displays tier1 teams with secondary badge variant", async () => {
      const teamsWithTier1: AdminTeamDTO[] = [
        {
          ...mockTeams[0],
          subscriptionTier: "tier1",
        },
      ];
      mockAdminTeamsList.mockResolvedValue(teamsWithTier1);
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(screen.getByText("Alpha Team")).toBeInTheDocument();
      });

      expect(screen.getByText("Pro")).toBeInTheDocument();
    });
  });

  describe("team with null owner", () => {
    it("displays dash for null ownerEmail", async () => {
      const teamsWithNullOwner: AdminTeamDTO[] = [
        {
          ...mockTeams[0],
          ownerEmail: null,
        },
      ];
      mockAdminTeamsList.mockResolvedValue(teamsWithNullOwner);
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(screen.getByText("Alpha Team")).toBeInTheDocument();
      });

      const cells = document.querySelectorAll("td");
      const dashCells = Array.from(cells).filter(
        (cell) => cell.textContent === "-",
      );
      expect(dashCells.length).toBeGreaterThan(0);
    });
  });

  describe("date formatting", () => {
    beforeEach(() => {
      mockAdminTeamsList.mockResolvedValue(mockTeams);
    });

    it("displays dash for null subscription expiration", async () => {
      render(<AdminTeamsPage />);

      await waitFor(() => {
        expect(screen.getByText("Alpha Team")).toBeInTheDocument();
      });

      // Beta team has null subscriptionExpiresAt
      const cells = document.querySelectorAll("td");
      const dashCells = Array.from(cells).filter(
        (cell) => cell.textContent === "-",
      );
      expect(dashCells.length).toBeGreaterThan(0);
    });
  });
});
