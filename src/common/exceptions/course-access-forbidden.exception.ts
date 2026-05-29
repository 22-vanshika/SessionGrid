import { HttpException, HttpStatus } from '@nestjs/common';

export class CourseAccessForbiddenException extends HttpException {
  constructor(courseId: string) {
    super(
      `Course ${courseId} does not belong to the authenticated teacher`,
      HttpStatus.FORBIDDEN,
    );
  }
}
