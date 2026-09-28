import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { from, lastValueFrom } from 'rxjs';
import { VideoConfigService } from '../application/video-config.service';
@Injectable()
export class BodaPolicyInterceptor implements NestInterceptor {
  constructor(private readonly video: VideoConfigService) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: { entId: string }; url: string }>();
    const entId = request.user?.entId;
    if (!entId) throw new ForbiddenException();
    return from(
      this.video.withLock(entId, async () => {
        await this.video.assertBoda(entId);
        const result: unknown = await lastValueFrom(next.handle());
        if (request.url.includes('/launch-context'))
          await this.video.reserveLaunch(entId);
        return result;
      }),
    );
  }
}
