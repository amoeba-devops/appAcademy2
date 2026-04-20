export class MapItem {
  id: number;
  academyId: number | null;
  passageId: number | null;
  parentItemId: number | null;
  domain: string;
  gradeLevel: string;
  difficulty: string;
  itemType: string;
  stem: string;
  options: string[];
  answerKeys: string[];
  explanation: string | null;
  points: number;
  version: number;
  status: string;
  tags: string[];
  passageTitle: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const MapItemType = {
  PART_A: 'PART_A',
  PART_B: 'PART_B',
} as const;

export const MapItemStatus = {
  DRAFT: 'DRAFT',
  REVIEW: 'REVIEW',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;