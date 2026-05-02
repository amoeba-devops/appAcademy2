import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export const MENU_ROLES = ['OWNER', 'ADMIN', 'STAFF', 'READONLY'] as const;
export type MenuRole = typeof MENU_ROLES[number];

export const MENU_KEYS = [
  'dashboard',
  'consultations',
  'students',
  'teachers',
  'programs',
  'classes',
  'timetable',
  'enrollments',
  'map',
  'payments',
  'posts',
  'notifications',
  'settings',
] as const;
export type MenuKey = typeof MENU_KEYS[number];

export class MenuPermissionItemDto {
  @ApiProperty({ enum: MENU_KEYS })
  @IsString()
  @IsIn(MENU_KEYS as unknown as string[])
  menuKey: MenuKey;

  @ApiProperty({ enum: MENU_ROLES })
  @IsString()
  @IsIn(MENU_ROLES as unknown as string[])
  role: MenuRole;

  @ApiProperty()
  @IsBoolean()
  visible: boolean;

  @ApiProperty()
  @IsBoolean()
  accessible: boolean;
}

export class UpdateMenuPermissionsDto {
  @ApiProperty({ type: [MenuPermissionItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuPermissionItemDto)
  items: MenuPermissionItemDto[];
}
