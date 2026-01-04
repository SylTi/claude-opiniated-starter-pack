import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegisterPage from "@/app/(auth)/register/page";

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

// Mock auth lib
const mockRegister = vi.fn();
vi.mock("@/lib/auth", () => ({
  authApi: {
    register: (...args: unknown[]) => mockRegister(...args),
  },
  oauthApi: {
    getRedirectUrl: vi.fn((provider: string) => `https://oauth.test/${provider}`),
  },
}));

// Mock auth context
const mockUseAuth = vi.fn();
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => mockUseAuth(),
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

describe("Register Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
  });

  describe("rendering", () => {
    it("renders registration form", () => {
      render(<RegisterPage />);

      expect(
        screen.getByRole("heading", { name: /create your account/i })
      ).toBeInTheDocument();
    });

    it("renders full name input", () => {
      render(<RegisterPage />);

      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    });

    it("renders email input", () => {
      render(<RegisterPage />);

      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });

    it("renders password input", () => {
      render(<RegisterPage />);

      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    });

    it("renders confirm password input", () => {
      render(<RegisterPage />);

      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });

    it("renders create account button", () => {
      render(<RegisterPage />);

      expect(
        screen.getByRole("button", { name: /create account/i })
      ).toBeInTheDocument();
    });

    it("renders link to login page", () => {
      render(<RegisterPage />);

      expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
        "href",
        "/login"
      );
    });

    it("renders OAuth buttons", () => {
      render(<RegisterPage />);

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
      render(<RegisterPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, "invalid-email");
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
      });
    });

    it("shows error for short password", async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      const passwordInput = screen.getByLabelText(/^password$/i);
      await user.type(passwordInput, "short");
      await user.tab();

      await waitFor(() => {
        expect(
          screen.getByText(/at least 8 characters/i)
        ).toBeInTheDocument();
      });
    });

    it("shows error when passwords do not match", async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      await user.type(screen.getByLabelText(/^password$/i), "password123");
      await user.type(screen.getByLabelText(/confirm password/i), "different123");
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/passwords don't match/i)).toBeInTheDocument();
      });
    });
  });

  describe("form submission", () => {
    it("calls register on valid form submission", async () => {
      mockRegister.mockResolvedValue({ message: "Success" });
      const user = userEvent.setup();
      render(<RegisterPage />);

      await user.type(screen.getByLabelText(/full name/i), "John Doe");
      await user.type(screen.getByLabelText(/email address/i), "john@example.com");
      await user.type(screen.getByLabelText(/^password$/i), "password123");
      await user.type(screen.getByLabelText(/confirm password/i), "password123");
      await user.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith({
          email: "john@example.com",
          password: "password123",
          fullName: "John Doe",
        });
      });
    });

    it("shows success message after registration", async () => {
      mockRegister.mockResolvedValue({ message: "Success" });
      const user = userEvent.setup();
      render(<RegisterPage />);

      await user.type(screen.getByLabelText(/email address/i), "john@example.com");
      await user.type(screen.getByLabelText(/^password$/i), "password123");
      await user.type(screen.getByLabelText(/confirm password/i), "password123");
      await user.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /check your email/i })
        ).toBeInTheDocument();
      });
    });

    it("shows Go to Login button after successful registration", async () => {
      mockRegister.mockResolvedValue({ message: "Success" });
      const user = userEvent.setup();
      render(<RegisterPage />);

      await user.type(screen.getByLabelText(/email address/i), "john@example.com");
      await user.type(screen.getByLabelText(/^password$/i), "password123");
      await user.type(screen.getByLabelText(/confirm password/i), "password123");
      await user.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /go to login/i })
        ).toBeInTheDocument();
      });
    });

    it("shows error message on registration failure", async () => {
      const { ApiError } = await import("@/lib/api");
      mockRegister.mockRejectedValue(
        new ApiError(409, "EmailExists", "Email already registered")
      );
      const user = userEvent.setup();
      render(<RegisterPage />);

      await user.type(screen.getByLabelText(/email address/i), "john@example.com");
      await user.type(screen.getByLabelText(/^password$/i), "password123");
      await user.type(screen.getByLabelText(/confirm password/i), "password123");
      await user.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/email already registered/i)).toBeInTheDocument();
      });
    });

    it("shows generic error on unexpected failure", async () => {
      mockRegister.mockRejectedValue(new Error("Network error"));
      const user = userEvent.setup();
      render(<RegisterPage />);

      await user.type(screen.getByLabelText(/email address/i), "john@example.com");
      await user.type(screen.getByLabelText(/^password$/i), "password123");
      await user.type(screen.getByLabelText(/confirm password/i), "password123");
      await user.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
      });
    });

    it("shows loading state during submission", async () => {
      mockRegister.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      const user = userEvent.setup();
      render(<RegisterPage />);

      await user.type(screen.getByLabelText(/email address/i), "john@example.com");
      await user.type(screen.getByLabelText(/^password$/i), "password123");
      await user.type(screen.getByLabelText(/confirm password/i), "password123");
      await user.click(screen.getByRole("button", { name: /create account/i }));

      expect(screen.getByText(/creating account/i)).toBeInTheDocument();
    });
  });
});
