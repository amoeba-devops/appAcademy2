/**
 * Program Domain Entity — 프로그램 도메인 엔티티
 */
export class Program {
  id: number;
  academyId: number;
  name: string;
  category: string;
  description: string | null;
  durationWeeks: number | null;
  targetAgeMin: number | null;
  targetAgeMax: number | null;
  level: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  setting: ProgramSetting | null;
}

export class ProgramSetting {
  id: number;
  programId: number;
  feeAmount: string | null;
  feeCurrency: string;
  capacityMax: number | null;
  sessionCount: number | null;
  materialInfo: unknown | null;
  refundPolicy: unknown | null;
  updatedAt: Date;
}

export const ProgramStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;

export const ProgramCategory = {
  ENGLISH: 'ENGLISH',
  MATH: 'MATH',
  SCIENCE: 'SCIENCE',
  OTHER: 'OTHER',
} as const;

export const ProgramLevel = {
  BEGINNER: 'BEGINNER',
  INTERMEDIATE: 'INTERMEDIATE',
  ADVANCED: 'ADVANCED',
} as const;
