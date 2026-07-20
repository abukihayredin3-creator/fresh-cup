import { EnterpriseTabs } from "./EnterpriseTabs";

export default function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-h3 text-fg">Enterprise</h1>
        <p className="text-body-sm text-fg-muted">
          Phase 8 — multi-tenant organization, regions, franchises, feature flags, licensing, SSO,
          currency/tax configuration, and cross-branch analytics for the organization this account
          belongs to.
        </p>
      </div>
      <EnterpriseTabs />
      {children}
    </div>
  );
}
