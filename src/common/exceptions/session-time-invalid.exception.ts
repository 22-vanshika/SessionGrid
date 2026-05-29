import { HttpException, HttpStatus } from '@nestjs/common';

export class SessionTimeInvalidException extends HttpException {
  constructor() {
    super('Session end time must be strictly after start time', HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
