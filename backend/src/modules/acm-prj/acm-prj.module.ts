import { ProjectFileService } from './application/project-file.service';
import { ObjectStoreClient } from '../acm-csl/infrastructure/external/object-store.client';
import { SharedDriveService } from './application/shared-drive.service';
import { SharedDriveController } from './presentation/shared-drive.controller';
import { Module } from '@nestjs/common';
import { ProjectService } from './application/project.service';
import { IssueService } from './application/issue.service';
import { IssueController } from './presentation/issue.controller';
import { ProjectDriveService } from './application/drive.service';
import { DriveClient } from './infrastructure/drive.client';
import {
  ProjectController,
  ProjectOAuthController,
} from './presentation/project.controller';
@Module({
  providers: [
    ProjectFileService,
    ObjectStoreClient,
    SharedDriveService,
    ProjectService,
    IssueService,
    ProjectDriveService,
    DriveClient,
  ],
  controllers: [
    SharedDriveController,
    IssueController,
    ProjectController,
    ProjectOAuthController,
  ],
})
export class AcmPrjModule {}
