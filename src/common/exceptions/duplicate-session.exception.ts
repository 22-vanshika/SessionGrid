import { HttpException, HttpStatus } from '@nestjs/common';

export class DuplicateSessionException extends HttpException {
  constructor() {
    super(
      'A session with these exact start and end times already exists on this offering',
      HttpStatus.CONFLICT,
    );
  }
}
