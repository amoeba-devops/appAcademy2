import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { ObjectStoreClient } from '../acm-csl/infrastructure/external/object-store.client';
import { TalkService } from './application/talk.service';
import { TalkSseService } from './application/talk-sse.service';
import { TalkChannelTypeormEntity } from './infrastructure/typeorm/talk-channel.typeorm-entity';
import { TalkMemberTypeormEntity } from './infrastructure/typeorm/talk-member.typeorm-entity';
import { TalkMessageTypeormEntity } from './infrastructure/typeorm/talk-message.typeorm-entity';
import { TalkAdminController } from './presentation/talk-admin.controller';
import { TalkPortalController } from './presentation/talk-portal.controller';

/**
 * REQ-260728C — 로비채팅 (운영자↔강사 메신저, AMA amoeba-talk 참조).
 * Routes: /acm/talk (콘솔 운영자 — 개설·DM·멤버관리 포함),
 *         /portal/talk (강사 — 참여 전용). SSE 스트림 각 1개.
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature(
      [
        TalkChannelTypeormEntity,
        TalkMemberTypeormEntity,
        TalkMessageTypeormEntity,
      ],
      ACM_DS,
    ),
  ],
  controllers: [TalkAdminController, TalkPortalController],
  providers: [TalkService, TalkSseService, ObjectStoreClient],
})
export class AcmTalkModule {}
