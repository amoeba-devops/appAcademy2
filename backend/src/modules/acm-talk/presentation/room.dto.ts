import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
export class RenameRoomDto {
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
}
export class ArchiveRoomDto {
  @IsBoolean() archived!: boolean;
}
export class LeaveRoomDto {
  @IsOptional() @IsUUID() successorId?: string;
}
