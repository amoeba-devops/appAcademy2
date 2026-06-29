import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  HeadObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
    const safe = filename.replace(/[^\w.\-]+/g, '_');
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
}
