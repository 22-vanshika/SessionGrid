import { HttpException, HttpStatus } from '@nestjs/common';

export class OfferingNotFoundException extends HttpException {
  constructor(id: string) {
    super(`Offering not found: ${id}`, HttpStatus.NOT_FOUND);
  }
}
