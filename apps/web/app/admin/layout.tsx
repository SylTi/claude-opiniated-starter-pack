"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Users, Loader2, Tag, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

const navigation = [
  { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Discount Codes", href: "/admin/discount-codes", icon: Tag },
  { name: "Coupons", href: "/admin/coupons", icon: Ticket },
];

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }

    if (!isLoading && user && user.role !== "admin") {
      toast.error("Access denied. Admin only.");
      router.push("/dashboard");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return <></>;
  }

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
              <ul className="space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                          isActive
                            ? "bg-blue-50 text-blue-700"
                            : "text-gray-700 hover:bg-gray-100",
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>

          {/* Main content */}
          <div className="flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
