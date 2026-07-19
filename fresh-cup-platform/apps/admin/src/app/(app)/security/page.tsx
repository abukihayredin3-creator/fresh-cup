"use client";

import { Badge, Button, Card, DataTable, Input, useToast } from "@fresh-cup/ui";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  useApiKeys,
  useCreateApiKey,
  useDisableTwoFactor,
  useEnrollTwoFactor,
  useMySessions,
  useRevokeAllUserSessions,
  useRevokeApiKey,
  useRevokeMySession,
  useTwoFactorStatus,
  useVerifyTwoFactor,
} from "@/lib/use-security";

function SessionsCard() {
  const { data, isLoading } = useMySessions();
  const revokeSession = useRevokeMySession();
  const { show: showToast } = useToast();

  async function handleRevoke(id: string) {
    try {
      await revokeSession.mutateAsync(id);
      showToast({ title: "Session revoked", tone: "success" });
    } catch {
      showToast({ title: "Could not revoke session", tone: "error" });
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <p className="text-body font-medium text-fg">My Sessions</p>
      <DataTable
        caption="Active sessions"
        loading={isLoading}
        rows={data ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No active sessions"
        columns={[
          {
            key: "created",
            header: "Created",
            render: (row) => new Date(row.createdAt).toLocaleString(),
          },
          {
            key: "expires",
            header: "Expires",
            render: (row) => new Date(row.expiresAt).toLocaleString(),
          },
          {
            key: "actions",
            header: "",
            align: "end",
            render: (row) => (
              <button
                type="button"
                onClick={() => handleRevoke(row.id)}
                className="text-caption text-danger-text underline-offset-2 hover:underline"
              >
                Revoke
              </button>
            ),
          },
        ]}
      />
    </Card>
  );
}

function TwoFactorCard() {
  const { data: status, isLoading } = useTwoFactorStatus();
  const enroll = useEnrollTwoFactor();
  const verify = useVerifyTwoFactor();
  const disable = useDisableTwoFactor();
  const { show: showToast } = useToast();

  const [enrollment, setEnrollment] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");

  async function handleEnroll() {
    try {
      const result = await enroll.mutateAsync();
      setEnrollment(result);
    } catch {
      showToast({ title: "Could not start enrollment", tone: "error" });
    }
  }

  async function handleVerify() {
    if (!code.trim()) return;
    try {
      await verify.mutateAsync(code);
      setEnrollment(null);
      setCode("");
      showToast({ title: "Two-factor authentication enabled", tone: "success" });
    } catch {
      showToast({ title: "Invalid code", tone: "error" });
    }
  }

  async function handleDisable() {
    if (!code.trim()) return;
    try {
      await disable.mutateAsync(code);
      setCode("");
      showToast({ title: "Two-factor authentication disabled", tone: "success" });
    } catch {
      showToast({ title: "Invalid code", tone: "error" });
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <p className="text-body font-medium text-fg">Two-Factor Authentication</p>
        {!isLoading ? (
          <Badge tone={status?.enabled ? "green" : "neutral"}>
            {status?.enabled ? "Enabled" : "Disabled"}
          </Badge>
        ) : null}
      </div>

      {status?.enabled ? (
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Enter your current code to disable"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-40"
          />
          <Button
            variant="secondary"
            onClick={handleDisable}
            loading={disable.isPending}
            disabled={!code.trim()}
          >
            Disable 2FA
          </Button>
        </div>
      ) : enrollment ? (
        <div className="flex flex-col gap-3">
          <p className="text-body-sm text-fg-muted">
            Scan this in an authenticator app, or enter the secret manually:
          </p>
          <p className="break-all rounded border border-border bg-surface-alt p-2 text-caption text-fg">
            {enrollment.secret}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Input
              label="Verification code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-40"
            />
            <Button onClick={handleVerify} loading={verify.isPending} disabled={!code.trim()}>
              Verify and enable
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button onClick={handleEnroll} loading={enroll.isPending}>
            Set up two-factor authentication
          </Button>
        </div>
      )}
    </Card>
  );
}

function ApiKeysCard() {
  const { data, isLoading } = useApiKeys();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();
  const { show: showToast } = useToast();

  const [name, setName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) return;
    try {
      const result = await createKey.mutateAsync(name);
      setCreatedKey(result.key);
      setName("");
    } catch {
      showToast({ title: "Could not create API key", tone: "error" });
    }
  }

  async function handleRevoke(id: string) {
    try {
      await revokeKey.mutateAsync(id);
      showToast({ title: "API key revoked", tone: "success" });
    } catch {
      showToast({ title: "Could not revoke API key", tone: "error" });
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <p className="text-body font-medium text-fg">API Keys</p>
      {createdKey ? (
        <p className="break-all rounded border border-orange-600 bg-orange-600/10 p-2 text-caption text-fg">
          Copy this key now — it will not be shown again: {createdKey}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <Input
          label="Key name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-56"
        />
        <Button onClick={handleCreate} loading={createKey.isPending} disabled={!name.trim()}>
          Create key
        </Button>
      </div>
      <DataTable
        caption="API keys"
        loading={isLoading}
        rows={data ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No API keys yet"
        columns={[
          { key: "name", header: "Name", render: (row) => row.name },
          { key: "prefix", header: "Prefix", render: (row) => row.keyPrefix },
          {
            key: "status",
            header: "Status",
            render: (row) => (
              <Badge tone={row.revokedAt ? "neutral" : "green"}>
                {row.revokedAt ? "Revoked" : "Active"}
              </Badge>
            ),
          },
          {
            key: "actions",
            header: "",
            align: "end",
            render: (row) =>
              row.revokedAt ? null : (
                <button
                  type="button"
                  onClick={() => handleRevoke(row.id)}
                  className="text-caption text-danger-text underline-offset-2 hover:underline"
                >
                  Revoke
                </button>
              ),
          },
        ]}
      />
    </Card>
  );
}

function AdminUserSessionsCard() {
  const revokeAll = useRevokeAllUserSessions();
  const { show: showToast } = useToast();
  const [userId, setUserId] = useState("");

  async function handleRevokeAll() {
    if (!userId.trim()) return;
    try {
      await revokeAll.mutateAsync(userId);
      showToast({ title: "All sessions revoked for that user", tone: "success" });
      setUserId("");
    } catch {
      showToast({ title: "Could not revoke sessions", tone: "error" });
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <p className="text-body font-medium text-fg">Revoke a User&apos;s Sessions</p>
      <div className="flex flex-wrap items-end gap-3">
        <Input
          label="User ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          hint="Force sign-out everywhere for a compromised or offboarded account"
          className="w-64"
        />
        <Button
          variant="secondary"
          onClick={handleRevokeAll}
          loading={revokeAll.isPending}
          disabled={!userId.trim()}
        >
          Revoke all sessions
        </Button>
      </div>
    </Card>
  );
}

export default function SecurityPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-h3 text-fg">Security</h1>
      <SessionsCard />
      <TwoFactorCard />
      {isAdmin ? <ApiKeysCard /> : null}
      {isAdmin ? <AdminUserSessionsCard /> : null}
    </div>
  );
}
