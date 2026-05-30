# 🌐 SessionGrid — Frontend Development Specification

This document serves as the single source of truth for building a client application (Web or Mobile) that connects to the SessionGrid Backend API. 

* **Live Cloud API Endpoint**: `https://sessiongrid-api.onrender.com`
* **Local Development Base URL**: `http://localhost:3000`
* **Interactive Swagger UI**: `https://sessiongrid-api.onrender.com/api/docs`

---

## 1. Authentication & Identity Strategy

The backend supports two authentication paths. The frontend must implement support for both:

### **Path A — Development Mode (Mock Headers)**
For rapid development, automated tests, and simple exploration, the server accepts three fallback mock headers on all protected routes:
* `x-user-id`: The UUID of the logged-in user.
* `x-user-role`: The role of the user (`teacher` or `parent`).
* `x-user-timezone`: The user's registered IANA timezone string (e.g. `Asia/Kolkata`).

### **Path B — Production Mode (JWT Bearer Token)**
1. The user registers via `POST /users/register`.
2. The user logs in via `POST /users/login` with their `email` and `password`.
3. The server returns a signed JWT `accessToken` along with the `user` profile object:
   ```json
   {
     "accessToken": "eyJhbGciOi...",
     "user": {
       "id": "3f9e0c8d-6ce8-492f-99c9-76fb3b0c62aa",
       "email": "alice@example.com",
       "firstName": "Alice",
       "lastName": "Smith",
       "role": "teacher",
       "timezone": "Asia/Kolkata",
       "createdAt": "2026-05-30T09:00:00.000Z",
       "updatedAt": "2026-05-30T09:00:00.000Z"
     }
   }
   ```
4. **Token Storage**: Store the `accessToken` in local storage or secure cookies.
5. **Authorization Header**: Attach the token to all subsequent requests:
   ```http
   Authorization: Bearer <accessToken>
   ```

---

## 2. Core User Interface Pages & Routing Flows

### **Flow 1 — Onboarding (Login & Registration)**
* **Register Screen**: Form fields for `Email`, `First Name`, `Last Name`, `Password`, `Role` (Dropdown: `teacher` / `parent`), and `Timezone` (IANA dropdown list or automatically detected via `Intl.DateTimeFormat().resolvedOptions().timeZone`).
* **Login Screen**: Form fields for `Email` and `Password`. Stores the token on success and redirects the user based on their `role`.

### **Flow 2 — 🎓 Teacher Dashboard**
* **Courses List**: Displays all courses owned by the teacher (`GET /courses/mine`).
* **Create Course Form**: Inputs for `title` (required) and `description` (optional, text area). Sends `POST /courses`.
* **Offerings Management**:
  * Displays offerings nested under courses.
  * **Create Offering**: Inputs for `courseId`, `capacity` (integer, min 1), and `status` (defaults to `draft`, can select `published`). Sends `POST /offerings`.
  * **Add Session to Offering**: Form to add timeslots to an offering. Inputs for local `startsAt` (datetime-local picker) and `endsAt` (datetime-local picker). Sends `POST /offerings/:offeringId/sessions`.
    * *Rule*: The frontend must ensure `endsAt` is strictly after `startsAt` to prevent errors before submission.

### **Flow 3 — 👨‍👩‍👧 Parent Dashboard**
* **Browse Offerings (`GET /offerings`)**: Displays a catalog of all **published** offerings with their sessions.
  * *Important*: The session times will arrive pre-converted to the parent's registered timezone (e.g. `2026-05-30T14:30:00+05:30`).
* **Book an Offering**: A "Book Spot" button on the offering cards. Sends `POST /bookings` with `offeringId`.
  * *Rules / Error Handling*:
    * If booking overlaps with an existing booking, the server returns `409 BOOKING_CONFLICT` (`BookingConflictException`). Display a friendly warning: *"Time overlap conflict with another of your bookings."*
    * If the offering capacity is full, the server returns `422 OFFERING_FULL` (`OfferingFullException`). Display: *"This offering is fully booked."*
* **My Bookings (`GET /bookings/mine`)**: Displays all bookings made by the parent.
  * **Cancel Booking Button**: A "Cancel Spot" button next to bookings. Sends `PATCH /bookings/:id/cancel` and refreshes the list. Cancellations are soft-deleted, so they will stay in the list as `status: "cancelled"`.

---

## 3. Dynamic Timezone Rules

All timezone shifting is handled server-side at the service layer, keeping frontend date arithmetic extremely simple:

1. **Inbound Time (Local ➔ UTC)**: When a teacher schedules a session, they pick local wall-clock times. The server automatically shift-interprets them using the teacher's registered profile timezone and stores them as UTC.
2. **Outbound Time (UTC ➔ Local)**: When any user queries `/offerings` or `/bookings/mine`, the server shifts the UTC timestamps to the requesting user's registered timezone and appends the correct offset (e.g. `+05:30`, `-04:00`).
3. **Frontend Presentation**: Simply parse the ISO 8601 string directly (e.g., using `new Date(startsAt)` or Luxon/date-fns) and display it using the browser's local string formatting. The offset is baked into the response string.

---

## 4. API Reference Cheat Sheet

| Endpoint | Method | Role | Payload | Response Code | Description |
| :--- | :---: | :---: | :--- | :---: | :--- |
| `/users/register` | `POST` | Public | `{ email, firstName, lastName, password, role, timezone }` | `210` | Register account |
| `/users/login` | `POST` | Public | `{ email, password }` | `200` | Log in & get JWT |
| `/courses` | `POST` | Teacher | `{ title, description }` | `201` | Create new course |
| `/courses/mine` | `GET` | Teacher | None | `200` | List teacher's courses |
| `/offerings` | `POST` | Teacher | `{ courseId, capacity, status }` | `201` | Create course offering |
| `/offerings` | `GET` | Any | None | `200` | List published offerings |
| `/offerings/mine` | `GET` | Teacher | None | `200` | List teacher's offerings |
| `/offerings/:id/sessions` | `POST` | Teacher | `{ startsAt, endsAt }` | `201` | Schedule session |
| `/bookings` | `POST` | Parent | `{ offeringId }` | `201` | Book published offering |
| `/bookings/mine` | `GET` | Parent | None | `200` | List parent's bookings |
| `/bookings/:id/cancel` | `PATCH` | Parent | None | `200` | Cancel booking |

---

## 5. Consistent Error Response Shape

All API errors adhere to the following strict layout. You can intercept this in your frontend client (e.g., via Axios interceptors) to render error alerts:

```json
{
  "statusCode": 409,
  "error": "BOOKING_CONFLICT",
  "message": "Double-booking detected: startsAt overlaps with another confirmed booking.",
  "timestamp": "2026-05-30T09:08:20.729Z",
  "path": "/bookings"
}
```

* **Validation Failures**: Always return `statusCode: 400` with `error: "VALIDATION_ERROR"` and an array of messages listing specific invalid fields.
