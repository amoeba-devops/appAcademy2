import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
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

export class MemberTargetDto {
  @IsIn(['USER', 'TEACHER']) kind!: 'USER' | 'TEACHER';
  @IsUUID() refId!: string;
}
export class InviteMembersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => MemberTargetDto)
  members!: MemberTargetDto[];
}
export class MemberPathDto extends MemberTargetDto {
  @IsUUID() id!: string;
}
