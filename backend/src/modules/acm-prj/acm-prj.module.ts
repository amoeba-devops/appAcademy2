import { SharedDriveService } from './application/shared-drive.service';
import { SharedDriveController } from './presentation/shared-drive.controller';
import { Module } from '@nestjs/common';
import { ProjectService } from './application/project.service';
import { ProjectDriveService } from './application/drive.service';
import { DriveClient } from './infrastructure/drive.client';
import {
  ProjectController,
  ProjectOAuthController,
} from './presentation/project.controller';
@Module({
  providers: [
    SharedDriveService,
    ProjectService,
    ProjectDriveService,
    DriveClient,
  ],
  controllers: [
    SharedDriveController,
    ProjectController,
    ProjectOAuthController,
  ],
})
export class AcmPrjModule {}
