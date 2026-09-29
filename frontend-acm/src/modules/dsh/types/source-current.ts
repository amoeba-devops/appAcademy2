export interface CurrentSourceSnapshot {
  definitionVersion: 'today-live-v1';
  today:string;
  externalSources:Array<{provider:string;syncedAt:string|null;dataDate:string|null;status:string|null}>;
  externalSyncedAt:string|null;
  externalDataDate:string|null;
  metrics:Array<{code:string;category:string;labelKr:string;labelEn:string;displayOrder:number;format?:string;unit?:string}>;
  values:Record<string,{calculated:number|null;manual:number|null;manualPresent:boolean;quality:string}>;
  scope: 'ALL';
  asOf: string;
  activeStudents: number;
  inactiveStudents: number;
  withdrawnStudents: number;
  activeTeachers: number;
  assignedStudents: number;
  assignedTeachers: number;
  missingAdmissionDates: number;
  missingWithdrawalDates: number;
  missingHireDates: number;
}
