export interface RecommendedItem {
  menuItemId: string;
  nameEn: string;
  nameAm: string | null;
  /** ETB minor units. */
  basePrice: number;
  categoryId: string;
  reason: string;
  /** 0-1 relevance score. */
  score: number;
}

export interface Recommendations {
  items: RecommendedItem[];
}
