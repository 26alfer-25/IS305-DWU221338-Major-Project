# Campus Service Request Management System
**IS305 Object-Oriented Programming — Assessment Task 3 (Major Project)**

| | |
|---|---|
| **Student name** | Obert MOSES |
| **Student ID** | 221338 |
| **GitHub repository** | https://github.com/26alfer-25/IS305-DWU221338-Major-Project.git |

## Project description
A Node.js **console application** that records, assigns, processes and monitors campus service requests (ICT support, facilities maintenance, cleaning and sanitation, general campus service). Requesters submit and track requests, Service Officers review and assign them, Technicians do the work, and the System Administrator reads the audit trail and management reports. It is written in plain JavaScript classes with **no database** and **no external packages**; data is stored in JSON files.

## Achievement components attempted
- [x] **Pass** — core classes, validation, arrays, console workflow
- [x] **Credit** — inheritance, constructor chaining, specialised requests, role workflow, history, search/filter/sort
- [x] **Distinction** — abstraction, polymorphism, JSON repositories, object restoration, audit trail, reports, automated tests

## Features completed
- **Pass:** `User`, `ServiceRequest`, `ServiceRequestManager`, `CampusServiceApp`; private fields with getters/controlled setters; register, submit, view (by ID / mine / all), update own request, cancel own request, search, summary by status; full validation (missing/duplicate IDs, bad e-mail, bad category/priority, not-the-owner, already cancelled).
- **Credit:** `StudentRequester`, `StaffRequester`, `ServiceOfficer`, `Technician` (+ `SystemAdministrator`) extend `User`; `ICTSupportRequest`, `MaintenanceRequest`, `CleaningRequest` (+ `GeneralServiceRequest`) extend `ServiceRequest` using `super()`; controlled status flow *Submitted → Reviewed → Assigned → In Progress → Resolved → Closed* (Cancelled is final); role permissions; overridden summary/score/target-hours methods; filter by category, status, priority, Technician; sort by date and priority; request history.
- **Distinction:** abstract-style base class (`NotImplementedError`); polymorphic processing of mixed request types; `data/users.json`, `serviceRequests.json`, `requestHistory.json`, `auditLog.json`; `FileRepository` + four repository classes + `DataStore`; `ServiceRequestFactory` / `UserFactory` restore the right subclass; audit trail (successes and rejections); 9 management reports using `filter/map/reduce/sort`; 41 automated tests with temporary files; file read/write error handling.

## Project folder structure
```
AT3_CampusServiceRequestSystem/
├── package.json
├── README.md
├── src/
│   ├── CampusServiceApp.js   (start here)
│   ├── models/  services/  factories/  repositories/  utils/
├── data/       simulated JSON data
├── scripts/    generateSampleData.js
├── tests/      pass.test.js  credit.test.js  distinction.test.js
└── docs/       requirements, UML, technical documentation, user guide, test report, AI declaration
```
See `docs/03-technical-documentation.md` for the responsibility of every class.

## Installation
1. Install **Node.js 20 or newer** (<https://nodejs.org>).
2. Open a terminal in this folder and run:
```
npm install
```
(There are no dependencies; this just creates `package-lock.json`.)

## Running the application
```
node src/CampusServiceApp.js
```
or `npm start`. To recreate the simulated demo data: `node scripts/generateSampleData.js`.
Demo users: `DWU2026001`, `DWU2026002` (students), `STAFF001`, `SO001` (Service Officer), `TECH001`–`TECH003` (Technicians), `ADM001` (Administrator).

## Running the tests
```
npm test
```
Uses the built-in `node:test` runner (41 tests). Tests write only to temporary folders, never to `data/`.

## The JSON data files (`data/`)
| File | Contents |
|---|---|
| `users.json` | Every registered user, with `userType` and a `specialisedData` object (programme, department, speciality, ...) |
| `serviceRequests.json` | Every request: ID, `requestType` (e.g. `ICTSupportRequest`), requester ID, title, category, priority, status, `assignedTechnicianId`, dates, `specialisedData` |
| `requestHistory.json` | One entry per workflow action: request ID, previous/new status, action, actor, comment, time |
| `auditLog.json` | One entry per action or rejected attempt: audit ID, actor, action, request ID, description, time, outcome |

The files contain **simulated data only** — no code, passwords or real records. A missing file is created as an empty array; a damaged file stops the program with a clear `FILE ERROR` instead of being overwritten.

## How objects are restored from saved data
JSON stores plain text and numbers, not class instances. At start-up `DataStore.loadInto()` reads the files and rebuilds real objects: `UserFactory.createFromData()` uses `userType` to build the right `User` subclass; `ServiceRequestFactory.createFromData()` uses `requestType` to build an `ICTSupportRequest`, `MaintenanceRequest`, `CleaningRequest` or `GeneralServiceRequest`, links the requester and Technician by ID, and re-applies the saved status, dates and history. Because the normal constructors run, restored objects still validate their specialised fields, override methods and behave polymorphically.

## Sample user scenarios
1. **Submit and track (Student):** register `DWU2026001` as a Student → option 2, ICT Support, "Unable to access campus Wi-Fi" → option 4 to see it with status *Submitted*.
2. **Full workflow:** Officer `SO001`: menu 11 → Review → Assign priority → Assign Technician `TECH001`. Technician `TECH001`: menu 12 → Start work → Add progress note → Resolve. Officer `SO001`: menu 11 → Verify and close. Then option 3 with the request ID shows the whole history.
3. **Permission check:** as `DWU2026001` try menu 11 → Review → `ERROR: Only a Service Officer can review requests.`
4. **Management view:** as `ADM001` open menu 13 → Management reports → `all`, and View audit log.
5. **Persistence:** submit a request, choose 10 to exit, start the program again, and view the request by ID.

## Known limitations
- No passwords: a user "logs in" by typing an ID.
- One user at a time; the JSON files are rewritten after each change.
- Console interface only; a Resolved request cannot be re-opened.

## Future improvements
Login with hashed passwords, a web or mobile interface, e-mail/SMS notifications, a *Reopened* status, configurable target hours, CSV/PDF report export, and a real database in a later version.

## AI use declaration
See `docs/06-ai-use-declaration.md` (approved AI use declaration, completed by the student).

## Documentation
`docs/01-requirements-document.md` · `docs/02-uml-and-system-design.md` · `docs/03-technical-documentation.md` · `docs/04-user-guide.md` · `docs/05-test-report.md` · `docs/06-ai-use-declaration.md`
