import { Card } from "@fresh-cup/ui";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <Card className="max-w-lg text-center">
        <p className="mb-2 font-sans text-caption uppercase tracking-widest text-green-700">
          Staff Dashboard
        </p>
        <h1 className="mb-4 font-display text-h2 text-green-900">Fresh Cup Admin</h1>
        <p className="font-sans text-body text-neutral-500">
          Menu management, live orders, inventory, and analytics land in later phases. This is the
          Phase&nbsp;0 project foundation.
        </p>
      </Card>
    </main>
  );
}
