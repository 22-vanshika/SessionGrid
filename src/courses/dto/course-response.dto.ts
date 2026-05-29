import { ApiProperty } from '@nestjs/swagger';
import { Course } from '../entities/course.entity';

export class CourseResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: '3f9e0c8d-6ce8-492f-99c9-76fb3b0c62aa' })
  teacherId: string;

  @ApiProperty({ example: 'Algebra I' })
  title: string;

  @ApiProperty({ example: 'Introduction to algebra', nullable: true })
  description: string | null;

  @ApiProperty({ example: '2024-09-01T09:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-09-01T09:00:00.000Z' })
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
