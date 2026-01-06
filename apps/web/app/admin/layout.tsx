import { type ReactNode } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { verifyUserCookie } from "@/lib/cookie-signing"
import { AdminLayoutClient } from "./admin-layout-client"

/**
 * Admin layout component (Server Component).
 * Performs server-side auth check to prevent FOUC (Flash of Unauthorized Content).
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}): Promise<React.ReactElement> {
  const cookieStore = await cookies()
  const userInfoCookie = cookieStore.get("user-info")

  // No cookie = not authenticated, redirect immediately (no flash)
  if (!userInfoCookie?.value) {
    redirect("/login")
  }

  // Verify the signed cookie
  const userInfo = await verifyUserCookie(userInfoCookie.value)

  // Invalid cookie or not admin = redirect (no flash)
  if (!userInfo || userInfo.role !== "admin") {
    redirect("/dashboard")
  }

  // User is verified admin - render the layout
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="w-full lg:w-64 shrink-0">
            <nav className="bg-white rounded-lg shadow p-4">
              <div className="mb-4 px-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  Admin Panel
                </h2>
                <p className="text-sm text-gray-500">Manage your application</p>
              </div>
              <AdminLayoutClient />
            </nav>
          </aside>

          {/* Main content */}
          <div className="flex-1">{children}</div>
        </div>
      </div>
    </div>
  )
}
