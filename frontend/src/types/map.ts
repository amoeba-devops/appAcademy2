export interface MapPassage {
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
  createdAt: string;
  updatedAt: string;
}

export interface MapItem {
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
  createdAt: string;
  updatedAt: string;
}

export interface MapTestSetItem {
  id: number;
  itemId: number;
  ordinal: number;
  itemVersionSnapshot: {
    itemId: number;
    passageId?: number | null;
    passageTitle?: string | null;
    domain: string;
    gradeLevel: string;
    difficulty: string;
    itemType: string;
    stem: string;
    options: string[];
    answerKeys: string[];
    explanation?: string | null;
    points: number;
    status: string;
    tags: string[];
    version: number;
  };
}

export interface MapTestSet {
  id: number;
  academyId: number;
  name: string;
  compositionMode: string;
  filterCriteria: Record<string, unknown> | null;
  totalPoints: number;
  status: string;
  createdBy: number | null;
  createdAt: string;
  itemCount: number;
  items: MapTestSetItem[];
}

export interface MapTestSetPreview {
  testSet: MapTestSet;
  totalItems: number;
  totalPoints: number;
  passageCount: number;
  partACount: number;
  partBCount: number;
  estimatedMinutes: number;
  difficultyBreakdown: Record<string, number>;
}

export interface MapAssignment {
  id: number;
  testSetId: number;
  testSetName: string | null;
  targetType: string;
  targetId: number;
  targetName: string | null;
  dueAt: string;
  status: string;
  createdAt: string;
  totalTargets: number;
  completedTargets: number;
  completionRate: number;
}

export interface MapScore {
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
  createdAt: string;
}

export interface MapGradingQueueItem {
  assignmentId: number;
  testSetId: number;
  testSetName: string | null;
  targetType: string;
  targetId: number;
  targetName: string | null;
  dueAt: string;
  status: string;
  totalTargets: number;
  submittedTargets: number;
  gradedTargets: number;
  averageReadingScore: number | null;
}

export interface MapGradingStudentResult {
  studentId: number;
  studentName: string;
  submittedAt: string | null;
  totalResponses: number;
  correctResponses: number;
  earnedPoints: number;
  totalPoints: number;
  scoreRate: number;
  gradingStatus: string;
  latestScoreId: number | null;
}

export interface MapGradingItemInsight {
  itemId: number;
  itemType: string;
  stem: string;
  correctCount: number;
  incorrectCount: number;
  correctRate: number;
}

export interface MapGradingDetail {
  assignment: MapGradingQueueItem;
  totalPoints: number;
  averageReadingScore: number | null;
  partACorrectRate: number;
  partBCorrectRate: number;
  studentResults: MapGradingStudentResult[];
  itemInsights: MapGradingItemInsight[];
}

export interface PortalMapStudentOption {
  studentId: number;
  studentName: string;
  gradeLevel: string | null;
  school: string | null;
}

export interface PortalMapScoreSummary {
  latestAssessedAt: string;
  latestReadingScore: number | null;
  latestMathScore: number | null;
  latestLanguageScore: number | null;
  averageReadingScore: number | null;
  bestReadingScore: number | null;
  readingDelta: number | null;
  assessmentsCount: number;
}

export interface PortalMapScoreHistory {
  accessMode: string;
  selectedStudentId: number | null;
  selectedStudentName: string | null;
  students: PortalMapStudentOption[];
  summary: PortalMapScoreSummary | null;
  scores: MapScore[];
}

export interface CreatePassageRequest {
  title: string;
  body: string;
  gradeLevel: string;
  domain?: string;
  source?: string;
  status?: string;
  assetUrls?: string[];
}

export type UpdatePassageRequest = Partial<CreatePassageRequest>;

export interface CreateItemRequest {
  passageId?: number;
  parentItemId?: number;
  domain: string;
  gradeLevel: string;
  difficulty: string;
  itemType: string;
  stem: string;
  options: string[];
  answerKeys: string[];
  explanation?: string;
  points?: number;
  status?: string;
  tags?: string[];
}

export type UpdateItemRequest = Partial<CreateItemRequest>;

export interface CreateAssignmentRequest {
  testSetId: number;
  targetType: string;
  targetId: number;
  dueAt: string;
  status?: string;
}

export type UpdateAssignmentRequest = Partial<CreateAssignmentRequest>;

export interface CreateTestSetRequest {
  name: string;
  compositionMode?: string;
  filterCriteria?: Record<string, unknown>;
  status?: string;
  items: Array<{
    itemId: number;
    ordinal?: number;
  }>;
}

export type UpdateTestSetRequest = Partial<CreateTestSetRequest>;

/* ── MAP Hub Stats ── */

export interface MapHubGradeBreakdown {
  label: string;
  count: number;
}

export interface MapHubStats {
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