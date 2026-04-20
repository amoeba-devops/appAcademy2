import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateParentDto {
  @ApiProperty({ description: 'Parent name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Phone number (will be encrypted)' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Email (will be encrypted)' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Preferred contact channel' })
  @IsOptional()
  @IsString()
  preferredChannel?: string;
}

export class UpdateParentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  preferredChannel?: string;
}

export class ParentResponseDto {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  preferredChannel: string | null;
  createdAt: Date;
  updatedAt: Date;
}
