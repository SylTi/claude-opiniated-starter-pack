"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, Link as LinkIcon, Unlink } from "lucide-react";
import { toast } from "sonner";
import { GoogleIcon, GitHubIcon } from "@/components/oauth-icons";
import { Button } from "@saas/ui/button";
import { Separator } from "@saas/ui/separator";
import { Alert, AlertDescription } from "@saas/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@saas/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { useI18n, useLocale } from "@/contexts/i18n-context";
import { oauthApi, authApi } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import type { OAuthAccountDTO, LoginHistoryDTO } from "@saas/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@saas/ui/select";

const providers = [
  { id: "google" as const, name: "Google", icon: GoogleIcon },
  { id: "github" as const, name: "GitHub", icon: GitHubIcon },
];

export default function SettingsPage(): React.ReactElement {
  const { t } = useI18n("skeleton");
  const { locale, setLocale } = useLocale();
  const { user } = useAuth();
  const [linkedAccounts, setLinkedAccounts] = useState<OAuthAccountDTO[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    const loadData = async (): Promise<void> => {
      try {
        const [accounts, history] = await Promise.all([
          oauthApi.getAccounts(),
          authApi.getLoginHistory(),
        ]);
        setLinkedAccounts(accounts);
        setLoginHistory(history);
      } catch {
        setError(t("settings.loadError"));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user, t]);

  const handleLink = (provider: "google" | "github"): void => {
    window.location.href = oauthApi.getLinkUrl(provider);
  };

  const handleUnlink = async (provider: "google" | "github"): Promise<void> => {
    try {
      setUnlinkingProvider(provider);
      setError(null);
      await oauthApi.unlink(provider);
      setLinkedAccounts((prev) => prev.filter((a) => a.provider !== provider));
      toast.success(t("settings.accountUnlinked", { provider }));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("settings.unlinkError"));
      }
    } finally {
      setUnlinkingProvider(null);
    }
  };

  const isLinked = (provider: string): boolean => {
    return linkedAccounts.some((a) => a.provider === provider);
  };

  const getLinkedAccount = (provider: string): OAuthAccountDTO | undefined => {
    return linkedAccounts.find((a) => a.provider === provider);
  };

  if (!user) {
    return <></>;
  }

  const currentLanguageLabel =
    locale === "fr" ? t("settings.languageFr") : t("settings.languageEn");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
      <p className="text-muted-foreground mt-1">
        {t("settings.subtitle")}
      </p>

      <Separator className="my-6" />

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Integrations */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t("settings.integrationsTitle")}</CardTitle>
          <CardDescription>
            {t("settings.integrationsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/profile/settings/integrations">{t("settings.openIntegrationTokens")}</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Language */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t("settings.languageTitle")}</CardTitle>
          <CardDescription>{t("settings.languageDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-xs">
            <label className="text-sm font-medium" htmlFor="language-select">
              {t("settings.languageLabel")}
            </label>
            <Select
              value={locale.startsWith("fr") ? "fr" : "en"}
              onValueChange={(value: string): void => {
                setLocale(value);
                const languageLabel =
                  value === "fr" ? t("settings.languageFr") : t("settings.languageEn");
                toast.success(
                  t("settings.languageUpdated", { language: languageLabel }),
                );
              }}
            >
              <SelectTrigger id="language-select">
                <SelectValue placeholder={currentLanguageLabel} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t("settings.languageEn")}</SelectItem>
                <SelectItem value="fr">{t("settings.languageFr")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Linked Accounts */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t("settings.linkedAccountsTitle")}</CardTitle>
          <CardDescription>
            {t("settings.linkedAccountsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {providers.map((provider) => {
            const linked = isLinked(provider.id);
            const account = getLinkedAccount(provider.id);
            const Icon = provider.icon;

            return (
              <div
                key={provider.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-6 w-6" />
                  <div>
                    <p className="font-medium">{provider.name}</p>
                    {linked && account?.email && (
                      <p className="text-sm text-muted-foreground">{account.email}</p>
                    )}
                  </div>
                </div>
                {linked ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnlink(provider.id)}
                    disabled={unlinkingProvider === provider.id}
                  >
                    {unlinkingProvider === provider.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Unlink className="mr-2 h-4 w-4" />
                        {t("settings.unlink")}
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleLink(provider.id)}
                  >
                    <LinkIcon className="mr-2 h-4 w-4" />
                    {t("settings.link")}
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Login History */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.recentLoginActivityTitle")}</CardTitle>
          <CardDescription>{t("settings.recentLoginActivityDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {loginHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              {t("settings.noLoginHistory")}
            </p>
          ) : (
            <div className="space-y-3">
              {loginHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium capitalize">
                      {entry.loginMethod === "mfa"
                        ? t("settings.loginMethodMfa")
                        : entry.loginMethod}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {entry.ipAddress || t("settings.unknownIp")} •{" "}
                      {new Date(entry.createdAt).toLocaleString(locale)}
                    </p>
                  </div>
                  <span
                    className={`text-sm px-2 py-1 rounded ${
                      entry.success
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {entry.success ? t("settings.loginSuccess") : t("settings.loginFailed")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
