import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ResetPasswordPage from "@/app/(auth)/reset-password/page";

// Mock next/navigation
const mockPush = vi.fn();
const mockSearchParams = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams(),
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
const mockResetPassword = vi.fn();
vi.mock("@/lib/auth", () => ({
  authApi: {
    resetPassword: (...args: unknown[]) => mockResetPassword(...args),
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

describe("Reset Password Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("without token", () => {
    beforeEach(() => {
      mockSearchParams.mockReturnValue({
        get: () => null,
      });
    });

    it("shows invalid link message", () => {
      render(<ResetPasswordPage />);

      expect(
        screen.getByRole("heading", { name: /invalid link/i })
      ).toBeInTheDocument();
    });

    it("shows explanation text", () => {
      render(<ResetPasswordPage />);

      expect(
        screen.getByText(/password reset link is invalid or has expired/i)
      ).toBeInTheDocument();
    });

    it("shows request new link button", () => {
      render(<ResetPasswordPage />);

      expect(
        screen.getByRole("link", { name: /request new link/i })
      ).toHaveAttribute("href", "/forgot-password");
    });
  });

  describe("with valid token", () => {
    beforeEach(() => {
      mockSearchParams.mockReturnValue({
        get: (key: string) => (key === "token" ? "valid-token-123" : null),
      });
    });

    describe("rendering", () => {
      it("renders reset password form", () => {
        render(<ResetPasswordPage />);

        expect(
          screen.getByRole("heading", { name: /reset your password/i })
        ).toBeInTheDocument();
      });

      it("renders new password input", () => {
        render(<ResetPasswordPage />);

        expect(screen.getByLabelText("New password")).toBeInTheDocument();
      });

      it("renders confirm password input", () => {
        render(<ResetPasswordPage />);

        expect(
          screen.getByLabelText(/confirm new password/i)
        ).toBeInTheDocument();
      });

      it("renders reset password button", () => {
        render(<ResetPasswordPage />);

        expect(
          screen.getByRole("button", { name: /reset password/i })
        ).toBeInTheDocument();
      });

      it("renders back to login link", () => {
        render(<ResetPasswordPage />);

        expect(
          screen.getByRole("link", { name: /back to login/i })
        ).toHaveAttribute("href", "/login");
      });
    });

    describe("form validation", () => {
      it("shows error for short password", async () => {
        const user = userEvent.setup();
        render(<ResetPasswordPage />);

        const passwordInput = screen.getByLabelText("New password");
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
        render(<ResetPasswordPage />);

        await user.type(screen.getByLabelText("New password"), "password123");
        await user.type(
          screen.getByLabelText("Confirm new password"),
          "different123"
        );
        await user.tab();

        await waitFor(() => {
          expect(
            screen.getByText(/passwords don't match/i)
          ).toBeInTheDocument();
        });
      });
    });

    describe("form submission", () => {
      it("calls resetPassword on valid form submission", async () => {
        mockResetPassword.mockResolvedValue({ message: "Success" });
        const user = userEvent.setup();
        render(<ResetPasswordPage />);

        await user.type(screen.getByLabelText("New password"), "newpassword123");
        await user.type(
          screen.getByLabelText("Confirm new password"),
          "newpassword123"
        );
        await user.click(screen.getByRole("button", { name: /reset password/i }));

        await waitFor(() => {
          expect(mockResetPassword).toHaveBeenCalledWith({
            token: "valid-token-123",
            password: "newpassword123",
            passwordConfirmation: "newpassword123",
          });
        });
      });

      it("shows success message after password reset", async () => {
        mockResetPassword.mockResolvedValue({ message: "Success" });
        const user = userEvent.setup();
        render(<ResetPasswordPage />);

        await user.type(screen.getByLabelText("New password"), "newpassword123");
        await user.type(
          screen.getByLabelText("Confirm new password"),
          "newpassword123"
        );
        await user.click(screen.getByRole("button", { name: /reset password/i }));

        await waitFor(() => {
          expect(
            screen.getByText(/password reset successful/i)
          ).toBeInTheDocument();
        });
      });

      it("shows Go to Login button after success", async () => {
        mockResetPassword.mockResolvedValue({ message: "Success" });
        const user = userEvent.setup();
        render(<ResetPasswordPage />);

        await user.type(screen.getByLabelText("New password"), "newpassword123");
        await user.type(
          screen.getByLabelText("Confirm new password"),
          "newpassword123"
        );
        await user.click(screen.getByRole("button", { name: /reset password/i }));

        await waitFor(() => {
          expect(
            screen.getByRole("button", { name: /go to login/i })
          ).toBeInTheDocument();
        });
      });

      it("shows error message on failure", async () => {
        const { ApiError } = await import("@/lib/api");
        mockResetPassword.mockRejectedValue(
          new ApiError(400, "TokenExpired", "Token expired")
        );
        const user = userEvent.setup();
        render(<ResetPasswordPage />);

        await user.type(screen.getByLabelText("New password"), "newpassword123");
        await user.type(
          screen.getByLabelText("Confirm new password"),
          "newpassword123"
        );
        await user.click(screen.getByRole("button", { name: /reset password/i }));

        await waitFor(() => {
          expect(screen.getByText(/token expired/i)).toBeInTheDocument();
        });
      });

      it("shows generic error on unexpected failure", async () => {
        mockResetPassword.mockRejectedValue(new Error("Network error"));
        const user = userEvent.setup();
        render(<ResetPasswordPage />);

        await user.type(screen.getByLabelText("New password"), "newpassword123");
        await user.type(
          screen.getByLabelText("Confirm new password"),
          "newpassword123"
        );
        await user.click(screen.getByRole("button", { name: /reset password/i }));

        await waitFor(() => {
          expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
        });
      });

      it("shows loading state during submission", async () => {
        mockResetPassword.mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100))
        );
        const user = userEvent.setup();
        render(<ResetPasswordPage />);

        await user.type(screen.getByLabelText("New password"), "newpassword123");
        await user.type(
          screen.getByLabelText("Confirm new password"),
          "newpassword123"
        );
        await user.click(screen.getByRole("button", { name: /reset password/i }));

        expect(screen.getByText(/resetting/i)).toBeInTheDocument();
      });
    });
  });
});
