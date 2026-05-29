import { HttpException, HttpStatus } from '@nestjs/common';

export class NotATeacherException extends HttpException {
  constructor() {
    super('Only users with the teacher role can perform this action', HttpStatus.FORBIDDEN);
  }
}
