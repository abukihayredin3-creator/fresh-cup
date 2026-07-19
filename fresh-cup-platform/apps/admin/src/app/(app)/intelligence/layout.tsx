import { IntelligenceTabs } from "./IntelligenceTabs";

export default function IntelligenceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-h3 text-fg">Intelligence</h1>
        <p className="text-body-sm text-fg-muted">
          AI-powered forecasting, customer/inventory/marketing insights, and an assistant — all
          computed from real order, inventory, and customer data. Nothing here is fabricated.
        </p>
      </div>
      <IntelligenceTabs />
      {children}
    </div>
  );
}
