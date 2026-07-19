"use client";

import { ApiError } from "@fresh-cup/api-client";
import { Button, Card, Input } from "@fresh-cup/ui";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";

type Mode = "customer-phone" | "customer-code" | "staff";

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.problem?.title ?? fallback;
  }
  return fallback;
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/";
  const { requestOtp, verifyOtp, staffLogin } = useAuth();

  const [mode, setMode] = useState<Mode>("customer-phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitRequestOtp() {
    setError(null);
    setLoading(true);
    try {
      await requestOtp(phone);
      setMode("customer-code");
    } catch (err) {
      setError(errorMessage(err, common("somethingWentWrong")));
    } finally {
      setLoading(false);
    }
  }

  function handleRequestOtp(event: FormEvent) {
    event.preventDefault();
    void submitRequestOtp();
  }

  async function handleVerifyOtp(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(phone, code);
      router.push(returnTo);
    } catch {
      setError(t("invalidCode"));
    } finally {
      setLoading(false);
    }
  }

  async function handleStaffLogin(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await staffLogin(email, password);
      router.push(returnTo);
    } catch (err) {
      setError(errorMessage(err, common("somethingWentWrong")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16 sm:px-6">
      <Card padded className="flex flex-col gap-6">
        <h1 className="text-center font-display text-h4 text-green-900 dark:text-green-700">
          {mode === "staff" ? t("staffTitle") : t("title")}
        </h1>

        {error ? (
          <p
            role="alert"
            className="rounded border border-error-600 bg-error-600/15 px-3 py-2 text-body-sm text-fg"
          >
            {error}
          </p>
        ) : null}

        {mode === "customer-phone" ? (
          <form onSubmit={handleRequestOtp} className="flex flex-col gap-4">
            <Input
              type="tel"
              label={t("phoneLabel")}
              hint={t("phoneHint")}
              placeholder="+251 9XX XXX XXX"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
              autoComplete="tel"
            />
            <Button type="submit" loading={loading} disabled={phone.trim().length === 0}>
              {t("sendCode")}
            </Button>
          </form>
        ) : null}

        {mode === "customer-code" ? (
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
            <Input
              type="text"
              inputMode="numeric"
              label={t("codeLabel")}
              hint={t("codeHint")}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
              autoComplete="one-time-code"
            />
            <Button type="submit" loading={loading} disabled={code.trim().length === 0}>
              {t("verify")}
            </Button>
            <div className="flex items-center justify-between text-body-sm">
              <button
                type="button"
                onClick={() => void submitRequestOtp()}
                className="text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
              >
                {t("resendCode")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("customer-phone");
                  setCode("");
                  setError(null);
                }}
                className="text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
              >
                {t("changePhone")}
              </button>
            </div>
          </form>
        ) : null}

        {mode === "staff" ? (
          <form onSubmit={handleStaffLogin} className="flex flex-col gap-4">
            <Input
              type="email"
              label={t("emailLabel")}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
            <Input
              type="password"
              label={t("passwordLabel")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
            <Button type="submit" loading={loading}>
              {t("signIn")}
            </Button>
          </form>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setMode(mode === "staff" ? "customer-phone" : "staff");
            setError(null);
          }}
          className="text-center text-caption text-fg-muted underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
        >
          {mode === "staff" ? t("title") : t("staffLoginLink")}
        </button>
      </Card>
    </div>
  );
}
