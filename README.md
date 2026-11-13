# Student Attendance Management System

A browser-based prototype that now includes a Node.js/Express API for lecturer records, MongoDB persistence, and a frontend served by the same service. Attendance workflows, student/course management, and authentication are not implemented yet.

## Run locally

1. Install Node.js 20 or newer.
2. Create a MongoDB Atlas cluster and database user. Add your development IP address to Atlas Network Access.
3. Copy `.env.example` to `.env` and set `MONGO_URI` to your Atlas connection string. Set `CLIENT_ORIGIN` only when the frontend is served from a different origin; for example, `http://localhost:5500`.
4. Install and start:

   ```bash
   npm install
   npm start
   ```

5. Open `http://localhost:5000`. Do not open `index.html` directly from the filesystem because the UI uses the API.

## API

- `GET /api/health` — service/database readiness
- `GET /api/lecturers?search=...` — list/search lecturers
- `POST /api/lecturers` — create (`lecturerId`, `fullName`, `email`, `department` required)
- `PUT /api/lecturers/:id` — update lecturer fields
- `DELETE /api/lecturers/:id` — delete lecturer

## Deploy to Render

Create a **Web Service** from this repository and use:

- Build command: `npm install`
- Start command: `npm start`
- Environment: `MONGO_URI` (required), `NODE_ENV=production` (recommended), and `CLIENT_ORIGIN` only if the frontend is hosted on another origin. Render supplies `PORT`; the server reads it automatically.

For MongoDB Atlas, configure Network Access appropriately for the deployed service and use a database user with only the permissions the app needs. Never commit `.env` or expose database credentials in browser JavaScript. If the frontend is deployed separately, set `CLIENT_ORIGIN` to its exact HTTPS origin.

## Remaining work

- Add student, course/class, attendance-session, and attendance-record models and APIs.
- Build the student, class, attendance, and reports UI; replace placeholder dashboard values with API data.
- Implement login, password hashing, authorization/roles, and protect write endpoints before using real school data. Lecturer CRUD is currently unauthenticated and is a prototype, not production-ready.
- Add stronger server-side field validation, automated tests, audit/history behavior, export/reporting, accessibility polish, and deployment monitoring.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGO_URI` | Yes | MongoDB Atlas connection URI, including database name |
| `PORT` | Provided by Render | HTTP listener port; locally defaults to `5000` |
| `CLIENT_ORIGIN` | Only for a separate frontend | Comma-separated allowed browser origin(s); omit when serving the bundled frontend from this service |
| `NODE_ENV` | Recommended | Set to `production` on Render |

Authentication secrets such as `JWT_SECRET` are not needed until authentication is added. Do not add a dummy secret in anticipation of a feature that does not yet exist.
