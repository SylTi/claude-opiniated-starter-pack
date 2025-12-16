import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserMenu } from "@/components/user-menu";
import type { UserDTO } from "@saas/shared";

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
    const regularUser: UserDTO = {
      id: 1,
      email: "user@example.com",
      fullName: "Regular User",
      role: "user",
      emailVerified: true,
      mfaEnabled: false,
      avatarUrl: null,
      createdAt: new Date().toISOString(),
    };

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

    it("does not display User Management for regular user", async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button"));

      expect(screen.queryByText("User Management")).not.toBeInTheDocument();
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
    const adminUser: UserDTO = {
      id: 1,
      email: "admin@example.com",
      fullName: "Admin User",
      role: "admin",
      emailVerified: true,
      mfaEnabled: false,
      avatarUrl: null,
      createdAt: new Date().toISOString(),
    };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: adminUser,
        logout: mockLogout,
      });
    });

    it("displays User Management for admin user", async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button"));

      expect(screen.getByText("User Management")).toBeInTheDocument();
    });

    it("navigates to admin users on User Management click", async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button"));
      await user.click(screen.getByText("User Management"));

      expect(mockPush).toHaveBeenCalledWith("/admin/users");
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
    const guestUser: UserDTO = {
      id: 1,
      email: "guest@example.com",
      fullName: "Guest User",
      role: "guest",
      emailVerified: false,
      mfaEnabled: false,
      avatarUrl: null,
      createdAt: new Date().toISOString(),
    };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: guestUser,
        logout: mockLogout,
      });
    });

    it("does not display User Management for guest user", async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByRole("button"));

      expect(screen.queryByText("User Management")).not.toBeInTheDocument();
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
      const userWithoutName: UserDTO = {
        id: 1,
        email: "test@example.com",
        fullName: null,
        role: "user",
        emailVerified: true,
        mfaEnabled: false,
        avatarUrl: null,
        createdAt: new Date().toISOString(),
      };

      mockUseAuth.mockReturnValue({
        user: userWithoutName,
        logout: mockLogout,
      });

      render(<UserMenu />);
      expect(screen.getByText("T")).toBeInTheDocument();
    });

    it("displays initials from fullName", () => {
      const userWithName: UserDTO = {
        id: 1,
        email: "test@example.com",
        fullName: "John Doe",
        role: "user",
        emailVerified: true,
        mfaEnabled: false,
        avatarUrl: null,
        createdAt: new Date().toISOString(),
      };

      mockUseAuth.mockReturnValue({
        user: userWithName,
        logout: mockLogout,
      });

      render(<UserMenu />);
      expect(screen.getByText("JD")).toBeInTheDocument();
    });
  });
});
