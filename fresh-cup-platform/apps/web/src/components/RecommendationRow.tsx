"use client";

import type { Locale, RecommendedItem } from "@fresh-cup/types";
import { PriceTag } from "@fresh-cup/ui";
import { Link } from "@/i18n/navigation";
import { localizedText } from "@/lib/localized";

export interface RecommendationRowProps {
  title: string;
  items: RecommendedItem[];
  locale: Locale;
}

/**
 * A horizontally-scrolling row of lightweight recommendation cards —
 * intentionally lighter than ProductCard (RecommendedItemDto carries no
 * image/description) since these are teasers meant to drive a tap-through
 * to the full product page, not a quick-add surface.
 */
export function RecommendationRow({ title, items, locale }: RecommendationRowProps) {
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-h5 text-fg">{title}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {items.map((item) => (
          <Link
            key={item.menuItemId}
            href={`/menu/${item.menuItemId}`}
            className="flex w-40 shrink-0 flex-col gap-1 rounded-lg border border-border bg-surface-alt p-3 hover:border-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
          >
            <p className="line-clamp-2 text-body-sm font-medium text-fg">
              {localizedText(item.nameEn, item.nameAm, locale)}
            </p>
            <PriceTag
              amount={item.basePrice}
              locale={locale}
              className="text-body-sm text-fg-muted"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
