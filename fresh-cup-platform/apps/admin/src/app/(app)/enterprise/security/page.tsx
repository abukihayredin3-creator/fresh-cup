"use client";

import { Badge, Button, Card, DataTable, Dialog, Input, Select, useToast } from "@fresh-cup/ui";
import type { SsoConnection, SsoProviderType } from "@fresh-cup/types";
import { useState } from "react";
import { useCreateSsoConnection, useSsoConnections } from "@/lib/use-enterprise";

const PROVIDER_OPTIONS: { value: SsoProviderType; label: string }[] = [
  { value: "GOOGLE_WORKSPACE", label: "Google Workspace" },
  { value: "MICROSOFT_ENTRA_ID", label: "Microsoft Entra ID" },
  { value: "OKTA", label: "Okta" },
  { value: "SAML", label: "Generic SAML 2.0" },
];

export default function EnterpriseSecurityPage() {
  const { data: connections, isLoading } = useSsoConnections();
  const createConnection = useCreateSsoConnection();
  const { show: showToast } = useToast();

  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<SsoProviderType>("GOOGLE_WORKSPACE");
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecretEnvVar, setClientSecretEnvVar] = useState("");

  async function handleCreate() {
    try {
      await createConnection.mutateAsync({
        provider,
        name,
        config: { issuer, clientId },
        clientSecretEnvVar: clientSecretEnvVar || undefined,
      });
      showToast({ title: "SSO connection created", tone: "success" });
      setOpen(false);
      setName("");
      setIssuer("");
      setClientId("");
      setClientSecretEnvVar("");
    } catch {
      showToast({ title: "Could not create SSO connection", tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-h5 text-fg">SSO connections</h2>
          <Button onClick={() => setOpen(true)}>New connection</Button>
        </div>
        <DataTable<SsoConnection>
          loading={isLoading}
          rows={connections ?? []}
          rowKey={(row) => row.id}
          emptyTitle="No SSO connections configured"
          columns={[
            { key: "name", header: "Name", render: (row) => row.name },
            { key: "provider", header: "Provider", render: (row) => row.provider },
            { key: "domain", header: "Domain hint", render: (row) => row.domainHint ?? "—" },
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <Badge tone={row.isEnabled ? "green" : "neutral"}>
                  {row.isEnabled ? "Enabled" : "Disabled"}
                </Badge>
              ),
            },
          ]}
        />
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} title="New SSO connection">
        <div className="flex flex-col gap-4">
          <Select
            label="Provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value as SsoProviderType)}
            options={PROVIDER_OPTIONS}
          />
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="Issuer / IdP URL"
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            hint="OIDC issuer URL or SAML IdP SSO URL"
          />
          <Input
            label="Client ID"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            hint="OIDC only — leave blank for SAML"
          />
          <Input
            label="Client secret env var"
            value={clientSecretEnvVar}
            onChange={(e) => setClientSecretEnvVar(e.target.value)}
            hint="Name of the env var holding the secret — never the secret itself"
          />
          <Button onClick={handleCreate} loading={createConnection.isPending}>
            Create
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
