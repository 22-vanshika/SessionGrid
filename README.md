# 📅 SessionGrid

> SessionGrid is an online booking system where teachers schedule
> classes and parents book spots — and the system guarantees no two parents can ever
> accidentally get the same slot at the same time.

🚀 **Live API** → [sessiongrid-api.onrender.com](https://sessiongrid-api.onrender.com)  
📖 **Swagger UI** → [sessiongrid-api.onrender.com/api/docs](https://sessiongrid-api.onrender.com/api/docs)  
🖥 **Frontend Demo** → [session-grid-frontend.vercel.app](https://session-grid-frontend.vercel.app)

---

## 1. What Is SessionGrid?

**Think of it like booking a gym class.** The gym instructor (teacher) posts a class
schedule (offering) with specific time slots (sessions). Parents browse the schedule
and book a spot. The app handles the hard part: making sure every time shows up in the
right timezone for every person, and that two parents clicking "Book" at the exact same
millisecond can never both succeed.

The three main actors:

```
  Teacher ──creates──▶ Offering ──has──▶ Sessions
                           ▲
                           │ books
                         Parent
```

---

## 2. How It Works — The Big Picture

```
Teacher              System               Parent
  │                    │                    │
  ├─ POST /courses ───▶│ Creates course     │
  ├─ POST /offerings ─▶│ Creates offering   │
  ├─ POST /sessions ──▶│ Stores times (UTC) │
  │                    │                    │
  │                    │◀─ GET /offerings ──┤ (parent's timezone)
  │                    │                    │
  │                    │◀─ POST /bookings ──┤ Lock→Check→Save
  │                    │                    │
  │                    │◀─ GET /bookings ───┤ (parent's timezone)
```

---

## 3. Tech Stack 🔧

| Tool                | What It Does (plain English)                                               | Version |
| ------------------- | -------------------------------------------------------------------------- | ------- |
| **NestJS**          | The web framework — like a blueprint for organizing the app                | 10.x    |
| **TypeScript**      | JavaScript with safety rules — catches mistakes before the app runs        | 5.x     |
| **PostgreSQL**      | The database — like a very reliable spreadsheet that lives on a server     | 16      |
| **TypeORM**         | Lets the app talk to the database using TypeScript instead of raw SQL      | 0.3.x   |
| **Luxon**           | Handles dates and timezones — converts "9 AM in Kolkata" to universal time | 3.x     |
| **class-validator** | Checks that incoming data looks right before the app processes it          | 0.14.x  |
| **Jest**            | The testing tool — runs all automated checks                               | 29.x    |
| **Docker**          | Runs PostgreSQL in a container so you don't install it manually            | —       |

---

## 4. Project Structure 🗂️

**Restaurant analogy for every module:**

- **Controller** = the waiter — takes your order (HTTP request), brings back the food
- **Service** = the chef — does the actual cooking (business logic)
- **Repository** = the pantry — fetches ingredients from the database (SQL/ORM calls)

```
src/
├── main.ts              ← Starts the server
├── app.module.ts        ← Wires all modules together
├── config/              ← Reads .env (ONLY place for process.env)
├── common/
│   ├── decorators/      ← @CurrentUser() reads user from request
│   ├── exceptions/      ← One file per named error type
│   ├── filters/         ← Turns every error into clean JSON
│   ├── guards/          ← Checks auth headers on every request
│   └── utils/           ← timezone.util.ts (ONLY TZ conversion)
├── users/               ← Register and log in
├── courses/             ← Teacher's course subjects
├── offerings/           ← A scheduled run of a course
├── sessions/            ← Individual time slots
├── bookings/            ← Book or cancel an offering
└── database/
    ├── data-source.ts   ← TypeORM connection config
    └── migrations/      ← Versioned schema changes
```

---

## 5. Setup — Get It Running in 3 Steps 🚀

**Step 1 — Copy your config file**
```bash
cp .env.example .env
```
What just happened: Created `.env` with every setting the app needs. Defaults work as-is.
✅ Worked if: `.env` exists in the project root.

---

**Step 2 — Start the database, install packages, and build the tables**
```bash
docker-compose up -d && npm install && npm run migration:run
```
What just happened: Docker started PostgreSQL in the background. `npm install` fetched all
libraries. `migration:run` created 5 tables using versioned files (no `synchronize: true`).
✅ Worked if: `docker ps` shows a running container and terminal prints
`5 migrations executed successfully`.

---

**Step 3 — Start the API server**
```bash
npm run start:dev
```
What just happened: NestJS started in watch mode — restarts automatically on file changes.
✅ Worked if: you see `Application is running on: http://localhost:3000`.

---

## 6. Environment Variables ⚙️

Copy `.env.example` to `.env` before starting. Every variable below is required.

| Variable         | What It Does                                                               | Example Value                       |
| ---------------- | -------------------------------------------------------------------------- | ----------------------------------- |
| `NODE_ENV`       | Tells the app which environment it's in                                    | `development`                       |
| `APP_PORT`       | Which port the server listens on                                           | `3000`                              |
| `DB_HOST`        | Where PostgreSQL is running                                                | `localhost`                         |
| `DB_PORT`        | PostgreSQL's port number                                                   | `5432`                              |
| `DB_USERNAME`    | Database login name                                                        | `sessiongrid`                       |
| `DB_PASSWORD`    | Database password                                                          | `changeme`                          |
| `DB_NAME`        | Which database to use                                                      | `sessiongrid`                       |
| `JWT_SECRET`     | A secret key for signing login tokens — keep long and random in production | `replace-with-a-long-random-secret` |
| `JWT_EXPIRES_IN` | How long a login token stays valid                                         | `7d`                                |

---

## 7. API Reference 📡

Protected routes require three headers: `x-user-id` (UUID), `x-user-role`
(`teacher` or `parent`), `x-user-timezone` (e.g. `Asia/Kolkata`).

### 🎓 Teacher APIs

| Method | Route                     | What It Does                                   |
| ------ | ------------------------- | ---------------------------------------------- |
| `POST` | `/courses`                | Create a course                                |
| `GET`  | `/courses/mine`           | List your courses                              |
| `POST` | `/offerings`              | Create an offering for a course                |
| `GET`  | `/offerings/mine`         | List your offerings (times in your TZ)         |
| `POST` | `/offerings/:id/sessions` | Add a time slot (times in your TZ, stored UTC) |

```
POST /courses
  body: {"title":"Algebra I","description":"..."}
   201: {"id":"uuid","title":"Algebra I","teacherId":"uuid"}

POST /offerings
  body: {"courseId":"uuid","capacity":20,"status":"published"}
   201: {"id":"uuid","courseId":"uuid","capacity":20,"status":"..."}

POST /offerings/:id/sessions  (times in your TZ, stored as UTC)
  body: {"startsAt":"2024-09-01T09:00:00","endsAt":"2024-09-01T10:00:00"}
   201: {"id":"uuid","startsAt":"2024-09-01T09:00:00+05:30","endsAt":"..."}
```

### 👨‍👩‍👧 Parent APIs

| Method  | Route                  | What It Does                          |
| ------- | ---------------------- | ------------------------------------- |
| `POST`  | `/bookings`            | Book a published offering             |
| `GET`   | `/bookings/mine`       | List your bookings (times in your TZ) |
| `PATCH` | `/bookings/:id/cancel` | Cancel a booking (safe to call twice) |

```
POST /bookings
  body: {"offeringId":"uuid"}
   201: {"id":"uuid","offeringId":"uuid","status":"confirmed","sessions":[...]}
```

### 🌐 Public APIs

| Method | Route             | What It Does               | Who                |
| ------ | ----------------- | -------------------------- | ------------------ |
| `POST` | `/users/register` | Create an account          | Anyone             |
| `POST` | `/users/login`    | Log in, returns user       | Anyone             |
| `GET`  | `/offerings`      | Browse published offerings | Any logged-in user |

```
POST /users/register  body: {"email":"alice@example.com","firstName":"Alice",
                             "lastName":"Smith","password":"secret123",
                             "role":"teacher","timezone":"Asia/Kolkata"}

POST /users/login     body: {"email":"alice@example.com","password":"secret123"}
```

**Every error** returns: `{"statusCode":409,"error":"BOOKING_CONFLICT",
"message":"...","timestamp":"...","path":"/bookings"}`.
`error` is always `UPPER_SNAKE_CASE`; validation errors use `VALIDATION_ERROR`.

---

## 8. Database Schema 🗄️

Five tables. All time columns are `TIMESTAMPTZ` (UTC). All PKs are database-generated
UUIDs. Every table has `id`, `created_at`, `updated_at`.

```
users ──1:N──▶ courses ──1:N──▶ offerings ──1:N──▶ sessions
  │                                  ▲
  └──(parent)── bookings ────N:1─────┘
```

**`users`** — like a school directory, one row per person

| Column                    | Type           | What It Stores                    |
| ------------------------- | -------------- | --------------------------------- |
| `email`                   | varchar unique | Login email                       |
| `password_hash`           | varchar        | scrypt-encrypted password         |
| `first_name`, `last_name` | varchar        | Person's name                     |
| `role`                    | enum           | `teacher` or `parent`             |
| `timezone`                | varchar        | IANA timezone e.g. `Asia/Kolkata` |

**`courses`** — like a class catalog entry (one teacher, many courses)

| Column        | Type            | What It Stores   |
| ------------- | --------------- | ---------------- |
| `teacher_id`  | UUID FK → users | Owner (indexed)  |
| `title`       | varchar         | Course name      |
| `description` | text nullable   | Optional details |

**`offerings`** — like one semester of a course (only `published` can be booked)

| Column      | Type              | What It Stores                                 |
| ----------- | ----------------- | ---------------------------------------------- |
| `course_id` | UUID FK → courses | Which course (indexed)                         |
| `capacity`  | integer           | Max spots (stored; see Assumptions)            |
| `status`    | enum              | `draft`, `published`, or `cancelled` (indexed) |

**`sessions`** — like a single calendar event inside an offering

| Column        | Type                | What It Stores   |
| ------------- | ------------------- | ---------------- |
| `offering_id` | UUID FK → offerings | Which offering   |
| `starts_at`   | timestamptz         | Start time (UTC) |
| `ends_at`     | timestamptz         | End time (UTC)   |

DB check `CHK_sessions_ends_after_starts` enforces `ends_at > starts_at`.
Composite index `(offering_id, starts_at, ends_at)` accelerates overlap queries.

**`bookings`** — like a confirmed reservation ticket

| Column        | Type                | What It Stores             |
| ------------- | ------------------- | -------------------------- |
| `offering_id` | UUID FK → offerings | What was booked            |
| `parent_id`   | UUID FK → users     | Who booked it (indexed)    |
| `status`      | enum                | `confirmed` or `cancelled` |

Unique constraint `(offering_id, parent_id)` prevents double-booking.
Cancellation deletes the row so the constraint never blocks re-booking.

---

## 9. Timezone Handling — How Times Work 🌍

**The problem in plain English:** A teacher in Mumbai says "class starts at 9 AM."
A parent in New York needs to know that's actually 11:30 PM the night before in their
timezone. If the database stored bare "9 AM" without knowing which timezone, the whole
system would give wrong times to everyone.

**The rule, four words: Store UTC. Display local.**

UTC (Coordinated Universal Time) is like a universal reference clock — no daylight
saving, no city differences. Every time goes in as UTC and comes out converted to
whoever is asking.

```
Teacher types       Service layer         Database        Parent sees
─────────────       ─────────────         ────────        ───────────
"9:00 AM"       →  subtract 5h30m    →  "03:30 UTC"  →  "11:30 PM"
(Asia/Kolkata)     (teacher's TZ)                       (America/New_York)
```

**Concrete example with real offsets:**

| Who     | Timezone           | What They See               | What's in the DB       |
| ------- | ------------------ | --------------------------- | ---------------------- |
| Teacher | `Asia/Kolkata`     | `2024-09-01T09:00:00+05:30` | `2024-09-01T03:30:00Z` |
| Parent  | `America/New_York` | `2024-08-31T23:30:00-04:00` | `2024-09-01T03:30:00Z` |

All conversion code lives in exactly one file:
[src/common/utils/timezone.util.ts](src/common/utils/timezone.util.ts).
No other file in the codebase converts timezones directly.

---

## 10. Concurrency — What Happens When Two Parents Book at the Same Time 🔒

**The problem:** Imagine two parents both clicking "Book" at the exact same millisecond.
Without protection, the system checks for conflicts for both at the same time. Both
see "no conflict" because neither has committed yet — and both get confirmed.

**This is like two people grabbing the last concert ticket off a table simultaneously.**

```
WITHOUT locking (BROKEN):
  Parent A: check conflicts → none found → save booking ✓
  Parent B: check conflicts → none found → save booking ✓  ← BOTH WIN (wrong!)

WITH locking (CORRECT):
  Parent A: LOCK rows → check conflicts → none → save → release ✓
  Parent B: LOCK attempt → WAITS for A to finish
  Parent B: now sees A's booking → conflict found → rejected ✗
```

**How `SELECT FOR UPDATE` works without SQL jargon:** Before checking for conflicts,
the system puts a "do not disturb" sign on the parent's existing booking rows. Any
other request that tries to read or change those same rows has to wait. By the time
the second request gets its turn, the first booking is already saved — and the conflict
check correctly rejects the duplicate.

The lock, the conflict check, and the insert all happen inside a **single database
transaction** in `BookingsService.executeBookingTransaction()`. They are never split
into separate steps.

---

## 11. Assumptions Made 📝

- **One booking per parent per offering.** A parent cannot book the same offering
  twice. Enforced in the app and in the database via a unique constraint.
  _Why: matches natural booking behaviour and keeps conflict checking simple._

- **Capacity is stored but not enforced during booking.** The `capacity` field is
  saved and returned in responses but does not block bookings when full.
  _Why: the assignment focused on timezone and concurrency correctness; capacity
  enforcement would be a straightforward addition inside the booking transaction._

- **Session times always use the teacher's registered timezone.** The timezone comes
  from the teacher's profile — it cannot be overridden per-request.
  _Why: prevents the API from being tricked into interpreting a time in the wrong zone._

- **Back-to-back sessions are not conflicts.** If session A ends at 10:00 and session
  B starts at 10:00 exactly, both can be booked.
  _Why: a child can go directly from one class to the next — no gap required._

- **Offering status is set explicitly by the teacher.** There is no auto-publish.
  Teachers pass `"status": "published"` when ready.
  _Why: teachers should control exactly when parents can see and book their offerings._

- **Cancelling an already-cancelled booking returns 200, not an error.** This is
  called idempotency — doing the same thing twice is safe.
  _Why: if a client retries due to a network hiccup, they will not get a confusing error._

- **Sessions can be added to an offering regardless of its status.** Teachers can
  schedule sessions before publishing.
  _Why: you build the schedule first, then open it to the public._

- **Bookings belong to the parent account directly.** The system does not model
  individual children as separate entities.
  _Why: out of scope for this project; every parent account is one booking entity._

---

## 12. Running Tests 🧪

| Command            | What It Tests                                          | How Many Tests |
| ------------------ | ------------------------------------------------------ | -------------- |
| `npm test`         | Unit tests — pure logic, no real database needed       | 28 tests       |
| `npm run test:e2e` | Integration tests — full flows against real PostgreSQL | 5 tests        |

### Unit test breakdown

| File                                   | Tests | What It Proves                                                                                                           |
| -------------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------ |
| `timezone.util.spec.ts`                |    19 | Timezone conversion is correct across Kolkata, New York, London, Auckland — including midnight crossings and round-trips |
| `bookings.service.spec.ts`             |     7 | Booking rules: rejects non-parents, rejects unpublished offerings, rejects duplicate bookings, rejects time conflicts    |
| `bookings.service.concurrency.spec.ts` |     2 | Two simultaneous conflicting bookings → exactly one succeeds, one is rejected                                            |

### Integration test breakdown

| Test                  | What It Proves                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Happy path + timezone | Full flow returns sessions with correct UTC offset for `Asia/Kolkata` (`+05:30`)                                                   |
| Duplicate booking     | Second `POST /bookings` for same offering returns `409 BOOKING_ALREADY_EXISTS`                                                     |
| Overlap conflict      | Booking whose sessions overlap existing booking returns `409 BOOKING_CONFLICT`                                                     |
| Back-to-back boundary | Two offerings with adjacent (touching, non-overlapping) sessions both return `201`                                                 |
| **Concurrency proof** | `Promise.all` fires two conflicting requests at the real database simultaneously; result is always exactly one `201` and one `409` |

The concurrency integration test is the definitive proof: `SELECT FOR UPDATE` forces
the two transactions to run one at a time, so the race condition cannot produce two
successful bookings.

---

## 13. API Documentation Files 📄

Two ready-to-use files live in the `docs/` folder:

- **`docs/openapi.json`** — Import into any OpenAPI-compatible tool (Swagger UI,
  Insomnia, Postman's import). Describes every route, request body, and response
  shape in standard machine-readable format.

- **`docs/sessiongrid.postman_collection.json`** — Import directly into
  [Postman](https://www.postman.com/). Gives you 11 pre-built requests in 4 folders
  (Users, Courses, Offerings, Bookings) — pre-configured to point directly to your live production server (`https://sessiongrid-api.onrender.com`). You can toggle the `baseUrl` collection variable to `http://localhost:3000` to test against your local server instead.

---

## 14. Live Cloud Deployment (Render) 🚀

SessionGrid is fully deployed, configured, and running live in the cloud.

* **Live API Base URL**: `https://sessiongrid-api.onrender.com`
* **Interactive API Documentation (Swagger)**: `https://sessiongrid-api.onrender.com/api/docs`

### **Production Infrastructure Architecture:**
* **Web Service**: Node.js/NestJS hosted on Render. Uses dynamic peer dependency checks and production-safe migrations compiled directly to native JavaScript.
* **Database**: Managed PostgreSQL instance (v16) hosted on Render. Supports unified secure `DATABASE_URL` connections, preventing connection leaks.
* **Continuous Integration**: Managed via GitHub actions and auto-deployed directly to Render on every push to the `main` branch.

