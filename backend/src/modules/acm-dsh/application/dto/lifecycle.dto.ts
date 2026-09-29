import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsUUID,
  IsBoolean,
  MaxLength,
  IsString,
} from 'class-validator';
export class LifecycleDto {
  @IsIn(['STUDENT', 'INQUIRY']) subjectKind!: 'STUDENT' | 'INQUIRY';
  @IsUUID() subjectId!: string;
  @IsIn([
    'SCHEDULE',
    'RETURN',
    'REFERRAL',
    'FIRST_PAYMENT',
    'FIRST_CLASS',
    'PAYMENT_ENDED',
  ])
  kind!:
    | 'SCHEDULE'
    | 'RETURN'
    | 'REFERRAL'
    | 'FIRST_PAYMENT'
    | 'FIRST_CLASS'
    | 'PAYMENT_ENDED';
  @IsISO8601({ strict: true }) effectiveDate!: string;
  @IsIn(['TPI', 'TRINITY', 'SANTACROCE', 'COMMON']) site!: string;
  @IsOptional()
  @IsIn(['SCHEDULING', 'SCHEDULED', 'CLOSED', 'CANCELLED'])
  status?: string;
  @IsOptional() @IsUUID() teacherId?: string;
  @IsOptional() @IsISO8601({ strict: true }) scheduledAt?: string;
  @IsOptional() @IsIn(['STUDENT', 'INQUIRY', 'PARENT']) relatedKind?: string;
  @IsOptional() @IsUUID() relatedId?: string;
  @IsOptional() @IsISO8601({ strict: true }) stoppedDate?: string;
  @IsOptional() @IsBoolean() verified?: boolean;
  @IsOptional() @IsString() @MaxLength(100) courseKey?: string;
}
