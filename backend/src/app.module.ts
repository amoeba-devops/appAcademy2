import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './presentation/controllers/health.controller';
import { AcmModule } from './modules/acm.module';
import { ACM_DS } from './modules/acm-common/datasource';
import { MailerModule } from './infrastructure/mailer/mailer.module';

@Module({
  imports: [
    // Environment config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Scheduler (cron jobs)
    ScheduleModule.forRoot(),

    // Event emitter (used for cross-module domain events → notifications, audit, etc.)
    EventEmitterModule.forRoot({ wildcard: true, maxListeners: 20 }),

    // Rate limiting (60 requests per minute per IP)
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 60,
    }]),

    // ACM PostgreSQL connection (db_acm). MySQL legacy datasource removed.
    TypeOrmModule.forRootAsync({
      name: ACM_DS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        name: ACM_DS,
        host: config.get('ACM_PG_HOST', 'localhost'),
        port: config.get<number>('ACM_PG_PORT', 5434),
        username: config.get('ACM_PG_USER', 'acm'),
        password: config.get('ACM_PG_PASSWORD', 'acm'),
        database: config.get('ACM_PG_DATABASE', 'db_acm'),
        autoLoadEntities: true,
        synchronize: false,
        logging: config.get('NODE_ENV') !== 'production',
        retryAttempts: config.get('NODE_ENV') === 'production' ? 10 : 1,
        retryDelay: 3000,
      }),
    }),

    // ACM modules — PostgreSQL only
    AcmModule,

    // SMTP mailer (global) — used by InviteeNotifier
    MailerModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
