import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import {
  CreateParentDto,
  ListParentsQueryDto,
  UpdateParentDto,
} from '../application/dto/parent.dto';
import { ParentService } from '../application/parent.service';

@ApiTags('acm-std')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
@Controller('acm/std/parents')
export class ParentController {
  constructor(private readonly parents: ParentService) {}

  @Get()
  @ApiOperation({ summary: 'List / search parents (REQ-260511 FR-STD-003)' })
  list(@CurrentUser() u: AcmCurrentUser, @Query() q: ListParentsQueryDto) {
    return this.parents.list(u.entId, q);
  }

  @Post()
  @ApiOperation({ summary: 'Create parent' })
  create(@CurrentUser() u: AcmCurrentUser, @Body() dto: CreateParentDto) {
    return this.parents.create(u.entId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get parent detail' })
  findOne(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.parents.findOne(u.entId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update parent' })
  update(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateParentDto,
  ) {
    return this.parents.update(u.entId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete parent' })
  remove(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.parents.remove(u.entId, id);
  }
}
