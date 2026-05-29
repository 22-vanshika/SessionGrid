import { HttpException, HttpStatus } from '@nestjs/common';

export class ForbiddenBookingAccessException extends HttpException {
  constructor() {
    super('This booking does not belong to the authenticated parent', HttpStatus.FORBIDDEN);
  }
}
