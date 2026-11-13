# Pre-deployment security review

## Scope and verdict

Review of the Node/Express + MongoDB API and its browser admin dashboard. **Do not treat this as production-ready approval.** This change applies baseline hardening and restricts data-management APIs to admins. Independent testing and school-specific review remain required before importing student data.

## Applied in this change

- Adds Helmet response security headers and request rate limits for authentication/setup, plus a general API limit.
- Authenticates protected APIs and checks admin role on the administrative dashboard and CRUD operations.
- Uses bcrypt password hashes, JWT expiry, generic login errors, a protected one-time admin setup route, and no public registration.
- No demo records are seeded; dashboard values come from MongoDB.
- Request body size remains limited; HTML table cells are populated using `textContent` rather than interpolated user HTML.
- Keeps same-origin deployment by default; CORS is disabled unless explicit frontend origins are configured.

## Blocking / required follow-up before production

1. **Lecturer scoping:** users have roles but are not linked to lecturer records or assigned courses. Current conservative policy must deny non-admin data routes; implement and test course-level authorization before giving lecturers access.
2. **Token storage:** browser UI currently keeps the JWT in `sessionStorage`. XSS could steal it. Prefer secure, HttpOnly, SameSite cookies with CSRF defenses, or document and mitigate the token-storage tradeoff; add a CSP compatible with the UI.
3. **Validation:** add a dedicated schema-validation layer (e.g. Zod/Joi) for every payload/query and reject unknown fields, invalid emails, oversized arrays, unexpected types and invalid date ranges.
4. **Account lifecycle:** add password reset/change, account deactivation endpoints, token revocation strategy, audit logs, and safeguards against removing the last admin.
5. **Bootstrap race:** one-time setup requires operationally controlled access. Protect the endpoint with a strong temporary key, invoke once, remove the key immediately, and verify in the database that exactly one bootstrap admin was created. Add an atomic bootstrap mechanism if deployment could run multiple app instances concurrently.
6. **Data deletion/history:** API currently deletes students/courses and enrollment links. Decide retention requirements; prefer deactivation/soft deletion and transactions or explicit cleanup policies that preserve attendance records.
7. **Operational controls:** configure Atlas least privilege, backups/restore tests, monitoring/alerts, TLS, log redaction, dependency scanning, and incident-response ownership. Never put secrets in frontend code or repository.
8. **Testing:** run `docs/api-test-checklist.md`, add automated unit/integration tests in CI, test rate limits and authorization, and perform an independent security review.

## Render production settings

Runtime Node, root directory repo root, build `npm install`, start `npm start`, health path `/api/health`. Required secrets: `MONGO_URI`, `JWT_SECRET` (random >=32 characters). Set `NODE_ENV=production`; set `BOOTSTRAP_ADMIN_KEY` only for first-admin setup and remove after. Do not manually set `PORT`. `CLIENT_ORIGIN` stays unset when frontend/API share the Render origin.
