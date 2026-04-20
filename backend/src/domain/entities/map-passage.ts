export class MapPassage {
  id: number;
  academyId: number | null;
  title: string;
  body: string;
  gradeLevel: string;
  domain: string;
  pairGroupId: number | null;
  source: string | null;
  version: number;
  status: string;
  assetUrls: string[];
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export const MapPassageDomain = {
  RC: 'RC',
  MATH: 'MATH',
  LANGUAGE: 'LANGUAGE',
} as const;

export const MapPassageStatus = {
  DRAFT: 'DRAFT',
  REVIEW: 'REVIEW',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;