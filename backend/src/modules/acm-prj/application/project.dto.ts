import { Type } from 'class-transformer';
import { ISSUE_STATUSES, ISSUE_TYPES } from './issue.dto';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsUrl,
  ValidateNested,
  Max,
  Min,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
export class ProjectDto {
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsUUID() ownerId!: string;
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  memberIds!: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  managerIds?: string[];
  @IsOptional() @IsIn(['ACTIVE', 'DONE', 'ARCHIVED']) status?: string;
}
export class ItemDto {
  @IsIn(['ISSUE', 'NOTE']) kind!: 'ISSUE' | 'NOTE';
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(50000) body?: string;
  @IsOptional() @IsIn(ISSUE_STATUSES) status?: string;
  @IsOptional() @IsUUID() assigneeId?: string | null;
  @IsOptional() @IsISO8601({ strict: true }) dueDate?: string | null;
  // REQ-261015C — 이슈 확장 필드
  @IsOptional() @IsIn(ISSUE_TYPES) issueType?: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) priority?: number;
  @IsOptional() @IsISO8601({ strict: true }) startDate?: string | null;
  // REQ-261016C — AMA 이슈 작성 화면 동일화
  @IsOptional() @IsUUID() parentId?: string | null;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  participantIds?: string[];
  @IsOptional() @IsInt() @Min(0) @Max(100) doneRatio?: number;
  @IsOptional() @IsString() @MaxLength(10000) resolution?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => IssueAttachmentDto)
  attachments?: IssueAttachmentDto[];
}
/** 첨부: 프로젝트 파일(ACM 저장소 pit_id 또는 Drive 파일 ID) 또는 URL 중 하나. */
export class IssueAttachmentDto {
  @IsOptional() @IsUUID() fileItemId?: string;
  @IsOptional() @Matches(/^[a-zA-Z0-9_-]{1,200}$/) driveFileId?: string;
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(1000)
  url?: string;
  @IsString() @MinLength(1) @MaxLength(255) name!: string;
}
export class DriveFileDto {
  @IsString() @Matches(/^[a-zA-Z0-9_-]{1,200}$/) fileId!: string;
}
export class CreateDriveDto {
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsIn(['DOCUMENT', 'SHEET', 'FOLDER']) kind!: 'DOCUMENT' | 'SHEET' | 'FOLDER';
  @IsUUID() operationId!: string;
  @IsOptional() @Matches(/^[a-zA-Z0-9_-]{1,200}$/) parentId?: string;
}
export class RootDto {
  @IsOptional() @Matches(/^[a-zA-Z0-9_-]{1,200}$/) fileId?: string;
  /** REQ-261016 — 새 공용폴더 이름(미지정 시 "ACM - {테넌트명}"). */
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
}
export class ConnectDto {
  @IsString() @MaxLength(500) returnPath!: string;
}
