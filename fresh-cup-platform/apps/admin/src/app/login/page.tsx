"use client";

import { ApiError } from "@fresh-cup/api-client";
import { Button, Card, Input } from "@fresh-cup/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.problem?.title ?? "Something went wrong.";
  }
  return "Something went wrong.";
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/";
  const { staffLogin } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await staffLogin(email, password);
      router.push(returnTo);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16 sm:px-6">
      <Card padded className="flex flex-col gap-6">
        <div className="text-center">
          <p className="mb-1 text-caption font-medium uppercase tracking-widest text-accent-text">
            Fresh Cup Admin
          </p>
          <h1 className="font-display text-h4 text-fg">Sign in</h1>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded border border-error-600 bg-error-600/15 px-3 py-2 text-body-sm text-fg"
          >
            {error}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            type="email"
            label="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
          <Input
            type="password"
            label="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
          <Button type="submit" loading={loading}>
            Sign in
          </Button>
        </form>
      </Card>
    </div>
  );
}
