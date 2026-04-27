import {
  Body,
  Controller,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationTemplateEntity } from '../../infrastructure/database/entities/notification-template.entity';
import { NotificationDispatcher } from './notification-dispatcher.service';
import {
  EVENT_TO_NTF_EVENT,
  type NotificationEventName,
} from '../../application/notification/notification-context.types';

class TestSendDto {
  to: string;
  variables?: Record<string, string>;
}

@ApiTags('Notification Templates')
@Controller('notification-templates')
export class TemplateTestSendController {
  constructor(
    @InjectRepository(NotificationTemplateEntity)
    private readonly tplRepo: Repository<NotificationTemplateEntity>,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  @Post(':id/test-send')
  @ApiOperation({ summary: 'Send a test notification using this template' })
  async testSend(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: TestSendDto,
  ) {
    const tpl = await this.tplRepo.findOne({ where: { ntfId: id } });
    if (!tpl) throw new NotFoundException('Template not found');

    const eventName = ntfEventToEventName(tpl.ntfEvent);
    if (!eventName) {
      throw new NotFoundException(
        `No event mapping found for ntfEvent='${tpl.ntfEvent}'`,
      );
    }

    await this.dispatcher.dispatch(eventName, {
      academyId: tpl.acdId,
      recipients: [body.to],
      recipientKind: 'PARENT',
      subjectKind: 'TEMPLATE_TEST',
      variables: body.variables ?? {},
    });
    return { data: { ok: true, templateId: id, recipient: body.to } };
  }
}

function ntfEventToEventName(nlgEvent: string): NotificationEventName | null {
  for (const [evt, ntf] of Object.entries(EVENT_TO_NTF_EVENT)) {
    if (ntf === nlgEvent) return evt as NotificationEventName;
  }
  return null;
}
