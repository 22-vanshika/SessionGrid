/**
 * Integration tests — bookings end-to-end.
 *
 * Each test boots the real AppModule against the live Docker PostgreSQL instance
 * and makes genuine HTTP requests via supertest.  No services, repositories, or
 * database interactions are mocked.
 *
 * After every test all created rows are deleted in FK-safe order so each test
 * starts from a clean slate.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import * as supertest from 'supertest';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const request = supertest as any;
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

let app: INestApplication;
let dataSource: DataSource;

beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();

  // Mirror the global middleware applied in main.ts.
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();
  dataSource = app.get(DataSource);
}, 30_000);

afterAll(async () => {
  await dataSource.destroy();
  await app.close();
});

afterEach(async () => {
  // Delete in FK-safe order: children before parents.
  await dataSource.query('DELETE FROM bookings');
  await dataSource.query('DELETE FROM sessions');
  await dataSource.query('DELETE FROM offerings');
  await dataSource.query('DELETE FROM courses');
  await dataSource.query('DELETE FROM users');
});

// ---------------------------------------------------------------------------
// Request helpers — thin wrappers around supertest to avoid repetition.
// ---------------------------------------------------------------------------

interface UserHeaders {
  'x-user-id': string;
  'x-user-role': string;
  'x-user-timezone': string;
  [key: string]: string;
}

interface RegisteredUser {
  id: string;
  headers: UserHeaders;
}

async function registerUser(
  email: string,
  role: 'teacher' | 'parent',
  timezone: string,
): Promise<RegisteredUser> {
  const res = await request(app.getHttpServer())
    .post('/users/register')
    .send({
      email,
      firstName: 'Test',
      lastName: 'User',
      password: 'password123',
      role,
      timezone,
    })
    .expect(201);

  const id: string = res.body.id as string;
  return {
    id,
    headers: { 'x-user-id': id, 'x-user-role': role, 'x-user-timezone': timezone },
  };
}

async function createCourse(teacherHeaders: UserHeaders): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/courses')
    .set(teacherHeaders)
    .send({ title: 'Test Course' })
    .expect(201);
  return res.body.id as string;
}

async function createOffering(
  teacherHeaders: UserHeaders,
  courseId: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/offerings')
    .set(teacherHeaders)
    .send({ courseId, capacity: 20, status: 'published' })
    .expect(201);
  return res.body.id as string;
}

async function addSession(
  teacherHeaders: UserHeaders,
  offeringId: string,
  startsAt: string,
  endsAt: string,
): Promise<void> {
  await request(app.getHttpServer())
    .post(`/offerings/${offeringId}/sessions`)
    .set(teacherHeaders)
    .send({ startsAt, endsAt })
    .expect(201);
}

async function bookOffering(
  parentHeaders: UserHeaders,
  offeringId: string,
): Promise<supertest.Response> {
  return request(app.getHttpServer())
    .post('/bookings')
    .set(parentHeaders)
    .send({ offeringId });
}

// ---------------------------------------------------------------------------
// Test 1 — Happy path: full booking flow with timezone verification
// ---------------------------------------------------------------------------

describe('happy path', () => {
  it('creates a booking and GET /bookings/mine returns sessions in the parent timezone', async () => {
    // Teacher lives in UTC; sessions are entered in UTC local time.
    const teacher = await registerUser('teacher.tz@test.com', 'teacher', 'UTC');
    const courseId = await createCourse(teacher.headers);
    const offeringId = await createOffering(teacher.headers, courseId);

    // Session: 09:00–10:00 in UTC = 14:30–15:30 in Asia/Kolkata
    await addSession(teacher.headers, offeringId, '2024-09-01T09:00:00', '2024-09-01T10:00:00');

    // Parent lives in Asia/Kolkata (UTC+5:30)
    const parent = await registerUser('parent.tz@test.com', 'parent', 'Asia/Kolkata');
    const bookRes = await bookOffering(parent.headers, offeringId);
    expect(bookRes.status).toBe(201);

    // GET /bookings/mine — sessions must arrive in Kolkata local time
    const mineRes = await request(app.getHttpServer())
      .get('/bookings/mine')
      .set(parent.headers)
      .expect(200);

    const bookings = mineRes.body as Array<{
      offeringId: string;
      offering: { sessions: Array<{ startsAt: string; endsAt: string }> };
    }>;

    expect(bookings).toHaveLength(1);
    expect(bookings[0].offeringId).toBe(offeringId);

    const session = bookings[0].offering.sessions[0];
    // 09:00 UTC → 14:30 IST
    expect(session.startsAt).toContain('2024-09-01T14:30:00');
    expect(session.startsAt).toContain('+05:30');
    // 10:00 UTC → 15:30 IST
    expect(session.endsAt).toContain('2024-09-01T15:30:00');
    expect(session.endsAt).toContain('+05:30');
  });
});

// ---------------------------------------------------------------------------
// Test 2 — Duplicate booking: same parent books same offering twice → 409
// ---------------------------------------------------------------------------

describe('duplicate booking', () => {
  it('returns 409 BookingAlreadyExistsException on the second attempt', async () => {
    const teacher = await registerUser('teacher.dup@test.com', 'teacher', 'UTC');
    const courseId = await createCourse(teacher.headers);
    const offeringId = await createOffering(teacher.headers, courseId);
    await addSession(teacher.headers, offeringId, '2024-09-01T09:00:00', '2024-09-01T10:00:00');

    const parent = await registerUser('parent.dup@test.com', 'parent', 'UTC');

    const first = await bookOffering(parent.headers, offeringId);
    expect(first.status).toBe(201);

    const second = await bookOffering(parent.headers, offeringId);
    expect(second.status).toBe(409);
    expect((second.body as { error: string }).error).toBe('BOOKING_ALREADY_EXISTS');
  });
});

// ---------------------------------------------------------------------------
// Test 3 — Overlap conflict: booking B overlaps sessions of confirmed booking A
// ---------------------------------------------------------------------------

describe('session overlap conflict', () => {
  it('returns 409 BOOKING_CONFLICT when new offering sessions overlap an existing booking', async () => {
    const teacher = await registerUser('teacher.conflict@test.com', 'teacher', 'UTC');
    const courseId = await createCourse(teacher.headers);

    // Offering A: 09:00–10:00 UTC
    const offeringA = await createOffering(teacher.headers, courseId);
    await addSession(teacher.headers, offeringA, '2024-09-01T09:00:00', '2024-09-01T10:00:00');

    // Offering B: 09:30–10:30 UTC — 30-minute overlap with A
    const offeringB = await createOffering(teacher.headers, courseId);
    await addSession(teacher.headers, offeringB, '2024-09-01T09:30:00', '2024-09-01T10:30:00');

    const parent = await registerUser('parent.conflict@test.com', 'parent', 'UTC');

    const bookA = await bookOffering(parent.headers, offeringA);
    expect(bookA.status).toBe(201);

    const bookB = await bookOffering(parent.headers, offeringB);
    expect(bookB.status).toBe(409);
    expect((bookB.body as { error: string }).error).toBe('BOOKING_CONFLICT');
  });

  it('does NOT conflict when sessions are back-to-back (shared endpoint only)', async () => {
    const teacher = await registerUser('teacher.adjacent@test.com', 'teacher', 'UTC');
    const courseId = await createCourse(teacher.headers);

    // Offering A: 09:00–10:00 UTC
    const offeringA = await createOffering(teacher.headers, courseId);
    await addSession(teacher.headers, offeringA, '2024-09-01T09:00:00', '2024-09-01T10:00:00');

    // Offering B: 10:00–11:00 UTC — starts exactly when A ends, no overlap
    const offeringB = await createOffering(teacher.headers, courseId);
    await addSession(teacher.headers, offeringB, '2024-09-01T10:00:00', '2024-09-01T11:00:00');

    const parent = await registerUser('parent.adjacent@test.com', 'parent', 'UTC');

    const bookA = await bookOffering(parent.headers, offeringA);
    expect(bookA.status).toBe(201);

    // Back-to-back — must succeed, not be rejected as a conflict.
    const bookB = await bookOffering(parent.headers, offeringB);
    expect(bookB.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// Test 4 — Concurrency proof: two simultaneous overlapping bookings
//
// This is the mandatory deliverable from Section 5.4 of PROJECT_STANDARDS.md.
// Two booking requests for the same parent are fired simultaneously with
// Promise.all.  The SELECT … FOR UPDATE lock ensures serialisation: exactly
// one succeeds and exactly one is rejected with a conflict.
// ---------------------------------------------------------------------------

describe('concurrency — SELECT FOR UPDATE proof', () => {
  it('fires two simultaneous overlapping bookings and exactly one succeeds', async () => {
    const teacher = await registerUser('teacher.concurrent@test.com', 'teacher', 'UTC');
    const courseId = await createCourse(teacher.headers);

    // Offering A: 09:00–10:00 UTC
    const offeringA = await createOffering(teacher.headers, courseId);
    await addSession(teacher.headers, offeringA, '2024-09-01T09:00:00', '2024-09-01T10:00:00');

    // Offering B: 09:30–10:30 UTC — overlaps with A
    const offeringB = await createOffering(teacher.headers, courseId);
    await addSession(teacher.headers, offeringB, '2024-09-01T09:30:00', '2024-09-01T10:30:00');

    const parent = await registerUser('parent.concurrent@test.com', 'parent', 'UTC');

    // Fire both booking requests simultaneously.
    const [resA, resB] = await Promise.all([
      bookOffering(parent.headers, offeringA),
      bookOffering(parent.headers, offeringB),
    ]);

    const statuses = [resA.status, resB.status].sort();

    // Exactly one 201 and exactly one 409.
    expect(statuses).toEqual([201, 409]);

    // The 409 must specifically be a time-overlap conflict, not a duplicate
    // booking or any other error — proving the locking strategy is correct.
    const failedRes = resA.status === 409 ? resA : resB;
    expect((failedRes.body as { error: string }).error).toBe('BOOKING_CONFLICT');
  }, 15_000);
});

// ---------------------------------------------------------------------------
// Test 5 — Audited edge case fixes & concurrency enhancements
// ---------------------------------------------------------------------------

describe('audited edge cases and enhancements', () => {
  it('rejects whitespace-only description in course creation', async () => {
    const teacher = await registerUser('teacher.trim@test.com', 'teacher', 'UTC');
    const res = await request(app.getHttpServer())
      .post('/courses')
      .set(teacher.headers)
      .send({ title: 'Trim Course', description: '    ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('rejects all-whitespace password in user registration', async () => {
    const res = await request(app.getHttpServer())
      .post('/users/register')
      .send({
        email: 'badpw@test.com',
        firstName: 'Bad',
        lastName: 'PW',
        password: '        ', // 8 spaces
        role: 'parent',
        timezone: 'UTC',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('returns 400 Bad Request for calendar-wise invalid dates instead of 500', async () => {
    const teacher = await registerUser('teacher.invaliddate@test.com', 'teacher', 'UTC');
    const courseId = await createCourse(teacher.headers);
    const offeringId = await createOffering(teacher.headers, courseId);

    const res = await request(app.getHttpServer())
      .post(`/offerings/${offeringId}/sessions`)
      .set(teacher.headers)
      .send({ startsAt: '2024-02-30T10:00:00', endsAt: '2024-02-30T11:00:00' }); // Feb 30th is invalid!

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_DATE_TIME');
  });

  it('soft-cancels bookings and allows re-booking the same offering', async () => {
    const teacher = await registerUser('teacher.soft@test.com', 'teacher', 'UTC');
    const courseId = await createCourse(teacher.headers);
    const offeringId = await createOffering(teacher.headers, courseId);
    await addSession(teacher.headers, offeringId, '2024-09-01T09:00:00', '2024-09-01T10:00:00');

    const parent = await registerUser('parent.soft@test.com', 'parent', 'UTC');

    // 1. Create a booking.
    const bookRes = await bookOffering(parent.headers, offeringId);
    expect(bookRes.status).toBe(201);
    const bookingId = bookRes.body.id;

    // 2. Cancel the booking (idempotently).
    const cancelRes = await request(app.getHttpServer())
      .patch(`/bookings/${bookingId}/cancel`)
      .set(parent.headers);
    expect(cancelRes.status).toBe(200);

    // 3. Verify it is still listed under GET /bookings/mine but with CANCELLED status.
    const mineRes = await request(app.getHttpServer())
      .get('/bookings/mine')
      .set(parent.headers)
      .expect(200);
    expect(mineRes.body).toHaveLength(1);
    expect(mineRes.body[0].status).toBe('cancelled');

    // 4. Re-book the same offering — must succeed because the active booking was cancelled!
    const rebookRes = await bookOffering(parent.headers, offeringId);
    expect(rebookRes.status).toBe(201);
  });

  it('prevents over-booking under concurrency for offering of capacity 1', async () => {
    const teacher = await registerUser('teacher.capacitycon@test.com', 'teacher', 'UTC');
    const courseId = await createCourse(teacher.headers);
    
    // Create an offering with capacity: 1.
    const res = await request(app.getHttpServer())
      .post('/offerings')
      .set(teacher.headers)
      .send({ courseId, capacity: 1, status: 'published' })
      .expect(201);
    const offeringId = res.body.id;

    await addSession(teacher.headers, offeringId, '2024-09-01T09:00:00', '2024-09-01T10:00:00');

    const parent1 = await registerUser('parent1@test.com', 'parent', 'UTC');
    const parent2 = await registerUser('parent2@test.com', 'parent', 'UTC');

    // Fire both bookings concurrently for different parents.
    const [res1, res2] = await Promise.all([
      bookOffering(parent1.headers, offeringId),
      bookOffering(parent2.headers, offeringId),
    ]);

    const statuses = [res1.status, res2.status].sort();

    // Exactly one wins (201) and the second is rejected with 422 OFFERING_FULL.
    expect(statuses).toEqual([201, 422]);

    const failedRes = res1.status === 422 ? res1 : res2;
    expect((failedRes.body as { error: string }).error).toBe('OFFERING_FULL');
  }, 15_000);
});
