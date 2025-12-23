import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AdminDashboardPage from "@/app/admin/dashboard/page";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
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

const mockStats = {
  totalUsers: 150,
  verifiedUsers: 120,
  mfaEnabledUsers: 45,
  newUsersThisMonth: 25,
  activeUsersThisWeek: 80,
  usersByRole: [
    { role: "admin", count: 3 },
    { role: "user", count: 145 },
    { role: "guest", count: 2 },
  ],
};

describe("Admin Dashboard Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loading state", () => {
    it("shows loading skeleton while fetching data", () => {
      mockApiGet.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      render(<AdminDashboardPage />);

      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("shows error message when stats fail to load", async () => {
      mockApiGet.mockResolvedValue({ data: null });
      render(<AdminDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load statistics/i)).toBeInTheDocument();
      });
    });

    it("redirects on unauthorized error", async () => {
      const { ApiError } = await import("@/lib/api");
      mockApiGet.mockRejectedValue(new ApiError(401, "Unauthorized", "Unauthorized"));
      render(<AdminDashboardPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
      });
    });

    it("redirects on forbidden error", async () => {
      const { ApiError } = await import("@/lib/api");
      mockApiGet.mockRejectedValue(new ApiError(403, "Forbidden", "Forbidden"));
      render(<AdminDashboardPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
      });
    });
  });

  describe("when stats are loaded", () => {
    beforeEach(() => {
      mockApiGet.mockResolvedValue({ data: mockStats });
    });

    it("displays page title", async () => {
      render(<AdminDashboardPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /admin dashboard/i })
        ).toBeInTheDocument();
      });
    });

    it("displays total users count", async () => {
      render(<AdminDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Total Users")).toBeInTheDocument();
        expect(screen.getByText("150")).toBeInTheDocument();
      });
    });

    it("displays new users this month", async () => {
      render(<AdminDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("+25 this month")).toBeInTheDocument();
      });
    });

    it("displays verified users count", async () => {
      render(<AdminDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Verified Users")).toBeInTheDocument();
        expect(screen.getByText("120")).toBeInTheDocument();
      });
    });

    it("displays verification rate", async () => {
      render(<AdminDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("80% verification rate")).toBeInTheDocument();
      });
    });

    it("displays MFA enabled count", async () => {
      render(<AdminDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("MFA Enabled")).toBeInTheDocument();
        expect(screen.getByText("45")).toBeInTheDocument();
      });
    });

    it("displays MFA adoption rate", async () => {
      render(<AdminDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("30% adoption rate")).toBeInTheDocument();
      });
    });

    it("displays active users this week", async () => {
      render(<AdminDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Active This Week")).toBeInTheDocument();
        expect(screen.getByText("80")).toBeInTheDocument();
      });
    });

    it("displays users by role section", async () => {
      render(<AdminDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Users by Role")).toBeInTheDocument();
      });
    });

    it("displays role distribution", async () => {
      render(<AdminDashboardPage />);

      await waitFor(() => {
        // Check for role badges
        const adminBadges = screen.getAllByText("admin");
        expect(adminBadges.length).toBeGreaterThan(0);
        expect(screen.getByText("3")).toBeInTheDocument();
        expect(screen.getByText("145")).toBeInTheDocument();
      });
    });

    it("displays quick actions section", async () => {
      render(<AdminDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Quick Actions")).toBeInTheDocument();
      });
    });

    it("has link to manage users", async () => {
      render(<AdminDashboardPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("link", { name: /manage users/i })
        ).toHaveAttribute("href", "/admin/users");
      });
    });

    it("shows coming soon buttons as disabled", async () => {
      render(<AdminDashboardPage />);

      await waitFor(() => {
        const viewLogsButton = screen.getByRole("button", { name: /view logs/i });
        expect(viewLogsButton).toBeDisabled();
      });
    });
  });
});
