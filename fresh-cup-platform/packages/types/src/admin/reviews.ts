export interface ProductReview {
  id: string;
  menuItemId: string;
  userId: string;
  userName: string;
  orderId: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface CreateReviewInput {
  rating: number;
  comment?: string;
  orderId?: string;
}

export interface ListReviewsParams {
  menuItemId?: string;
  userId?: string;
  rating?: number;
}
