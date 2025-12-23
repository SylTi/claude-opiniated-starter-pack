import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AdminLayout from "@/app/admin/layout";
import type { SubscriptionTier } from "@saas/shared";

// Mock next/navigation
const mockPush = vi.fn();
const mockPathname = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname(),
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

// Mock auth context
const mockUseAuth = vi.fn();
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => mockUseAuth(),
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

describe("Admin Layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/admin/dashboard");
  });

  describe("when user is not authenticated", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
      });
    });

    it("redirects to login", async () => {
      render(
        <AdminLayout>
          <div>Admin Content</div>
        </AdminLayout>
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/login");
      });
    });
  });

  describe("when user is loading", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
      });
    });

    it("shows loading spinner", () => {
      render(
        <AdminLayout>
          <div>Admin Content</div>
        </AdminLayout>
      );

      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });

  describe("when user is not admin", () => {
    beforeEach(() => {
      const regularUser: MockUser = {
        id: 1,
        email: "user@example.com",
        fullName: "Regular User",
        role: "user",
        subscriptionTier: "free",
        emailVerified: true,
        mfaEnabled: false,
      };

      mockUseAuth.mockReturnValue({
        user: regularUser,
        isLoading: false,
      });
    });

    it("redirects to dashboard with error", async () => {
      const { toast } = await import("sonner");
      render(
        <AdminLayout>
          <div>Admin Content</div>
        </AdminLayout>
      );

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Access denied. Admin only.");
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
      });
    });

    it("does not render content", () => {
      render(
        <AdminLayout>
          <div>Admin Content</div>
        </AdminLayout>
      );

      expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
    });
  });

  describe("when user is admin", () => {
    beforeEach(() => {
      const adminUser: MockUser = {
        id: 1,
        email: "admin@example.com",
        fullName: "Admin User",
        role: "admin",
        subscriptionTier: "free",
        emailVerified: true,
        mfaEnabled: false,
      };

      mockUseAuth.mockReturnValue({
        user: adminUser,
        isLoading: false,
      });
    });

    it("renders admin panel title", () => {
      render(
        <AdminLayout>
          <div>Admin Content</div>
        </AdminLayout>
      );

      expect(screen.getByText("Admin Panel")).toBeInTheDocument();
    });

    it("renders navigation links", () => {
      render(
        <AdminLayout>
          <div>Admin Content</div>
        </AdminLayout>
      );

      expect(
        screen.getByRole("link", { name: /dashboard/i })
      ).toHaveAttribute("href", "/admin/dashboard");
      expect(screen.getByRole("link", { name: /users/i })).toHaveAttribute(
        "href",
        "/admin/users"
      );
    });

    it("renders children content", () => {
      render(
        <AdminLayout>
          <div>Admin Content</div>
        </AdminLayout>
      );

      expect(screen.getByText("Admin Content")).toBeInTheDocument();
    });

    // Note: Navigation highlighting test is skipped because the Link mock
    // doesn't pass className through, making it impossible to test the
    // active state styling in jsdom environment
  });
});
