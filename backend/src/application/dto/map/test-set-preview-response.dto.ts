import { ApiProperty } from '@nestjs/swagger';
import { TestSetResponseDto } from './test-set-response.dto';

export class TestSetPreviewResponseDto {
  @ApiProperty({ type: TestSetResponseDto })
  testSet: TestSetResponseDto;

  @ApiProperty()
  totalItems: number;

  @ApiProperty()
  totalPoints: number;

  @ApiProperty()
  passageCount: number;

  @ApiProperty()
  partACount: number;

  @ApiProperty()
  partBCount: number;

  @ApiProperty()
  estimatedMinutes: number;

  @ApiProperty({ type: Object })
  difficultyBreakdown: Record<string, number>;
}