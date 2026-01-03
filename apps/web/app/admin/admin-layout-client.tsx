"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

interface AdminLayoutClientProps {
  navigation: NavigationItem[];
}

/**
 * Client component for admin navigation.
 * Handles active state highlighting based on current pathname.
 */
export function AdminLayoutClient({
  navigation,
}: AdminLayoutClientProps): React.ReactElement {
  const pathname = usePathname()

  return (
    <ul className="space-y-1">
      {navigation.map((item) => {
        const isActive = pathname === item.href
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
        )
      })}
    </ul>
  )
}
