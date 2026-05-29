import { HttpException, HttpStatus } from '@nestjs/common';

export class EmailAlreadyTakenException extends HttpException {
  constructor(email: string) {
    super(`Email is already registered: ${email}`, HttpStatus.CONFLICT);
  }
}
