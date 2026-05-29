import { HttpException, HttpStatus } from '@nestjs/common';

export class OfferingAccessForbiddenException extends HttpException {
  constructor(offeringId: string) {
    super(
      `Offering ${offeringId} does not belong to the authenticated teacher`,
      HttpStatus.FORBIDDEN,
    );
  }
}
