import { HttpException, HttpStatus } from '@nestjs/common';

export class BookingAlreadyExistsException extends HttpException {
  constructor(offeringId: string) {
    super(
      `Parent already has a booking for offering: ${offeringId}`,
      HttpStatus.CONFLICT,
    );
  }
}
