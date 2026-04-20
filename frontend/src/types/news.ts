export interface NewsPost {
  id: number;
  slug: string;
  title: string;
  bodyMd: string;
  coverImageUrl: string | null;
  category: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
}

// i18n keys — consumers resolve via t(NEWS_CATEGORY_LABEL_KEYS[cat]).
export const NEWS_CATEGORY_LABEL_KEYS: Record<string, string> = {
  RESULT: 'news.filter.result',
  EVENT: 'news.filter.event',
  NOTICE: 'news.filter.notice',
};

export const NEWS_CATEGORY_COLORS: Record<string, string> = {
  RESULT: 'bg-gold/20 text-gold',
  EVENT: 'bg-ama-accent/10 text-ama-accent',
  NOTICE: 'bg-navy/5 text-navy',
};
