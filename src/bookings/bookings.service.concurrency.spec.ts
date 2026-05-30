/**
 * Concurrency simulation for BookingsService.bookOffering.
 *
 * Goal: prove that the pessimistic-lock strategy is correct.
 *
 * Real PostgreSQL behavior (Section 5 of PROJECT_STANDARDS.md):
 *   1. Transaction A acquires SELECT … FOR UPDATE on the parent's existing bookings.
 *   2. Transaction B attempts the same lock and *blocks* until A commits.
 *   3. After A commits its new booking, B unblocks and sees A's row in the locked set.
 *   4. B's conflict check now detects the overlap → BookingConflictException.
 *
 * This unit-level simulation replaces the real DB lock with a promise-chain
 * that serialises the two transactions.  The second callback runs only after
 * the first has fully committed its booking to the shared in-memory store,
 * so its conflict check sees the first booking — exactly as a real DB lock
 * would guarantee.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, EntityManager, DeepPartial } from 'typeorm';
import { BookingsService } from './bookings.service';
import { BookingsRepository } from './bookings.repository';
import { UsersService } from '../users/users.service';
import { OfferingsService } from '../offerings/offerings.service';
import { User, UserRole } from '../users/entities/user.entity';
import { Offering, OfferingStatus } from '../offerings/entities/offering.entity';
import { Session } from '../sessions/entities/session.entity';
import { Booking, BookingStatus } from './entities/booking.entity';
import { BookingConflictException } from '../common/exceptions/booking-conflict.exception';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const PARENT_ID = 'parent-uuid-concurrency';
const OFFERING_A_ID = 'offering-a-uuid';
const OFFERING_B_ID = 'offering-b-uuid';

const parentUser: User = {
  id: PARENT_ID,
  email: 'concurrent.parent@test.com',
  passwordHash: 'hash',
  firstName: 'Concurrent',
  lastName: 'Parent',
  role: UserRole.PARENT,
  timezone: 'UTC',
  createdAt: new Date(),
  updatedAt: new Date(),
  courses: [],
  bookings: [],
};

// Offering A: 09:00–10:00 UTC
const sessionA: Session = {
  id: 'session-a-uuid',
  offeringId: OFFERING_A_ID,
  startsAt: new Date('2024-09-01T09:00:00.000Z'),
  endsAt: new Date('2024-09-01T10:00:00.000Z'),
  createdAt: new Date(),
  updatedAt: new Date(),
  offering: {} as Offering,
};

// Offering B: 09:30–10:30 UTC — overlaps with offering A by 30 minutes
const sessionB: Session = {
  id: 'session-b-uuid',
  offeringId: OFFERING_B_ID,
  startsAt: new Date('2024-09-01T09:30:00.000Z'),
  endsAt: new Date('2024-09-01T10:30:00.000Z'),
  createdAt: new Date(),
  updatedAt: new Date(),
  offering: {} as Offering,
};

const offeringA: Offering = {
  id: OFFERING_A_ID,
  courseId: 'course-uuid',
  capacity: 10,
  status: OfferingStatus.PUBLISHED,
  sessions: [sessionA],
  course: {} as never,
  bookings: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const offeringB: Offering = {
  id: OFFERING_B_ID,
  courseId: 'course-uuid',
  capacity: 10,
  status: OfferingStatus.PUBLISHED,
  sessions: [sessionB],
  course: {} as never,
  bookings: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('BookingsService — concurrency simulation', () => {
  let service: BookingsService;
  let committedBookings: Booking[];
  // Maps offeringId → sessions so the conflict-check mock can look up
  // which sessions belong to each already-booked offering.
  let offeringSessions: Map<string, Session[]>;

  beforeEach(async () => {
    committedBookings = [];
    offeringSessions = new Map([
      [OFFERING_A_ID, [sessionA]],
      [OFFERING_B_ID, [sessionB]],
    ]);

    // -----------------------------------------------------------------------
    // Repository mocks that read/write the shared in-memory committedBookings.
    // -----------------------------------------------------------------------

    const mockBookingsRepo = {
      lockOffering: jest.fn().mockResolvedValue(undefined),
      // Returns every committed booking belonging to the parent — simulates the
      // rows that would be locked by SELECT … FOR UPDATE.
      lockParentBookings: jest.fn().mockImplementation(() => {
        return Promise.resolve(
          committedBookings.filter(
            (b) =>
              b.parentId === PARENT_ID &&
              b.status === BookingStatus.CONFIRMED,
          ),
        );
      }),

      // Runs the same overlap predicate as the real SQL query against the
      // sessions associated with the parent's already-committed bookings.
      findConflictingSessions: jest.fn().mockImplementation(
        (
          _parentId: string,
          newRanges: ReadonlyArray<{ startsAt: Date; endsAt: Date }>,
        ) => {
          const existingSessions = committedBookings.flatMap((b) =>
            offeringSessions.get(b.offeringId) ?? [],
          );

          const conflicting = existingSessions.filter((existing) =>
            newRanges.some(
              ({ startsAt, endsAt }) =>
                // Strict-inequality overlap predicate (back-to-back is NOT a conflict).
                existing.startsAt < endsAt && existing.endsAt > startsAt,
            ),
          );

          return Promise.resolve(conflicting);
        },
      ),

      // Returns 0 so the capacity guard never fires during concurrency tests
      // (capacity is 10 on both offerings; we are testing conflict detection, not capacity).
      countConfirmedByOfferingId: jest.fn().mockResolvedValue(0),

      // Commits the booking to the shared store — equivalent to a DB INSERT
      // that becomes visible to subsequent transactions after commit.
      save: jest
        .fn()
        .mockImplementation((bookingData: DeepPartial<Booking>) => {
          const persisted: Booking = {
            id: `booking-${bookingData.offeringId as string}`,
            offeringId: bookingData.offeringId as string,
            parentId: bookingData.parentId as string,
            status: BookingStatus.CONFIRMED,
            createdAt: new Date(),
            updatedAt: new Date(),
            offering: {} as never,
            parent: {} as never,
          };
          committedBookings.push(persisted);
          return Promise.resolve(persisted);
        }),
    };

    // -----------------------------------------------------------------------
    // DataSource mock — serialises transactions.
    //
    // When two bookOffering calls run under Promise.all, both resolve their
    // pre-transaction steps (role check, offering lookup) concurrently as
    // microtasks.  Then both call dataSource.transaction().
    //
    // The first call chains immediately onto a resolved promise (transactionQueue
    // = Promise.resolve()), so its callback starts right away.
    //
    // The second call chains onto the first call's result promise.  Its callback
    // will not start until the first transaction fully resolves — including the
    // committedBookings.push() in the save mock.
    //
    // This mirrors exactly what SELECT … FOR UPDATE guarantees in PostgreSQL:
    // transaction B cannot read the locked rows until transaction A commits.
    // -----------------------------------------------------------------------

    let transactionQueue: Promise<unknown> = Promise.resolve();

    const mockDataSource = {
      transaction: jest
        .fn()
        .mockImplementation((cb: (em: EntityManager) => Promise<unknown>) => {
          const txResult = transactionQueue.then(() =>
            cb({} as EntityManager),
          );
          // Advance the queue regardless of whether this transaction succeeds
          // or throws — the next transaction must still be able to start.
          transactionQueue = txResult.then(
            () => undefined,
            () => undefined,
          );
          return txResult;
        }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: BookingsRepository, useValue: mockBookingsRepo },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn().mockResolvedValue(parentUser),
          },
        },
        {
          provide: OfferingsService,
          useValue: {
            findByIdWithSessions: jest
              .fn()
              .mockImplementation((id: string) =>
                Promise.resolve(
                  id === OFFERING_A_ID ? offeringA : offeringB,
                ),
              ),
          },
        },
        {
          provide: DataSource,
          useValue: mockDataSource as unknown as DataSource,
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  it('exactly one booking succeeds and exactly one throws BookingConflictException', async () => {
    // Fire both concurrent booking attempts simultaneously.
    const results = await Promise.allSettled([
      service.bookOffering(PARENT_ID, OFFERING_A_ID),
      service.bookOffering(PARENT_ID, OFFERING_B_ID),
    ]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    // Exactly one request wins.
    expect(successes).toHaveLength(1);

    // The other request is rejected with a time-overlap conflict, not a generic
    // error — confirming the lock strategy is working correctly.
    expect(failures).toHaveLength(1);
    expect(
      (failures[0] as PromiseRejectedResult).reason,
    ).toBeInstanceOf(BookingConflictException);
  });

  it('the winning booking is persisted exactly once in the store', async () => {
    await Promise.allSettled([
      service.bookOffering(PARENT_ID, OFFERING_A_ID),
      service.bookOffering(PARENT_ID, OFFERING_B_ID),
    ]);

    // Only one booking should have been committed — the second transaction
    // should have thrown before reaching save().
    expect(committedBookings).toHaveLength(1);
  });
});
