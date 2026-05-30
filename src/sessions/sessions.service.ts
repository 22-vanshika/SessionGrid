import { Injectable } from '@nestjs/common';
import { toUTC, toLocalISO } from '../common/utils/timezone.util';
import { SessionsRepository } from './sessions.repository';
import { OfferingsService } from '../offerings/offerings.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';
import { DuplicateSessionException } from '../common/exceptions/duplicate-session.exception';
import { NotATeacherException } from '../common/exceptions/not-a-teacher.exception';
import { OfferingAccessForbiddenException } from '../common/exceptions/offering-access-forbidden.exception';
import { SessionInPastException } from '../common/exceptions/session-in-past.exception';
import { SessionTimeInvalidException } from '../common/exceptions/session-time-invalid.exception';

export interface LocalisedSessionResult {
  id: string;
  offeringId: string;
  startsAt: string;
  endsAt: string;
  createdAt: Date;
  updatedAt: Date;
}

// Sessions more than two years old are considered stale input. This threshold
// allows historical sessions (e.g. 2024 dates still valid through 2026) while
// preventing obviously erroneous entries like year-2000 timestamps.
const SESSION_MAX_PAST_YEARS = 2;

@Injectable()
export class SessionsService {
  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly offeringsService: OfferingsService,
    private readonly usersService: UsersService,
  ) {}

  // teacherTimezone is read from the x-user-timezone header by the controller
  // and passed here. Local times are interpreted in that timezone before UTC storage.
  // The teacher's role is verified against the database, not the header, to match
  // the pattern used by CoursesService and OfferingsService.
  async addToOffering(
    offeringId: string,
    teacherId: string,
    teacherTimezone: string,
    localStartsAt: string,
    localEndsAt: string,
  ): Promise<LocalisedSessionResult> {
    const teacher = await this.usersService.findById(teacherId);
    if (teacher.role !== UserRole.TEACHER) {
      throw new NotATeacherException();
    }
    const offering = await this.offeringsService.findByIdWithSessions(offeringId);
    // Verify the teacher owns the course that this offering belongs to.
    if (offering.course.teacherId !== teacherId) {
      throw new OfferingAccessForbiddenException(offeringId);
    }

    const startsAt = toUTC(localStartsAt, teacherTimezone);
    const endsAt = toUTC(localEndsAt, teacherTimezone);

    // The DB enforces this via CHK_sessions_ends_after_starts, but catching it
    // here provides a meaningful error message before hitting the constraint.
    if (endsAt <= startsAt) {
      throw new SessionTimeInvalidException();
    }

    const pastCutoff = new Date();
    pastCutoff.setFullYear(pastCutoff.getFullYear() - SESSION_MAX_PAST_YEARS);
    if (startsAt < pastCutoff) {
      throw new SessionInPastException();
    }

    // Prevent duplicate sessions — same UTC start and end already exist on this offering.
    const isDuplicate = offering.sessions.some(
      (s) =>
        s.startsAt.getTime() === startsAt.getTime() &&
        s.endsAt.getTime() === endsAt.getTime(),
    );
    if (isDuplicate) {
      throw new DuplicateSessionException();
    }

    const saved = await this.sessionsRepository.saveBulk([{ offeringId, startsAt, endsAt }]);
    const session = saved[0]!;
    return {
      id: session.id,
      offeringId: session.offeringId,
      startsAt: toLocalISO(session.startsAt, teacherTimezone),
      endsAt: toLocalISO(session.endsAt, teacherTimezone),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}
