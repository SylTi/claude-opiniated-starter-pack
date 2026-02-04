import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DynamicUserMenu } from "@/components/nav/dynamic-user-menu";
import type { NavSectionWithIcons } from "@/lib/nav/types";

const mockPush = vi.fn();
const mockLogout = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

const sections: NavSectionWithIcons[] = [
  {
    id: "core.account",
    label: "Account",
    order: 100,
    items: [
      {
        id: "app.theme.toggle",
        label: "Theme",
        href: "#",
        order: 10,
      },
      {
        id: "core.profile",
        label: "Profile",
        href: "/profile",
        order: 100,
      },
      {
        id: "core.logout",
        label: "Log out",
        href: "#",
        order: 9999,
      },
    ],
  },
];

describe("DynamicUserMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "";
    document.documentElement.classList.remove("dark");
    mockUseAuth.mockReturnValue({
      user: {
        id: 1,
        email: "user@example.com",
        fullName: "User Example",
        avatarUrl: null,
      },
      logout: mockLogout,
    });
  });

  it("renders a theme switch for app.theme.toggle", async () => {
    const user = userEvent.setup();
    render(<DynamicUserMenu sections={sections} />);

    await user.click(screen.getByTestId("user-menu"));

    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("toggles dark mode and writes theme cookies", async () => {
    const user = userEvent.setup();
    render(<DynamicUserMenu sections={sections} />);

    await user.click(screen.getByTestId("user-menu"));
    const switchButton = screen.getByRole("switch");

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    await user.click(switchButton);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.cookie).toContain("saas-theme=dark");
    expect(document.cookie).toContain("notarium-theme=dark");
  });
});
