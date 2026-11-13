# Student Attendance Management System

Node.js/Express API and browser UI backed by MongoDB. The app includes lecturer, student, course, enrollment, user-authentication, attendance-session and attendance-record APIs. This is a functional foundation; review security, validation, tests and school-specific requirements before production use.

## Local setup

1. Install Node.js 20+ and create a MongoDB Atlas database/user. Allow your development IP address in Atlas Network Access.
2. Copy `.env.example` to `.env`; set `MONGO_URI`, `JWT_SECRET` (random, at least 32 characters), and `BOOTSTRAP_ADMIN_KEY` (a separate random secret). Do not commit `.env`.
3. Run `npm install` then `npm start`; open `http://localhost:5000`.
4. Create the first admin once using curl (replace values; send secrets securely):

   ```bash
   curl -X POST http://localhost:5000/api/auth/setup \
     -H 'Content-Type: application/json' \
     -H 'x-bootstrap-key: YOUR_BOOTSTRAP_ADMIN_KEY' \
     -d '{"name":"School Administrator","email":"admin@example.com","password":"use-a-long-unique-password"}'
   ```

   Setup is refused once any user exists. Keep the bootstrap key private; remove `BOOTSTRAP_ADMIN_KEY` from Render after setup. Sign in at the site using the created admin. Admin passwords must be at least 12 characters.

## API overview

All routes below require `Authorization: Bearer <token>` unless noted. Login and one-time setup are public; user/course/student writes require admin role. Attendance routes require an authenticated account.

- `POST /api/auth/setup` — one-time first-admin creation; `x-bootstrap-key` header required
- `POST /api/auth/login` — `{ "email", "password" }`; returns token and user
- `GET /api/auth/me` — current account
- `POST /api/users` — admin creates account `{ "name", "email", "password", "role": "lecturer"|"admin" }`
- `GET /api/users` — admin list accounts
- `GET /api/dashboard` — real database counts, no seeded/sample totals
- `GET|POST /api/lecturers`; `PUT|DELETE /api/lecturers/:id` — create/list/update/delete lecturer; writes are admin-only
- `GET|POST /api/students`; `PUT|DELETE /api/students/:id` — student CRUD; writes are admin-only
- `GET|POST /api/courses`; `PUT|DELETE /api/courses/:id` — course CRUD; writes are admin-only
- `POST /api/courses/:id/enroll` — admin enrolls `{ "studentIds": ["MongoDB Student ID", ...] }`
- `GET /api/courses/:id/students` — list enrolled students
- `POST /api/attendance/sessions` — create session `{ "courseId", "title", "sessionDate" }`; date optional
- `GET /api/attendance/sessions?courseId=...` — list sessions
- `POST /api/attendance/sessions/:id/records` — submit `{ "records": [{ "studentId": "MongoDB Student ID", "status": "present|absent|late|excused", "note": "optional" }] }`; upserts marks and checks course enrollment
- `GET /api/attendance/sessions/:id/records` — list marks for a session
- `GET /api/attendance/report?courseId=...` — recent attendance records, optionally filtered by course
- `GET /api/health` — service/database status

The API uses MongoDB ObjectIds for `studentIds`, `courseId`, and route `:id` values; these are not the human-readable student/course codes. Create students/courses first, enroll students, create a session, then mark attendance.

## Exact Render Web Service settings

Create a **Web Service** from this repository and branch `add-mongodb-render-backend` (or the branch you intend to deploy). Use:

| Render setting | Value |
| --- | --- |
| Runtime | Node |
| Root Directory | Leave blank (repository root) |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Auto-Deploy | On, if desired |

Add these environment variables in the service's **Environment** tab:

| Key | Value |
| --- | --- |
| `MONGO_URI` | MongoDB Atlas connection string for the production database, including database name |
| `JWT_SECRET` | A randomly generated secret with at least 32 characters; keep private |
| `BOOTSTRAP_ADMIN_KEY` | A different randomly generated secret; remove after creating initial admin |
| `NODE_ENV` | `production` |
| `CLIENT_ORIGIN` | Leave unset for the bundled same-origin frontend. If separately hosted, set its exact HTTPS origin (comma-separated for multiple origins). |
| `PORT` | Do not set manually; Render provides it and the server reads it automatically. |

For Atlas, create a database user with only the required database permissions and configure Network Access for the Render service according to your Atlas plan and security policy. Do not put database credentials or JWT secrets in frontend files. After deploy, call `/api/auth/setup` once with the bootstrap key and then remove that key from Render. Never use a real school dataset until authentication, access policies, backups, audit requirements and deployment settings have been reviewed.

## Data and demo content

No demo lecturer, student, course, account or attendance records are inserted by the app. Database collections are created as records are written. The dashboard reads current database counts. Existing MongoDB data is not automatically deleted by deployment; back it up and explicitly remove unwanted records only if you intend to.

## Still to do before production

- Build student/course/enrollment and attendance management screens (the current browser UI demonstrates sign-in and lecturer management; APIs are available for the other workflows).
- Add rate limiting, stronger input validation, automated tests, audit logging, pagination and school-specific authorization/lecturer-course assignment.
- Configure backups, monitoring, HTTPS/custom domain as needed, and review privacy/legal obligations for student data.
