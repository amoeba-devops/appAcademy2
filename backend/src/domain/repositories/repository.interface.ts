/**
 * IRepository — Clean Architecture 도메인 레이어 리포지토리 인터페이스
 * Infrastructure 레이어에서 구현한다.
 */
export interface IRepository<T> {
  findById(id: number): Promise<T | null>;
  findAll(): Promise<T[]>;
  create(entity: Partial<T>): Promise<T>;
  update(id: number, entity: Partial<T>): Promise<T>;
  delete(id: number): Promise<void>;
}
