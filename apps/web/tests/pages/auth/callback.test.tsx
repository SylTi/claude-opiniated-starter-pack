import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OAuthCallbackPage from "@/app/auth/callback/page";

// Mock next/navigation
const mockPush = vi.fn();
const mockSearchParams = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams(),
}));

// Mock auth context
const mockRefreshUser = vi.fn();
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    refreshUser: mockRefreshUser,
  }),
}));

describe("OAuth Callback Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshUser.mockResolvedValue(undefined);
  });

  describe("loading state", () => {
    beforeEach(() => {
      mockSearchParams.mockReturnValue({
        get: (key: string) => {
          if (key === "success") return "true";
          return null;
        },
      });
    });

    it("shows loading spinner while processing", () => {
      render(<OAuthCallbackPage />);

      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });

    it("shows processing message", () => {
      render(<OAuthCallbackPage />);

      expect(
        screen.getByText("Completing authentication...")
      ).toBeInTheDocument();
    });
  });

  describe("successful authentication", () => {
    describe("existing user", () => {
      beforeEach(() => {
        mockSearchParams.mockReturnValue({
          get: (key: string) => {
            if (key === "success") return "true";
            if (key === "isNewUser") return "false";
            return null;
          },
        });
      });

      it("calls refreshUser", async () => {
        render(<OAuthCallbackPage />);

        await waitFor(() => {
          expect(mockRefreshUser).toHaveBeenCalled();
        });
      });

      it("redirects to dashboard for existing user", async () => {
        render(<OAuthCallbackPage />);

        await waitFor(() => {
          expect(mockPush).toHaveBeenCalledWith("/dashboard");
        });
      });
    });

    describe("new user", () => {
      beforeEach(() => {
        mockSearchParams.mockReturnValue({
          get: (key: string) => {
            if (key === "success") return "true";
            if (key === "isNewUser") return "true";
            return null;
          },
        });
      });

      it("redirects to profile for new user", async () => {
        render(<OAuthCallbackPage />);

        await waitFor(() => {
          expect(mockPush).toHaveBeenCalledWith("/profile");
        });
      });
    });
  });

  describe("authentication error", () => {
    beforeEach(() => {
      mockSearchParams.mockReturnValue({
        get: (key: string) => {
          if (key === "error") return "OAuth authentication failed";
          return null;
        },
      });
    });

    it("shows error heading", () => {
      render(<OAuthCallbackPage />);

      expect(screen.getByText("Authentication Failed")).toBeInTheDocument();
    });

    it("shows error message", () => {
      render(<OAuthCallbackPage />);

      expect(
        screen.getByText("OAuth authentication failed")
      ).toBeInTheDocument();
    });

    it("shows Back to Login button", () => {
      render(<OAuthCallbackPage />);

      expect(
        screen.getByRole("button", { name: /back to login/i })
      ).toBeInTheDocument();
    });

    it("redirects to login when clicking Back to Login", async () => {
      const user = userEvent.setup();
      render(<OAuthCallbackPage />);

      await user.click(screen.getByRole("button", { name: /back to login/i }));

      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  describe("no params", () => {
    beforeEach(() => {
      mockSearchParams.mockReturnValue({
        get: () => null,
      });
    });

    it("shows loading state when no success or error", () => {
      render(<OAuthCallbackPage />);

      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });
});
