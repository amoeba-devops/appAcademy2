import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { NotificationTemplateEntity } from '../../infrastructure/database/entities/notification-template.entity';

class CreateTemplateDto {
  event: string;
  channel?: string;
  title: string;
  body: string;
  variables?: string[];
  isActive?: boolean;
}

class UpdateTemplateDto {
  event?: string;
  channel?: string;
  title?: string;
  body?: string;
  variables?: string[];
  isActive?: boolean;
}

@ApiTags('Notification Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notification-templates')
export class NotificationTemplateController {
  constructor(
    @InjectRepository(NotificationTemplateEntity)
    private readonly repo: Repository<NotificationTemplateEntity>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all notification templates (알림 템플릿 목록)' })
  async findAll() {
    const templates = await this.repo.find({
      where: { ntfDeletedAt: IsNull() },
      order: { ntfEvent: 'ASC', ntfChannel: 'ASC' },
    });

    return {
      data: templates.map((t) => this.toDto(t)),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification template by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const template = await this.repo.findOne({
      where: { ntfId: id, ntfDeletedAt: IsNull() },
    });

    if (!template) {
      return { data: null };
    }

    return { data: this.toDto(template) };
  }

  @Post()
  @ApiOperation({ summary: 'Create notification template (알림 템플릿 생성)' })
  async create(@Body() dto: CreateTemplateDto) {
    const entity = this.repo.create({
      acdId: 1,
      ntfEvent: dto.event,
      ntfChannel: dto.channel ?? 'TALK',
      ntfTitle: dto.title,
      ntfBody: dto.body,
      ntfVariables: dto.variables ?? null,
      ntfIsActive: dto.isActive === false ? 0 : 1,
    });

    const saved = await this.repo.save(entity);
    return { data: this.toDto(saved) };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update notification template (알림 템플릿 수정)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTemplateDto,
  ) {
    const template = await this.repo.findOne({
      where: { ntfId: id, ntfDeletedAt: IsNull() },
    });

    if (!template) {
      return { data: null };
    }

    if (dto.event !== undefined) template.ntfEvent = dto.event;
    if (dto.channel !== undefined) template.ntfChannel = dto.channel;
    if (dto.title !== undefined) template.ntfTitle = dto.title;
    if (dto.body !== undefined) template.ntfBody = dto.body;
    if (dto.variables !== undefined) template.ntfVariables = dto.variables;
    if (dto.isActive !== undefined) template.ntfIsActive = dto.isActive ? 1 : 0;

    const saved = await this.repo.save(template);
    return { data: this.toDto(saved) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification template (알림 템플릿 삭제 — soft)' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.repo.update(id, { ntfDeletedAt: new Date() });
    return { data: { success: true } };
  }

  private toDto(t: NotificationTemplateEntity) {
    return {
      id: t.ntfId,
      event: t.ntfEvent,
      channel: t.ntfChannel,
      title: t.ntfTitle,
      body: t.ntfBody,
      variables: t.ntfVariables,
      isActive: t.ntfIsActive === 1,
      createdAt: t.ntfCreatedAt,
      updatedAt: t.ntfUpdatedAt,
    };
  }
}
