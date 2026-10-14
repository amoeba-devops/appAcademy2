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
