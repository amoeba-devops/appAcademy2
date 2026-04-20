/**
 * Post Domain Entity — 소식/뉴스 도메인 엔티티
 */
export class Post {
  id: number;
  academyId: number;
  slug: string;
  title: string;
  bodyMd: string;
  coverImageUrl: string | null;
  authorUserId: number | null;
  publishedAt: Date | null;
  status: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

export const PostStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;

export const PostCategory = {
  RESULT: 'RESULT',       // 합격 실적
  EVENT: 'EVENT',          // 행사
  NOTICE: 'NOTICE',        // 공지
} as const;
