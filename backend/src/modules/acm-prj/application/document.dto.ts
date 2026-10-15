import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
export class DocumentDto {
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsIn(['MEMO', 'SHEET', 'DOC']) documentType!: 'MEMO' | 'SHEET' | 'DOC';
  @IsIn(['LOCAL', 'GOOGLE_LINK']) storageType!: 'LOCAL' | 'GOOGLE_LINK';
  @IsOptional() @IsObject() content?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(500) url?: string;
  @IsOptional() @IsInt() @Min(1) revision?: number;
}
export class SharedFolderDto {
  @IsString() @Matches(/^[\w-]{1,200}$/) fileId!: string;
  @IsIn(['NONE', 'VIEW', 'EDIT']) operatorAccess!: 'NONE' | 'VIEW' | 'EDIT';
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  viewers!: string[];
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  editors!: string[];
}

export class ProjectRelationDto {
  @IsIn(['CLIENT', 'CHAT']) kind!: 'CLIENT' | 'CHAT';
  @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsOptional() @IsUUID() refId?: string;
}

export class ProjectFileDto {
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsIn(['PLANNING', 'DESIGN', 'DEVELOPMENT', 'OPERATION', 'ETC'])
  phase!: string;
  @IsUUID() operationId!: string;
  /** REQ-261016 — 저장소 선택. 미지정 시 Drive 준비되면 DRIVE, 아니면 ACM. */
  @IsOptional() @IsIn(['DRIVE', 'ACM']) storage?: 'DRIVE' | 'ACM';
}

export class DocumentPermissionDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  viewers!: string[];
}
