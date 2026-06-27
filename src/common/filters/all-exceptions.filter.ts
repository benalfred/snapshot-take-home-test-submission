import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { errorResponse } from '../utils/response.utils';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();

    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | object = 'Internal server error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();

      const exceptionResponse = exception.getResponse();

      message =
          typeof exceptionResponse === 'string'
              ? exceptionResponse
              : (exceptionResponse as Record<string, any>).message ??
              exceptionResponse;

      this.logger.warn(
          `${request.method} ${request.originalUrl} -> ${statusCode}`,
      );
    } else {
      const error = exception as Error;

      this.logger.error(
          error?.message ?? 'Unhandled Exception',
          error?.stack,
      );
    }

    response.status(statusCode).json(
        errorResponse(
            statusCode,
            message,
            request.originalUrl,
        ),
    );
  }
}