import { IsBoolean, IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import type { AiProvider } from '../../infrastructure/typeorm/ai-config.typeorm-entity';

export const AI_PROVIDERS: AiProvider[] = [
  'OPENAI', 'ANTHROPIC', 'GOOGLE_GEMINI', 'CUSTOM_OPENAI_COMPATIBLE',
];

export class UpdateAiConfigDto {
  @IsIn(AI_PROVIDERS) provider!: AiProvider;
  @IsString() @MinLength(1) @MaxLength(120) modelId!: string;
  @IsOptional() @IsString() @MaxLength(500) apiKey?: string;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(500) baseUrl?: string;
  @IsOptional() @IsString() @MaxLength(200) orgProjectId?: string;
  @IsBoolean() isActive!: boolean;
}

export class TestAiConfigDto {
  @IsIn(AI_PROVIDERS) provider!: AiProvider;
  @IsString() @MinLength(1) @MaxLength(120) modelId!: string;
  @IsOptional() @IsString() @MaxLength(500) apiKey?: string;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(500) baseUrl?: string;
  @IsOptional() @IsString() @MaxLength(200) orgProjectId?: string;
}
