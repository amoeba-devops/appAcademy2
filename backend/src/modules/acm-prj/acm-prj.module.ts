import { ProjectFileContentController } from './presentation/project-file-content.controller';
import { ProjectFileService } from './application/project-file.service';
import { DocAssetService } from './application/doc-asset.service';
import {
  DocAssetContentController,
  DocAssetUploadController,
} from './presentation/doc-asset.controller';
import { ObjectStoreClient } from '../acm-csl/infrastructure/external/object-store.client';
import { SharedDriveService } from './application/shared-drive.service';
import { SharedDriveController } from './presentation/shared-drive.controller';
import { Module } from '@nestjs/common';
import { AcmAuditModule } from '../acm-audit/acm-audit.module';
import { GoogleAppConfigService } from './application/google-app-config.service';
import { SystemGoogleOauthController } from './presentation/system-google-oauth.controller';
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
  imports: [AcmAuditModule],
  providers: [
    GoogleAppConfigService,
    ProjectFileService,
    DocAssetService,
    ObjectStoreClient,
    SharedDriveService,
    ProjectService,
    IssueService,
    ProjectDriveService,
    DriveClient,
  ],
  controllers: [
    ProjectFileContentController,
    DocAssetContentController,
    DocAssetUploadController,
    SystemGoogleOauthController,
    SharedDriveController,
    IssueController,
    ProjectController,
    ProjectOAuthController,
  ],
})
export class AcmPrjModule {}
