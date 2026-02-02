import { type ReactNode } from "react"
import { redirect } from "next/navigation"
import { verifyUserFromApi } from "@/lib/server/auth"

/**
 * Admin layout component (Server Component).
 * Performs server-side auth check to prevent unauthorized access.
 *
 * SECURITY: API verification is the sole authoritative check.
 * The API call verifies the user's fresh role from the database.
 *
 * The user-info cookie is still useful for:
 * - UI hints (nav items, client-side checks)
 * - Non-critical optimizations where false-positive is acceptable
 *
 * NOTE: Shell rendering is handled by ShellWrapper in the root providers.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}): Promise<React.ReactElement> {
  // API verification - always authoritative for admin access
  const currentUser = await verifyUserFromApi()

  if (!currentUser) {
    // No valid session - redirect to login
    redirect("/login")
  }

  if (currentUser.role !== "admin") {
    // User's actual role (from DB) is not admin
    redirect("/dashboard")
  }

  // User is verified admin with fresh role data - render children
  // Shell structure is provided by ShellWrapper via the design system
  return <>{children}</>
}
