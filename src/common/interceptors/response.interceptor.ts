import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
    HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { successResponse } from '../utils/response.utils';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<any> {
        const request = context.switchToHttp().getRequest();

        return next.handle().pipe(
            map((data) => {
                return {
                    ...successResponse(data),
                    path: request.originalUrl,
                };
            }),
        );
    }
}