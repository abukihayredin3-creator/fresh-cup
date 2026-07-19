import type { Locale } from "@fresh-cup/types";
import type { ReactNode } from "react";
import { cn } from "../cn";
import { Card } from "./Card";
import { IconButton } from "./IconButton";
import { PriceTag } from "./PriceTag";

export interface ProductCardProps {
  name: string;
  description?: string | null;
  /** ETB minor units. */
  priceAmount: number;
  locale?: Locale;
  imageUrl?: string | null;
  imageAlt?: string;
  tags?: string[];
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  favoriteLabel: string;
  onSelect?: () => void;
  /** Lets the consumer swap in next/image (web) instead of a plain <img>. */
  renderImage?: (props: { src: string; alt: string }) => ReactNode;
  addLabel?: string;
  onAdd?: () => void;
  unavailable?: boolean;
  unavailableLabel?: string;
  className?: string;
}

export function ProductCard({
  name,
  description,
  priceAmount,
  locale = "en",
  imageUrl,
  imageAlt = "",
  tags = [],
  isFavorite = false,
  onToggleFavorite,
  favoriteLabel,
  onSelect,
  renderImage,
  addLabel,
  onAdd,
  unavailable = false,
  unavailableLabel,
  className,
}: ProductCardProps) {
  return (
    <Card padded={false} className={cn("flex flex-col overflow-hidden", className)}>
      <div className="relative aspect-[4/3] w-full bg-tint-green">
        {imageUrl ? (
          renderImage ? (
            renderImage({ src: imageUrl, alt: imageAlt || name })
          ) : (
            // Fallback when the consumer doesn't inject next/image via renderImage.
            <img src={imageUrl} alt={imageAlt || name} className="h-full w-full object-cover" />
          )
        ) : null}
        {onToggleFavorite ? (
          <IconButton
            aria-label={favoriteLabel}
            aria-pressed={isFavorite}
            onClick={onToggleFavorite}
            variant="solid"
            className="absolute right-2 top-2 bg-surface-alt/90 text-fg hover:bg-surface-alt"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M12 21s-7.5-4.6-10-9.1C0.3 8.4 2.1 5 5.6 5c2 0 3.4 1 4.4 2.4C11 6 12.4 5 14.4 5c3.5 0 5.3 3.4 3.6 6.9C19.5 16.4 12 21 12 21z"
                fill={isFavorite ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </IconButton>
        ) : null}
        {unavailable ? (
          <div className="absolute inset-0 flex items-center justify-center bg-overlay">
            <span className="rounded-pill bg-surface-alt px-3 py-1 text-caption font-medium text-fg">
              {unavailableLabel}
            </span>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onSelect}
        disabled={!onSelect}
        className="flex flex-1 flex-col gap-1 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-inset disabled:cursor-default"
      >
        <span className="font-display text-h5 text-fg">{name}</span>
        {description ? (
          <span className="line-clamp-2 text-body-sm text-fg-muted">{description}</span>
        ) : null}
        {tags.length > 0 ? (
          <span className="mt-1 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-pill bg-tint-green px-2 py-0.5 text-caption text-fg"
              >
                {tag}
              </span>
            ))}
          </span>
        ) : null}
      </button>

      <div className="flex items-center justify-between border-t border-border p-4">
        <PriceTag amount={priceAmount} locale={locale} className="text-body font-medium text-fg" />
        {onAdd ? (
          <button
            type="button"
            onClick={onAdd}
            disabled={unavailable}
            className="rounded bg-orange-600 px-3 py-1.5 text-body-sm font-medium text-neutral-900 transition-colors hover:bg-orange-600/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-alt"
          >
            {addLabel}
          </button>
        ) : null}
      </div>
    </Card>
  );
}
