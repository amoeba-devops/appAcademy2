/**
 * Base Entity — 모든 도메인 엔티티의 공통 필드
 */
export abstract class BaseEntity {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}
