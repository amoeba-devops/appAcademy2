import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { QnaCategoryService } from '../application/qna-category.service';
import { CreateQnaCategoryDto, UpdateQnaCategoryDto } from '../application/dto/qna-category.dto';

/** Q-30..Q-33 — QNA Categories CRUD. */
@ApiTags('acm-qna')
@ApiBearerAuth()
@UseGuards(OwnEntityGuard)
@Controller('acm/qna/categories')
export class QnaCategoryController {
  constructor(private readonly service: QnaCategoryService) {}

  @Get()
  @ApiOperation({ summary: 'List categories (Q-30)' })
  list(@CurrentUser() user: AcmCurrentUser) {
    return this.service.list(user.entId);
  }

  @Post()
  @ApiOperation({ summary: 'Create category (Q-31)' })
  create(@CurrentUser() user: AcmCurrentUser, @Body() dto: CreateQnaCategoryDto) {
    return this.service.create(user.entId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update category (Q-32)' })
  update(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQnaCategoryDto,
  ) {
    return this.service.update(user.entId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete category (Q-33) — blocked when referenced' })
  async remove(@CurrentUser() user: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.service.remove(user.entId, id);
  }
}
