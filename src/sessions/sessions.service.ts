import { Injectable } from '@nestjs/common';
import { toUTC } from '../common/utils/timezone.util';
import { Session } from './entities/session.entity';
import { SessionsRepository } from './sessions.repository';
import { OfferingsService } from '../offerings/offerings.service';
import { UserRole } from '../users/entities/user.entity';
import { NotATeacherException } from '../common/exceptions/not-a-teacher.exception';
import { OfferingAccessForbiddenException } from '../common/exceptions/offering-access-forbidden.exception';
import { SessionTimeInvalidException } from '../common/exceptions/session-time-invalid.exception';

@Injectable()
export class SessionsService {
  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly offeringsService: OfferingsService,
  ) {}

  // teacherTimezone is read from the authenticated teacher's profile by the controller
  // and passed here. Local times are interpreted in that timezone before UTC storage.
  async addToOffering(
    offeringId: string,
    teacherId: string,
    teacherRole: UserRole,
    teacherTimezone: string,
    localStartsAt: string,
    localEndsAt: string,
  ): Promise<Session> {
    if (teacherRole !== UserRole.TEACHER) {
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

    const saved = await this.sessionsRepository.saveBulk([{ offeringId, startsAt, endsAt }]);
    return saved[0]!;
  }
}
