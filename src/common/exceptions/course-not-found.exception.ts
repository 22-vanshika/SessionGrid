import { HttpException, HttpStatus } from '@nestjs/common';

export class CourseNotFoundException extends HttpException {
  constructor(id: string) {
    super(`Course not found: ${id}`, HttpStatus.NOT_FOUND);
  }
}
