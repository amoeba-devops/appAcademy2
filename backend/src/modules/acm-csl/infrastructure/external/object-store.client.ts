import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import {
  S3Client,
  HeadObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';

/** 멀티파트 업로드 파트 크기 (S3 최소 5MB). */
const MULTIPART_PART_BYTES = 16 * 1024 * 1024;

/**
 * REQ-260626 T-06 / ADR-008 — S3-compatible object store client.
 *
 * Backed by MinIO in dev/staging/prod, but the implementation goes
 * through the AWS SDK so swapping for AWS S3 / Cloudflare R2 later is
 * just an env-variable change.
 *
 * Env (all required when the attachment endpoints are enabled):
 *   ACM_S3_ENDPOINT             e.g. http://minio:9000
 *   ACM_S3_REGION               placeholder for MinIO (us-east-1)
 *   ACM_S3_BUCKET               e.g. acm-attachments
 *   ACM_S3_ACCESS_KEY_ID
 *   ACM_S3_SECRET_ACCESS_KEY
 *   ACM_S3_FORCE_PATH_STYLE     "true" for MinIO, omit for AWS S3
 *
 * When `ACM_S3_BUCKET` is unset the client logs a warning at startup
 * and `isConfigured()` returns false — callers should 503 when this
 * happens so the rest of the app stays bootable without MinIO.
 */
@Injectable()
export class ObjectStoreClient implements OnModuleInit {
  private readonly log = new Logger(ObjectStoreClient.name);
  private client?: S3Client;
  private bucket?: string;
  private endpoint?: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const endpoint = this.config.get<string>('ACM_S3_ENDPOINT');
    const bucket = this.config.get<string>('ACM_S3_BUCKET');
    const region = this.config.get<string>('ACM_S3_REGION') ?? 'us-east-1';
    const accessKeyId = this.config.get<string>('ACM_S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('ACM_S3_SECRET_ACCESS_KEY');
    const forcePathStyle =
      (this.config.get<string>('ACM_S3_FORCE_PATH_STYLE') ?? 'true') === 'true';

    if (!bucket || !accessKeyId || !secretAccessKey) {
      this.log.warn(
        'ACM_S3_* env not fully set — attachment endpoints will return 503. Configure docker-compose minio + secrets to enable.',
      );
      return;
    }

    this.client = new S3Client({
      region,
      endpoint,
      forcePathStyle,
      credentials: { accessKeyId, secretAccessKey },
    });
    this.bucket = bucket;
    this.endpoint = endpoint;
    this.log.log(
      `ObjectStoreClient ready (endpoint=${endpoint ?? 'aws-default'}, bucket=${bucket}, forcePathStyle=${forcePathStyle})`,
    );
  }

  isConfigured(): boolean {
    return !!this.client && !!this.bucket;
  }

  private requireClient(): { client: S3Client; bucket: string } {
    if (!this.client || !this.bucket) {
      throw new Error('OBJECT_STORE_NOT_CONFIGURED');
    }
    return { client: this.client, bucket: this.bucket };
  }

  /**
   * Build the canonical object key for a CSL attachment.
   * `{ent_id}/{att_id}/{filename}` keeps tenant isolation at the
   * prefix level (bucket policy can deny cross-tenant access later).
   */
  buildKey(entId: string, attId: string, filename: string): string {
    const safe = filename.replace(/[^\w.-]+/g, '_');
    return `${entId}/${attId}/${safe}`;
  }

  /**
   * Issue a short-lived (5 min) presigned PUT URL.
   * The browser PUTs the file directly to MinIO/S3 with the same
   * Content-Type the caller declared so the server-side `Content-Type`
   * matches the row in `amb_acm_csl_attachment.att_mime`.
   */
  async presignPut(opts: {
    key: string;
    mime: string;
    sizeBytes: number;
  }): Promise<string> {
    const { client, bucket } = this.requireClient();
    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: opts.key,
      ContentType: opts.mime,
      ContentLength: opts.sizeBytes,
    });
    return getSignedUrl(client, cmd, { expiresIn: 300 });
  }

  /**
   * Issue a short-lived (5 min) presigned GET URL with a forced
   * download disposition so the browser saves rather than renders.
   */
  async presignGet(opts: { key: string; filename: string }): Promise<string> {
    const { client, bucket } = this.requireClient();
    const cmd = new GetObjectCommand({
      Bucket: bucket,
      Key: opts.key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(opts.filename)}"`,
    });
    return getSignedUrl(client, cmd, { expiresIn: 300 });
  }

  /**
   * HEAD probe — used by the `confirm` endpoint to verify the browser
   * actually PUT the object and the size matches the declared row.
   * Returns the actual ContentLength + ContentType, or null on miss.
   */
  async head(key: string): Promise<{ size: number; mime?: string } | null> {
    const { client, bucket } = this.requireClient();
    try {
      const res = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );
      return {
        size: Number(res.ContentLength ?? 0),
        mime: res.ContentType,
      };
    } catch (err) {
      const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    const { client, bucket } = this.requireClient();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  /**
   * Backend-proxied upload (FIX-260630 PDF Mixed Content). The browser
   * cannot hit MinIO directly via presigned PUT because MinIO is on the
   * docker internal hostname (`http://minio:9000`) which (a) doesn't
   * resolve from the browser and (b) violates HTTPS Mixed Content.
   * Backend receives the file then streams it through to MinIO.
   */
  async putObject(opts: {
    key: string;
    body: Buffer;
    mime: string;
  }): Promise<void> {
    const { client, bucket } = this.requireClient();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: opts.key,
        Body: opts.body,
        ContentType: opts.mime,
        ContentLength: opts.body.length,
      }),
    );
  }

  /**
   * REQ-260912B — 스트림 업로드. 녹화본처럼 수백 MB~GB 일 수 있는 파일을
   * 메모리에 통째로 올리지 않기 위해 사용한다.
   *
   * REQ-260920C B-2 — 보다 다운로드 API 는 Range 미지원·전체 전송이며
   * `Content-Length` 유무가 보장되지 않는다. 길이를 알면 단일 PutObject,
   * 모르면 `@aws-sdk/lib-storage` 멀티파트 업로드로 길이 없이 스트리밍한다
   * (이전 256MB 메모리 버퍼 폴백 제거).
   */
  async putObjectStream(opts: {
    key: string;
    body: Readable;
    mime: string;
    /** 업스트림 Content-Length. 없거나 0 이하이면 멀티파트 경로. */
    contentLength?: number | null;
  }): Promise<void> {
    const { client, bucket } = this.requireClient();
    const len = opts.contentLength ?? 0;
    if (Number.isFinite(len) && len > 0) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: opts.key,
          Body: opts.body,
          ContentType: opts.mime,
          ContentLength: len,
        }),
      );
      return;
    }

    const upload = new Upload({
      client,
      params: {
        Bucket: bucket,
        Key: opts.key,
        Body: opts.body,
        ContentType: opts.mime,
      },
      // 16MB 파트 × 동시 2 — 백엔드 메모리 상주 최대 ~32MB.
      partSize: MULTIPART_PART_BYTES,
      queueSize: 2,
      leavePartsOnError: false,
    });
    await upload.done();
  }

  /**
   * Stream an object back to the controller, which forwards it to the
   * browser with Content-Disposition. Avoids buffering the whole object
   * in memory.
   *
   * `range` (REQ-260912B): HTTP Range 헤더 원문을 그대로 전달하면 S3 가 206
   * 부분 응답을 돌려준다 — `<video>` 탐색(seek)에 필요.
   */
  async getObjectStream(
    key: string,
    range?: string,
  ): Promise<{
    stream: Readable;
    mime?: string;
    contentLength?: number;
    contentRange?: string;
    partial: boolean;
  }> {
    const { client, bucket } = this.requireClient();
    const res = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key, Range: range }),
    );
    if (!res.Body) {
      throw new Error('OBJECT_BODY_EMPTY');
    }
    return {
      stream: res.Body as Readable,
      mime: res.ContentType,
      contentLength: res.ContentLength,
      contentRange: res.ContentRange,
      partial: !!res.ContentRange,
    };
  }
}
