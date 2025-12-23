"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { useAuth } from "@/contexts/auth-context";

export function Header(): React.ReactElement {
  const { user, isLoading } = useAuth();

  return (
    <header className="border-b bg-white">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold">
          SaaS App
        </Link>

        <nav className="flex items-center gap-4">
          {isLoading ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
          ) : user ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost">Dashboard</Button>
              </Link>
              {user.role === "admin" && (
                <Link href="/admin/dashboard">
                  <Button variant="ghost">Admin</Button>
                </Link>
              )}
              <UserMenu />
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost">Sign in</Button>
              </Link>
              <Link href="/register">
                <Button>Get started</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
