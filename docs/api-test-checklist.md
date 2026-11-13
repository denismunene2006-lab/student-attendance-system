# API / MongoDB pre-deployment test checklist

Run against a non-production MongoDB database first. Use a disposable admin account and real ObjectIds returned by the API; do not use personal or student information in test data. `BASE` is your local or Render URL. Set `TOKEN` after bootstrap/login.

## Connection and bootstrap

- [ ] `GET $BASE/api/health` returns success and database `connected`.
- [ ] Without MongoDB credentials/connectivity, service does not falsely report ready; inspect logs without exposing `MONGO_URI`.
- [ ] `POST /api/auth/setup` without bootstrap header and with wrong key is rejected.
- [ ] Correct setup key creates exactly one admin; repeat setup is rejected (409).
- [ ] Remove `BOOTSTRAP_ADMIN_KEY` after setup; verify setup is disabled.
- [ ] `POST /api/auth/login` with correct credentials returns a token; wrong password and unknown email return generic 401.
- [ ] `GET /api/auth/me` without token/with malformed or expired token returns 401.

## Authorization

- [ ] No token cannot read dashboard, lecturers, students, courses, enrollments, or attendance.
- [ ] Lecturer role cannot use admin-only create/update/delete endpoints or the admin dashboard.
- [ ] Admin can access only intended administrative endpoints.
- [ ] Inactive user token is rejected.
- [ ] Duplicate email, student ID, lecturer ID, and course code return conflict without stack traces or credentials.

## CRUD and data integrity

- [ ] Create/list/search/update/delete lecturer, student, and course; check the same records persist after service restart.
- [ ] Missing required fields, invalid email, oversized values, malformed ObjectIds and invalid enum values fail safely.
- [ ] Student/course delete behavior is understood and expected related enrollment/attendance history is preserved or intentionally removed.
- [ ] Dashboard counts match database contents and do not include inactive students/courses in active totals.
- [ ] Pagination/large result behavior is assessed for expected dataset size.

## Enrollment and attendance

- [ ] Enroll active students by MongoDB ObjectId; invalid, inactive, duplicate IDs and invalid course are handled as documented.
- [ ] Duplicate enrollment is idempotent and reports accurate counts.
- [ ] Create a session for an active course; reject invalid date and invalid/inactive course.
- [ ] Mark present/absent/late/excused for enrolled students; reject invalid status, duplicate student in payload, unknown and non-enrolled students.
- [ ] Re-submit marks updates existing records rather than duplicating them.
- [ ] Session detail, course filter and reports return expected data; inspect time zone/day-boundary behavior.

## Production checks

- [ ] Render build/start/health check succeeds; only required environment variables are present and secrets are not in Git/logs.
- [ ] Atlas DB user has minimum permissions; Network Access is restricted according to deployment support and policy; TLS connection succeeds.
- [ ] Restore a backup into a test database and verify data recovery before launch.
- [ ] Review rate limits, request size, security headers, CORS, log redaction, monitoring and incident response.
- [ ] Verify authorized staff can only see the students/courses they need. The current model has no lecturer-course assignment; keep APIs admin-only until scoped authorization is implemented.
- [ ] Complete school privacy/security review before importing actual student records.
