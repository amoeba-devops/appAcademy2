import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../../infrastructure/database/entities/audit-log.entity';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepo: Repository<AuditLogEntity>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only audit write operations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const user = request.user;
      const ip = request.ip;
      const userAgent = request.headers?.['user-agent'];

      return next.handle().pipe(
        tap((responseData) => {
          // Fire and forget — don't block the response
          this.logAudit(user, method, request.path, responseData, ip, userAgent).catch(
            () => {
              // Silently ignore audit log failures
            },
          );
        }),
      );
    }

    return next.handle();
  }

  private async logAudit(
    user: { userId: number; academyId: number } | undefined,
    method: string,
    path: string,
    responseData: unknown,
    ip: string,
    userAgent: string,
  ): Promise<void> {
    if (!user?.academyId) return;

    const actionMap: Record<string, string> = {
      POST: 'CREATE',
      PUT: 'UPDATE',
      PATCH: 'UPDATE',
      DELETE: 'DELETE',
    };

    const entityId =
      responseData && typeof responseData === 'object' && 'data' in responseData
        ? (responseData as Record<string, unknown>).data
        : null;

    await this.auditLogRepo.save({
      acdId: user.academyId,
      adlUserId: user.userId,
      adlAction: actionMap[method] ?? method,
      adlEntityType: this.extractEntityType(path),
      adlEntityId: typeof entityId === 'number' ? entityId : 0,
      adlIp: ip,
      adlUserAgent: userAgent?.substring(0, 500),
    });
  }

  private extractEntityType(path: string): string {
    // Extract entity type from URL path: /api/students/1 → STUDENT
    const segments = path
      .replace(/^\/api\//, '')
      .split('/')
      .filter(Boolean);

    return (segments[0] ?? 'UNKNOWN')
      .toUpperCase()
      .replace(/S$/, ''); // plurals → singular
  }
}
