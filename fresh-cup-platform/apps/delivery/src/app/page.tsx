import { Card } from "@fresh-cup/ui";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <Card className="max-w-lg text-center">
        <p className="mb-2 font-sans text-caption uppercase tracking-widest text-green-700">
          Rider Dashboard
        </p>
        <h1 className="mb-4 font-display text-h2 text-green-900">Fresh Cup Delivery</h1>
        <p className="font-sans text-body text-neutral-500">
          Delivery assignments, live tracking, and rider status updates land in Phase&nbsp;2. This
          is the Phase&nbsp;0 project foundation.
        </p>
      </Card>
    </main>
  );
}
