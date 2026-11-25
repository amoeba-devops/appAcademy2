import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const SCOPES = [
  'teachers:read',
  'lessons:read',
  'lessons:write',
] as const;
export type Scope = (typeof SCOPES)[number];
export class ApiSettingsDto {
  @IsBoolean() enabled!: boolean;
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(3)
  @IsIn(SCOPES, { each: true })
  scopes!: Scope[];
}
export class ClientDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}
export class ClientStateDto {
  @IsBoolean() active!: boolean;
}
export class IssueKeyDto extends ClientDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsIn(SCOPES, { each: true })
  scopes!: Scope[];
  @IsDateString({ strict: true }) expiresAt!: string;
}
export class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit = 100;
  @IsOptional() @IsUUID() cursor?: string;
}
export class TeacherQueryDto extends PageDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  @MaxLength(200)
  email?: string;
  @IsOptional() @IsIn(['ACTIVE', 'LEAVE', 'RESIGNED']) status?: string;
}
export class LessonQueryDto extends PageDto {
  @IsDateString({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  from!: string;
  @IsDateString({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  to!: string;
  @IsOptional() @IsUUID() teacherId?: string;
}
export class ExternalStudentDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
  @IsOptional() @IsUUID() studentId?: string;
}
export class LessonDto {
  @IsOptional() @IsUUID() teacherId?: string;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  @MaxLength(200)
  teacherEmail?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ExternalStudentDto)
  students!: ExternalStudentDto[];
  @IsDateString({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  startsAt!: string;
  @IsDateString({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  endsAt!: string;
  @IsIn(['DEMO_CLASS', 'REGULAR_CLASS']) category!:
    'DEMO_CLASS' | 'REGULAR_CLASS';
  @IsIn(['ONSITE', 'ONLINE']) deliveryMode!: 'ONSITE' | 'ONLINE';
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsString() @MaxLength(500) meetingUrl?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(500) reason?: string;
}
export class DeleteLessonDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  reason!: string;
}
