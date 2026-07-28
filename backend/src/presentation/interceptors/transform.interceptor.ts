import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface TransformedResponse<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, TransformedResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<TransformedResponse<T>> {
    // REQ-260728C: @Sse 핸들러는 이벤트 스트림(MessageEvent) 을 emit 한다 —
    // 각 이벤트를 { success, data } 로 감싸면 SSE payload 형식이 깨진다.
    if (Reflect.getMetadata('__sse__', context.getHandler())) {
      return next.handle() as Observable<TransformedResponse<T>>;
    }
    return next.handle().pipe(
      map((data) => {
        // FIX-260512: pass binary/stream responses through unwrapped so Nest's
        // built-in StreamableFile / stream handling can serve raw bytes
        // (e.g. PDF/image downloads). Wrapping these in { success, data } would
        // JSON-serialize them and corrupt the payload.
        if (
          data instanceof StreamableFile ||
          Buffer.isBuffer(data) ||
          (data &&
            typeof data === 'object' &&
            typeof (data as { pipe?: unknown }).pipe === 'function')
        ) {
          return data as unknown as TransformedResponse<T>;
        }

        // If data already has success property, pass through (e.g. auth login response)
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // If data has pagination meta, separate it
        if (data && typeof data === 'object' && 'items' in data && 'meta' in data) {
          return {
            success: true,
            data: data.items,
            meta: data.meta,
          };
        }

        return {
          success: true,
          data,
        };
      }),
    );
  }
}
