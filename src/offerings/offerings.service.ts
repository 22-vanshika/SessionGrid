import { Injectable } from '@nestjs/common';
import { toLocalISO } from '../common/utils/timezone.util';
import { Course } from '../courses/entities/course.entity';
import { Session } from '../sessions/entities/session.entity';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';
import { CoursesService } from '../courses/courses.service';
import { Offering, OfferingStatus } from './entities/offering.entity';
import { OfferingsRepository } from './offerings.repository';
import { CourseAccessForbiddenException } from '../common/exceptions/course-access-forbidden.exception';
import { NotATeacherException } from '../common/exceptions/not-a-teacher.exception';
import { OfferingNotFoundException } from '../common/exceptions/offering-not-found.exception';

export interface CreateOfferingData {
  courseId: string;
  capacity: number;
  status?: OfferingStatus;
}

export interface LocalisedSession {
  id: string;
  offeringId: string;
  startsAt: string;
  endsAt: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalisedOffering {
  id: string;
  courseId: string;
  capacity: number;
  status: OfferingStatus;
  createdAt: Date;
  updatedAt: Date;
  course: Course;
  sessions: LocalisedSession[];
}

@Injectable()
export class OfferingsService {
  constructor(
    private readonly offeringsRepository: OfferingsRepository,
    private readonly usersService: UsersService,
    private readonly coursesService: CoursesService,
  ) {}

  async create(teacherId: string, data: CreateOfferingData): Promise<Offering> {
    const teacher = await this.usersService.findById(teacherId);
    if (teacher.role !== UserRole.TEACHER) {
      throw new NotATeacherException();
    }
    const course = await this.coursesService.findById(data.courseId);
    // Only the teacher who owns the course may create offerings under it.
    if (course.teacherId !== teacherId) {
      throw new CourseAccessForbiddenException(data.courseId);
    }
    return this.offeringsRepository.save({
      courseId: data.courseId,
      capacity: data.capacity,
      status: data.status ?? OfferingStatus.DRAFT,
    });
  }

  async findById(id: string): Promise<Offering> {
    const offering = await this.offeringsRepository.findById(id);
    if (!offering) {
      throw new OfferingNotFoundException(id);
    }
    return offering;
  }

  async findByIdWithSessions(id: string): Promise<Offering> {
    const offering = await this.offeringsRepository.findByIdWithSessions(id);
    if (!offering) {
      throw new OfferingNotFoundException(id);
    }
    return offering;
  }

  async findAllPublished(callerTimezone: string): Promise<LocalisedOffering[]> {
    const offerings = await this.offeringsRepository.findAllPublished();
    return offerings.map((o) => this.toLocalisedOffering(o, callerTimezone));
  }

  async findAllByTeacherId(
    teacherId: string,
    teacherTimezone: string,
  ): Promise<LocalisedOffering[]> {
    const offerings = await this.offeringsRepository.findAllByTeacherId(teacherId);
    return offerings.map((o) => this.toLocalisedOffering(o, teacherTimezone));
  }

  private toLocalisedOffering(offering: Offering, timezone: string): LocalisedOffering {
    return {
      id: offering.id,
      courseId: offering.courseId,
      capacity: offering.capacity,
      status: offering.status,
      createdAt: offering.createdAt,
      updatedAt: offering.updatedAt,
      course: offering.course as Course,
      sessions: offering.sessions.map((s) => this.toLocalisedSession(s, timezone)),
    };
  }

  private toLocalisedSession(session: Session, timezone: string): LocalisedSession {
    return {
      id: session.id,
      offeringId: session.offeringId,
      startsAt: toLocalISO(session.startsAt, timezone),
      endsAt: toLocalISO(session.endsAt, timezone),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}
