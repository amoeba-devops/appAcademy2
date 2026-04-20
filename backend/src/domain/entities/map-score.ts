export class MapScore {
  id: number;
  studentId: number;
  studentName: string | null;
  assignmentId: number | null;
  assessedAt: string;
  readingScore: number | null;
  mathScore: number | null;
  languageScore: number | null;
  source: string;
  note: string | null;
  createdAt: Date;
}

export class MapGradingAssignment {
  assignmentId: number;
  testSetId: number;
  testSetName: string | null;
  targetType: string;
  targetId: number;
  targetName: string | null;
  dueAt: Date;
  status: string;
  totalTargets: number;
  submittedTargets: number;
  gradedTargets: number;
  averageReadingScore: number | null;
}

export class MapGradingStudentResult {
  studentId: number;
  studentName: string;
  submittedAt: Date | null;
  totalResponses: number;
  correctResponses: number;
  earnedPoints: number;
  totalPoints: number;
  scoreRate: number;
  gradingStatus: string;
  latestScoreId: number | null;
}

export class MapGradingItemInsight {
  itemId: number;
  itemType: string;
  stem: string;
  correctCount: number;
  incorrectCount: number;
  correctRate: number;
}

export class MapGradingDetail {
  assignment: MapGradingAssignment;
  totalPoints: number;
  averageReadingScore: number | null;
  partACorrectRate: number;
  partBCorrectRate: number;
  studentResults: MapGradingStudentResult[];
  itemInsights: MapGradingItemInsight[];
}

export class MapPortalStudentOption {
  studentId: number;
  studentName: string;
  gradeLevel: string | null;
  school: string | null;
}

export class MapPortalScoreSummary {
  latestAssessedAt: string;
  latestReadingScore: number | null;
  latestMathScore: number | null;
  latestLanguageScore: number | null;
  averageReadingScore: number | null;
  bestReadingScore: number | null;
  readingDelta: number | null;
  assessmentsCount: number;
}

export class MapPortalScoreHistory {
  accessMode: string;
  selectedStudentId: number | null;
  selectedStudentName: string | null;
  students: MapPortalStudentOption[];
  summary: MapPortalScoreSummary | null;
  scores: MapScore[];
}

/* ── MAP Hub Stats (관리자 허브 KPI) ── */

export class MapHubGradeBreakdown {
  label: string;
  count: number;
}

export class MapHubStats {
  passages: number;
  passagesByGrade: MapHubGradeBreakdown[];
  items: number;
  partAItems: number;
  partBItems: number;
  testSets: number;
  publishedTestSets: number;
  draftTestSets: number;
  monthAssignments: number;
  monthAverageScore: number | null;
  pendingGrading: number;
}