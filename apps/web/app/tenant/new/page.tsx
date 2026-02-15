"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@saas/ui/card";
import { Button } from "@saas/ui/button";
import { Input } from "@saas/ui/input";
import { Label } from "@saas/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { useI18n } from "@/contexts/i18n-context";
import { tenantsApi, ApiError } from "@/lib/api";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";

export default function NewTenantPage(): React.ReactElement {
  const { t } = useI18n("skeleton");
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error(t("tenantNew.enterTeamName"));
      return;
    }

    setIsLoading(true);
    try {
      const tenant = await tenantsApi.create({ name: name.trim() });
      // Switch to the new tenant
      await tenantsApi.switch(tenant.id);
      await refreshUser();
      toast.success(t("tenantNew.teamCreatedSuccess"));
      router.push("/dashboard");
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(t("tenantNew.teamCreateError"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    router.push("/login");
    return <></>;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-lg">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Building2 className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle>{t("tenantNew.title")}</CardTitle>
          <CardDescription>
            {t("tenantNew.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("tenantNew.teamName")}</Label>
              <Input
                id="name"
                type="text"
                placeholder={t("tenantNew.teamNamePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isLoading}
                className="flex-1"
              >
                {t("tenantNew.cancel")}
              </Button>
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("tenantNew.creating")}
                  </>
                ) : (
                  t("tenantNew.createTeam")
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
