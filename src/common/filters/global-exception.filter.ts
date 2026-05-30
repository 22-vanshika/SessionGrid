import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
}

// PostgreSQL error codes we handle explicitly so clients receive a meaningful
// HTTP response instead of a generic 500.
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_UNIQUE_VIOLATION = '23505';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = this.classify(exception, request);

    response.status(body.statusCode).json({
      ...body,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private classify(
    exception: unknown,
    request: Request,
  ): Omit<ErrorResponseBody, 'timestamp' | 'path'> {
    if (exception instanceof HttpException) {
      return this.handleHttpException(exception);
    }
    if (exception instanceof QueryFailedError) {
      return this.handleQueryFailedError(exception, request);
    }
    // Express body-parser throws a SyntaxError with status 400 when the request
    // body is not valid JSON. Surfacing this as 500 would be misleading — it is
    // always a client mistake, so we return 400 with a stable error code.
    if (exception instanceof SyntaxError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'BAD_REQUEST',
        message: 'Request body contains invalid JSON',
      };
    }
    return this.handleUnknownException(exception, request);
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

  private handleQueryFailedError(
    exception: QueryFailedError,
    request: Request,
  ): Omit<ErrorResponseBody, 'timestamp' | 'path'> {
    const pgCode = (exception as QueryFailedError & { driverError?: { code?: string } })
      .driverError?.code;

    if (pgCode === PG_FOREIGN_KEY_VIOLATION) {
      // A referenced row (e.g. the offering) was deleted between the application
      // check and the INSERT. Return 409 so the client knows to re-fetch state.
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'REFERENCED_RESOURCE_NOT_FOUND',
        message: 'A referenced resource no longer exists; please refresh and try again',
      };
    }

    if (pgCode === PG_UNIQUE_VIOLATION) {
      // The DB unique constraint fired after the application-level duplicate check
      // was passed (lost-update race). Treat it as a conflict.
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'UNIQUE_CONSTRAINT_VIOLATION',
        message: 'A record with these values already exists',
      };
    }

    // Other database errors — log full detail server-side, return generic 500.
    this.logger.error(
      `Database error on ${request.method} ${request.url}`,
      exception.stack,
    );
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
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
