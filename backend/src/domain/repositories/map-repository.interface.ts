import { IRepository } from './repository.interface';
import { MapPassage } from '../entities/map-passage';
import { MapItem } from '../entities/map-item';
import { MapAssignment } from '../entities/map-assignment';
import { MapGradingAssignment, MapGradingDetail, MapHubStats, MapPortalScoreHistory, MapScore } from '../entities/map-score';
import { MapTestSet, MapTestSetPreview } from '../entities/map-test-set';

export interface IMapPassageRepository extends IRepository<MapPassage> {
  findByAcademyIdWithFilters(
    academyId: number,
    filters: {
      status?: string;
      domain?: string;
      gradeLevel?: string;
      search?: string;
    },
  ): Promise<MapPassage[]>;
  findByIdWithRelations(id: number): Promise<MapPassage | null>;
}

export const MAP_PASSAGE_REPOSITORY = Symbol('IMapPassageRepository');

export interface IMapItemRepository extends IRepository<MapItem> {
  findByAcademyIdWithFilters(
    academyId: number,
    filters: {
      status?: string;
      domain?: string;
      gradeLevel?: string;
      itemType?: string;
      passageId?: number;
      search?: string;
    },
  ): Promise<MapItem[]>;
  findByIdWithRelations(id: number): Promise<MapItem | null>;
}

export const MAP_ITEM_REPOSITORY = Symbol('IMapItemRepository');

export interface IMapTestSetRepository extends IRepository<MapTestSet> {
  findByAcademyIdWithFilters(
    academyId: number,
    filters: {
      status?: string;
      search?: string;
    },
  ): Promise<MapTestSet[]>;
  findByIdWithRelations(id: number): Promise<MapTestSet | null>;
  buildPreview(id: number): Promise<MapTestSetPreview | null>;
}

export const MAP_TEST_SET_REPOSITORY = Symbol('IMapTestSetRepository');

export interface IMapAssignmentRepository extends IRepository<MapAssignment> {
  findByAcademyIdWithFilters(
    academyId: number,
    filters: {
      status?: string;
      targetType?: string;
      search?: string;
    },
  ): Promise<MapAssignment[]>;
  findByIdWithRelations(id: number): Promise<MapAssignment | null>;
}

export const MAP_ASSIGNMENT_REPOSITORY = Symbol('IMapAssignmentRepository');

export interface IMapScoreRepository extends IRepository<MapScore> {
  findByStudentId(studentId: number): Promise<MapScore[]>;
  findByAssignmentId(assignmentId: number): Promise<MapScore[]>;
  getGradingQueue(
    academyId: number,
    filters: {
      status?: string;
      search?: string;
    },
  ): Promise<MapGradingAssignment[]>;
  getGradingDetail(assignmentId: number): Promise<MapGradingDetail | null>;
  gradeAssignment(assignmentId: number): Promise<MapGradingDetail>;
  getPortalScoreHistory(params: {
    academyId: number;
    userEmail: string;
    role: string;
    studentId?: number;
    /**
     * Parent ID resolved from JWT `sub`. When supplied (PARENT role), the
     * repo skips the email-based lookup — necessary because phone-OTP-issued
     * parent tokens carry `email: ''`.
     */
    parentId?: number;
  }): Promise<MapPortalScoreHistory>;
  getHubStats(academyId: number): Promise<MapHubStats>;
}

export const MAP_SCORE_REPOSITORY = Symbol('IMapScoreRepository');