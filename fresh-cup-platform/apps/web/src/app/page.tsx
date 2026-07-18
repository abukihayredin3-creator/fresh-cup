import { Button, Card } from "@fresh-cup/ui";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <Card className="max-w-lg text-center">
        <p className="mb-2 font-sans text-caption uppercase tracking-widest text-green-700">
          Merkato, Addis Ababa
        </p>
        <h1 className="mb-4 font-display text-h2 text-green-900">Fresh Cup Juice House</h1>
        <p className="mb-8 font-sans text-body text-neutral-500">
          The online ordering experience is under construction. This is the Phase&nbsp;0 project
          foundation — menu browsing, checkout, and QR dine-in ordering land in the next phase.
        </p>
        <Button variant="primary" disabled>
          Order Now — Coming Soon
        </Button>
      </Card>
    </main>
  );
}
