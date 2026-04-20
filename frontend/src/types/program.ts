export interface ProgramSetting {
  id: number;
  feeAmount: string | null;
  feeCurrency: string;
  capacityMax: number | null;
  sessionCount: number | null;
  materialInfo: unknown | null;
  refundPolicy: unknown | null;
  updatedAt: string;
}

export interface Program {
  id: number;
  name: string;
  category: string;
  description: string | null;
  durationWeeks: number | null;
  targetAgeMin: number | null;
  targetAgeMax: number | null;
  level: string | null;
  status: string;
  setting: ProgramSetting | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProgramSettingRequest {
  feeAmount?: string;
  feeCurrency?: string;
  capacityMax?: number;
  sessionCount?: number;
  materialInfo?: unknown;
  refundPolicy?: unknown;
}

export interface CreateProgramRequest {
  name: string;
  category: string;
  description?: string;
  durationWeeks?: number;
  targetAgeMin?: number;
  targetAgeMax?: number;
  level?: string;
  setting?: CreateProgramSettingRequest;
}

export interface UpdateProgramRequest {
  name?: string;
  category?: string;
  description?: string;
  durationWeeks?: number;
  targetAgeMin?: number;
  targetAgeMax?: number;
  level?: string;
  status?: string;
  setting?: CreateProgramSettingRequest;
}
