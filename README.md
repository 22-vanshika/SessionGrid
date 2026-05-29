# SessionGrid

> A global class-offering booking system that lets teachers schedule courses across timezones and lets parents book those sessions — with database-level guarantees that no two conflicting bookings can ever both succeed.

---

## What Was Built

SessionGrid is a RESTful API built with NestJS, TypeScript, and PostgreSQL that solves two hard problems in a multi-timezone booking system: (1) every timestamp must mean the same instant regardless of where the teacher or parent is located, and (2) two parents booking the same session simultaneously must never both succeed. The system stores all times as UTC, converts them to each user's registered IANA timezone at the service layer on the way in and out, and uses pessimistic row-level locking (`SELECT ... FOR UPDATE`) inside a single database transaction to eliminate the concurrent-booking race condition entirely. Teachers create courses and offerings, add sessions with local times, and publish offerings. Parents browse published offerings and book them; the system rejects any booking whose sessions overlap with the parent's existing schedule.

---

## Local Setup

1. Copy and configure environment variables:
   ```bash
   cp .env.example .env
   # Defaults in .env.example work as-is for local development
   ```

2. Start PostgreSQL and run migrations:
   ```bash
   docker-compose up -d
   npm install
   npm run migration:run
   ```

3. Start the development server:
   ```bash
   npm run start:dev
   ```

The API is available at `http://localhost:3000` (or the port set in `APP_PORT`).

---

## API Reference

All protected routes require three headers that simulate authentication (see Design Decisions — Auth):

| Header | Value |
|--------|-------|
| `x-user-id` | UUID of the authenticated user |
| `x-user-role` | `teacher` or `parent` |
| `x-user-timezone` | IANA timezone string, e.g. `Asia/Kolkata` |

### Routes

| Method | Path | Auth | Description | Example request body |
|--------|------|------|-------------|----------------------|
| `POST` | `/users/register` | None | Register a new user | `{"email":"alice@example.com","firstName":"Alice","lastName":"Smith","password":"secret123","role":"teacher","timezone":"Asia/Kolkata"}` |
| `POST` | `/users/login` | None | Validate credentials; returns user object | `{"email":"alice@example.com","password":"secret123"}` |
| `POST` | `/courses` | Teacher | Create a course owned by the caller | `{"title":"Algebra I","description":"Intro algebra"}` |
| `GET` | `/courses/mine` | Teacher | List the caller's courses | — |
| `POST` | `/offerings` | Teacher | Create an offering under one of the caller's courses | `{"courseId":"<uuid>","capacity":20,"status":"published"}` |
| `GET` | `/offerings` | Any role | List all published offerings; session times in caller's timezone | — |
| `GET` | `/offerings/mine` | Teacher | List the caller's own offerings; session times in teacher's timezone | — |
| `POST` | `/offerings/:offeringId/sessions` | Teacher | Add a session to an offering (times in teacher's registered timezone) | `{"startsAt":"2024-09-01T09:00:00","endsAt":"2024-09-01T10:00:00"}` |
| `POST` | `/bookings` | Parent | Book a published offering | `{"offeringId":"<uuid>"}` |
| `GET` | `/bookings/mine` | Parent | List the caller's bookings; session times in parent's timezone | — |
| `PATCH` | `/bookings/:id/cancel` | Parent | Cancel a booking (idempotent — safe to call on an already-cancelled booking) | — |

### Response envelope

Every successful response returns the resource directly. Every error response has the shape:

```json
{
  "statusCode": 409,
  "error": "BOOKING_CONFLICT",
  "message": "One or more sessions in this offering overlap with an existing booking in the parent's schedule",
  "timestamp": "2024-09-01T09:00:00.000Z",
  "path": "/bookings"
}
```

The `error` field is always an `UPPER_SNAKE_CASE` machine-readable code derived from the exception class name (e.g. `BookingConflictException` → `BOOKING_CONFLICT`). Validation failures use `VALIDATION_ERROR` with `message` as an array of field-level strings.

---

## Design Decisions

### UTC storage and service-layer timezone conversion

All timestamps are stored as `TIMESTAMPTZ` (UTC) in PostgreSQL. A UTC timestamp has exactly one meaning regardless of where the server or client runs, which eliminates the class of bugs where a timestamp is stored in one timezone and read back as another.

Timezone conversion happens exclusively in the service layer, in one direction only:

- **Inbound (local → UTC):** `toUTC(localIso, ianaTimezone)` is called in the service immediately before passing data to the repository. The teacher's IANA timezone is read from their profile — it is never accepted in the request body — so the API cannot be tricked into interpreting a time in the wrong zone.
- **Outbound (UTC → local):** `toLocalISO(utcDate, ianaTimezone)` is called in the service immediately before returning data to the controller, converting UTC dates to the requesting user's local ISO 8601 string with offset (e.g. `2024-09-01T14:30:00+05:30`).

All conversion logic lives in exactly one file: `src/common/utils/timezone.util.ts`. Any future change to how the system handles timezones is made in one place, and the 19 unit tests for that file give immediate regression coverage.

### Pessimistic locking and the concurrent-booking race condition

Without locking, two simultaneous booking requests for the same parent can both pass the conflict check before either commits:

```
Transaction A reads:  no conflict → plans to insert
Transaction B reads:  no conflict → plans to insert   ← reads stale data
Transaction A commits its booking
Transaction B commits its booking   ← race condition: both succeed
```

A unique constraint prevents duplicate rows but cannot prevent time-overlap conflicts between different offerings. Application-level locking (e.g. in-memory mutexes) fails across multiple server processes.

The solution is **pessimistic locking**: at the start of every booking transaction, `BookingsRepository.lockParentBookings()` issues a `SELECT ... FOR UPDATE` on all of the parent's confirmed booking rows. This acquires an exclusive row-level lock. Any concurrent transaction that tries to read or write those rows blocks until the first transaction commits. The sequence with locking is:

```
Transaction A: SELECT ... FOR UPDATE  → acquires lock
Transaction B: SELECT ... FOR UPDATE  → BLOCKS (waits for A)
Transaction A: conflict check → none → INSERT booking → COMMIT → releases lock
Transaction B: unblocks → reads A's committed booking → conflict check → CONFLICT → ROLLBACK
```

The lock, conflict check, and insert all execute inside a single `dataSource.transaction()` call in `BookingsService.executeBookingTransaction()`. They are never split across separate transactions.

### Time-overlap conflict detection

Two time intervals overlap if and only if:

```
A.startsAt < B.endsAt  AND  A.endsAt > B.startsAt
```

This is the standard interval-overlap predicate. The strict inequalities mean sessions that share only an endpoint — back-to-back sessions like 09:00–10:00 and 10:00–11:00 — are **not** considered overlapping. A child can immediately attend a second class after the first ends.

`BookingsRepository.findConflictingSessions()` builds a dynamic query that joins from the parent's confirmed bookings through their associated sessions, then applies one `OR` clause per incoming session range. It uses `.distinct(true)` to return each conflicting session at most once even when it is reachable through multiple bookings. The method must run inside the same transaction as `lockParentBookings` so that it reads locked, up-to-date rows — not a snapshot from before the lock was acquired.

### Mock auth guard and production JWT replacement

The current authentication layer is `MockAuthGuard` in `src/common/guards/mock-auth.guard.ts`, which reads three HTTP headers (`x-user-id`, `x-user-role`, `x-user-timezone`) and attaches an `AuthenticatedUser` object to the request. This keeps the auth concern out of scope so the booking, conflict-detection, and timezone logic can be evaluated independently.

To replace it with JWT in production, only one file changes: `MockAuthGuard` is replaced with a `JwtAuthGuard` that:

1. Extracts the `Authorization: Bearer <token>` header
2. Verifies the signature using `AppConfig.jwtSecret`
3. Decodes the claims (`sub` → user ID, `role`)
4. Calls `UsersService.findById(sub)` to retrieve the user's timezone from the database
5. Attaches the same `AuthenticatedUser` shape to `request.user`

Every controller uses `@CurrentUser()` to read from `request.user`, which is guard-agnostic. No controller, service, DTO, or other file needs to change when the guard is swapped.

---

## Assumptions

1. **One booking per parent per offering.** A parent can hold at most one confirmed booking for any given offering. This is enforced at the application level (the duplicate check inside the locked transaction) and at the database level (a unique constraint on `(offering_id, parent_id)` in the `bookings` table).

2. **Session overlap is the only booking constraint enforced.** The `capacity` field on an offering is stored and returned in responses but is not checked during booking. If capacity enforcement is required in the future, a count query on confirmed bookings for that offering would be added inside the booking transaction.

3. **Session times are always in the teacher's registered timezone.** The teacher's IANA timezone is read from their user profile at request time. There is no per-request timezone override. A teacher who travels to a different timezone must update their profile timezone to have times interpreted correctly.

4. **Back-to-back sessions are never treated as conflicting.** If session A ends at exactly the same instant session B starts, the overlap predicate evaluates to false and both bookings are allowed. This matches the natural expectation that a child can attend consecutive classes.

5. **Offering status is set by the teacher explicitly.** There is no automatic promotion from `draft` to `published`. A teacher passes `"status": "published"` when creating an offering or must update it separately. Only published offerings can be booked; attempting to book a `draft` or `cancelled` offering returns 422 `OFFERING_NOT_PUBLISHED`.

6. **`PATCH /bookings/:id/cancel` is idempotent.** Cancelling an already-cancelled booking returns 200 with no error. This makes client-side retry logic safe.

7. **Sessions can be added to an offering regardless of its status.** There is no restriction on adding sessions to a published, draft, or cancelled offering. This allows teachers to schedule sessions ahead of publishing.

8. **Bookings belong to the parent user, not to a child entity.** The system does not model children as first-class entities. A parent user represents one account; all bookings are associated with that account directly.

---

## Test Coverage

### Unit tests — 28 passing (`npm test`)

| File | Count | What is proved |
|------|------:|----------------|
| `common/utils/timezone.util.spec.ts` | 19 | `toUTC` and `toLocalISO` correctness across `Asia/Kolkata`, `America/New_York`, `Europe/London`, `Pacific/Auckland`; cross-date-boundary cases; round-trip consistency; back-to-back boundary edge case |
| `bookings/bookings.service.spec.ts` | 7 | `bookOffering` throws `NotAParentException` for non-parents; propagates `OfferingNotFoundException`; throws `OfferingNotPublishedException` for draft; throws `BookingAlreadyExistsException` on duplicate; throws `BookingConflictException` when overlap detected; saves and returns booking on happy path; `lockParentBookings` is always called before `findConflictingSessions` |
| `bookings/bookings.service.concurrency.spec.ts` | 2 | Serialised transaction simulation: exactly one of two simultaneous overlapping bookings succeeds and the other throws `BookingConflictException`; only one booking row is committed to the in-memory store |

### Integration tests — 5 passing (`npm run test:e2e`)

All tests run against the real PostgreSQL Docker instance with no mocking.

| Test | What is proved |
|------|----------------|
| Happy path + timezone | Full flow (register teacher → course → offering → session → register parent → book → `GET /bookings/mine`) returns sessions with correct UTC offset for the parent's timezone (`+05:30` for `Asia/Kolkata`) |
| Duplicate booking | A second `POST /bookings` for the same offering returns 409 `BOOKING_ALREADY_EXISTS` |
| Overlap conflict | Booking an offering whose sessions overlap an existing booking returns 409 `BOOKING_CONFLICT` |
| Back-to-back boundary | Two offerings with adjacent (non-overlapping) sessions both return 201 — confirming the strict-inequality predicate is correct |
| Concurrency proof | `Promise.all` fires two overlapping booking requests simultaneously against the real database; `SELECT ... FOR UPDATE` serialises them; result is exactly one 201 and one 409 `BOOKING_CONFLICT` — proving the locking strategy eliminates the race condition |
