export interface CurrentSourceSnapshot {
  definitionVersion: 'current-master-v1';
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
