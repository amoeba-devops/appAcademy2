// MAP 기출문제(MPQ) shared types — mirrors backend DTOs.

export type MpqGrade = 'G2' | 'G3' | 'G4';
export type MpqStatus = 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
export type MpqDifficulty = 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';

export interface MpqListItem {
  id: string;
  externalNo: number;
  grade: MpqGrade;
  question: string;
  choices: string[];
  answerIndex: number | null;
  status: MpqStatus;
  paired: boolean;
}

export interface MpqDetail {
  id: string;
  externalNo: number;
  grade: MpqGrade;
  domain: string;
  difficulty: MpqDifficulty;
  status: MpqStatus;
  source: string;
  question: string;
  choices: string[];
  answerIndex: number | null;
  explanation: string | null;
  passage: {
    id: string;
    body: string;
    glossary: string | null;
    pairGroupId: string | null;
  };
  pairedPassage: { id: string; body: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListMpqResponse {
  items: MpqListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface MpqImportResult {
  inserted: number;
  updated: number;
  errors: Array<{ row: number; message: string }>;
  total: number;
}

export interface ListMpqQuery {
  q?: string;
  grade?: MpqGrade | 'ALL';
  hasAnswer?: 'ALL' | 'YES' | 'NO';
  paired?: boolean;
  status?: MpqStatus | 'ALL';
  page?: number;
  limit?: number;
}

export interface CreateMpqInput {
  mpqGrade: MpqGrade;
  mpqExternalNo?: number;
  mpgBody: string;
  mpgGlossary?: string;
  mpgPairBody?: string;
  mpqQuestion: string;
  mpqChoices: string[];
  mpqAnswerIndex?: number | null;
  mpqExplanation?: string;
  mpqDifficulty?: MpqDifficulty;
  mpqStatus?: MpqStatus;
  mpqSource?: string;
}

export type UpdateMpqInput = Partial<CreateMpqInput> & {
  mpgPairBody?: string | null;
  mpgGlossary?: string | null;
};
