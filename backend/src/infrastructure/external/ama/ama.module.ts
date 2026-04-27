import { Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { AMA_CLIENT_SERVICE } from './interfaces/ama-client.interface';
import { AmaMockService } from './ama-mock.service';
import { AmaClientHttpService } from './ama-client.service';
import { TeacherSyncService } from './teacher-sync.service';

/**
 * AMA integration module — Read-only Teacher Master Mirror.
 *
 * Provider selection is driven by env AMA_MODE:
 *   - 'mock' (default for dev/test) → AmaMockService
 *   - 'http'                        → AmaClientHttpService
 *
 * C-003: This module MUST NOT be imported by payment / refund / tax modules.
 */
const amaClientProvider: Provider = {
  provide: AMA_CLIENT_SERVICE,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const mode = String(config.get('AMA_MODE', 'mock')).toLowerCase();
    if (mode === 'http') {
      return new AmaClientHttpService(config);
    }
    return new AmaMockService();
  },
};

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([TeacherEntity])],
  providers: [amaClientProvider, TeacherSyncService],
  exports: [AMA_CLIENT_SERVICE, TeacherSyncService],
})
export class AmaModule {}
