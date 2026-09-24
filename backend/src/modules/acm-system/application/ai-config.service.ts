import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { packEncrypted, unpackEncrypted } from '../../acm-auth/infrastructure/ama-secret.codec';
import { AiConfigTypeormEntity, type AiProvider } from '../infrastructure/typeorm/ai-config.typeorm-entity';
import type { TestAiConfigDto, UpdateAiConfigDto } from './dto/ai-config.dto';

export interface AiConfigView {
  provider: AiProvider | null;
  modelId: string;
  apiKeyIsSet: boolean;
  baseUrl: string | null;
  orgProjectId: string | null;
  isActive: boolean;
  lastTestStatus: 'SUCCESS' | 'FAILED' | null;
  lastTestedAt: string | null;
  lastTestMessage: string | null;
}

@Injectable()
export class AiConfigService {
  private readonly log = new Logger(AiConfigService.name);
  constructor(
    @InjectRepository(AiConfigTypeormEntity, ACM_DS)
    private readonly repo: Repository<AiConfigTypeormEntity>,
    private readonly aes: AesGcmService,
  ) {}

  async findByEntId(entId: string): Promise<AiConfigView> {
    return this.toView(await this.repo.findOne({ where: { entId } }));
  }

  async upsert(entId: string, dto: UpdateAiConfigDto): Promise<AiConfigView> {
    this.validateEndpoint(dto.provider, dto.baseUrl);
    let row = await this.repo.findOne({ where: { entId } });
    const changed = !row || row.provider !== dto.provider || row.modelId !== dto.modelId.trim() ||
      (row.baseUrl ?? '') !== (dto.baseUrl?.trim().replace(/\/$/, '') ?? '') || !!dto.apiKey?.trim();
    if (!row) row = this.repo.create({ entId, provider: dto.provider, modelId: dto.modelId.trim() });
    if (dto.isActive && (changed || row.lastTestStatus !== 'SUCCESS')) {
      throw new BadRequestException('AI_CONFIG_TEST_REQUIRED');
    }
    row.provider = dto.provider;
    row.modelId = dto.modelId.trim();
    row.baseUrl = dto.provider === 'CUSTOM_OPENAI_COMPATIBLE' ? dto.baseUrl?.trim().replace(/\/$/, '') ?? null : null;
    row.orgProjectId = dto.orgProjectId?.trim() || null;
    row.isActive = dto.isActive;
    if (dto.apiKey?.trim()) row.apiKeyEnc = packEncrypted(this.aes.encrypt(dto.apiKey.trim()));
    if (changed) {
      row.lastTestStatus = null;
      row.lastTestedAt = null;
      row.lastTestMessage = null;
      row.isActive = false;
    }
    const saved = await this.repo.save(row);
    this.log.log(`ai-config updated ent=${entId} provider=${saved.provider} active=${saved.isActive} keyChanged=${!!dto.apiKey?.trim()}`);
    return this.toView(saved);
  }

  async test(entId: string, dto: TestAiConfigDto): Promise<AiConfigView> {
    this.validateEndpoint(dto.provider, dto.baseUrl);
    let row = await this.repo.findOne({ where: { entId } });
    const apiKey = dto.apiKey?.trim() || (row?.apiKeyEnc?.length ? this.aes.decrypt(unpackEncrypted(row.apiKeyEnc)) : '');
    if (!apiKey) throw new BadRequestException('AI_API_KEY_REQUIRED');
    const result = await this.probe(dto.provider, dto.modelId.trim(), apiKey, dto.baseUrl, dto.orgProjectId);
    if (row && row.provider === dto.provider && row.modelId === dto.modelId.trim() &&
      (row.baseUrl ?? '') === (dto.baseUrl?.trim().replace(/\/$/, '') ?? '') && !dto.apiKey?.trim()) {
      row.lastTestStatus = result.ok ? 'SUCCESS' : 'FAILED';
      row.lastTestedAt = new Date();
      row.lastTestMessage = result.message;
      if (!result.ok) row.isActive = false;
      await this.repo.save(row);
    }
    if (!result.ok) throw new BadRequestException(result.message);
    return row ? this.toView(row) : { ...this.toView(null), provider: dto.provider, modelId: dto.modelId, lastTestStatus: 'SUCCESS', lastTestedAt: new Date().toISOString(), lastTestMessage: result.message };
  }

  async removeKey(entId: string): Promise<AiConfigView> {
    const row = await this.repo.findOne({ where: { entId } });
    if (!row) throw new NotFoundException('AI_CONFIG_NOT_FOUND');
    row.apiKeyEnc = null;
    row.isActive = false;
    row.lastTestStatus = null;
    row.lastTestedAt = null;
    row.lastTestMessage = null;
    this.log.log(`ai-config key removed ent=${entId}`);
    return this.toView(await this.repo.save(row));
  }

  private validateEndpoint(provider: AiProvider, baseUrl?: string) {
    if (provider !== 'CUSTOM_OPENAI_COMPATIBLE') return;
    if (!baseUrl) throw new BadRequestException('AI_BASE_URL_REQUIRED');
    const url = new URL(baseUrl);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || host === 'localhost' || host.endsWith('.local') || /^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) {
      throw new BadRequestException('AI_BASE_URL_NOT_ALLOWED');
    }
  }

  private async probe(provider: AiProvider, modelId: string, key: string, baseUrl?: string, org?: string) {
    let url: string;
    const headers: Record<string, string> = {};
    if (provider === 'ANTHROPIC') {
      url = 'https://api.anthropic.com/v1/models'; headers['x-api-key'] = key; headers['anthropic-version'] = '2023-06-01';
    } else if (provider === 'GOOGLE_GEMINI') {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}?key=${encodeURIComponent(key)}`;
    } else {
      url = `${provider === 'OPENAI' ? 'https://api.openai.com/v1' : baseUrl}/models/${encodeURIComponent(modelId)}`;
      headers.authorization = `Bearer ${key}`;
      if (org) headers['OpenAI-Organization'] = org;
    }
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
      return response.ok ? { ok: true, message: 'CONNECTION_OK' } : { ok: false, message: response.status === 401 || response.status === 403 ? 'AI_AUTH_FAILED' : response.status === 404 ? 'AI_MODEL_NOT_FOUND' : 'AI_PROVIDER_UNAVAILABLE' };
    } catch {
      return { ok: false, message: 'AI_PROVIDER_UNAVAILABLE' };
    }
  }

  private toView(row: AiConfigTypeormEntity | null): AiConfigView {
    return {
      provider: row?.provider ?? null, modelId: row?.modelId ?? '', apiKeyIsSet: !!row?.apiKeyEnc?.length,
      baseUrl: row?.baseUrl ?? null, orgProjectId: row?.orgProjectId ?? null, isActive: row?.isActive ?? false,
      lastTestStatus: row?.lastTestStatus ?? null, lastTestedAt: row?.lastTestedAt?.toISOString() ?? null,
      lastTestMessage: row?.lastTestMessage ?? null,
    };
  }
}
