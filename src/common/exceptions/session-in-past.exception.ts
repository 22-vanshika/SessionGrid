import { HttpException, HttpStatus } from '@nestjs/common';

export class SessionInPastException extends HttpException {
  constructor() {
    super(
      'Session start time cannot be more than 2 years in the past',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
