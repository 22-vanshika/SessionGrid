import { HttpException, HttpStatus } from '@nestjs/common';

export class BookingNotFoundException extends HttpException {
  constructor(id: string) {
    super(`Booking not found: ${id}`, HttpStatus.NOT_FOUND);
  }
}
