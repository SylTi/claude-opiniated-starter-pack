import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Header } from "@/components/header";

const mockUseAuth = vi.fn();
const mockUseDesign = vi.fn();
const mockUseThemeTokens = vi.fn();

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/contexts/design-context", () => ({
  useDesign: () => mockUseDesign(),
  useThemeTokens: () => mockUseThemeTokens(),
}));

vi.mock("@/components/tenant-switcher", () => ({
  TenantSwitcher: () => <div>Tenant Slot</div>,
}));

vi.mock("@/components/user-menu", () => ({
  UserMenu: () => <div>User Menu Slot</div>,
}));

vi.mock("@/components/nav/dynamic-user-menu", () => ({
  DynamicUserMenu: () => <div>Dynamic User Menu Slot</div>,
}));

describe("Header override", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseThemeTokens.mockReturnValue({
      appName: "Notarium",
      logoUrl: null,
    });
    mockUseAuth.mockReturnValue({
      user: {
        id: 1,
        role: "user",
        currentTenantId: 10,
      },
      hasUserInfoCookie: true,
      userRole: "user",
    });
  });

  it("uses plugin headerOverride when provided", () => {
    const HeaderOverride = (props: {
      brand: React.ReactNode;
      mainNavigation: React.ReactNode;
      tenantSwitcher: React.ReactNode;
      userMenu: React.ReactNode;
    }): React.ReactElement => (
      <header data-testid="plugin-header">
        <div>{props.brand}</div>
        <div>{props.mainNavigation}</div>
        <div>{props.tenantSwitcher}</div>
        <div>{props.userMenu}</div>
      </header>
    );

    mockUseDesign.mockReturnValue({
      design: {
        headerOverride: {
          Header: HeaderOverride,
        },
      },
      isSafeMode: false,
    });

    render(<Header />);

    expect(screen.getByTestId("plugin-header")).toBeInTheDocument();
    expect(screen.getByText("Tenant Slot")).toBeInTheDocument();
    expect(screen.getByText("User Menu Slot")).toBeInTheDocument();
  });

  it("falls back to default header when headerOverride crashes", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const CrashingHeader = (): React.ReactElement => {
      throw new Error("boom");
    };

    mockUseDesign.mockReturnValue({
      design: {
        headerOverride: {
          Header: CrashingHeader,
        },
      },
      isSafeMode: false,
    });

    render(<Header />);

    expect(screen.getByRole("button", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Tenant Slot")).toBeInTheDocument();
    expect(screen.getByText("User Menu Slot")).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});
