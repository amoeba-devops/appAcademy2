export interface AdmissionInfo {
  id?: string;
  targetLabel?: string | null;
  examContent?: string | null;
  scheduleText?: string | null;
}
export interface School {
  id: string;
  name: string;
  level: "ELEMENTARY" | "MIDDLE" | "HIGH" | "FOREIGN";
  region?: string;
  district?: string;
  isForeign?: boolean;
  isAuthorized: boolean | null;
  curriculumDescription?: string | null;
  eligibility?: string | null;
  notes?: string;
  updatedAt?: string;
  admissions?: AdmissionInfo[];
}
