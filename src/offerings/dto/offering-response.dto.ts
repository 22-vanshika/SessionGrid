import { OfferingStatus, Offering } from '../entities/offering.entity';
import { LocalisedOffering, LocalisedSession } from '../offerings.service';
import { Course } from '../../courses/entities/course.entity';

class CourseInOfferingDto {
  id: string;
  teacherId: string;
  title: string;
  description: string | null;
}

class SessionInOfferingDto {
  id: string;
  offeringId: string;
  startsAt: string;
  endsAt: string;
  createdAt: Date;
  updatedAt: Date;
}

// Used for POST /offerings — offering is freshly created with no sessions loaded.
export class OfferingResponseDto {
  id: string;
  courseId: string;
  capacity: number;
  status: OfferingStatus;
  createdAt: Date;
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

// Used for GET /offerings and GET /offerings/mine — service has already localised session times.
export class OfferingWithSessionsResponseDto {
  id: string;
  courseId: string;
  capacity: number;
  status: OfferingStatus;
  createdAt: Date;
  updatedAt: Date;
  course: CourseInOfferingDto;
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
