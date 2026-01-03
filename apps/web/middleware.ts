import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decryptUserCookie } from "@/lib/cookie-signing";

/**
 * Public routes that don't require authentication
 */
const publicRoutes = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

/**
 * Routes that require admin role
 */
const adminRoutes = ["/admin"];

/**
 * Check if path matches any of the given routes
 */
function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

/**
 * Check if path is a static asset or API route
 */
function isStaticOrApi(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") // Files with extensions (favicon.ico, etc.)
  );
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Skip static assets and API routes
  if (isStaticOrApi(pathname)) {
    return NextResponse.next();
  }

  // Skip public routes
  if (matchesRoute(pathname, publicRoutes)) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionCookie = request.cookies.get("adonis-session");

  if (!sessionCookie) {
    // Redirect to login with return URL
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // For admin routes, verify admin role from signed cookie (optimization to avoid API calls)
  // Security: This is only for routing. Actual admin API calls are protected by backend auth middleware.
  if (matchesRoute(pathname, adminRoutes)) {
    const userInfoCookie = request.cookies.get("user-info");

    if (!userInfoCookie?.value) {
      // No user info cookie, redirect to dashboard (they're logged in but we don't know their role)
      // The dashboard will handle checking their actual permissions
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Verify and decrypt the JWT cookie
    const userInfo = await decryptUserCookie(userInfoCookie.value);

    if (!userInfo || userInfo.role !== "admin") {
      // Invalid cookie or not an admin, redirect to dashboard
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)",
  ],
};
