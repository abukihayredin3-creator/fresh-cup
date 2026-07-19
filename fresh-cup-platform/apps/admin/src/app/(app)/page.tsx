import { Card } from "@fresh-cup/ui";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-h3 text-fg">Dashboard</h1>
      <Card>
        <p className="text-body text-fg-muted">
          Live sales, orders, and inventory widgets land here.
        </p>
      </Card>
    </div>
  );
}
