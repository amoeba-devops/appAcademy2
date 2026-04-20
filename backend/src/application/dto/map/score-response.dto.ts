import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MapScoreResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  studentId: number;

  @ApiPropertyOptional()
  studentName: string | null;

  @ApiPropertyOptional()
  assignmentId: number | null;

  @ApiProperty()
  assessedAt: string;

  @ApiPropertyOptional()
  readingScore: number | null;

  @ApiPropertyOptional()
  mathScore: number | null;

  @ApiPropertyOptional()
  languageScore: number | null;

  @ApiProperty()
  source: string;

  @ApiPropertyOptional()
  note: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class GradingQueueResponseDto {
  @ApiProperty()
  assignmentId: number;

  @ApiProperty()
  testSetId: number;

  @ApiPropertyOptional()
  testSetName: string | null;

  @ApiProperty()
  targetType: string;

  @ApiProperty()
  targetId: number;

  @ApiPropertyOptional()
  targetName: string | null;

  @ApiProperty()
  dueAt: Date;

  @ApiProperty()
  status: string;

  @ApiProperty()
  totalTargets: number;

  @ApiProperty()
  submittedTargets: number;

  @ApiProperty()
  gradedTargets: number;

  @ApiPropertyOptional()
  averageReadingScore: number | null;
}

export class GradingStudentResultResponseDto {
  @ApiProperty()
  studentId: number;

  @ApiProperty()
  studentName: string;

  @ApiPropertyOptional()
  submittedAt: Date | null;

  @ApiProperty()
  totalResponses: number;

  @ApiProperty()
  correctResponses: number;

  @ApiProperty()
  earnedPoints: number;

  @ApiProperty()
  totalPoints: number;

  @ApiProperty()
  scoreRate: number;

  @ApiProperty()
  gradingStatus: string;

  @ApiPropertyOptional()
  latestScoreId: number | null;
}

export class GradingItemInsightResponseDto {
  @ApiProperty()
  itemId: number;

  @ApiProperty()
  itemType: string;

  @ApiProperty()
  stem: string;

  @ApiProperty()
  correctCount: number;

  @ApiProperty()
  incorrectCount: number;

  @ApiProperty()
  correctRate: number;
}

export class GradingDetailResponseDto {
  @ApiProperty({ type: GradingQueueResponseDto })
  assignment: GradingQueueResponseDto;

  @ApiProperty()
  totalPoints: number;

  @ApiPropertyOptional()
  averageReadingScore: number | null;

  @ApiProperty()
  partACorrectRate: number;

  @ApiProperty()
  partBCorrectRate: number;

  @ApiProperty({ type: [GradingStudentResultResponseDto] })
  studentResults: GradingStudentResultResponseDto[];

  @ApiProperty({ type: [GradingItemInsightResponseDto] })
  itemInsights: GradingItemInsightResponseDto[];
}

export class PortalStudentOptionResponseDto {
  @ApiProperty()
  studentId: number;

  @ApiProperty()
  studentName: string;

  @ApiPropertyOptional()
  gradeLevel: string | null;

  @ApiPropertyOptional()
  school: string | null;
}

export class PortalScoreSummaryResponseDto {
  @ApiProperty()
  latestAssessedAt: string;

  @ApiPropertyOptional()
  latestReadingScore: number | null;

  @ApiPropertyOptional()
  latestMathScore: number | null;

  @ApiPropertyOptional()
  latestLanguageScore: number | null;

  @ApiPropertyOptional()
  averageReadingScore: number | null;

  @ApiPropertyOptional()
  bestReadingScore: number | null;

  @ApiPropertyOptional()
  readingDelta: number | null;

  @ApiProperty()
  assessmentsCount: number;
}

export class PortalScoreHistoryResponseDto {
  @ApiProperty()
  accessMode: string;

  @ApiPropertyOptional()
  selectedStudentId: number | null;

  @ApiPropertyOptional()
  selectedStudentName: string | null;

  @ApiProperty({ type: [PortalStudentOptionResponseDto] })
  students: PortalStudentOptionResponseDto[];

  @ApiPropertyOptional({ type: PortalScoreSummaryResponseDto })
  summary: PortalScoreSummaryResponseDto | null;

  @ApiProperty({ type: [MapScoreResponseDto] })
  scores: MapScoreResponseDto[];
}

/* ── MAP Hub Stats ── */

export class HubGradeBreakdownDto {
  @ApiProperty()
  label: string;

  @ApiProperty()
  count: number;
}

export class MapHubStatsResponseDto {
  @ApiProperty()
  passages: number;

  @ApiProperty({ type: [HubGradeBreakdownDto] })
  passagesByGrade: HubGradeBreakdownDto[];

  @ApiProperty()
  items: number;

  @ApiProperty()
  partAItems: number;

  @ApiProperty()
  partBItems: number;

  @ApiProperty()
  testSets: number;

  @ApiProperty()
  publishedTestSets: number;

  @ApiProperty()
  draftTestSets: number;

  @ApiProperty()
  monthAssignments: number;

  @ApiPropertyOptional()
  monthAverageScore: number | null;

  @ApiProperty()
  pendingGrading: number;
}