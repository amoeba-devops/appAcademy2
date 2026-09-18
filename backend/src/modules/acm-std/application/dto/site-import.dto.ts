import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
export class ImportDecisionDto {
  @IsString() @MaxLength(200) key!: string;
  @IsIn(['NEW', 'UPDATE']) action!: 'NEW' | 'UPDATE';
  @IsOptional() @IsUUID() studentId?: string;
  @IsBoolean() reviewed!: boolean;
  @IsArray()
  @ArrayMaxSize(5)
  @IsUUID(undefined, { each: true })
  teacherIds!: string[];
  @IsOptional() @IsEmail() @MaxLength(200) email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
}
export class CommitSiteImportDto {
  @IsUUID() previewId!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ImportDecisionDto)
  decisions!: ImportDecisionDto[];
}
