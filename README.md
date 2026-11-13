# Student Attendance Management System

Node.js/Express API and browser admin dashboard backed by MongoDB. The dashboard now supports lecturer/student/course records and student course enrollment. Student/course/attendance API routes are also available. This is a functional foundation, not a production security certification.

## Local setup and initial admin

1. Use Node.js 20+ and a MongoDB Atlas database/user. Allow your development IP in Atlas Network Access.
2. Copy `.env.example` to `.env`; configure `MONGO_URI`, a random `JWT_SECRET` (>=32 chars) and a separate random `BOOTSTRAP_ADMIN_KEY`. Never commit `.env`.
3. Run `npm install`, then `npm start`, and browse to `http://localhost:5000`.
4. Set the temporary bootstrap secret in the environment and call `POST /api/auth/setup` once with `x-bootstrap-key`. See the exact curl example earlier in the repository history or `docs/` guidance. Immediately remove that environment variable after the first admin is created.
5. Login in the web UI. Admins can add/edit/delete lecturers, students, and courses, and enroll students into courses. There are no seeded/demo records.

## API summary

- `POST /api/auth/setup`, `POST /api/auth/login`, `GET /api/auth/me`
- Admin: `/api/dashboard`, `/api/users`, lecturer/student/course CRUD
- Admin enrollment: `POST /api/courses/:id/enroll`, `GET /api/courses/:id/students`
- Admin attendance: session create/list, record upsert/read, and report endpoints under `/api/attendance`
- `GET /api/health`

Protected endpoints use `Authorization: Bearer <JWT>`. Use MongoDB ObjectIds in enrollment and attendance APIs; human-readable IDs are separate fields.

## Render Web Service settings

Runtime Node; root directory repository root; build command `npm install`; start command `npm start`; health check `/api/health`. Set `MONGO_URI`, `JWT_SECRET` (strong unique random secret >=32 chars), and `NODE_ENV=production`. Set `BOOTSTRAP_ADMIN_KEY` only for first-admin setup then remove it. Leave `PORT` unset; Render injects it. Leave `CLIENT_ORIGIN` unset when frontend and API are the same Render service.

## Test and review docs

- [API/MongoDB pre-deployment checklist](docs/api-test-checklist.md)
- [Pre-deployment security review and blocking follow-ups](docs/security-review.md)

Important security caveat: because lecturer-to-course assignment has not been modeled, this branch conservatively restricts all records and attendance APIs to administrator accounts. Add course-scoped lecturer permissions before enabling lecturer access. Do not import real student information until security/privacy review, authorization testing, backups, and remaining review items are addressed.
