"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { authApi } from "@/lib/auth";
import { oauthApi } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { registerSchema, type RegisterFormData } from "@/lib/validations";

export default function RegisterPage(): React.ReactElement {
  const { t } = useI18n("skeleton");
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: "onBlur",
  });

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, authLoading, router]);

  const onSubmit = async (data: RegisterFormData): Promise<void> => {
    try {
      setError(null);
      await authApi.register({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("common.unexpectedError"));
      }
    }
  };

  const handleOAuthLogin = (provider: "google" | "github"): void => {
    window.location.href = oauthApi.getRedirectUrl(provider);
  };

  if (success) {
    return (
      <>
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            {t("auth.register.checkEmailTitle")}
          </h2>
          <p className="mt-4 text-muted-foreground">
            {t("auth.register.checkEmailMessage")}
          </p>
          <Button className="mt-6" onClick={() => router.push("/login")}>
            {t("common.goToLogin")}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          {t("auth.register.title")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("auth.register.alreadyHaveAccount")}{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:text-primary/80"
          >
            {t("auth.register.signInLink")}
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
            <Label htmlFor="fullName">{t("auth.register.fullNameOptional")}</Label>
            <Input
              id="fullName"
              type="text"
              autoComplete="name"
              {...register("fullName")}
              className="mt-1"
            />
            {errors.fullName && (
              <p className="mt-1 text-sm text-destructive">
                {errors.fullName.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="email">{t("auth.register.emailLabel")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
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
            <Label htmlFor="password">{t("auth.register.passwordLabel")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
              className="mt-1"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="passwordConfirmation">{t("auth.register.confirmPasswordLabel")}</Label>
            <Input
              id="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              {...register("passwordConfirmation")}
              className="mt-1"
            />
            {errors.passwordConfirmation && (
              <p className="mt-1 text-sm text-destructive">
                {errors.passwordConfirmation.message}
              </p>
            )}
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("auth.register.creatingAccount")}
            </>
          ) : (
            t("auth.register.createAccountButton")
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
