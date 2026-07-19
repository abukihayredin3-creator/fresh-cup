import { Card } from "@fresh-cup/ui";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("common");
  const nav = await getTranslations("nav");

  const highlights = [
    {
      title: "Cold-pressed daily",
      body: "Fresh fruit and vegetables juiced every morning, never from concentrate.",
    },
    {
      title: "Dine in, pickup, or delivery",
      body: "Scan the table QR code, grab it on your way, or have it brought to you.",
    },
    {
      title: "Earn loyalty points",
      body: "Every order adds up — redeem points for free drinks and food.",
    },
  ];

  return (
    <>
      <section className="bg-tint-green">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-24">
          <p className="font-sans text-caption uppercase tracking-widest text-fg-muted">
            Merkato, Addis Ababa
          </p>
          <h1 className="max-w-2xl font-display text-h1 text-fg">Fresh Cup Juice House</h1>
          <p className="max-w-xl font-sans text-body text-fg-muted">
            Cold-pressed juices, smoothies, and healthy bites — order for dine-in, pickup, or
            delivery.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/menu"
              className="inline-flex items-center justify-center gap-2 rounded bg-orange-600 px-6 py-3 text-h5 font-medium text-neutral-900 transition-colors hover:bg-orange-600/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              {nav("menu")}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-3">
          {highlights.map((item) => (
            <Card key={item.title} padded>
              <h2 className="mb-2 font-display text-h5 text-fg">{item.title}</h2>
              <p className="text-body-sm text-fg-muted">{item.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        <Card
          padded
          className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left"
        >
          <div>
            <h2 className="font-display text-h4 text-fg">Ready to order?</h2>
            <p className="mt-1 text-body-sm text-fg-muted">{t("searchPlaceholder")}</p>
          </div>
          <Link
            href="/menu"
            className="inline-flex items-center justify-center gap-2 rounded bg-orange-600 px-6 py-3 text-h5 font-medium text-neutral-900 transition-colors hover:bg-orange-600/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            {nav("menu")}
          </Link>
        </Card>
      </section>
    </>
  );
}
