import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ManagePostsUseCase } from '../../application/use-cases/post';
import { CreatePostDto, UpdatePostDto } from '../../application/dto/post';

@ApiTags('Posts (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/posts')
export class AdminPostController {
  constructor(private readonly managePosts: ManagePostsUseCase) {}

  @Get()
  @ApiOperation({ summary: 'List posts (관리자 — 소식 목록)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'category', required: false })
  async list(
    @CurrentUser() user: { academyId: number },
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    return this.managePosts.listAll(user.academyId, { status, category });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Post detail (관리자)' })
  async detail(
    @CurrentUser() user: { academyId: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.managePosts.getById(user.academyId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create post (소식 등록 — DRAFT 상태로 생성)' })
  async create(
    @CurrentUser() user: { academyId: number; userId: number },
    @Body() dto: CreatePostDto,
  ) {
    return this.managePosts.create(user.academyId, user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update post (소식 수정 / 발행 / 보관)' })
  async update(
    @CurrentUser() user: { academyId: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
  ) {
    return this.managePosts.update(user.academyId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete post (소식 삭제)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: { academyId: number },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.managePosts.delete(user.academyId, id);
  }
}
