import { ApiProperty } from '@nestjs/swagger';

export class ItemResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ nullable: true })
  academyId: number | null;

  @ApiProperty({ nullable: true })
  passageId: number | null;

  @ApiProperty({ nullable: true })
  parentItemId: number | null;

  @ApiProperty()
  domain: string;

  @ApiProperty()
  gradeLevel: string;

  @ApiProperty()
  difficulty: string;

  @ApiProperty()
  itemType: string;

  @ApiProperty()
  stem: string;

  @ApiProperty({ type: [String] })
  options: string[];

  @ApiProperty({ type: [String] })
  answerKeys: string[];

  @ApiProperty({ nullable: true })
  explanation: string | null;

  @ApiProperty()
  points: number;

  @ApiProperty()
  version: number;

  @ApiProperty()
  status: string;

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty({ nullable: true })
  passageTitle: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}