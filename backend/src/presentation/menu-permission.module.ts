import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuPermissionEntity } from '../infrastructure/database/entities/menu-permission.entity';
import { ManageMenuPermissionsUseCase } from '../application/use-cases/menu-permission';
import { AdminMenuPermissionController } from './controllers/admin-menu-permission.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MenuPermissionEntity])],
  controllers: [AdminMenuPermissionController],
  providers: [ManageMenuPermissionsUseCase],
  exports: [ManageMenuPermissionsUseCase],
})
export class MenuPermissionModule {}
