import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProfilePage from "@/app/profile/page";
import type { SubscriptionTier } from "@saas/shared";

// Mock auth context
const mockUseAuth = vi.fn();
const mockRefreshUser = vi.fn();
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock auth lib
const mockUpdateProfile = vi.fn();
vi.mock("@/lib/auth", () => ({
  authApi: {
    updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  },
}));

// Mock API error
vi.mock("@/lib/api", () => ({
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
  subscriptionTier: SubscriptionTier;
  emailVerified: boolean;
  mfaEnabled: boolean;
  avatarUrl: string | null;
}

describe("Profile Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshUser.mockResolvedValue(undefined);
  });

  describe("when user is not authenticated", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        refreshUser: mockRefreshUser,
      });
    });

    it("renders nothing when user is null", () => {
      const { container } = render(<ProfilePage />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("when user is authenticated", () => {
    const mockUser: MockUser = {
      id: 1,
      email: "user@example.com",
      fullName: "Test User",
      role: "user",
      subscriptionTier: "free",
      emailVerified: true,
      mfaEnabled: false,
      avatarUrl: null,
    };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        refreshUser: mockRefreshUser,
      });
    });

    describe("rendering", () => {
      it("renders page title", () => {
        render(<ProfilePage />);
        expect(screen.getByText("Profile")).toBeInTheDocument();
      });

      it("renders description text", () => {
        render(<ProfilePage />);
        expect(
          screen.getByText("Manage your account information")
        ).toBeInTheDocument();
      });

      it("renders full name input", () => {
        render(<ProfilePage />);
        expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      });

      it("renders email input as disabled", () => {
        render(<ProfilePage />);
        const emailInput = screen.getByLabelText(/email/i);
        expect(emailInput).toBeDisabled();
        expect(emailInput).toHaveValue("user@example.com");
      });

      it("renders avatar URL input", () => {
        render(<ProfilePage />);
        expect(screen.getByLabelText(/avatar url/i)).toBeInTheDocument();
      });

      it("renders save button", () => {
        render(<ProfilePage />);
        expect(
          screen.getByRole("button", { name: /save changes/i })
        ).toBeInTheDocument();
      });

      it("displays user email", () => {
        render(<ProfilePage />);
        expect(screen.getByText("user@example.com")).toBeInTheDocument();
      });

      it("displays user name", () => {
        render(<ProfilePage />);
        expect(screen.getByText("Test User")).toBeInTheDocument();
      });

      it("displays avatar initials when no avatar URL", () => {
        render(<ProfilePage />);
        expect(screen.getByText("TU")).toBeInTheDocument();
      });
    });

    describe("with unverified email", () => {
      beforeEach(() => {
        mockUseAuth.mockReturnValue({
          user: { ...mockUser, emailVerified: false },
          refreshUser: mockRefreshUser,
        });
      });

      it("displays unverified email warning", () => {
        render(<ProfilePage />);
        expect(screen.getByText("Email not verified")).toBeInTheDocument();
      });
    });

    describe("with no name set", () => {
      beforeEach(() => {
        mockUseAuth.mockReturnValue({
          user: { ...mockUser, fullName: null },
          refreshUser: mockRefreshUser,
        });
      });

      it("displays 'No name set'", () => {
        render(<ProfilePage />);
        expect(screen.getByText("No name set")).toBeInTheDocument();
      });

      it("displays email initial as avatar fallback", () => {
        render(<ProfilePage />);
        expect(screen.getByText("U")).toBeInTheDocument();
      });
    });

    describe("form submission", () => {
      it("calls updateProfile on valid form submission", async () => {
        mockUpdateProfile.mockResolvedValue({ message: "Success" });
        const user = userEvent.setup();
        render(<ProfilePage />);

        const fullNameInput = screen.getByLabelText(/full name/i);
        await user.clear(fullNameInput);
        await user.type(fullNameInput, "New Name");
        await user.click(screen.getByRole("button", { name: /save changes/i }));

        await waitFor(() => {
          expect(mockUpdateProfile).toHaveBeenCalledWith({
            fullName: "New Name",
            avatarUrl: null,
          });
        });
      });

      it("calls refreshUser after successful update", async () => {
        mockUpdateProfile.mockResolvedValue({ message: "Success" });
        const user = userEvent.setup();
        render(<ProfilePage />);

        await user.click(screen.getByRole("button", { name: /save changes/i }));

        await waitFor(() => {
          expect(mockRefreshUser).toHaveBeenCalled();
        });
      });

      it("shows success toast after update", async () => {
        mockUpdateProfile.mockResolvedValue({ message: "Success" });
        const { toast } = await import("sonner");
        const user = userEvent.setup();
        render(<ProfilePage />);

        await user.click(screen.getByRole("button", { name: /save changes/i }));

        await waitFor(() => {
          expect(toast.success).toHaveBeenCalledWith(
            "Profile updated successfully"
          );
        });
      });

      it("shows loading state during submission", async () => {
        mockUpdateProfile.mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100))
        );
        const user = userEvent.setup();
        render(<ProfilePage />);

        await user.click(screen.getByRole("button", { name: /save changes/i }));

        expect(screen.getByText(/saving/i)).toBeInTheDocument();
      });

      it("shows error message on API failure", async () => {
        const { ApiError } = await import("@/lib/api");
        mockUpdateProfile.mockRejectedValue(
          new ApiError(400, "UpdateFailed", "Update failed")
        );
        const user = userEvent.setup();
        render(<ProfilePage />);

        await user.click(screen.getByRole("button", { name: /save changes/i }));

        await waitFor(() => {
          expect(screen.getByText("Update failed")).toBeInTheDocument();
        });
      });

      it("shows generic error on unexpected failure", async () => {
        mockUpdateProfile.mockRejectedValue(new Error("Network error"));
        const user = userEvent.setup();
        render(<ProfilePage />);

        await user.click(screen.getByRole("button", { name: /save changes/i }));

        await waitFor(() => {
          expect(
            screen.getByText("An unexpected error occurred")
          ).toBeInTheDocument();
        });
      });
    });
  });
});
