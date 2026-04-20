import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  AssignmentResponseDto,
  CreateAssignmentDto,
  CreateTestSetDto,
  CreateItemDto,
  CreatePassageDto,
  GradingDetailResponseDto,
  GradingQueueResponseDto,
  UpdateAssignmentDto,
  UpdateTestSetDto,
  UpdateItemDto,
  UpdatePassageDto,
} from '../../application/dto/map';
import {
  CreateAssignmentUseCase,
  CreateTestSetUseCase,
  CreateItemUseCase,
  CreatePassageUseCase,
  GetGradingDetailUseCase,
  GetGradingQueueUseCase,
  GetAssignmentDetailUseCase,
  GetAssignmentsUseCase,
  GetHubStatsUseCase,
  GetItemDetailUseCase,
  GetItemsUseCase,
  GetPassageDetailUseCase,
  GetPassagesUseCase,
  GetTestSetDetailUseCase,
  GetTestSetPreviewUseCase,
  GetTestSetsUseCase,
  GradeAssignmentUseCase,
  UpdateAssignmentUseCase,
  UpdateTestSetUseCase,
  UpdateItemUseCase,
  UpdatePassageUseCase,
} from '../../application/use-cases/map';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('MAP')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('map')
export class MapController {
  constructor(
    private readonly getPassages: GetPassagesUseCase,
    private readonly getPassageDetail: GetPassageDetailUseCase,
    private readonly createPassage: CreatePassageUseCase,
    private readonly updatePassage: UpdatePassageUseCase,
    private readonly getItems: GetItemsUseCase,
    private readonly getItemDetail: GetItemDetailUseCase,
    private readonly createItem: CreateItemUseCase,
    private readonly updateItem: UpdateItemUseCase,
    private readonly getAssignments: GetAssignmentsUseCase,
    private readonly getAssignmentDetail: GetAssignmentDetailUseCase,
    private readonly createAssignment: CreateAssignmentUseCase,
    private readonly updateAssignment: UpdateAssignmentUseCase,
    private readonly getGradingQueue: GetGradingQueueUseCase,
    private readonly getGradingDetail: GetGradingDetailUseCase,
    private readonly gradeAssignment: GradeAssignmentUseCase,
    private readonly getTestSets: GetTestSetsUseCase,
    private readonly getTestSetDetail: GetTestSetDetailUseCase,
    private readonly createTestSet: CreateTestSetUseCase,
    private readonly updateTestSet: UpdateTestSetUseCase,
    private readonly getTestSetPreview: GetTestSetPreviewUseCase,
    private readonly getHubStats: GetHubStatsUseCase,
  ) {}

  @Get('hub-stats')
  @ApiOperation({ summary: 'Get MAP hub KPI stats (MAP 허브 통계)' })
  async hubStats(@CurrentUser() user: { academyId: number }) {
    return this.getHubStats.execute(user.academyId);
  }

  @Get('passages')
  @ApiOperation({ summary: 'Get passage library (지문 라이브러리 조회)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'domain', required: false })
  @ApiQuery({ name: 'gradeLevel', required: false })
  @ApiQuery({ name: 'search', required: false })
  async listPassages(
    @CurrentUser() user: { academyId: number },
    @Query('status') status?: string,
    @Query('domain') domain?: string,
    @Query('gradeLevel') gradeLevel?: string,
    @Query('search') search?: string,
  ) {
    return this.getPassages.execute(user.academyId, {
      status,
      domain,
      gradeLevel,
      search,
    });
  }

  @Get('passages/:id')
  @ApiOperation({ summary: 'Get passage detail (지문 상세 조회)' })
  async getPassage(@Param('id', ParseIntPipe) id: number) {
    return this.getPassageDetail.execute(id);
  }

  @Post('passages')
  @ApiOperation({ summary: 'Create passage (지문 등록)' })
  async createPassageEntry(
    @CurrentUser() user: { academyId: number },
    @Body() dto: CreatePassageDto,
  ) {
    return this.createPassage.execute(user.academyId, dto);
  }

  @Patch('passages/:id')
  @ApiOperation({ summary: 'Update passage (지문 수정)' })
  async updatePassageEntry(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePassageDto,
  ) {
    return this.updatePassage.execute(id, dto);
  }

  @Get('items')
  @ApiOperation({ summary: 'Get item library (문항 라이브러리 조회)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'domain', required: false })
  @ApiQuery({ name: 'gradeLevel', required: false })
  @ApiQuery({ name: 'itemType', required: false })
  @ApiQuery({ name: 'passageId', required: false })
  @ApiQuery({ name: 'search', required: false })
  async listItems(
    @CurrentUser() user: { academyId: number },
    @Query('status') status?: string,
    @Query('domain') domain?: string,
    @Query('gradeLevel') gradeLevel?: string,
    @Query('itemType') itemType?: string,
    @Query('passageId') passageId?: string,
    @Query('search') search?: string,
  ) {
    return this.getItems.execute(user.academyId, {
      status,
      domain,
      gradeLevel,
      itemType,
      passageId: passageId ? Number(passageId) : undefined,
      search,
    });
  }

  @Get('items/:id')
  @ApiOperation({ summary: 'Get item detail (문항 상세 조회)' })
  async getItem(@Param('id', ParseIntPipe) id: number) {
    return this.getItemDetail.execute(id);
  }

  @Post('items')
  @ApiOperation({ summary: 'Create item (문항 등록)' })
  async createItemEntry(
    @CurrentUser() user: { academyId: number },
    @Body() dto: CreateItemDto,
  ) {
    return this.createItem.execute(user.academyId, dto);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Update item (문항 수정)' })
  async updateItemEntry(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateItemDto,
  ) {
    return this.updateItem.execute(id, dto);
  }

  @Get('assignments')
  @ApiOperation({ summary: 'Get MAP assignments (응시 배정 목록 조회)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'targetType', required: false })
  @ApiQuery({ name: 'search', required: false })
  async listAssignments(
    @CurrentUser() user: { academyId: number },
    @Query('status') status?: string,
    @Query('targetType') targetType?: string,
    @Query('search') search?: string,
  ): Promise<AssignmentResponseDto[]> {
    return this.getAssignments.execute(user.academyId, { status, targetType, search });
  }

  @Get('assignments/:id')
  @ApiOperation({ summary: 'Get MAP assignment detail (응시 배정 상세 조회)' })
  async getAssignment(@Param('id', ParseIntPipe) id: number): Promise<AssignmentResponseDto> {
    return this.getAssignmentDetail.execute(id);
  }

  @Post('assignments')
  @ApiOperation({ summary: 'Create MAP assignment (응시 배정 생성)' })
  async createAssignmentEntry(@Body() dto: CreateAssignmentDto): Promise<AssignmentResponseDto> {
    return this.createAssignment.execute(dto);
  }

  @Patch('assignments/:id')
  @ApiOperation({ summary: 'Update MAP assignment (응시 배정 수정)' })
  async updateAssignmentEntry(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAssignmentDto,
  ): Promise<AssignmentResponseDto> {
    return this.updateAssignment.execute(id, dto);
  }

  @Get('grading')
  @ApiOperation({ summary: 'Get MAP grading queue (채점 대기열 조회)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  async listGradingQueue(
    @CurrentUser() user: { academyId: number },
    @Query('status') status?: string,
    @Query('search') search?: string,
  ): Promise<GradingQueueResponseDto[]> {
    return this.getGradingQueue.execute(user.academyId, { status, search });
  }

  @Get('grading/:assignmentId')
  @ApiOperation({ summary: 'Get MAP grading detail (채점 상세 조회)' })
  async getGrading(@Param('assignmentId', ParseIntPipe) assignmentId: number): Promise<GradingDetailResponseDto> {
    return this.getGradingDetail.execute(assignmentId);
  }

  @Post('grading/:assignmentId/grade')
  @ApiOperation({ summary: 'Auto-grade MAP assignment (MAP 자동 채점)' })
  async gradeMapAssignment(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
  ): Promise<GradingDetailResponseDto> {
    return this.gradeAssignment.execute(assignmentId);
  }

  @Get('test-sets')
  @ApiOperation({ summary: 'Get MAP test sets (테스트셋 목록 조회)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  async listTestSets(
    @CurrentUser() user: { academyId: number },
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.getTestSets.execute(user.academyId, { status, search });
  }

  @Get('test-sets/:id')
  @ApiOperation({ summary: 'Get MAP test set detail (테스트셋 상세 조회)' })
  async getTestSet(@Param('id', ParseIntPipe) id: number) {
    return this.getTestSetDetail.execute(id);
  }

  @Get('test-sets/:id/preview')
  @ApiOperation({ summary: 'Preview MAP test set (테스트셋 미리보기)' })
  async previewTestSet(@Param('id', ParseIntPipe) id: number) {
    return this.getTestSetPreview.execute(id);
  }

  @Post('test-sets')
  @ApiOperation({ summary: 'Create MAP test set (테스트셋 생성)' })
  async createTestSetEntry(
    @CurrentUser() user: { academyId: number; id?: number },
    @Body() dto: CreateTestSetDto,
  ) {
    return this.createTestSet.execute(user.academyId, user.id ?? 0, dto);
  }

  @Patch('test-sets/:id')
  @ApiOperation({ summary: 'Update MAP test set (테스트셋 수정)' })
  async updateTestSetEntry(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTestSetDto,
  ) {
    return this.updateTestSet.execute(id, dto);
  }
}