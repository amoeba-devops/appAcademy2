import {
  ArgumentsHost,
  Body,
  CanActivate,
  Catch,
  Controller,
  Delete,
  ExecutionContext,
  ExceptionFilter,
  Get,
  HttpException,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  SetMetadata,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import {
  ApiManagementGuard,
  ApiGuideGuard,
} from '../../acm-common/guards/api-management.guard';
import { RequirePasswordRotationGuard } from '../../acm-common/guards/require-password-rotation.guard';
import { IntegrationAccessService } from '../application/integration-access.service';
import { SchedulerService } from '../application/scheduler.service';
import {
  ApiSettingsDto,
  ClientDto,
  ClientStateDto,
  DeleteLessonDto,
  IssueKeyDto,
  LessonDto,
  LessonQueryDto,
  TeacherQueryDto,
  type Scope,
} from '../application/dto/scheduler.dto';
import { API_CATALOG, API_ERRORS, schedulerOpenApi } from './scheduler-catalog';
import type {
  IntegrationRequest,
  WriteResult,
} from '../application/scheduler.types';

@Injectable()
export class SchedulerApiGuard implements CanActivate {
  constructor(
    private readonly access: IntegrationAccessService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    ctx
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Cache-Control', 'no-store');
    const scope = this.reflector.get<Scope>(
      'integrationScope',
      ctx.getHandler(),
    );
    const req = ctx.switchToHttp().getRequest<IntegrationRequest>();
    req.integration = await this.access.authenticate(
      req.headers.authorization,
      scope,
    );
    return true;
  }
}
@Catch()
export class SchedulerErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const payload = error instanceof HttpException ? error.getResponse() : null;
    const value =
      payload && typeof payload === 'object'
        ? (payload as { code?: string; message?: unknown; details?: unknown })
        : null;
    const code =
      value?.code ??
      (status === 400
        ? 'VALIDATION_ERROR'
        : status >= 500
          ? 'INTERNAL_ERROR'
          : `HTTP_${status}`);
    if (status === 429) res.setHeader('Retry-After', '60');
    res.status(status).json({
      success: false,
      error: {
        code,
        message: code,
        ...(value?.details ? { details: value.details } : {}),
      },
    });
  }
}

@Controller('acm/integrations')
@UseGuards(
  AcmJwtAuthGuard,
  OwnEntityGuard,
  ApiGuideGuard,
  RequirePasswordRotationGuard,
)
export class IntegrationGuideController {
  @Get('catalog') catalog() {
    return {
      basePath: '/api/integrations/v1',
      version: 'v1',
      status: 'AVAILABLE',
      apis: API_CATALOG,
      errors: API_ERRORS,
    };
  }
  @Get('openapi.json') openapi(@Res() res: Response) {
    return res
      .header(
        'Content-Disposition',
        'attachment; filename="acm-scheduler-openapi.json"',
      )
      .json(schedulerOpenApi('/api/integrations/v1'));
  }
}
@Controller('acm/integrations')
@UseGuards(
  AcmJwtAuthGuard,
  OwnEntityGuard,
  ApiManagementGuard,
  RequirePasswordRotationGuard,
)
export class IntegrationAdminController {
  constructor(private readonly access: IntegrationAccessService) {}
  @Get('settings') settings(@CurrentUser() u: AcmCurrentUser) {
    return this.access.settings(u.entId);
  }
  @Put('settings') save(
    @CurrentUser() u: AcmCurrentUser,
    @Body() dto: ApiSettingsDto,
  ) {
    return this.access.saveSettings(u.entId, u.id, dto);
  }
  @Get('clients') clients(@CurrentUser() u: AcmCurrentUser) {
    return this.access.clients(u.entId);
  }
  @Post('clients') add(
    @CurrentUser() u: AcmCurrentUser,
    @Body() dto: ClientDto,
  ) {
    return this.access.addClient(u.entId, u.id, dto.name);
  }
  @Put('clients/:id') state(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClientStateDto,
  ) {
    return this.access.setClient(u.entId, u.id, id, dto.active);
  }
  @Post('clients/:id/keys') issue(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueKeyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.access.issueKey(u.entId, u.id, id, dto);
  }
  @Delete('keys/:id') revoke(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.access.revokeKey(u.entId, u.id, id);
  }
}

@Controller('integrations/v1')
@UseGuards(SchedulerApiGuard)
@UseFilters(SchedulerErrorFilter)
export class SchedulerApiController {
  constructor(private readonly scheduler: SchedulerService) {}
  @Get('teachers')
  @SetMetadata('integrationScope', 'teachers:read')
  teachers(@Req() req: IntegrationRequest, @Query() q: TeacherQueryDto) {
    return this.scheduler.teachers(req.integration, q);
  }
  @Get('lessons')
  @SetMetadata('integrationScope', 'lessons:read')
  list(@Req() req: IntegrationRequest, @Query() q: LessonQueryDto) {
    return this.scheduler.list(req.integration, q);
  }
  @Get('lessons/external/:externalId')
  @SetMetadata('integrationScope', 'lessons:read')
  async get(
    @Req() req: IntegrationRequest,
    @Param('externalId') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(res, await this.scheduler.get(req.integration, id));
  }
  @Put('lessons/external/:externalId')
  @SetMetadata('integrationScope', 'lessons:write')
  async put(
    @Req() req: IntegrationRequest,
    @Param('externalId') id: string,
    @Body() dto: LessonDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(
      res,
      await this.scheduler.write(req.integration, id, dto, this.headers(req)),
    );
  }
  @Delete('lessons/external/:externalId')
  @SetMetadata('integrationScope', 'lessons:write')
  async remove(
    @Req() req: IntegrationRequest,
    @Param('externalId') id: string,
    @Body() dto: DeleteLessonDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(
      res,
      await this.scheduler.write(
        req.integration,
        id,
        dto,
        this.headers(req),
        true,
      ),
    );
  }
  private headers(req: Request) {
    return {
      key: req.get('Idempotency-Key'),
      match: req.get('If-Match'),
      none: req.get('If-None-Match'),
    };
  }
  private respond(res: Response, result: WriteResult) {
    res.status(result.status).setHeader('Cache-Control', 'no-store');
    if (result.etag) res.setHeader('ETag', result.etag);
    return { success: true, data: result.data };
  }
}
