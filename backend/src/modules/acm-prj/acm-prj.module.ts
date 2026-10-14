import { Module } from '@nestjs/common';
import { ProjectService } from './application/project.service';
import { ProjectDriveService } from './application/drive.service';
import { DriveClient } from './infrastructure/drive.client';
import {
  ProjectController,
  ProjectOAuthController,
} from './presentation/project.controller';
@Module({
  providers: [ProjectService, ProjectDriveService, DriveClient],
  controllers: [ProjectController, ProjectOAuthController],
})
export class AcmPrjModule {}
