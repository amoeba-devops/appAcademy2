import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { ObjectStoreClient } from '../../acm-csl/infrastructure/external/object-store.client';
import { AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { ProjectService } from './project.service';

/**
 * PLN-261020C — 문서 본문 이미지·첨부. `<img>` 는 로그인 헤더를 보낼 수 없어서
 * 자산 id 의 HMAC 을 붙인 고유 링크로 연다(링크를 아는 사람은 열 수 있다).
 */
export const IMAGE_MAX = 10 * 1024 * 1024;
export const FILE_MAX = 50 * 1024 * 1024;
const IMAGE_MIME = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const BLOCKED = /\.(html?|svg|js|mjs|exe|sh|bat|cmd|msi)$/i;
export const ASSET_PATH = '/api/acm/prj/doc-assets/';

const secret = () =>
  `${process.env.ACM_JWT_SECRET || 'acm-dev-secret-change-in-production'}:prj-doc-asset`;
export const assetToken = (id: string) =>
  createHmac('sha256', secret()).update(id).digest('base64url');
export function assetTokenValid(id: string, token: string) {
  const expected = Buffer.from(assetToken(id));
  const given = Buffer.from(String(token ?? ''));
  return expected.length === given.length && timingSafeEqual(expected, given);
}
export const assetUrl = (id: string) => `${ASSET_PATH}${id}/${assetToken(id)}`;

@Injectable()
export class DocAssetService {
  constructor(
    private readonly projects: ProjectService,
    private readonly store: ObjectStoreClient,
  ) {}

  async upload(
    u: AcmCurrentUser,
    prj: string,
    kind: 'image' | 'file',
    file: Express.Multer.File,
  ) {
    await this.projects.access(u, prj, false, true);
    const name = file.originalname.slice(0, 300);
    if (!file.size || BLOCKED.test(name))
      throw new BadRequestException('지원하지 않는 파일 형식입니다.');
    const image = kind === 'image';
    if (image && !IMAGE_MIME.includes(file.mimetype))
      throw new BadRequestException(
        'PNG, JPG, GIF, WEBP 이미지만 넣을 수 있습니다.',
      );
    if (file.size > (image ? IMAGE_MAX : FILE_MAX))
      throw new BadRequestException(
        image
          ? '이미지는 10MB 이하만 넣을 수 있습니다.'
          : '파일은 50MB 이하만 넣을 수 있습니다.',
      );
    if (!this.store.isConfigured())
      throw new ServiceUnavailableException('파일 저장소 설정이 필요합니다.');
    const id = randomUUID();
    const key = this.store.buildKey(u.entId, id, name);
    await this.store.putObject({
      key,
      body: file.buffer,
      mime: 'application/octet-stream',
    });
    await this.projects.ds.query(
      'INSERT INTO amb_acm_prj_doc_asset(pda_id,ent_id,prj_id,object_key,file_name,mime_type,size_bytes,is_image,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        id,
        u.entId,
        prj,
        key,
        name,
        file.mimetype || 'application/octet-stream',
        file.size,
        image,
        u.id,
      ],
    );
    return { id, url: assetUrl(id), name, size: file.size, image };
  }

  /** 고유 링크로 내용을 연다(로그인 없음). */
  async open(id: string, token: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id) || !assetTokenValid(id, token))
      throw new NotFoundException();
    const [a] = await this.projects.ds.query<
      {
        object_key: string;
        file_name: string;
        mime_type: string;
        is_image: boolean;
      }[]
    >(
      'SELECT object_key,file_name,mime_type,is_image FROM amb_acm_prj_doc_asset WHERE pda_id=$1 AND deleted_at IS NULL',
      [id],
    );
    if (!a) throw new NotFoundException();
    const obj = await this.store.getObjectStream(a.object_key);
    return {
      stream: obj.stream,
      contentLength: obj.contentLength,
      filename: a.file_name,
      // 이미지는 허용 목록 MIME 만 inline, 나머지는 내려받기.
      inline: a.is_image && IMAGE_MIME.includes(a.mime_type),
      mime:
        a.is_image && IMAGE_MIME.includes(a.mime_type)
          ? a.mime_type
          : 'application/octet-stream',
    };
  }
}
