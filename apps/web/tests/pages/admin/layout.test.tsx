import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import AdminLayout from "@/app/admin/layout"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { verifyUserCookie } from "@/lib/cookie-signing"

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  usePathname: () => "/admin/dashboard",
}))

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}))

vi.mock("@/lib/cookie-signing", () => ({
  verifyUserCookie: vi.fn(),
}))

describe("Admin Layout", () => {
  const mockCookies = vi.mocked(cookies)
  const mockRedirect = vi.mocked(redirect)
  const mockVerify = vi.mocked(verifyUserCookie)

  beforeEach(() => {
    vi.clearAllMocks()
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT")
    })
  })

  it("redirects to login when no user cookie exists", async () => {
    mockCookies.mockResolvedValue({
      get: () => undefined,
    } as never)

    await expect(
      AdminLayout({ children: <div>Admin Content</div> }),
    ).rejects.toThrow("NEXT_REDIRECT")
    expect(mockRedirect).toHaveBeenCalledWith("/login")
  })

  it("redirects to dashboard when user is not admin", async () => {
    mockCookies.mockResolvedValue({
      get: () => ({ value: "signed-cookie" }),
    } as never)
    mockVerify.mockResolvedValue({
      role: "user",
    })

    await expect(
      AdminLayout({ children: <div>Admin Content</div> }),
    ).rejects.toThrow("NEXT_REDIRECT")
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard")
  })

  it("renders admin layout for admin users", async () => {
    mockCookies.mockResolvedValue({
      get: () => ({ value: "signed-cookie" }),
    } as never)
    mockVerify.mockResolvedValue({
      role: "admin",
    })

    render(await AdminLayout({ children: <div>Admin Content</div> }))

    expect(screen.getByText("Admin Panel")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute(
      "href",
      "/admin/dashboard",
    )
    expect(screen.getByRole("link", { name: /users/i })).toHaveAttribute(
      "href",
      "/admin/users",
    )
    expect(screen.getByRole("link", { name: /tiers/i })).toHaveAttribute(
      "href",
      "/admin/tiers",
    )
    expect(screen.getByText("Admin Content")).toBeInTheDocument()
  })
})
