import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import {
  CalEventReviewTypeormEntity,
  CalHomeworkStatus,
} from '../infrastructure/typeorm/cal-event-review.typeorm-entity';

/**
 * PLN-260728F B — 수업 피드백·과제 서비스.
 * 작성은 담당강사(포털 TEACHER, evt_assignee_tch_id = refId)만.
 * 열람은 관리자·해당 수업 관련자(포털 스코프는 컨트롤러에서 보장).
 */
const MAX_HTML = 100 * 1024;

export interface ReviewView {
  feedbackHtml: string | null;
  homeworkStatus: CalHomeworkStatus | null;
  homeworkHtml: string | null;
  updatedAt: string | null;
}

export interface ReviewFlags {
  hasFeedback: boolean;
  homeworkStatus: CalHomeworkStatus | null;
  classDone: boolean;
}

@Injectable()
export class CalEventReviewService {
  constructor(
    @InjectRepository(CalEventReviewTypeormEntity, ACM_DS)
    private readonly repo: Repository<CalEventReviewTypeormEntity>,
  ) {}

  async get(entId: string, evtId: string): Promise<ReviewView> {
    const row = await this.repo.findOne({ where: { entId, evtId } });
    return this.toView(row);
  }

  /**
   * upsert — 피드백/과제 부분 갱신. assigneeTchId 는 컨트롤러가 이벤트에서
   * 조회해 전달(담당강사 검증 포함).
   */
  async upsert(
    entId: string,
    evtId: string,
    authorTchId: string,
    patch: {
      feedbackHtml?: string;
      homeworkStatus?: CalHomeworkStatus;
      homeworkHtml?: string;
    },
  ): Promise<ReviewView> {
    if (
      patch.homeworkStatus !== undefined &&
      patch.homeworkStatus !== 'ASSIGNED' &&
      patch.homeworkStatus !== 'NONE'
    ) {
      throw new BadRequestException('INVALID_HOMEWORK_STATUS');
    }
    for (const v of [patch.feedbackHtml, patch.homeworkHtml]) {
      if (v !== undefined && v.length > MAX_HTML) {
        throw new BadRequestException('CONTENT_TOO_LONG');
      }
    }

    let row = await this.repo.findOne({ where: { entId, evtId } });
    if (!row) {
      row = this.repo.create({ entId, evtId, authorTchId });
    }
    if (patch.feedbackHtml !== undefined) row.feedbackHtml = patch.feedbackHtml;
    if (patch.homeworkStatus !== undefined) {
      row.homeworkStatus = patch.homeworkStatus;
      if (patch.homeworkStatus === 'NONE') row.homeworkHtml = null;
    }
    if (patch.homeworkHtml !== undefined) row.homeworkHtml = patch.homeworkHtml;
    row.authorTchId = authorTchId;
    const saved = await this.repo.save(row);
    return this.toView(saved);
  }

  /** 목록 배지용 배치 플래그. Map<evtId, flags>. */
  async flagsForEvents(
    entId: string,
    evtIds: string[],
  ): Promise<Map<string, ReviewFlags>> {
    const map = new Map<string, ReviewFlags>();
    const ids = Array.from(new Set(evtIds.filter(Boolean)));
    if (ids.length === 0) return map;
    const rows = await this.repo.find({ where: { entId, evtId: In(ids) } });
    for (const r of rows) {
      const hasFeedback = !!r.feedbackHtml?.trim();
      const hs = r.homeworkStatus ?? null;
      map.set(r.evtId, {
        hasFeedback,
        homeworkStatus: hs,
        classDone: hasFeedback && hs !== null,
      });
    }
    return map;
  }

  /** 담당강사 검증 — 이벤트의 assigneeTchId 와 포털 강사 refId 일치 필요. */
  assertAssignee(
    assigneeTchId: string | null | undefined,
    tchId: string,
  ): void {
    if (!assigneeTchId || assigneeTchId !== tchId) {
      throw new ForbiddenException('NOT_ASSIGNEE_TEACHER');
    }
  }

  private toView(row: CalEventReviewTypeormEntity | null): ReviewView {
    return {
      feedbackHtml: row?.feedbackHtml ?? null,
      homeworkStatus: row?.homeworkStatus ?? null,
      homeworkHtml: row?.homeworkHtml ?? null,
      updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
    };
  }
}
