import { Course } from '../entities/course.entity';

export class CourseResponseDto {
  id: string;
  teacherId: string;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(course: Course): CourseResponseDto {
    const dto = new CourseResponseDto();
    dto.id = course.id;
    dto.teacherId = course.teacherId;
    dto.title = course.title;
    dto.description = course.description;
    dto.createdAt = course.createdAt;
    dto.updatedAt = course.updatedAt;
    return dto;
  }
}
