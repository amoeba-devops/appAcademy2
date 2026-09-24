import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { AdsService } from './ads.service';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { packEncrypted } from '../../acm-auth/infrastructure/ama-secret.codec';
@Injectable()
export class AdsOAuthService {
  constructor(
    private readonly ads: AdsService,
    private readonly config: ConfigService,
    private readonly crypto: AesGcmService,
  ) {}
  private redirect() {
    const origin = this.config.get<string>('FRONTEND_URL');
    const uri =
      this.config.get<string>('ADS_GOOGLE_REDIRECT_URI') ||
      (origin
        ? new URL('/admin/config/ad-platforms', origin).toString()
        : undefined);
    if (!uri) throw new BadRequestException('OAUTH_REDIRECT_NOT_CONFIGURED');
    const url = new URL(uri);
    if (
      url.protocol !== 'https:' ||
      url.pathname !== '/admin/config/ad-platforms' ||
      url.search ||
      url.hash
    )
      throw new BadRequestException('OAUTH_REDIRECT_INVALID');
    return uri;
  }
  async start(ent: string, actor: string, id: string) {
    const c = await this.ads.connection(ent, id),
      keys = this.ads.decrypt(c);
    if (c.provider !== 'GOOGLE' || !keys.clientId || !keys.clientSecret)
      throw new BadRequestException('OAUTH_CLIENT_REQUIRED');
    const state = randomBytes(32).toString('hex');
    const redirect = this.redirect();
    await this.ads.ds.query(
      "INSERT INTO amb_acm_ads_oauth_state(state_hash,ent_id,adc_id,actor_id,revision,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '10 minutes')",
      [
        createHash('sha256').update(state).digest('hex'),
        ent,
        id,
        actor,
        c.revision,
      ],
    );
    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: keys.clientId, redirect_uri: redirect, response_type: 'code', scope: 'https://www.googleapis.com/auth/adwords', access_type: 'offline', prompt: 'consent', state })}`,
    };
  }
  async finish(ent: string, actor: string, state: string, code: string) {
    const [s]: Array<{ adc_id: string; revision: number }> =
      await this.ads.ds.query(
        'WITH changed AS (DELETE FROM amb_acm_ads_oauth_state WHERE state_hash=$1 AND ent_id=$2 AND actor_id=$3 AND expires_at>now() RETURNING adc_id,revision) SELECT * FROM changed',
        [createHash('sha256').update(state).digest('hex'), ent, actor],
      );
    if (!s) throw new BadRequestException('OAUTH_STATE_INVALID');
    const c = await this.ads.connection(ent, s.adc_id);
    if (c.revision !== s.revision)
      throw new ConflictException('CONNECTION_CHANGED');
    const keys = this.ads.decrypt(c);
    const response = await this.ads.client.request(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: keys.clientId,
          client_secret: keys.clientSecret,
          redirect_uri: this.redirect(),
          code,
        }).toString(),
      },
    );
    if (
      !response ||
      typeof response !== 'object' ||
      !('refresh_token' in response) ||
      typeof response.refresh_token !== 'string'
    )
      throw new BadRequestException('OAUTH_REFRESH_TOKEN_REQUIRED');
    keys.refreshToken = response.refresh_token;
    const encrypted = packEncrypted(
      this.crypto.encrypt(JSON.stringify(keys)),
    ).toString('base64');
    const rows: Array<{ adc_id: string }> = await this.ads.ds.query(
      'WITH changed AS (UPDATE amb_acm_ads_connection SET credentials_enc=$4,revision=revision+1,active=false,tested_revision=NULL,test_result=NULL,updated_at=now() WHERE ent_id=$1 AND adc_id=$2 AND revision=$3 RETURNING adc_id) SELECT * FROM changed',
      [ent, c.adc_id, s.revision, encrypted],
    );
    if (!rows.length) throw new ConflictException('CONNECTION_CHANGED');
    return { ok: true };
  }
}
