import {
  AssignmentResponseDto,
  GradingDetailResponseDto,
  GradingQueueResponseDto,
  GradingItemInsightResponseDto,
  GradingStudentResultResponseDto,
  HubGradeBreakdownDto,
  ItemResponseDto,
  MapHubStatsResponseDto,
  MapScoreResponseDto,
  PassageResponseDto,
  PortalScoreHistoryResponseDto,
  PortalScoreSummaryResponseDto,
  PortalStudentOptionResponseDto,
  TestSetPreviewResponseDto,
  TestSetResponseDto,
} from '../../dto/map';
import { MapAssignment } from '../../../domain/entities/map-assignment';
import { MapItem } from '../../../domain/entities/map-item';
import { MapPassage } from '../../../domain/entities/map-passage';
import {
  MapGradingAssignment,
  MapGradingDetail,
  MapGradingItemInsight,
  MapHubStats,
  MapPortalScoreHistory,
  MapPortalScoreSummary,
  MapPortalStudentOption,
  MapGradingStudentResult,
  MapScore,
} from '../../../domain/entities/map-score';
import { MapTestSet, MapTestSetPreview } from '../../../domain/entities/map-test-set';

export function toPassageResponse(passage: MapPassage): PassageResponseDto {
  const response = new PassageResponseDto();
  response.id = passage.id;
  response.academyId = passage.academyId;
  response.title = passage.title;
  response.body = passage.body;
  response.gradeLevel = passage.gradeLevel;
  response.domain = passage.domain;
  response.pairGroupId = passage.pairGroupId;
  response.source = passage.source;
  response.version = passage.version;
  response.status = passage.status;
  response.assetUrls = passage.assetUrls;
  response.itemCount = passage.itemCount;
  response.createdAt = passage.createdAt;
  response.updatedAt = passage.updatedAt;
  return response;
}

export function toItemResponse(item: MapItem): ItemResponseDto {
  const response = new ItemResponseDto();
  response.id = item.id;
  response.academyId = item.academyId;
  response.passageId = item.passageId;
  response.parentItemId = item.parentItemId;
  response.domain = item.domain;
  response.gradeLevel = item.gradeLevel;
  response.difficulty = item.difficulty;
  response.itemType = item.itemType;
  response.stem = item.stem;
  response.options = item.options;
  response.answerKeys = item.answerKeys;
  response.explanation = item.explanation;
  response.points = item.points;
  response.version = item.version;
  response.status = item.status;
  response.tags = item.tags;
  response.passageTitle = item.passageTitle;
  response.createdAt = item.createdAt;
  response.updatedAt = item.updatedAt;
  return response;
}

export function toAssignmentResponse(assignment: MapAssignment): AssignmentResponseDto {
  const response = new AssignmentResponseDto();
  response.id = assignment.id;
  response.testSetId = assignment.testSetId;
  response.testSetName = assignment.testSetName;
  response.targetType = assignment.targetType;
  response.targetId = assignment.targetId;
  response.targetName = assignment.targetName;
  response.dueAt = assignment.dueAt;
  response.status = assignment.status;
  response.createdAt = assignment.createdAt;
  response.totalTargets = assignment.totalTargets;
  response.completedTargets = assignment.completedTargets;
  response.completionRate = assignment.completionRate;
  return response;
}

export function toScoreResponse(score: MapScore): MapScoreResponseDto {
  const response = new MapScoreResponseDto();
  response.id = score.id;
  response.studentId = score.studentId;
  response.studentName = score.studentName;
  response.assignmentId = score.assignmentId;
  response.assessedAt = score.assessedAt;
  response.readingScore = score.readingScore;
  response.mathScore = score.mathScore;
  response.languageScore = score.languageScore;
  response.source = score.source;
  response.note = score.note;
  response.createdAt = score.createdAt;
  return response;
}

export function toGradingQueueResponse(item: MapGradingAssignment): GradingQueueResponseDto {
  const response = new GradingQueueResponseDto();
  response.assignmentId = item.assignmentId;
  response.testSetId = item.testSetId;
  response.testSetName = item.testSetName;
  response.targetType = item.targetType;
  response.targetId = item.targetId;
  response.targetName = item.targetName;
  response.dueAt = item.dueAt;
  response.status = item.status;
  response.totalTargets = item.totalTargets;
  response.submittedTargets = item.submittedTargets;
  response.gradedTargets = item.gradedTargets;
  response.averageReadingScore = item.averageReadingScore;
  return response;
}

function toGradingStudentResultResponse(item: MapGradingStudentResult): GradingStudentResultResponseDto {
  const response = new GradingStudentResultResponseDto();
  response.studentId = item.studentId;
  response.studentName = item.studentName;
  response.submittedAt = item.submittedAt;
  response.totalResponses = item.totalResponses;
  response.correctResponses = item.correctResponses;
  response.earnedPoints = item.earnedPoints;
  response.totalPoints = item.totalPoints;
  response.scoreRate = item.scoreRate;
  response.gradingStatus = item.gradingStatus;
  response.latestScoreId = item.latestScoreId;
  return response;
}

function toGradingItemInsightResponse(item: MapGradingItemInsight): GradingItemInsightResponseDto {
  const response = new GradingItemInsightResponseDto();
  response.itemId = item.itemId;
  response.itemType = item.itemType;
  response.stem = item.stem;
  response.correctCount = item.correctCount;
  response.incorrectCount = item.incorrectCount;
  response.correctRate = item.correctRate;
  return response;
}

export function toGradingDetailResponse(detail: MapGradingDetail): GradingDetailResponseDto {
  const response = new GradingDetailResponseDto();
  response.assignment = toGradingQueueResponse(detail.assignment);
  response.totalPoints = detail.totalPoints;
  response.averageReadingScore = detail.averageReadingScore;
  response.partACorrectRate = detail.partACorrectRate;
  response.partBCorrectRate = detail.partBCorrectRate;
  response.studentResults = detail.studentResults.map(toGradingStudentResultResponse);
  response.itemInsights = detail.itemInsights.map(toGradingItemInsightResponse);
  return response;
}

function toPortalStudentOptionResponse(item: MapPortalStudentOption): PortalStudentOptionResponseDto {
  const response = new PortalStudentOptionResponseDto();
  response.studentId = item.studentId;
  response.studentName = item.studentName;
  response.gradeLevel = item.gradeLevel;
  response.school = item.school;
  return response;
}

function toPortalScoreSummaryResponse(summary: MapPortalScoreSummary): PortalScoreSummaryResponseDto {
  const response = new PortalScoreSummaryResponseDto();
  response.latestAssessedAt = summary.latestAssessedAt;
  response.latestReadingScore = summary.latestReadingScore;
  response.latestMathScore = summary.latestMathScore;
  response.latestLanguageScore = summary.latestLanguageScore;
  response.averageReadingScore = summary.averageReadingScore;
  response.bestReadingScore = summary.bestReadingScore;
  response.readingDelta = summary.readingDelta;
  response.assessmentsCount = summary.assessmentsCount;
  return response;
}

export function toPortalScoreHistoryResponse(history: MapPortalScoreHistory): PortalScoreHistoryResponseDto {
  const response = new PortalScoreHistoryResponseDto();
  response.accessMode = history.accessMode;
  response.selectedStudentId = history.selectedStudentId;
  response.selectedStudentName = history.selectedStudentName;
  response.students = history.students.map(toPortalStudentOptionResponse);
  response.summary = history.summary ? toPortalScoreSummaryResponse(history.summary) : null;
  response.scores = history.scores.map(toScoreResponse);
  return response;
}

export function toTestSetResponse(testSet: MapTestSet): TestSetResponseDto {
  const response = new TestSetResponseDto();
  response.id = testSet.id;
  response.academyId = testSet.academyId;
  response.name = testSet.name;
  response.compositionMode = testSet.compositionMode;
  response.filterCriteria = testSet.filterCriteria;
  response.totalPoints = testSet.totalPoints;
  response.status = testSet.status;
  response.createdBy = testSet.createdBy;
  response.createdAt = testSet.createdAt;
  response.itemCount = testSet.itemCount;
  response.items = testSet.items.map((item) => ({
    id: item.id,
    itemId: item.itemId,
    ordinal: item.ordinal,
    itemVersionSnapshot: item.itemVersionSnapshot,
  }));
  return response;
}

export function toTestSetPreviewResponse(preview: MapTestSetPreview): TestSetPreviewResponseDto {
  const response = new TestSetPreviewResponseDto();
  response.testSet = toTestSetResponse(preview.testSet);
  response.totalItems = preview.totalItems;
  response.totalPoints = preview.totalPoints;
  response.passageCount = preview.passageCount;
  response.partACount = preview.partACount;
  response.partBCount = preview.partBCount;
  response.estimatedMinutes = preview.estimatedMinutes;
  response.difficultyBreakdown = preview.difficultyBreakdown;
  return response;
}

export function toHubStatsResponse(stats: MapHubStats): MapHubStatsResponseDto {
  const response = new MapHubStatsResponseDto();
  response.passages = stats.passages;
  response.passagesByGrade = stats.passagesByGrade.map((b) => {
    const dto = new HubGradeBreakdownDto();
    dto.label = b.label;
    dto.count = b.count;
    return dto;
  });
  response.items = stats.items;
  response.partAItems = stats.partAItems;
  response.partBItems = stats.partBItems;
  response.testSets = stats.testSets;
  response.publishedTestSets = stats.publishedTestSets;
  response.draftTestSets = stats.draftTestSets;
  response.monthAssignments = stats.monthAssignments;
  response.monthAverageScore = stats.monthAverageScore;
  response.pendingGrading = stats.pendingGrading;
  return response;
}