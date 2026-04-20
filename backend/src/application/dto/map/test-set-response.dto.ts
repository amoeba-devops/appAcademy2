import { ApiProperty } from '@nestjs/swagger';

export class TestSetItemResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  itemId: number;

  @ApiProperty()
  ordinal: number;

  @ApiProperty({ type: Object })
  itemVersionSnapshot: Record<string, unknown>;
}

export class TestSetResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  academyId: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  compositionMode: string;

  @ApiProperty({ nullable: true, type: Object })
  filterCriteria: Record<string, unknown> | null;

  @ApiProperty()
  totalPoints: number;

  @ApiProperty()
  status: string;

  @ApiProperty({ nullable: true })
  createdBy: number | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  itemCount: number;

  @ApiProperty({ type: [TestSetItemResponseDto] })
  items: TestSetItemResponseDto[];
}