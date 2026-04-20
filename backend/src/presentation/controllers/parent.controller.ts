import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateParentDto, UpdateParentDto } from '../../application/dto/parent';
import {
  GetParentsUseCase,
  GetParentDetailUseCase,
  CreateParentUseCase,
  UpdateParentUseCase,
} from '../../application/use-cases/parent';

@ApiTags('Parents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('parents')
export class ParentController {
  constructor(
    private readonly getParents: GetParentsUseCase,
    private readonly getParentDetail: GetParentDetailUseCase,
    private readonly createParent: CreateParentUseCase,
    private readonly updateParent: UpdateParentUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get parent list (학부모 목록 조회)' })
  @ApiQuery({ name: 'search', required: false })
  async list(
    @CurrentUser() user: { academyId: number },
    @Query('search') search?: string,
  ) {
    return this.getParents.execute(user.academyId, { search });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get parent detail (학부모 상세 조회)' })
  async detail(@Param('id', ParseIntPipe) id: number) {
    return this.getParentDetail.execute(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create parent (학부모 등록)' })
  async create(
    @CurrentUser() user: { academyId: number },
    @Body() dto: CreateParentDto,
  ) {
    return this.createParent.execute(user.academyId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update parent (학부모 수정)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateParentDto,
  ) {
    return this.updateParent.execute(id, dto);
  }
}
