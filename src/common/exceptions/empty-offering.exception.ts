import { HttpException, HttpStatus } from '@nestjs/common';

export class EmptyOfferingException extends HttpException {
  constructor(offeringId: string) {
    super(
      `Offering ${offeringId} has no sessions and cannot be booked`,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
