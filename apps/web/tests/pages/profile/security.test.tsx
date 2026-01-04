import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SecurityPage from "@/app/profile/security/page";
import type { SubscriptionTier } from "@saas/shared";

// Mock auth context
const mockUseAuth = vi.fn();
const mockRefreshUser = vi.fn();
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock auth lib
const mockMfaStatus = vi.fn();
const mockMfaSetup = vi.fn();
const mockMfaEnable = vi.fn();
const mockMfaDisable = vi.fn();
const mockChangePassword = vi.fn();
vi.mock("@/lib/auth", () => ({
  mfaApi: {
    status: () => mockMfaStatus(),
    setup: () => mockMfaSetup(),
    enable: (...args: unknown[]) => mockMfaEnable(...args),
    disable: (...args: unknown[]) => mockMfaDisable(...args),
  },
  authApi: {
    changePassword: (...args: unknown[]) => mockChangePassword(...args),
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

// Mock clipboard API
const mockWriteText = vi.fn();
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: mockWriteText,
  },
  writable: true,
  configurable: true,
});

interface MockUser {
  id: number;
  email: string;
  fullName: string | null;
  role: string;
  subscriptionTier: SubscriptionTier;
  emailVerified: boolean;
  mfaEnabled: boolean;
}

describe("Security Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshUser.mockResolvedValue(undefined);
    mockMfaStatus.mockResolvedValue({ mfaEnabled: false, backupCodesRemaining: 0 });
    mockWriteText.mockResolvedValue(undefined);
  });

  describe("when user is not authenticated", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        refreshUser: mockRefreshUser,
      });
    });

    it("renders nothing when user is null", () => {
      const { container } = render(<SecurityPage />);
      return waitFor(() => {
        expect(mockMfaStatus).toHaveBeenCalled();
        expect(container.firstChild).toBeNull();
      });
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
    };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        refreshUser: mockRefreshUser,
      });
    });

    describe("rendering", () => {
      it("renders page title", async () => {
        render(<SecurityPage />);

        await waitFor(() => {
          expect(screen.getByText("Security")).toBeInTheDocument();
        });
      });

      it("renders description text", async () => {
        render(<SecurityPage />);

        await waitFor(() => {
          expect(
            screen.getByText("Manage your security settings")
          ).toBeInTheDocument();
        });
      });

      it("renders Two-Factor Authentication card", async () => {
        render(<SecurityPage />);

        await waitFor(() => {
          expect(
            screen.getByText("Two-Factor Authentication")
          ).toBeInTheDocument();
        });
      });

      it("renders Change Password card", async () => {
        render(<SecurityPage />);

        await waitFor(() => {
          expect(screen.getByText("Change Password")).toBeInTheDocument();
        });
      });
    });

    describe("MFA not enabled", () => {
      beforeEach(() => {
        mockMfaStatus.mockResolvedValue({
          mfaEnabled: false,
          backupCodesRemaining: 0,
        });
      });

      it("shows MFA not enabled message", async () => {
        render(<SecurityPage />);

        await waitFor(() => {
          expect(
            screen.getByText("Two-factor authentication is not enabled")
          ).toBeInTheDocument();
        });
      });

      it("shows Set up 2FA button", async () => {
        render(<SecurityPage />);

        await waitFor(() => {
          expect(
            screen.getByRole("button", { name: /set up 2fa/i })
          ).toBeInTheDocument();
        });
      });
    });

    describe("MFA setup flow", () => {
      const mockSetupData = {
        secret: "test-secret",
        qrCode: "data:image/png;base64,test",
        backupCodes: ["code1", "code2", "code3", "code4"],
      };

      beforeEach(() => {
        mockMfaStatus.mockResolvedValue({
          mfaEnabled: false,
          backupCodesRemaining: 0,
        });
        mockMfaSetup.mockResolvedValue(mockSetupData);
      });

      it("shows QR code after clicking Set up 2FA", async () => {
        const user = userEvent.setup();
        render(<SecurityPage />);

        await waitFor(() => {
          expect(
            screen.getByRole("button", { name: /set up 2fa/i })
          ).toBeInTheDocument();
        });

        await user.click(screen.getByRole("button", { name: /set up 2fa/i }));

        await waitFor(() => {
          expect(screen.getByAltText("MFA QR Code")).toBeInTheDocument();
        });
      });

      it("shows backup codes during setup", async () => {
        const user = userEvent.setup();
        render(<SecurityPage />);

        await waitFor(() => {
          expect(
            screen.getByRole("button", { name: /set up 2fa/i })
          ).toBeInTheDocument();
        });

        await user.click(screen.getByRole("button", { name: /set up 2fa/i }));

        await waitFor(() => {
          expect(screen.getByText("code1")).toBeInTheDocument();
          expect(screen.getByText("code2")).toBeInTheDocument();
        });
      });

      it("shows Copy codes button", async () => {
        const user = userEvent.setup();
        render(<SecurityPage />);

        await waitFor(() => {
          expect(
            screen.getByRole("button", { name: /set up 2fa/i })
          ).toBeInTheDocument();
        });

        await user.click(screen.getByRole("button", { name: /set up 2fa/i }));

        await waitFor(() => {
          expect(
            screen.getByRole("button", { name: /copy codes/i })
          ).toBeInTheDocument();
        });
      });

      it("shows Copied state after clicking copy button", async () => {
        const user = userEvent.setup();
        render(<SecurityPage />);

        await waitFor(() => {
          expect(
            screen.getByRole("button", { name: /set up 2fa/i })
          ).toBeInTheDocument();
        });

        await user.click(screen.getByRole("button", { name: /set up 2fa/i }));

        await waitFor(() => {
          expect(
            screen.getByRole("button", { name: /copy codes/i })
          ).toBeInTheDocument();
        });

        await user.click(screen.getByRole("button", { name: /copy codes/i }));

        // After clicking, the button should show "Copied!" text
        await waitFor(() => {
          expect(screen.getByText(/copied/i)).toBeInTheDocument();
        });
      });

      it("shows verification code input", async () => {
        const user = userEvent.setup();
        render(<SecurityPage />);

        await waitFor(() => {
          expect(
            screen.getByRole("button", { name: /set up 2fa/i })
          ).toBeInTheDocument();
        });

        await user.click(screen.getByRole("button", { name: /set up 2fa/i }));

        await waitFor(() => {
          expect(
            screen.getByLabelText(/enter verification code/i)
          ).toBeInTheDocument();
        });
      });

      it("enables MFA on valid code submission", async () => {
        mockMfaEnable.mockResolvedValue({ message: "Success" });
        const user = userEvent.setup();
        render(<SecurityPage />);

        await waitFor(() => {
          expect(
            screen.getByRole("button", { name: /set up 2fa/i })
          ).toBeInTheDocument();
        });

        await user.click(screen.getByRole("button", { name: /set up 2fa/i }));

        await waitFor(() => {
          expect(
            screen.getByLabelText(/enter verification code/i)
          ).toBeInTheDocument();
        });

        await user.type(
          screen.getByLabelText(/enter verification code/i),
          "123456"
        );
        await user.click(screen.getByRole("button", { name: /enable 2fa/i }));

        await waitFor(() => {
          expect(mockMfaEnable).toHaveBeenCalledWith({
            code: "123456",
            secret: "test-secret",
            backupCodes: ["code1", "code2", "code3", "code4"],
          });
        });
      });
    });

    describe("MFA enabled", () => {
      beforeEach(() => {
        mockMfaStatus.mockResolvedValue({
          mfaEnabled: true,
          backupCodesRemaining: 8,
        });
      });

      it("shows MFA enabled message", async () => {
        render(<SecurityPage />);

        await waitFor(() => {
          expect(
            screen.getByText("Two-factor authentication is enabled")
          ).toBeInTheDocument();
        });
      });

      it("shows backup codes remaining", async () => {
        render(<SecurityPage />);

        await waitFor(() => {
          expect(screen.getByText("Backup codes remaining: 8")).toBeInTheDocument();
        });
      });

      it("shows Disable 2FA button", async () => {
        render(<SecurityPage />);

        await waitFor(() => {
          expect(
            screen.getByRole("button", { name: /disable 2fa/i })
          ).toBeInTheDocument();
        });
      });

      it("shows disable form when clicking Disable 2FA", async () => {
        const user = userEvent.setup();
        render(<SecurityPage />);

        await waitFor(() => {
          expect(
            screen.getByRole("button", { name: /disable 2fa/i })
          ).toBeInTheDocument();
        });

        await user.click(screen.getByRole("button", { name: /disable 2fa/i }));

        await waitFor(() => {
          expect(
            screen.getByLabelText(/enter your 2fa code to disable/i)
          ).toBeInTheDocument();
        });
      });

      it("disables MFA on valid code submission", async () => {
        mockMfaDisable.mockResolvedValue({ message: "Success" });
        const user = userEvent.setup();
        render(<SecurityPage />);

        await waitFor(() => {
          expect(
            screen.getByRole("button", { name: /disable 2fa/i })
          ).toBeInTheDocument();
        });

        await user.click(screen.getByRole("button", { name: /disable 2fa/i }));

        await waitFor(() => {
          expect(
            screen.getByLabelText(/enter your 2fa code to disable/i)
          ).toBeInTheDocument();
        });

        await user.type(
          screen.getByLabelText(/enter your 2fa code to disable/i),
          "123456"
        );

        const disableButton = screen.getByRole("button", { name: "Disable" });
        await user.click(disableButton);

        await waitFor(() => {
          expect(mockMfaDisable).toHaveBeenCalledWith("123456");
        });
      });
    });

    describe("change password", () => {
      it("renders current password input", async () => {
        render(<SecurityPage />);

        await waitFor(() => {
          expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
        });
      });

      it("renders new password input", async () => {
        render(<SecurityPage />);

        await waitFor(() => {
          expect(screen.getByLabelText("New password")).toBeInTheDocument();
        });
      });

      it("renders confirm new password input", async () => {
        render(<SecurityPage />);

        await waitFor(() => {
          expect(
            screen.getByLabelText(/confirm new password/i)
          ).toBeInTheDocument();
        });
      });

      it("renders change password button", async () => {
        render(<SecurityPage />);

        await waitFor(() => {
          expect(
            screen.getByRole("button", { name: /change password/i })
          ).toBeInTheDocument();
        });
      });

      it("calls changePassword on valid form submission", async () => {
        mockChangePassword.mockResolvedValue({ message: "Success" });
        const user = userEvent.setup();
        render(<SecurityPage />);

        await waitFor(() => {
          expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
        });

        await user.type(
          screen.getByLabelText(/current password/i),
          "oldpassword"
        );
        await user.type(screen.getByLabelText("New password"), "newpassword123");
        await user.type(
          screen.getByLabelText(/confirm new password/i),
          "newpassword123"
        );
        await user.click(
          screen.getByRole("button", { name: /change password/i })
        );

        await waitFor(() => {
          expect(mockChangePassword).toHaveBeenCalledWith({
            currentPassword: "oldpassword",
            newPassword: "newpassword123",
            newPasswordConfirmation: "newpassword123",
          });
        });
      });

      it("shows success toast after password change", async () => {
        mockChangePassword.mockResolvedValue({ message: "Success" });
        const { toast } = await import("sonner");
        const user = userEvent.setup();
        render(<SecurityPage />);

        await waitFor(() => {
          expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
        });

        await user.type(
          screen.getByLabelText(/current password/i),
          "oldpassword"
        );
        await user.type(screen.getByLabelText("New password"), "newpassword123");
        await user.type(
          screen.getByLabelText(/confirm new password/i),
          "newpassword123"
        );
        await user.click(
          screen.getByRole("button", { name: /change password/i })
        );

        await waitFor(() => {
          expect(toast.success).toHaveBeenCalledWith(
            "Password changed successfully"
          );
        });
      });

      it("shows error message on API failure", async () => {
        const { ApiError } = await import("@/lib/api");
        mockChangePassword.mockRejectedValue(
          new ApiError(400, "InvalidPassword", "Current password is incorrect")
        );
        const user = userEvent.setup();
        render(<SecurityPage />);

        await waitFor(() => {
          expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
        });

        await user.type(
          screen.getByLabelText(/current password/i),
          "wrongpassword"
        );
        await user.type(screen.getByLabelText("New password"), "newpassword123");
        await user.type(
          screen.getByLabelText(/confirm new password/i),
          "newpassword123"
        );
        await user.click(
          screen.getByRole("button", { name: /change password/i })
        );

        await waitFor(() => {
          expect(
            screen.getByText("Current password is incorrect")
          ).toBeInTheDocument();
        });
      });

      it("shows loading state during submission", async () => {
        mockChangePassword.mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100))
        );
        const user = userEvent.setup();
        render(<SecurityPage />);

        await waitFor(() => {
          expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
        });

        await user.type(
          screen.getByLabelText(/current password/i),
          "oldpassword"
        );
        await user.type(screen.getByLabelText("New password"), "newpassword123");
        await user.type(
          screen.getByLabelText(/confirm new password/i),
          "newpassword123"
        );
        await user.click(
          screen.getByRole("button", { name: /change password/i })
        );

        expect(screen.getByText(/changing/i)).toBeInTheDocument();
      });
    });
  });
});
