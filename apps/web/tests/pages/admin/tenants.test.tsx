import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminTenantsPage from "@/app/admin/tenants/page";
import type { AdminTenantDTO, SubscriptionTierDTO } from "@saas/shared";

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
const mockAdminTenantsList = vi.fn();
const mockAdminTenantsUpdateTier = vi.fn();
const mockAdminBillingListTiers = vi.fn();
vi.mock("@/lib/api", () => ({
  adminTenantsApi: {
    list: (...args: unknown[]) => mockAdminTenantsList(...args),
    updateTier: (...args: unknown[]) => mockAdminTenantsUpdateTier(...args),
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

const mockTenants: AdminTenantDTO[] = [
  {
    id: 1,
    name: "Alpha Team",
    slug: "alpha-team",
    type: "team",
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
    name: "Personal Workspace",
    slug: "personal-user",
    type: "personal",
    subscriptionTier: "free",
    subscriptionExpiresAt: null,
    ownerId: 2,
    ownerEmail: "user@example.com",
    memberCount: 1,
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

describe("Admin Tenants Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminBillingListTiers.mockResolvedValue(mockTiers);
  });

  describe("loading state", () => {
    it("shows loading skeleton while fetching tenants", () => {
      mockAdminTenantsList.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );
      render(<AdminTenantsPage />);

      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("when tenants are loaded", () => {
    beforeEach(() => {
      mockAdminTenantsList.mockResolvedValue(mockTenants);
    });

    it("displays page title", async () => {
      render(<AdminTenantsPage />);

      await waitFor(() => {
        expect(screen.getByText("Tenant Management")).toBeInTheDocument();
      });
    });

    it("displays page description", async () => {
      render(<AdminTenantsPage />);

      await waitFor(() => {
        expect(
          screen.getByText(/View and manage all tenants/i),
        ).toBeInTheDocument();
      });
    });

    it("displays tenants table headers including Type", async () => {
      render(<AdminTenantsPage />);

      await waitFor(() => {
        expect(screen.getByText("ID")).toBeInTheDocument();
        expect(screen.getByText("Name")).toBeInTheDocument();
        expect(screen.getByText("Type")).toBeInTheDocument();
        expect(screen.getByText("Slug")).toBeInTheDocument();
        expect(screen.getByText("Owner")).toBeInTheDocument();
        expect(screen.getByText("Members")).toBeInTheDocument();
        expect(screen.getByText("Subscription")).toBeInTheDocument();
        expect(screen.getByText("Balance")).toBeInTheDocument();
        expect(screen.getByText("Expires")).toBeInTheDocument();
        expect(screen.getByText("Created")).toBeInTheDocument();
      });
    });

    it("displays tenant names", async () => {
      render(<AdminTenantsPage />);

      await waitFor(() => {
        expect(screen.getByText("Alpha Team")).toBeInTheDocument();
        expect(screen.getByText("Personal Workspace")).toBeInTheDocument();
      });
    });

    it("displays tenant types", async () => {
      render(<AdminTenantsPage />);

      await waitFor(() => {
        expect(screen.getByText("team")).toBeInTheDocument();
        expect(screen.getByText("personal")).toBeInTheDocument();
      });
    });

    it("displays tenant slugs", async () => {
      render(<AdminTenantsPage />);

      await waitFor(() => {
        expect(screen.getByText("alpha-team")).toBeInTheDocument();
        expect(screen.getByText("personal-user")).toBeInTheDocument();
      });
    });

    it("displays owner emails", async () => {
      render(<AdminTenantsPage />);

      await waitFor(() => {
        expect(screen.getByText("owner@alpha.com")).toBeInTheDocument();
        expect(screen.getByText("user@example.com")).toBeInTheDocument();
      });
    });

    it("displays subscription tier selects for each tenant", async () => {
      render(<AdminTenantsPage />);

      await waitFor(() => {
        expect(screen.getByText("Alpha Team")).toBeInTheDocument();
      });

      const selectTriggers = screen.getAllByRole("combobox");
      expect(selectTriggers.length).toBe(2);
    });

    it("displays current tier values in selects", async () => {
      render(<AdminTenantsPage />);

      await waitFor(() => {
        expect(screen.getByText("Alpha Team")).toBeInTheDocument();
      });

      expect(screen.getByText("Enterprise")).toBeInTheDocument();
      expect(screen.getByText("Free")).toBeInTheDocument();
    });

    it("displays balance for tenants with positive balance", async () => {
      render(<AdminTenantsPage />);

      await waitFor(() => {
        expect(screen.getByText("$50.00")).toBeInTheDocument();
      });
    });
  });

  describe("empty state", () => {
    beforeEach(() => {
      mockAdminTenantsList.mockResolvedValue([]);
    });

    it("shows no tenants message when list is empty", async () => {
      render(<AdminTenantsPage />);

      await waitFor(() => {
        expect(screen.getByText("No tenants found")).toBeInTheDocument();
      });
    });
  });

  describe("tier update", () => {
    beforeEach(() => {
      mockAdminTenantsList.mockResolvedValue(mockTenants);
      mockAdminTenantsUpdateTier.mockResolvedValue({});
    });

    it("calls update tier API when tier is changed", async () => {
      const user = userEvent.setup();
      render(<AdminTenantsPage />);

      await waitFor(() => {
        expect(screen.getByText("Alpha Team")).toBeInTheDocument();
      });

      // Click on the first select (Alpha Team)
      const selectTriggers = screen.getAllByRole("combobox");
      await user.click(selectTriggers[0]);

      // Select "Pro" tier
      await user.click(screen.getByRole("option", { name: /Pro/i }));

      await waitFor(() => {
        expect(mockAdminTenantsUpdateTier).toHaveBeenCalledWith(1, {
          subscriptionTier: "tier1",
        });
      });
    });

    it("shows success toast after updating tier", async () => {
      const { toast } = await import("sonner");
      const user = userEvent.setup();
      render(<AdminTenantsPage />);

      await waitFor(() => {
        expect(screen.getByText("Alpha Team")).toBeInTheDocument();
      });

      const selectTriggers = screen.getAllByRole("combobox");
      await user.click(selectTriggers[0]);
      await user.click(screen.getByRole("option", { name: /Pro/i }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "Tenant subscription tier updated successfully",
        );
      });
    });

    it("shows error toast when update fails with ApiError", async () => {
      const { ApiError } = await import("@/lib/api");
      const { toast } = await import("sonner");
      mockAdminTenantsUpdateTier.mockRejectedValue(
        new ApiError(400, "ValidationError", "Invalid tier"),
      );
      const user = userEvent.setup();
      render(<AdminTenantsPage />);

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
      mockAdminTenantsUpdateTier.mockRejectedValue(new Error("Network error"));
      const user = userEvent.setup();
      render(<AdminTenantsPage />);

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
      mockAdminTenantsList.mockRejectedValue(
        new ApiError(401, "Unauthorized", "Unauthorized"),
      );
      render(<AdminTenantsPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
      });
    });

    it("redirects on forbidden error", async () => {
      const { ApiError } = await import("@/lib/api");
      mockAdminTenantsList.mockRejectedValue(
        new ApiError(403, "Forbidden", "Forbidden"),
      );
      render(<AdminTenantsPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
      });
    });

    it("shows error toast on API failure", async () => {
      const { ApiError } = await import("@/lib/api");
      const { toast } = await import("sonner");
      mockAdminTenantsList.mockRejectedValue(
        new ApiError(500, "ServerError", "Server error"),
      );
      render(<AdminTenantsPage />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Server error");
      });
    });

    it("shows generic error toast on unknown error", async () => {
      const { toast } = await import("sonner");
      mockAdminTenantsList.mockRejectedValue(new Error("Network error"));
      render(<AdminTenantsPage />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to fetch tenants");
      });
    });
  });

  describe("tenant with null owner", () => {
    it("displays dash for null ownerEmail", async () => {
      const tenantsWithNullOwner: AdminTenantDTO[] = [
        {
          ...mockTenants[0],
          ownerEmail: null,
        },
      ];
      mockAdminTenantsList.mockResolvedValue(tenantsWithNullOwner);
      render(<AdminTenantsPage />);

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
});
