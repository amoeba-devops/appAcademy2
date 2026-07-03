export interface ProgramSetting {
  feeAmount: number | null;
  capacityMax: number | null;
  sessionCount: number | null;
}

export interface Program {
  id: string;
  name: string;
  category: string;
  description: string | null;
  durationWeeks: number | null;
  targetAgeMin: number | null;
  targetAgeMax: number | null;
  level: string | null;
  status: string;
  setting?: ProgramSetting | null;
}

export interface NewsPost {
  id: string;
  slug: string;
  title: string;
  bodyMd: string;
  category: string;
  publishedAt: string | null;
  createdAt: string;
}

export const NEWS_CATEGORY_LABEL_KEYS: Record<string, string> = {
  RESULT: 'news.category.result',
  EVENT: 'news.category.event',
  NOTICE: 'news.category.notice',
};

export const NEWS_CATEGORY_COLORS: Record<string, string> = {
  RESULT: 'bg-blue-100 text-blue-700',
  EVENT: 'bg-yellow-100 text-yellow-800',
  NOTICE: 'bg-slate-100 text-slate-700',
};
