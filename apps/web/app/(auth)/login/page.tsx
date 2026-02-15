"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { GoogleIcon, GitHubIcon } from "@/components/oauth-icons";
import { Button } from "@saas/ui/button";
import { Input } from "@saas/ui/input";
import { Label } from "@saas/ui/label";
import { Alert, AlertDescription } from "@saas/ui/alert";
import { Separator } from "@saas/ui/separator";
import { useAuth } from "@/contexts/auth-context";
import { useI18n } from "@/contexts/i18n-context";
import { oauthApi } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { loginSchema, type LoginFormData } from "@/lib/validations";

/**
 * Validate and sanitize callback URL to prevent open redirect attacks.
 * Only allows relative paths starting with /.
 * Blocks auth routes to prevent redirect loops.
 */
function getSafeCallbackUrl(callbackUrl: string | null): string {
  const defaultUrl = "/dashboard";

  if (!callbackUrl) {
    return defaultUrl;
  }

  // Must be a relative path starting with /
  if (!callbackUrl.startsWith("/")) {
    return defaultUrl;
  }

  // Reject protocol-relative URLs (//evil.com)
  if (callbackUrl.startsWith("//")) {
    return defaultUrl;
  }

  // Reject backslash (can be used for path traversal on some systems)
  if (callbackUrl.includes("\\")) {
    return defaultUrl;
  }

  // Reject auth routes to prevent redirect loops after login
  if (
    callbackUrl === "/login" ||
    callbackUrl.startsWith("/login/") ||
    callbackUrl.startsWith("/auth/") ||
    callbackUrl === "/register" ||
    callbackUrl.startsWith("/register/")
  ) {
    return defaultUrl;
  }

  // Note: @ is allowed as it's valid in query strings (e.g., ?email=user@example.com)
  // For relative paths starting with /, @ cannot indicate credentials

  return callbackUrl;
}

export default function LoginPage(): React.ReactElement {
  const { t } = useI18n("skeleton");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, refreshUser, isAuthenticated, isLoading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [requiresMfa, setRequiresMfa] = useState(false);

  // Get safe callback URL from query params (supports both callbackUrl and returnTo)
  const redirectUrl = useMemo(() => {
    const callbackUrl = searchParams.get("callbackUrl");
    const returnTo = searchParams.get("returnTo");
    return getSafeCallbackUrl(callbackUrl ?? returnTo);
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
  });

  // Set page title
  useEffect(() => {
    document.title = t("auth.login.pageTitle");
  }, [t]);

  // Redirect authenticated users to callback URL or dashboard
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push(redirectUrl);
    }
  }, [isAuthenticated, authLoading, router, redirectUrl]);

  const onSubmit = async (data: LoginFormData): Promise<void> => {
    try {
      setError(null);
      const result = await login(data.email, data.password, data.mfaCode);

      if (result.requiresMfa) {
        setRequiresMfa(true);
        return;
      }

      const refreshedUser = await refreshUser();
      if (!refreshedUser) {
        setError(t("auth.login.sessionVerifyError"));
        return;
      }

      router.replace(redirectUrl);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error && err.message) {
        setError(err.message);
      } else {
        setError(t("common.unexpectedError"));
      }
    }
  };

  const handleOAuthLogin = (provider: "google" | "github"): void => {
    // Pass callbackUrl to OAuth flow so it can be restored after authentication
    const oauthUrl = oauthApi.getRedirectUrl(provider, redirectUrl);
    window.location.href = oauthUrl;
  };

  return (
    <>
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          {t("auth.login.title")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("auth.login.createAccountPrefix")}{" "}
          <Link
            href="/register"
            className="font-medium text-primary hover:text-primary/80"
          >
            {t("auth.login.createAccountLink")}
          </Link>
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="email">{t("auth.login.emailLabel")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              aria-required="true"
              {...register("email")}
              className="mt-1"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="password">{t("auth.login.passwordLabel")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
              className="mt-1"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          {requiresMfa && (
            <div>
              <Label htmlFor="mfaCode">{t("auth.login.mfaLabel")}</Label>
              <Input
                id="mfaCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="one-time-code"
                placeholder={t("auth.login.mfaPlaceholder")}
                {...register("mfaCode")}
                className="mt-1"
              />
              {errors.mfaCode && (
                <p className="mt-1 text-sm text-destructive">
                  {errors.mfaCode.message}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm">
            <Link
              href="/forgot-password"
              className="font-medium text-primary hover:text-primary/80"
            >
              {t("auth.login.forgotPassword")}
            </Link>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("auth.login.signingIn")}
            </>
          ) : (
            t("auth.login.signInButton")
          )}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-background px-2 text-muted-foreground">
              {t("auth.login.orContinueWith")}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOAuthLogin("google")}
          >
            <GoogleIcon className="mr-2" />
            Google
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOAuthLogin("github")}
          >
            <GitHubIcon className="mr-2" />
            GitHub
          </Button>
        </div>
      </form>
    </>
  );
}
