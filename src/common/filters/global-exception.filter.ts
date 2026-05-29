import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body =
      exception instanceof HttpException
        ? this.handleHttpException(exception)
        : this.handleUnknownException(exception, request);

    response.status(body.statusCode).json({
      ...body,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private handleHttpException(
    exception: HttpException,
  ): Omit<ErrorResponseBody, 'timestamp' | 'path'> {
    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const errorCode = this.toErrorCode(exception.constructor.name);

    if (typeof exceptionResponse === 'string') {
      return { statusCode, error: errorCode, message: exceptionResponse };
    }

    const body = exceptionResponse as Record<string, unknown>;
    const rawMessage = body['message'];

    // ValidationPipe sends an array of field-level error strings.
    if (Array.isArray(rawMessage)) {
      return { statusCode, error: 'VALIDATION_ERROR', message: rawMessage as string[] };
    }

    return {
      statusCode,
      error: errorCode,
      message:
        typeof rawMessage === 'string'
          ? rawMessage
          : String(rawMessage ?? 'An error occurred'),
    };
  }

  private handleUnknownException(
    exception: unknown,
    request: Request,
  ): Omit<ErrorResponseBody, 'timestamp' | 'path'> {
    // Log full details server-side — never expose internals to the client.
    this.logger.error(
      `Unhandled exception on ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    };
  }

  // Converts an exception class name to an UPPER_SNAKE_CASE error code.
  // e.g. BookingConflictException → BOOKING_CONFLICT
  //      BadRequestException      → BAD_REQUEST
  //      UnauthorizedException    → UNAUTHORIZED
  private toErrorCode(exceptionClassName: string): string {
    return exceptionClassName
      .replace(/Exception$/, '')
      .replace(/([A-Z])/g, '_$1')
      .toUpperCase()
      .replace(/^_/, '');
  }
}
