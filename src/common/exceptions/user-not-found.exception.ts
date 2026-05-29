import { HttpException, HttpStatus } from '@nestjs/common';

export class UserNotFoundException extends HttpException {
  constructor(identifier: string) {
    super(`User not found: ${identifier}`, HttpStatus.NOT_FOUND);
  }
}
