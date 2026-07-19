import { AnalyticsTabs } from "./AnalyticsTabs";

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-h3 text-fg">Analytics</h1>
      <AnalyticsTabs />
      {children}
    </div>
  );
}
