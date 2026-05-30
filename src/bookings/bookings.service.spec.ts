import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import { BookingsService } from './bookings.service';
import { BookingsRepository } from './bookings.repository';
import { UsersService } from '../users/users.service';
import { OfferingsService } from '../offerings/offerings.service';
import { User, UserRole } from '../users/entities/user.entity';
import { Offering, OfferingStatus } from '../offerings/entities/offering.entity';
import { Session } from '../sessions/entities/session.entity';
import { Booking, BookingStatus } from './entities/booking.entity';
import { BookingConflictException } from '../common/exceptions/booking-conflict.exception';
import { BookingAlreadyExistsException } from '../common/exceptions/booking-already-exists.exception';
import { BookingNotFoundException } from '../common/exceptions/booking-not-found.exception';
import { ForbiddenBookingAccessException } from '../common/exceptions/forbidden-booking-access.exception';
import { OfferingNotFoundException } from '../common/exceptions/offering-not-found.exception';
import { OfferingNotPublishedException } from '../common/exceptions/offering-not-published.exception';
import { OfferingFullException } from '../common/exceptions/offering-full.exception';
import { NotAParentException } from '../common/exceptions/not-a-parent.exception';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PARENT_ID = 'parent-uuid-1';
const OFFERING_ID = 'offering-uuid-1';
const BOOKING_ID = 'booking-uuid-1';

const mockParentUser: User = {
  id: PARENT_ID,
  email: 'parent@test.com',
  passwordHash: 'hash',
  firstName: 'Jane',
  lastName: 'Doe',
  role: UserRole.PARENT,
  timezone: 'UTC',
  createdAt: new Date(),
  updatedAt: new Date(),
  courses: [],
  bookings: [],
};

const mockSession: Session = {
  id: 'session-uuid-1',
  offeringId: OFFERING_ID,
  startsAt: new Date('2024-09-01T09:00:00.000Z'),
  endsAt: new Date('2024-09-01T10:00:00.000Z'),
  createdAt: new Date(),
  updatedAt: new Date(),
  offering: {} as Offering,
};

const mockPublishedOffering: Offering = {
  id: OFFERING_ID,
  courseId: 'course-uuid-1',
  capacity: 10,
  status: OfferingStatus.PUBLISHED,
  sessions: [mockSession],
  course: {} as never,
  bookings: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDraftOffering: Offering = {
  ...mockPublishedOffering,
  status: OfferingStatus.DRAFT,
};

const savedBooking: Booking = {
  id: BOOKING_ID,
  offeringId: OFFERING_ID,
  parentId: PARENT_ID,
  status: BookingStatus.CONFIRMED,
  createdAt: new Date(),
  updatedAt: new Date(),
  offering: {} as never,
  parent: {} as never,
};

// ---------------------------------------------------------------------------
// Mock-type helpers
// ---------------------------------------------------------------------------

type MockBookingsRepository = jest.Mocked<
  Pick<
    BookingsRepository,
    | 'lockParentBookings'
    | 'findConflictingSessions'
    | 'countConfirmedByOfferingId'
    | 'save'
    | 'findById'
    | 'deleteById'
    | 'findByParentId'
    | 'updateStatus'
    | 'lockOffering'
  >
>;

const buildMockBookingsRepository = (): MockBookingsRepository => ({
  lockParentBookings: jest.fn(),
  findConflictingSessions: jest.fn(),
  countConfirmedByOfferingId: jest.fn(),
  save: jest.fn(),
  findById: jest.fn(),
  deleteById: jest.fn(),
  findByParentId: jest.fn(),
  updateStatus: jest.fn(),
  lockOffering: jest.fn(),
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('BookingsService.bookOffering', () => {
  let service: BookingsService;
  let mockBookingsRepo: MockBookingsRepository;
  let mockManager: EntityManager;
  let mockDataSource: { transaction: jest.Mock };

  // Keep dependency mocks at describe-scope so individual tests can override
  // them without accessing private service properties.
  let mockUsersService: { findById: jest.Mock };
  let mockOfferingsService: { findByIdWithSessions: jest.Mock };

  beforeEach(async () => {
    mockBookingsRepo = buildMockBookingsRepository();
    mockManager = {} as EntityManager;

    // Set happy-path defaults; individual tests reset these as needed.
    mockUsersService = {
      findById: jest.fn().mockResolvedValue(mockParentUser),
    };
    mockOfferingsService = {
      findByIdWithSessions: jest.fn().mockResolvedValue(mockPublishedOffering),
    };

    // The transaction mock executes the callback immediately with a stub manager,
    // allowing all in-transaction logic to run without a real database.
    mockDataSource = {
      transaction: jest.fn().mockImplementation(
        (cb: (em: EntityManager) => Promise<unknown>) => cb(mockManager),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: BookingsRepository, useValue: mockBookingsRepo },
        { provide: UsersService, useValue: mockUsersService },
        { provide: OfferingsService, useValue: mockOfferingsService },
        {
          provide: DataSource,
          useValue: mockDataSource as unknown as DataSource,
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);

    // Repository happy-path defaults.
    mockBookingsRepo.lockOffering.mockResolvedValue(undefined);
    mockBookingsRepo.lockParentBookings.mockResolvedValue([]);
    mockBookingsRepo.findConflictingSessions.mockResolvedValue([]);
    mockBookingsRepo.countConfirmedByOfferingId.mockResolvedValue(0);
    mockBookingsRepo.save.mockResolvedValue(savedBooking);
  });

  // --------------------------------------------------------------------------
  // Role guard
  // --------------------------------------------------------------------------

  it('throws NotAParentException when the caller is a teacher, not a parent', async () => {
    mockUsersService.findById.mockResolvedValue({
      ...mockParentUser,
      role: UserRole.TEACHER,
    });

    await expect(service.bookOffering(PARENT_ID, OFFERING_ID)).rejects.toThrow(
      NotAParentException,
    );
  });

  // --------------------------------------------------------------------------
  // Offering guards
  // --------------------------------------------------------------------------

  it('propagates OfferingNotFoundException when the offering does not exist', async () => {
    mockOfferingsService.findByIdWithSessions.mockRejectedValue(
      new OfferingNotFoundException(OFFERING_ID),
    );

    await expect(service.bookOffering(PARENT_ID, OFFERING_ID)).rejects.toThrow(
      OfferingNotFoundException,
    );
  });

  it('throws OfferingNotPublishedException when offering status is DRAFT', async () => {
    mockOfferingsService.findByIdWithSessions.mockResolvedValue(
      mockDraftOffering,
    );

    await expect(service.bookOffering(PARENT_ID, OFFERING_ID)).rejects.toThrow(
      OfferingNotPublishedException,
    );
  });

  // --------------------------------------------------------------------------
  // Capacity guard
  // --------------------------------------------------------------------------

  it('throws OfferingFullException when confirmed bookings equal capacity', async () => {
    // capacity is 10 (from mockPublishedOffering); mock returns 10 confirmed bookings.
    mockBookingsRepo.countConfirmedByOfferingId.mockResolvedValue(10);

    await expect(service.bookOffering(PARENT_ID, OFFERING_ID)).rejects.toThrow(
      OfferingFullException,
    );
  });

  // --------------------------------------------------------------------------
  // Duplicate booking check (runs inside transaction, after lock)
  // --------------------------------------------------------------------------

  it('throws BookingAlreadyExistsException when the parent already has a booking for this offering', async () => {
    // lockParentBookings returns a row for the same offeringId — the service
    // interprets this as "already booked" and rejects before the conflict check.
    mockBookingsRepo.lockParentBookings.mockResolvedValue([savedBooking]);

    await expect(service.bookOffering(PARENT_ID, OFFERING_ID)).rejects.toThrow(
      BookingAlreadyExistsException,
    );
  });

  // --------------------------------------------------------------------------
  // Conflict detection
  // --------------------------------------------------------------------------

  it('throws BookingConflictException when findConflictingSessions returns a non-empty result', async () => {
    mockBookingsRepo.findConflictingSessions.mockResolvedValue([mockSession]);

    await expect(service.bookOffering(PARENT_ID, OFFERING_ID)).rejects.toThrow(
      BookingConflictException,
    );
  });

  // --------------------------------------------------------------------------
  // Happy path
  // --------------------------------------------------------------------------

  it('saves and returns the booking when there are no conflicts', async () => {
    const result = await service.bookOffering(PARENT_ID, OFFERING_ID);

    expect(mockBookingsRepo.save).toHaveBeenCalledWith(
      {
        offeringId: OFFERING_ID,
        parentId: PARENT_ID,
        status: BookingStatus.CONFIRMED,
      },
      mockManager,
    );
    expect(result).toBe(savedBooking);
  });

  // --------------------------------------------------------------------------
  // Lock ordering — lockParentBookings must always precede findConflictingSessions
  // --------------------------------------------------------------------------

  it('calls lockParentBookings strictly before findConflictingSessions', async () => {
    const callOrder: string[] = [];

    mockBookingsRepo.lockParentBookings.mockImplementation(() => {
      callOrder.push('lockParentBookings');
      return Promise.resolve([]);
    });
    mockBookingsRepo.findConflictingSessions.mockImplementation(() => {
      callOrder.push('findConflictingSessions');
      return Promise.resolve([]);
    });

    await service.bookOffering(PARENT_ID, OFFERING_ID);

    expect(callOrder).toHaveLength(2);
    expect(callOrder.indexOf('lockParentBookings')).toBeLessThan(
      callOrder.indexOf('findConflictingSessions'),
    );
  });
});

// ---------------------------------------------------------------------------
// cancelBooking
// ---------------------------------------------------------------------------

describe('BookingsService.cancelBooking', () => {
  let service: BookingsService;
  let mockBookingsRepo: MockBookingsRepository;

  beforeEach(async () => {
    mockBookingsRepo = buildMockBookingsRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: BookingsRepository, useValue: mockBookingsRepo },
        { provide: UsersService, useValue: { findById: jest.fn() } },
        { provide: OfferingsService, useValue: { findByIdWithSessions: jest.fn() } },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  it('throws BookingNotFoundException when the booking does not exist', async () => {
    mockBookingsRepo.findById.mockResolvedValue(null);

    await expect(service.cancelBooking(BOOKING_ID, PARENT_ID)).rejects.toThrow(
      BookingNotFoundException,
    );
  });

  it('throws ForbiddenBookingAccessException when the booking belongs to a different parent', async () => {
    mockBookingsRepo.findById.mockResolvedValue({
      ...savedBooking,
      parentId: 'other-parent-uuid',
    });

    await expect(service.cancelBooking(BOOKING_ID, PARENT_ID)).rejects.toThrow(
      ForbiddenBookingAccessException,
    );
  });

  it('calls updateStatus when the booking belongs to the authenticated parent', async () => {
    mockBookingsRepo.findById.mockResolvedValue(savedBooking);
    mockBookingsRepo.updateStatus.mockResolvedValue(undefined);

    await service.cancelBooking(BOOKING_ID, PARENT_ID);

    expect(mockBookingsRepo.updateStatus).toHaveBeenCalledWith(BOOKING_ID, BookingStatus.CANCELLED);
  });
});
