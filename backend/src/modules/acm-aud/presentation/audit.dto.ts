import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class UpdateAuditPolicyDto {
  @ApiProperty({ minimum: 3, maximum: 20 })
  @IsInt()
  @Min(3)
  @Max(20)
  failMax!: number;
  @ApiProperty({
    minimum: 0,
    maximum: 1440,
    description: '0 = until an administrator unlocks',
  })
  @IsInt()
  @Min(0)
  @Max(1440)
  lockMinutes!: number;
  @ApiProperty({ minimum: 5, maximum: 200 })
  @IsInt()
  @Min(5)
  @Max(200)
  ipFailMax!: number;
  @ApiProperty({ minimum: 1, maximum: 1440 })
  @IsInt()
  @Min(1)
  @Max(1440)
  ipWindowMinutes!: number;
  @ApiProperty({ minimum: 1, maximum: 1440 })
  @IsInt()
  @Min(1)
  @Max(1440)
  ipBlockMinutes!: number;
}

export class UnlockAccountDto {
  @ApiProperty({ enum: ['CONSOLE', 'PORTAL'] })
  @IsIn(['CONSOLE', 'PORTAL'])
  kind!: 'CONSOLE' | 'PORTAL';
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() actorId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() failureId?: string;
}
