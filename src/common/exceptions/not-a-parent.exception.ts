import { HttpException, HttpStatus } from '@nestjs/common';

export class NotAParentException extends HttpException {
  constructor() {
    super('Only users with the parent role can perform this action', HttpStatus.FORBIDDEN);
  }
}
