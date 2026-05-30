import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { toLocalISO } from '../common/utils/timezone.util';
import { Session } from '../sessions/entities/session.entity';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';
import { OfferingsService } from '../offerings/offerings.service';
import { Offering, OfferingStatus } from '../offerings/entities/offering.entity';
import { Booking, BookingStatus } from './entities/booking.entity';
import { BookingsRepository } from './bookings.repository';
import { BookingAlreadyExistsException } from '../common/exceptions/booking-already-exists.exception';
import { BookingConflictException } from '../common/exceptions/booking-conflict.exception';
import { BookingNotFoundException } from '../common/exceptions/booking-not-found.exception';
import { EmptyOfferingException } from '../common/exceptions/empty-offering.exception';
import { ForbiddenBookingAccessException } from '../common/exceptions/forbidden-booking-access.exception';
import { NotAParentException } from '../common/exceptions/not-a-parent.exception';
import { OfferingFullException } from '../common/exceptions/offering-full.exception';
import { OfferingNotPublishedException } from '../common/exceptions/offering-not-published.exception';

export interface LocalisedBookingSession {
  id: string;
  offeringId: string;
  startsAt: string;
  endsAt: string;
}

export interface LocalisedBooking {
  id: string;
  offeringId: string;
  parentId: string;
  status: BookingStatus;
  createdAt: Date;
  updatedAt: Date;
  offering: {
    id: string;
    courseId: string;
    capacity: number;
    status: OfferingStatus;
    sessions: LocalisedBookingSession[];
  };
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly bookingsRepository: BookingsRepository,
    private readonly usersService: UsersService,
    private readonly offeringsService: OfferingsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async bookOffering(parentId: string, offeringId: string): Promise<Booking> {
    await this.assertParentRole(parentId);
    const offering = await this.offeringsService.findByIdWithSessions(offeringId);
    this.assertOfferingIsPublished(offering);
    this.assertOfferingHasSessions(offering);
    const sessionRanges = this.extractSessionRanges(offering.sessions);
    return this.executeBookingTransaction(parentId, offeringId, sessionRanges, offering.capacity);
  }

  async findByParentId(parentId: string, parentTimezone: string): Promise<LocalisedBooking[]> {
    const bookings = await this.bookingsRepository.findByParentId(parentId);
    return bookings.map((b) => this.toLocalisedBooking(b, parentTimezone));
  }

  async cancelBooking(bookingId: string, parentId: string): Promise<void> {
    const booking = await this.bookingsRepository.findById(bookingId);
    if (!booking) {
      throw new BookingNotFoundException(bookingId);
    }
    if (booking.parentId !== parentId) {
      throw new ForbiddenBookingAccessException();
    }
    await this.bookingsRepository.updateStatus(bookingId, BookingStatus.CANCELLED);
  }

  private async assertParentRole(parentId: string): Promise<void> {
    const user = await this.usersService.findById(parentId);
    if (user.role !== UserRole.PARENT) {
      throw new NotAParentException();
    }
  }

  private assertOfferingIsPublished(offering: Offering): void {
    if (offering.status !== OfferingStatus.PUBLISHED) {
      throw new OfferingNotPublishedException(offering.id);
    }
  }

  private assertOfferingHasSessions(offering: Offering): void {
    if (offering.sessions.length === 0) {
      throw new EmptyOfferingException(offering.id);
    }
  }

  private extractSessionRanges(
    sessions: Session[],
  ): Array<{ startsAt: Date; endsAt: Date }> {
    return sessions.map((s) => ({ startsAt: s.startsAt, endsAt: s.endsAt }));
  }

  // All three operations — lock, conflict check, insert — run inside one transaction.
  // The lock (SELECT FOR UPDATE) on existing bookings prevents concurrent transactions
  // from reading or modifying the same rows until this one commits, eliminating the
  // race condition described in Section 5 of the project standards.
  private async executeBookingTransaction(
    parentId: string,
    offeringId: string,
    sessionRanges: Array<{ startsAt: Date; endsAt: Date }>,
    capacity: number,
  ): Promise<Booking> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      await this.bookingsRepository.lockOffering(offeringId, manager);

      const existingBookings = await this.bookingsRepository.lockParentBookings(
        parentId,
        manager,
      );

      if (existingBookings.some((b) => b.offeringId === offeringId)) {
        throw new BookingAlreadyExistsException(offeringId);
      }

      const confirmedCount = await this.bookingsRepository.countConfirmedByOfferingId(
        offeringId,
        manager,
      );
      if (confirmedCount >= capacity) {
        throw new OfferingFullException(offeringId);
      }

      const conflicts = await this.bookingsRepository.findConflictingSessions(
        parentId,
        sessionRanges,
        manager,
      );
      if (conflicts.length > 0) {
        throw new BookingConflictException();
      }

      return this.bookingsRepository.save(
        { offeringId, parentId, status: BookingStatus.CONFIRMED },
        manager,
      );
    });
  }

  private toLocalisedBooking(booking: Booking, timezone: string): LocalisedBooking {
    const offering = booking.offering as Offering;
    return {
      id: booking.id,
      offeringId: booking.offeringId,
      parentId: booking.parentId,
      status: booking.status,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      offering: {
        id: offering.id,
        courseId: offering.courseId,
        capacity: offering.capacity,
        status: offering.status,
        sessions: offering.sessions.map((s) => ({
          id: s.id,
          offeringId: s.offeringId,
          startsAt: toLocalISO(s.startsAt, timezone),
          endsAt: toLocalISO(s.endsAt, timezone),
        })),
      },
    };
  }
}
