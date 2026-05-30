import { HttpException, HttpStatus } from '@nestjs/common';

export class OfferingFullException extends HttpException {
  constructor(offeringId: string) {
    super(
      `Offering ${offeringId} has reached its maximum capacity and cannot accept new bookings`,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
