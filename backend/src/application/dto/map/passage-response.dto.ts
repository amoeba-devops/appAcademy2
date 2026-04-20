import { ApiProperty } from '@nestjs/swagger';

export class PassageResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ nullable: true })
  academyId: number | null;

  @ApiProperty()
  title: string;

  @ApiProperty()
  body: string;

  @ApiProperty()
  gradeLevel: string;

  @ApiProperty()
  domain: string;

  @ApiProperty({ nullable: true })
  pairGroupId: number | null;

  @ApiProperty({ nullable: true })
  source: string | null;

  @ApiProperty()
  version: number;

  @ApiProperty()
  status: string;

  @ApiProperty({ type: [String] })
  assetUrls: string[];

  @ApiProperty()
  itemCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}