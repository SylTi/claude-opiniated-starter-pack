import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Header } from "@/components/header";
import type { UserDTO, SubscriptionTierDTO } from "@saas/shared";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock the auth context
const mockUseAuth = vi.fn();
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => mockUseAuth(),
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

describe("Header Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when user is not authenticated", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        hasUserInfoCookie: false,
        userRole: null,
      });
    });

    it("displays Sign in button", () => {
      render(<Header />);
      expect(
        screen.getByRole("button", { name: "Sign in" }),
      ).toBeInTheDocument();
    });

    it("displays Get started button", () => {
      render(<Header />);
      expect(
        screen.getByRole("button", { name: "Get started" }),
      ).toBeInTheDocument();
    });

    it("does not display Dashboard link", () => {
      render(<Header />);
      expect(
        screen.queryByRole("button", { name: "Dashboard" }),
      ).not.toBeInTheDocument();
    });

    it("does not display Admin link", () => {
      render(<Header />);
      expect(
        screen.queryByRole("button", { name: "Admin" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("when user is loading", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        hasUserInfoCookie: false,
        userRole: null,
      });
    });

    it("displays Sign in button", () => {
      render(<Header />);
      expect(
        screen.getByRole("button", { name: "Sign in" }),
      ).toBeInTheDocument();
    });

    it("displays Get started button", () => {
      render(<Header />);
      expect(
        screen.getByRole("button", { name: "Get started" }),
      ).toBeInTheDocument();
    });
  });

  describe("when user cookie exists but user is not loaded", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        hasUserInfoCookie: true,
        userRole: "user",
      });
    });

    it("shows authenticated links without auth buttons", () => {
      render(<Header />);
      expect(
        screen.getByRole("button", { name: "Dashboard" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Sign in" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Get started" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("when regular user is authenticated", () => {
    const regularUser: UserDTO = {
      id: 1,
      email: "user@example.com",
      fullName: "Regular User",
      role: "user",
      currentTeamId: null,
      currentTeam: null,
      effectiveSubscriptionTier: createMockTier("free", 0),
      emailVerified: true,
      mfaEnabled: false,
      avatarUrl: null,
      balance: 0,
      balanceCurrency: "usd",
      createdAt: new Date().toISOString(),
    };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: regularUser,
        isLoading: false,
        hasUserInfoCookie: true,
        userRole: "user",
        logout: vi.fn(),
      });
    });

    it("displays Dashboard link", () => {
      render(<Header />);
      expect(
        screen.getByRole("button", { name: "Dashboard" }),
      ).toBeInTheDocument();
    });

    it("does not display Admin link for regular user", () => {
      render(<Header />);
      expect(
        screen.queryByRole("button", { name: "Admin" }),
      ).not.toBeInTheDocument();
    });

    it("does not display Sign in button", () => {
      render(<Header />);
      expect(
        screen.queryByRole("button", { name: "Sign in" }),
      ).not.toBeInTheDocument();
    });

    it("does not display Get started button", () => {
      render(<Header />);
      expect(
        screen.queryByRole("button", { name: "Get started" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("when admin user is authenticated", () => {
    const adminUser: UserDTO = {
      id: 1,
      email: "admin@example.com",
      fullName: "Admin User",
      role: "admin",
      currentTeamId: null,
      currentTeam: null,
      effectiveSubscriptionTier: createMockTier("free", 0),
      emailVerified: true,
      mfaEnabled: false,
      avatarUrl: null,
      balance: 0,
      balanceCurrency: "usd",
      createdAt: new Date().toISOString(),
    };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: adminUser,
        isLoading: false,
        hasUserInfoCookie: true,
        userRole: "admin",
        logout: vi.fn(),
      });
    });

    it("displays Dashboard link", () => {
      render(<Header />);
      expect(
        screen.getByRole("button", { name: "Dashboard" }),
      ).toBeInTheDocument();
    });

    it("displays Admin link for admin user", () => {
      render(<Header />);
      expect(screen.getByRole("button", { name: "Admin" })).toBeInTheDocument();
    });

    it("does not display Sign in button", () => {
      render(<Header />);
      expect(
        screen.queryByRole("button", { name: "Sign in" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("when guest user is authenticated", () => {
    const guestUser: UserDTO = {
      id: 1,
      email: "guest@example.com",
      fullName: "Guest User",
      role: "guest",
      currentTeamId: null,
      currentTeam: null,
      effectiveSubscriptionTier: createMockTier("free", 0),
      emailVerified: false,
      mfaEnabled: false,
      avatarUrl: null,
      balance: 0,
      balanceCurrency: "usd",
      createdAt: new Date().toISOString(),
    };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: guestUser,
        isLoading: false,
        hasUserInfoCookie: true,
        userRole: "guest",
        logout: vi.fn(),
      });
    });

    it("displays Dashboard link", () => {
      render(<Header />);
      expect(
        screen.getByRole("button", { name: "Dashboard" }),
      ).toBeInTheDocument();
    });

    it("does not display Admin link for guest user", () => {
      render(<Header />);
      expect(
        screen.queryByRole("button", { name: "Admin" }),
      ).not.toBeInTheDocument();
    });
  });
});
