import { signFileTicket, verifyFileTicket } from './file-ticket';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ObjectStoreClient } from '../../acm-csl/infrastructure/external/object-store.client';
import { ProjectService } from './project.service';
import { ProjectDriveService } from './drive.service';
import { AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { ProjectFileDto } from './document.dto';
@Injectable()
export class ProjectFileService {
  constructor(
    private readonly projects: ProjectService,
    private readonly drive: ProjectDriveService,
    private readonly store: ObjectStoreClient,
  ) {}
  async upload(
    u: AcmCurrentUser,
    id: string,
    d: ProjectFileDto,
    file: Express.Multer.File,
  ) {
    await this.projects.access(u, id, false, true);
    if (!file.size || file.size > 50 * 1024 * 1024 || !d.title.trim())
      throw new BadRequestException('제목과 50MB 이하 파일을 확인하세요.');
    if (/\.(html?|svg|js|exe|sh|bat)$/i.test(file.originalname))
      throw new BadRequestException('지원하지 않는 파일 형식입니다.');
    const status = await this.drive.status(u);
    // REQ-261016 — 연결 전에는 ACM 저장소, 연결 후에는 선택(기본 Drive).
    const storage = d.storage ?? (status.rootReady ? 'DRIVE' : 'ACM');
    if (storage === 'DRIVE' && !status.rootReady)
      throw new ConflictException({
        code: 'DRIVE_NOT_READY',
        message:
          '회사 Google Drive 공용폴더가 준비되지 않았습니다. ACM 저장소를 선택하세요.',
      });
    if (storage === 'DRIVE') {
      const result = await this.drive.create(
        u,
        id,
        { title: d.title, kind: 'DOCUMENT', operationId: d.operationId },
        file,
      );
      // Drive creation is idempotent; metadata is safe to retry.
      const item = result as { id?: string };
      if (item.id)
        await this.projects.ds.query(
          'UPDATE amb_acm_prj_item SET pit_body=$4,file_phase=$5 WHERE ent_id=$1 AND prj_id=$2 AND drive_file_id=$3',
          [u.entId, id, item.id, d.description ?? '', d.phase],
        );
      return result;
    }
    if (!this.store.isConfigured())
      throw new ServiceUnavailableException(
        '파일 저장소 또는 Google Drive 연결이 필요합니다.',
      );
    return this.projects.ds.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `${u.entId}:${d.operationId}`,
      ]);
      const [existing] = await m.query<Record<string, unknown>[]>(
        'SELECT * FROM amb_acm_prj_item WHERE ent_id=$1 AND pit_id=$2',
        [u.entId, d.operationId],
      );
      if (existing) {
        if (existing.prj_id !== id || existing.deleted_at)
          throw new BadRequestException(
            '이 업로드 요청은 다시 사용할 수 없습니다.',
          );
        return existing;
      }
      const key = this.store.buildKey(
        u.entId,
        d.operationId,
        file.originalname,
      );
      await this.store.putObject({
        key,
        body: file.buffer,
        mime: 'application/octet-stream',
      });
      const [row] = await m.query<Record<string, unknown>[]>(
        `INSERT INTO amb_acm_prj_item(pit_id,ent_id,prj_id,pit_kind,pit_title,pit_body,created_by,document_type,storage_type,object_key,drive_size,drive_mime,file_phase) VALUES($1,$2,$3,'FILE',$4,$5,$6,'FILE','LOCAL',$7,$8,$9,$10) RETURNING *`,
        [
          d.operationId,
          u.entId,
          id,
          d.title.trim(),
          d.description ?? '',
          u.id,
          key,
          file.size,
          file.mimetype,
          d.phase,
        ],
      );
      return row;
    });
  }
  async download(u: AcmCurrentUser, id: string, itemId: string) {
    await this.projects.access(u, id);
    const [item] = await this.projects.ds.query<
      { object_key: string | null; pit_title: string }[]
    >(
      "SELECT object_key,pit_title FROM amb_acm_prj_item WHERE ent_id=$1 AND prj_id=$2 AND pit_id=$3 AND pit_kind='FILE' AND deleted_at IS NULL",
      [u.entId, id, itemId],
    );
    if (!item) throw new NotFoundException();
    // ACM 저장소 파일은 서버가 직접 내려준다(5분 1회용 링크). 내부 MinIO 주소를 브라우저에 주지 않는다.
    const result = item.object_key
      ? {
          url: `/api/acm/prj/files/content?t=${encodeURIComponent(
            signFileTicket({ ent: u.entId, prj: id, item: itemId }),
          )}`,
        }
      : await this.drive.open(u, id, itemId);
    await this.projects.ds.query(
      'UPDATE amb_acm_prj_item SET download_count=download_count+1 WHERE ent_id=$1 AND prj_id=$2 AND pit_id=$3',
      [u.entId, id, itemId],
    );
    return result;
  }
}

/** 티켓으로 ACM 저장소 파일 내용을 연다(권한은 티켓 발급 시점에 확인됨). */
export async function openTicketFile(
  ds: ProjectService['ds'],
  store: ObjectStoreClient,
  ticket: string,
) {
  const t = verifyFileTicket(ticket);
  const [item] = await ds.query<
    {
      object_key: string | null;
      pit_title: string;
      drive_mime: string | null;
    }[]
  >(
    "SELECT object_key,pit_title,drive_mime FROM amb_acm_prj_item WHERE ent_id=$1 AND prj_id=$2 AND pit_id=$3 AND pit_kind='FILE' AND deleted_at IS NULL",
    [t.ent, t.prj, t.item],
  );
  if (!item?.object_key) throw new NotFoundException();
  const obj = await store.getObjectStream(item.object_key);
  return {
    ...obj,
    filename: item.pit_title,
    mime: item.drive_mime ?? obj.mime,
  };
}
