import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
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
  @IsOptional() @IsIn(['TODO', 'DOING', 'DONE']) status?: string;
  @IsOptional() @IsUUID() assigneeId?: string | null;
  @IsOptional() @IsISO8601({ strict: true }) dueDate?: string | null;
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
}
export class ConnectDto {
  @IsString() @MaxLength(500) returnPath!: string;
}
