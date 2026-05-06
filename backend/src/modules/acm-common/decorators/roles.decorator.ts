import { SetMetadata } from '@nestjs/common';
import type { AcmRole } from '../decorators/current-user.decorator';

export const ACM_ROLES_KEY = 'acm_roles';

/**
 * Restrict a route to specific ACM roles. Use together with RolesGuard.
 * @example @Roles('ADMIN')
 */
export const Roles = (...roles: AcmRole[]) => SetMetadata(ACM_ROLES_KEY, roles);
