import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './presentation/controllers/health.controller';
import { AuthModule } from './presentation/auth/auth.module';
import { TeacherModule } from './presentation/teacher.module';
import { StudentParentModule } from './presentation/student-parent.module';
import { ConsultationModule } from './presentation/consultation.module';
import { ProgramModule } from './presentation/program.module';
import { ClassModule } from './presentation/class.module';
import { TimetableModule } from './presentation/timetable.module';
import { EnrollmentModule } from './presentation/enrollment.module';
import { MapModule } from './presentation/map.module';
import { PaymentModule } from './presentation/payment.module';
import { PostModule } from './presentation/post.module';
import { DashboardModule } from './presentation/dashboard.module';
import { PortalParentModule } from './presentation/portal-parent.module';
import { NotificationModule } from './presentation/notification.module';

@Module({
  imports: [
    // Environment config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Scheduler (cron jobs)
    ScheduleModule.forRoot(),

    // Rate limiting (60 requests per minute per IP)
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 60,
    }]),

    // Database (MySQL)
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.get('DB_USERNAME', 'root'),
        password: config.get('DB_PASSWORD', 'password'),
        database: config.get('DB_DATABASE', 'db_tac'),
        charset: 'utf8mb4',
        entities: [__dirname + '/infrastructure/database/entities/*.entity{.ts,.js}'],
        synchronize: false, // 운영 환경 안전: SQL 마이그레이션 사용
        logging: config.get('NODE_ENV') !== 'production',
        retryAttempts: config.get('NODE_ENV') === 'production' ? 10 : 3,
        retryDelay: 3000,
      }),
    }),

    // Auth
    AuthModule,

    // Feature modules
    TeacherModule,
    StudentParentModule,
    ConsultationModule,
    ProgramModule,
    ClassModule,
    TimetableModule,
    EnrollmentModule,
    MapModule,
    PaymentModule,
    PostModule,
    DashboardModule,
    PortalParentModule,
    NotificationModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
