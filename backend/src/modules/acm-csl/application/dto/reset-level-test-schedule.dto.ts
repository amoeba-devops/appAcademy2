import { IsDateString, IsUUID, Matches, ValidateIf } from 'class-validator';

/** All snapshot keys are required; null means the saved value was empty. */
export class ResetLevelTestScheduleDto {
  @ValidateIf((_o, value: unknown) => value !== null)
  @IsDateString()
  scheduledAt!: string | null;

  @ValidateIf((_o, value: unknown) => value !== null)
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  scheduledTime!: string | null;

  @ValidateIf((_o, value: unknown) => value !== null)
  @IsUUID()
  calEventId!: string | null;
}
