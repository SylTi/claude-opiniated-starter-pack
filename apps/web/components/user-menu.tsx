"use client";

import { useRouter } from "next/navigation";
import {
  User,
  Settings,
  LogOut,
  Shield,
  LayoutDashboard,
  Users,
  UsersRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@saas/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@saas/ui/dropdown-menu";
import { useAuth } from "@/contexts/auth-context";
import { useI18n } from "@/contexts/i18n-context";

export function UserMenu(): React.ReactElement {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t } = useI18n("skeleton");

  if (!user) {
    return <></>;
  }

  const initials = user.fullName
    ? user.fullName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email[0].toUpperCase();

  const handleLogout = async (): Promise<void> => {
    await logout();
    router.push("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="user-menu"
          className="flex cursor-pointer items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={user.avatarUrl || undefined}
              alt={user.fullName || user.email}
            />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user.fullName || t("user.defaultName")}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/dashboard")}>
          <LayoutDashboard className="mr-2 h-4 w-4" />
          <span>{t("user.dashboard")}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/profile")}>
          <User className="mr-2 h-4 w-4" />
          <span>{t("user.profile")}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/profile/security")}>
          <Shield className="mr-2 h-4 w-4" />
          <span>{t("user.security")}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/profile/settings")}>
          <Settings className="mr-2 h-4 w-4" />
          <span>{t("user.settings")}</span>
        </DropdownMenuItem>
        {user.currentTenantId && user.effectiveSubscriptionTier.level > 0 && (
          <DropdownMenuItem onClick={() => router.push("/team")}>
            <UsersRound className="mr-2 h-4 w-4" />
            <span>{t("user.team")}</span>
          </DropdownMenuItem>
        )}
        {user.role === "admin" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/admin/dashboard")}>
              <Users className="mr-2 h-4 w-4" />
              <span>{t("user.adminPanel")}</span>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t("user.logout")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
