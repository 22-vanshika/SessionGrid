import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidDateTimeException extends HttpException {
  constructor(message = 'Provided datetime string is invalid or contains an invalid calendar date') {
    super(message, HttpStatus.BAD_REQUEST);
  }
}
