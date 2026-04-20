export const MapTestSetCompositionMode = {
  FIXED: 'FIXED',
  SHUFFLED: 'SHUFFLED',
} as const;

export const MapTestSetStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;

export class MapTestSetItem {
  id: number;
  itemId: number;
  ordinal: number;
  itemVersionSnapshot: Record<string, unknown>;
}

export class MapTestSet {
  id: number;
  academyId: number;
  name: string;
  compositionMode: string;
  filterCriteria: Record<string, unknown> | null;
  totalPoints: number;
  status: string;
  createdBy: number | null;
  createdAt: Date;
  itemCount: number;
  items: MapTestSetItem[];
}

export class MapTestSetPreview {
  testSet: MapTestSet;
  totalItems: number;
  totalPoints: number;
  passageCount: number;
  partACount: number;
  partBCount: number;
  estimatedMinutes: number;
  difficultyBreakdown: Record<string, number>;
}