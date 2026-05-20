export interface Post {
  id: number;
  title: string;
  slug: string;
  bodyMd: string;
  coverImageUrl: string | null;
  category: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreatePostPayload {
  title: string;
  slug: string;
  bodyMd: string;
  coverImageUrl?: string;
  category?: string;
}

export interface UpdatePostPayload {
  title?: string;
  slug?: string;
  bodyMd?: string;
  coverImageUrl?: string | null;
  category?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt?: string | null;
}
