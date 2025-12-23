import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ForgotPasswordPage from "@/app/(auth)/forgot-password/page";

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
const mockForgotPassword = vi.fn();
vi.mock("@/lib/auth", () => ({
  authApi: {
    forgotPassword: (...args: unknown[]) => mockForgotPassword(...args),
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

describe("Forgot Password Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders forgot password form", () => {
      render(<ForgotPasswordPage />);

      expect(
        screen.getByRole("heading", { name: /forgot password/i })
      ).toBeInTheDocument();
    });

    it("renders description text", () => {
      render(<ForgotPasswordPage />);

      expect(
        screen.getByText(/enter your email address/i)
      ).toBeInTheDocument();
    });

    it("renders email input", () => {
      render(<ForgotPasswordPage />);

      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });

    it("renders send reset link button", () => {
      render(<ForgotPasswordPage />);

      expect(
        screen.getByRole("button", { name: /send reset link/i })
      ).toBeInTheDocument();
    });

    it("renders back to login link", () => {
      render(<ForgotPasswordPage />);

      expect(
        screen.getByRole("link", { name: /back to login/i })
      ).toHaveAttribute("href", "/login");
    });
  });

  describe("form validation", () => {
    it("shows error for invalid email", async () => {
      const user = userEvent.setup();
      render(<ForgotPasswordPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, "invalid-email");
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
      });
    });

    it("shows error for empty email", async () => {
      const user = userEvent.setup();
      render(<ForgotPasswordPage />);

      // Submit form without filling email
      await user.click(screen.getByRole("button", { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
      });
    });
  });

  describe("form submission", () => {
    it("calls forgotPassword on valid form submission", async () => {
      mockForgotPassword.mockResolvedValue({ message: "Success" });
      const user = userEvent.setup();
      render(<ForgotPasswordPage />);

      await user.type(
        screen.getByLabelText(/email address/i),
        "test@example.com"
      );
      await user.click(screen.getByRole("button", { name: /send reset link/i }));

      await waitFor(() => {
        expect(mockForgotPassword).toHaveBeenCalledWith("test@example.com");
      });
    });

    it("shows success message after sending reset link", async () => {
      mockForgotPassword.mockResolvedValue({ message: "Success" });
      const user = userEvent.setup();
      render(<ForgotPasswordPage />);

      await user.type(
        screen.getByLabelText(/email address/i),
        "test@example.com"
      );
      await user.click(screen.getByRole("button", { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      });
    });

    it("shows success message even for non-existent email (security)", async () => {
      mockForgotPassword.mockResolvedValue({ message: "Success" });
      const user = userEvent.setup();
      render(<ForgotPasswordPage />);

      await user.type(
        screen.getByLabelText(/email address/i),
        "nonexistent@example.com"
      );
      await user.click(screen.getByRole("button", { name: /send reset link/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/if an account exists with this email/i)
        ).toBeInTheDocument();
      });
    });

    it("shows Back to Login button after success", async () => {
      mockForgotPassword.mockResolvedValue({ message: "Success" });
      const user = userEvent.setup();
      render(<ForgotPasswordPage />);

      await user.type(
        screen.getByLabelText(/email address/i),
        "test@example.com"
      );
      await user.click(screen.getByRole("button", { name: /send reset link/i }));

      await waitFor(() => {
        expect(
          screen.getByRole("link", { name: /back to login/i })
        ).toBeInTheDocument();
      });
    });

    it("shows error message on failure", async () => {
      const { ApiError } = await import("@/lib/api");
      mockForgotPassword.mockRejectedValue(
        new ApiError(429, "TooManyRequests", "Too many requests")
      );
      const user = userEvent.setup();
      render(<ForgotPasswordPage />);

      await user.type(
        screen.getByLabelText(/email address/i),
        "test@example.com"
      );
      await user.click(screen.getByRole("button", { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText(/too many requests/i)).toBeInTheDocument();
      });
    });

    it("shows generic error on unexpected failure", async () => {
      mockForgotPassword.mockRejectedValue(new Error("Network error"));
      const user = userEvent.setup();
      render(<ForgotPasswordPage />);

      await user.type(
        screen.getByLabelText(/email address/i),
        "test@example.com"
      );
      await user.click(screen.getByRole("button", { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
      });
    });

    it("shows loading state during submission", async () => {
      mockForgotPassword.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      const user = userEvent.setup();
      render(<ForgotPasswordPage />);

      await user.type(
        screen.getByLabelText(/email address/i),
        "test@example.com"
      );
      await user.click(screen.getByRole("button", { name: /send reset link/i }));

      expect(screen.getByText(/sending/i)).toBeInTheDocument();
    });
  });
});
