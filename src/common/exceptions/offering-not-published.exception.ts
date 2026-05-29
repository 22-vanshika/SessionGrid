import { HttpException, HttpStatus } from '@nestjs/common';

export class OfferingNotPublishedException extends HttpException {
  constructor(offeringId: string) {
    super(
      `Offering ${offeringId} is not published and cannot be booked`,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
