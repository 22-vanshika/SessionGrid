import { ApiProperty } from '@nestjs/swagger';
import { OfferingStatus, Offering } from '../entities/offering.entity';
import { LocalisedOffering, LocalisedSession } from '../offerings.service';
import { Course } from '../../courses/entities/course.entity';

export class CourseInOfferingDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: '3f9e0c8d-6ce8-492f-99c9-76fb3b0c62aa' })
  teacherId: string;

  @ApiProperty({ example: 'Algebra I' })
  title: string;

  @ApiProperty({ example: 'Introduction to algebra', nullable: true })
  description: string | null;
}

export class SessionInOfferingDto {
  @ApiProperty({ example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' })
  id: string;

  @ApiProperty({ example: 'c3d4e5f6-a7b8-9012-cdef-123456789012' })
  offeringId: string;

  @ApiProperty({
    example: '2024-09-01T14:30:00+05:30',
    description: 'Local ISO 8601 with UTC offset in the requesting user\'s timezone',
  })
  startsAt: string;

  @ApiProperty({ example: '2024-09-01T15:30:00+05:30' })
  endsAt: string;

  @ApiProperty({ example: '2024-09-01T09:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-09-01T09:00:00.000Z' })
  updatedAt: Date;
}

// Used for POST /offerings — offering freshly created with no sessions loaded.
export class OfferingResponseDto {
  @ApiProperty({ example: 'c3d4e5f6-a7b8-9012-cdef-123456789012' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  courseId: string;

  @ApiProperty({ example: 20 })
  capacity: number;

  @ApiProperty({ enum: OfferingStatus, example: OfferingStatus.DRAFT })
  status: OfferingStatus;

  @ApiProperty({ example: '2024-09-01T09:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-09-01T09:00:00.000Z' })
  updatedAt: Date;

  static fromEntity(offering: Offering): OfferingResponseDto {
    const dto = new OfferingResponseDto();
    dto.id = offering.id;
    dto.courseId = offering.courseId;
    dto.capacity = offering.capacity;
    dto.status = offering.status;
    dto.createdAt = offering.createdAt;
    dto.updatedAt = offering.updatedAt;
    return dto;
  }
}

// Used for GET /offerings and GET /offerings/mine — sessions already localised.
export class OfferingWithSessionsResponseDto {
  @ApiProperty({ example: 'c3d4e5f6-a7b8-9012-cdef-123456789012' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  courseId: string;

  @ApiProperty({ example: 20 })
  capacity: number;

  @ApiProperty({ enum: OfferingStatus, example: OfferingStatus.PUBLISHED })
  status: OfferingStatus;

  @ApiProperty({ example: '2024-09-01T09:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-09-01T09:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ type: () => CourseInOfferingDto })
  course: CourseInOfferingDto;

  @ApiProperty({ type: () => [SessionInOfferingDto] })
  sessions: SessionInOfferingDto[];

  static fromLocalised(offering: LocalisedOffering): OfferingWithSessionsResponseDto {
    const dto = new OfferingWithSessionsResponseDto();
    dto.id = offering.id;
    dto.courseId = offering.courseId;
    dto.capacity = offering.capacity;
    dto.status = offering.status;
    dto.createdAt = offering.createdAt;
    dto.updatedAt = offering.updatedAt;
    dto.course = OfferingWithSessionsResponseDto.mapCourse(offering.course);
    dto.sessions = offering.sessions.map(OfferingWithSessionsResponseDto.mapSession);
    return dto;
  }

  private static mapCourse(course: Course): CourseInOfferingDto {
    return {
      id: course.id,
      teacherId: course.teacherId,
      title: course.title,
      description: course.description,
    };
  }

  private static mapSession(session: LocalisedSession): SessionInOfferingDto {
    return {
      id: session.id,
      offeringId: session.offeringId,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}
