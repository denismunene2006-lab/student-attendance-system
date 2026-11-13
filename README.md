# Student Attendance Management System

A lightweight, browser-based prototype for managing lecturer records and account information as a starting point for a student attendance system. The current repository contains a static HTML interface with CSS styling and a small amount of client-side JavaScript; it does not yet include attendance-taking workflows or a backend.

> **Project status:** Front-end prototype / work in progress. Records and dashboard figures are sample data and are not saved to a database.

## Current features

- Administrator-style dashboard layout with navigation links to the dashboard, lecturer registration, lecturer records, and account management.
- Lecturer registration form with fields for lecturer ID, name, email, and department.
- Client-side form handling that appends a submitted lecturer to the on-page lecturer table and clears the form.
- Lecturer search that filters the lecturer rows already present when the page loads.
- Sample lecturer record and account-management table.
- Responsive-friendly layout foundations, including flexible dashboard cards, styled tables, forms, and navigation.

## Technology

- HTML
- CSS (`style-modern.css`)
- Vanilla JavaScript (`script.js`)

There are no package dependencies or build tools configured in the current project.

## Getting started

1. Clone or download this repository.
2. Open `index.html` in a modern web browser.

Alternatively, serve the repository directory using any static web server and open the local URL. No installation or compilation is currently required.

## Repository structure

```text
.
├── index.html        # Dashboard and lecturer/account management interface
├── script.js         # Lecturer search and registration behavior
├── style-modern.css  # Page styling
└── README.md
```

## What is done

- A single-page administrator interface has been created.
- Sections and navigation are in place for dashboard, lecturer registration, lecturer records, and account management.
- The registration form adds a row to the lecturer table in the current page session.
- Search filters the lecturer table rows that exist at initial page load.
- Basic visual styling has been added for the navigation, dashboard, forms, and tables.

## What remains to be completed

The following capabilities are **not implemented** in the current repository and are recommended next steps:

### Core attendance functionality

- Add student registration and student records.
- Create courses/classes and associate students and lecturers with them.
- Implement attendance sessions, attendance marking, and attendance history.
- Add attendance summaries, reports, and export options.

### Data and application behavior

- Replace sample values and hard-coded dashboard totals with real data.
- Persist lecturer, student, account, and attendance records (for example, through a backend API and database or a suitable local-storage prototype).
- Implement working Edit, Delete, Deactivate, and other account actions; these controls are currently presentation-only.
- Make search include records added after the page loads and add validation for required fields and duplicate IDs.
- Add authentication, authorization, and secure account management before using real user data.

### Quality and usability

- Improve small-screen and keyboard accessibility, including semantic page structure and accessible feedback for form actions.
- Add automated tests and document expected behavior.
- Add deployment instructions and screenshots when the interface is ready.

## Important limitations

- This is currently a front-end demonstration, not a complete attendance system.
- Newly registered lecturers are kept only in the page's in-memory DOM. Refreshing the page removes them.
- Dashboard totals and the example lecturer/account records are static sample content.
- The account table and its controls do not yet modify account data.
- Do not use this prototype to store sensitive or production data.

## Contributing

Contributions are welcome. A good next step is to choose a persistence approach, document the data model, and then build the student and attendance workflows on top of the existing interface.

## License

No license is currently specified. Please contact the repository owner before reusing or distributing this project.
