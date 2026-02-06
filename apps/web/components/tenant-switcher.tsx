"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/auth-context";
import { tenantsApi, ApiError } from "@/lib/api";
import { toast } from "sonner";
import type { TenantDTO } from "@saas/shared";

interface TenantSwitcherProps {
  className?: string;
}

export function TenantSwitcher({
  className,
}: TenantSwitcherProps): React.ReactElement | null {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [tenants, setTenants] = useState<TenantDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  // Extract user ID to avoid re-fetching when user object reference changes
  // but the user hasn't actually changed
  const userId = user?.id;

  const fetchTenants = useCallback(async (): Promise<void> => {
    if (!userId) return;

    setIsLoading(true);
    try {
      const data = await tenantsApi.list();
      setTenants(data);
    } catch (error) {
      if (error instanceof ApiError) {
        console.error("Failed to fetch tenants:", error.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const handleSwitchTenant = async (tenantId: number): Promise<void> => {
    if (tenantId === user?.currentTenantId) return;

    setIsSwitching(true);
    try {
      await tenantsApi.switch(tenantId);
      await refreshUser();
      toast.success("Switched workspace");
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to switch workspace");
      }
    } finally {
      setIsSwitching(false);
    }
  };

  const handleCreateTenant = (): void => {
    router.push("/tenant/new");
  };

  if (!user) {
    return null;
  }

  const currentTenant = tenants.find((t) => t.id === user.currentTenantId);
  const personalTenants = tenants.filter((t) => t.type === "personal");
  const teamTenants = tenants.filter((t) => t.type === "team");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={className}
          disabled={isLoading || isSwitching}
        >
          {currentTenant?.type === "personal" ? (
            <User className="mr-2 h-4 w-4" />
          ) : (
            <Building2 className="mr-2 h-4 w-4" />
          )}
          <span className="truncate max-w-[150px]">
            {currentTenant?.name || "Select workspace"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        {personalTenants.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Personal
            </DropdownMenuLabel>
            {personalTenants.map((tenant) => (
              <DropdownMenuItem
                key={tenant.id}
                onClick={() => handleSwitchTenant(tenant.id)}
                className="cursor-pointer"
              >
                <User className="mr-2 h-4 w-4" />
                <span className="truncate flex-1">{tenant.name}</span>
                {tenant.id === user.currentTenantId && (
                  <Check className="ml-2 h-4 w-4" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {teamTenants.length > 0 && (
          <>
            {personalTenants.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Teams
            </DropdownMenuLabel>
            {teamTenants.map((tenant) => (
              <DropdownMenuItem
                key={tenant.id}
                onClick={() => handleSwitchTenant(tenant.id)}
                className="cursor-pointer"
              >
                <Building2 className="mr-2 h-4 w-4" />
                <span className="truncate flex-1">{tenant.name}</span>
                {tenant.id === user.currentTenantId && (
                  <Check className="ml-2 h-4 w-4" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleCreateTenant}
          className="cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" />
          <span>Create team</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
