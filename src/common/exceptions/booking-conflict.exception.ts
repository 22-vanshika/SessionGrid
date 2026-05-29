import { HttpException, HttpStatus } from '@nestjs/common';

// 409 signals a time-overlap conflict per Section 7.3 of the project standards.
export class BookingConflictException extends HttpException {
  constructor() {
    super(
      'One or more sessions in this offering overlap with an existing booking in the parent\'s schedule',
      HttpStatus.CONFLICT,
    );
  }
}
