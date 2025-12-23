import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/app/(auth)/login/page";

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

// Mock auth context
const mockLogin = vi.fn();
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

// Mock auth lib
vi.mock("@/lib/auth", () => ({
  oauthApi: {
    getRedirectUrl: vi.fn((provider: string) => `https://oauth.test/${provider}`),
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

describe("Login Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders login form", () => {
      render(<LoginPage />);

      expect(
        screen.getByRole("heading", { name: /sign in to your account/i })
      ).toBeInTheDocument();
    });

    it("renders email input", () => {
      render(<LoginPage />);

      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });

    it("renders password input", () => {
      render(<LoginPage />);

      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });

    it("renders sign in button", () => {
      render(<LoginPage />);

      expect(
        screen.getByRole("button", { name: /sign in/i })
      ).toBeInTheDocument();
    });

    it("renders link to register page", () => {
      render(<LoginPage />);

      expect(
        screen.getByRole("link", { name: /create a new account/i })
      ).toHaveAttribute("href", "/register");
    });

    it("renders forgot password link", () => {
      render(<LoginPage />);

      expect(
        screen.getByRole("link", { name: /forgot your password/i })
      ).toHaveAttribute("href", "/forgot-password");
    });

    it("renders OAuth buttons", () => {
      render(<LoginPage />);

      expect(
        screen.getByRole("button", { name: /google/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /github/i })
      ).toBeInTheDocument();
    });
  });

  describe("form validation", () => {
    it("shows error for invalid email", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, "invalid-email");
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
      });
    });

    it("shows error for empty password", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const passwordInput = screen.getByLabelText(/password/i);
      await user.click(passwordInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });
    });
  });

  describe("form submission", () => {
    it("calls login on valid form submission", async () => {
      mockLogin.mockResolvedValue({ user: { id: 1 } });
      const user = userEvent.setup();
      render(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), "test@example.com");
      await user.type(screen.getByLabelText(/password/i), "password123");
      await user.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(
          "test@example.com",
          "password123",
          undefined
        );
      });
    });

    it("redirects to dashboard on successful login", async () => {
      mockLogin.mockResolvedValue({ user: { id: 1 } });
      const user = userEvent.setup();
      render(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), "test@example.com");
      await user.type(screen.getByLabelText(/password/i), "password123");
      await user.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
      });
    });

    it("shows MFA input when MFA is required", async () => {
      mockLogin.mockResolvedValue({ requiresMfa: true });
      const user = userEvent.setup();
      render(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), "test@example.com");
      await user.type(screen.getByLabelText(/password/i), "password123");
      await user.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(
          screen.getByLabelText(/two-factor authentication code/i)
        ).toBeInTheDocument();
      });
    });

    it("shows error message on login failure", async () => {
      const { ApiError } = await import("@/lib/api");
      mockLogin.mockRejectedValue(new ApiError(401, "InvalidCredentials", "Invalid credentials"));
      const user = userEvent.setup();
      render(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), "test@example.com");
      await user.type(screen.getByLabelText(/password/i), "wrongpassword");
      await user.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });
    });

    it("shows generic error on unexpected failure", async () => {
      mockLogin.mockRejectedValue(new Error("Network error"));
      const user = userEvent.setup();
      render(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), "test@example.com");
      await user.type(screen.getByLabelText(/password/i), "password123");
      await user.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
      });
    });

    it("shows loading state during submission", async () => {
      mockLogin.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      const user = userEvent.setup();
      render(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), "test@example.com");
      await user.type(screen.getByLabelText(/password/i), "password123");
      await user.click(screen.getByRole("button", { name: /sign in/i }));

      expect(screen.getByText(/signing in/i)).toBeInTheDocument();
    });
  });
});
