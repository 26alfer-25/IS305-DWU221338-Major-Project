# Technical Documentation
**Student:** Obert MOSES — **Student ID:** 221338

## 1. Project folder structure
```
AT3_CampusServiceRequestSystem/
├── package.json                  scripts: npm start, npm test (no dependencies)
├── README.md
├── src/
│   ├── CampusServiceApp.js       console menus (the program starts here)
│   ├── models/                   domain classes
│   │   ├── User.js  StudentRequester.js  StaffRequester.js  ServiceOfficer.js  Technician.js  SystemAdministrator.js
│   │   ├── ServiceRequest.js     abstract-style base class
│   │   ├── ICTSupportRequest.js  MaintenanceRequest.js  CleaningRequest.js  GeneralServiceRequest.js
│   │   └── AuditEntry.js
│   ├── services/
│   │   ├── ServiceRequestManager.js   business rules, permissions, audit trail
│   │   └── ReportService.js           nine management reports
│   ├── factories/
│   │   ├── UserFactory.js  ServiceRequestFactory.js    create / restore the right subclass
│   ├── repositories/
│   │   ├── FileRepository.js          generic JSON file reader/writer
│   │   ├── UserFileRepository.js  ServiceRequestFileRepository.js
│   │   ├── RequestHistoryFileRepository.js  AuditFileRepository.js
│   │   └── DataStore.js               loads / saves all four files for the manager
│   └── utils/  constants.js  errors.js  validators.js  consolePrompter.js
├── data/                         users.json  serviceRequests.json  requestHistory.json  auditLog.json (simulated data)
├── scripts/generateSampleData.js creates the simulated data through the real workflow
├── tests/                        pass.test.js  credit.test.js  distinction.test.js
└── docs/                         requirements, UML, technical documentation, user guide, test report, AI declaration
```

## 2. Responsibility of each class
| Class | Responsibility |
|---|---|
| `User` (+ 5 subclasses) | Hold and validate a person's data; answer "what may this role do?" (`canManageRequests()` ...). |
| `ServiceRequest` | Hold common request data, validate it, control status changes, keep the history; declares the abstract-style methods. |
| `ICTSupportRequest`, `MaintenanceRequest`, `CleaningRequest`, `GeneralServiceRequest` | Add specialised fields and validation; supply the specialised summary, priority score and target hours. |
| `AuditEntry` | One immutable audit record. |
| `ServiceRequestManager` | Keeps the arrays; enforces uniqueness, ownership and role permissions; runs every workflow step; writes the audit log. |
| `ReportService` | Builds the nine reports from the manager's requests using `filter`, `map`, `reduce`, `sort`. |
| `UserFactory`, `ServiceRequestFactory` | Choose the right subclass when creating a new object or restoring one from JSON. |
| `FileRepository` and 4 subclasses | Read/write one JSON file; know nothing about users or requests. |
| `DataStore` | Turns manager data into plain JSON records and back into objects. |
| `CampusServiceApp` | Asks questions, calls the manager, prints results. It never reads or writes files. |

## 3. Where encapsulation is used
- Every field of `User`, `ServiceRequest`, all subclasses and `AuditEntry` is a **private field** (`#name`). Outside code can only use getters and controlled setters.
- Setters validate (`set priority(v)` uses `requireOneOf`); there is no setter for `userId` or `requestId`, so identities cannot change.
- `status` has **no setter at all**; it changes only through `transitionTo()`, which checks the allowed workflow.
- Getters for dates return copies (`new Date(...)`) and `getHistory()` returns copies, so callers cannot edit internal data.
- `ServiceRequestManager` keeps `#users`, `#requests` and `#auditLog` private and returns copies of the arrays.

## 4. Where inheritance and constructor chaining are used
- `StudentRequester`, `StaffRequester`, `ServiceOfficer`, `Technician`, `SystemAdministrator` **extend** `User`. Each constructor calls `super({ ...commonData, userType: 'Student' })`, so the base class stores and validates the shared fields and the subclass sets its own user type.
- `ICTSupportRequest`, `MaintenanceRequest`, `CleaningRequest`, `GeneralServiceRequest` **extend** `ServiceRequest`. Each constructor is `constructor(commonRequestData, specialisedData) { super({ ...commonRequestData, category: CATEGORY.xxx }); ... }`, then validates and stores its own fields.
- `UserFileRepository` and the other repositories extend `FileRepository`, calling `super(filePath, { idField, label })`.

## 5. Where method overriding and polymorphism are used
- **Abstract-style base class:** `ServiceRequest.getRequestSummary()`, `calculatePriorityScore()` and `getTargetResolutionHours()` throw `NotImplementedError` ("X must implement ...").
- **Overriding:** each request subclass overrides all three. Examples: an ICT request scores +30 for a campus-wide network impact and must be fixed in 4 hours; a Maintenance request scores +45 for a Critical hazard; a Cleaning request scores +25 for a High hygiene risk (+10 for spills) and must be done in 6 hours.
- Subclasses also override `validateSpecialisedFields()` and `allowsCategoryChange()`, and user subclasses override `canManageRequests()`, `canWorkOnRequests()`, `canViewAdminData()` and `displayInfo()`.
- **Polymorphism:** all four request types live in one array. The loop `for (const request of requests) { request.getRequestSummary(); request.calculatePriorityScore(); request.getTargetResolutionHours(); }` (Administrator Menu → *Polymorphism demonstration*, test `D2`) gives a different, correct answer for each type. `ReportService.urgentRequests()` and `overdueRequests()` also rely on it.

## 6. How the request workflow is controlled
```
Submitted → Reviewed → Assigned → In Progress → Resolved → Closed        Submitted → Cancelled
```
- The table `STATUS_TRANSITIONS` in `constants.js` lists the only legal next statuses. `Closed` and `Cancelled` have none (final).
- `ServiceRequest.transitionTo()` checks the table (`#assertTransition`) and throws `WorkflowError` for anything else. Changes are made only after all checks pass, so a rejected action changes nothing.
- **Roles** are checked in `ServiceRequestManager` before the request is touched: `#requireOfficer()` for review, priority, assignment and closing; `#requireAssignedTechnician()` for start, progress notes and resolve; `#requireOwner()` for requester update/cancel.
- Every accepted step adds a history entry (previous status, new status, action, actor ID and role, comment, time). Every step — accepted or rejected — adds an audit entry.

## 7. How validation and errors are handled
- Small helpers in `validators.js` (`requireText`, `requireOneOf`, `isValidEmail`) are used by constructors, setters and `validate()`.
- Custom errors in `errors.js` all extend `AppError`: `ValidationError`, `DuplicateError`, `NotFoundError`, `PermissionError`, `WorkflowError`, `StorageError`, `NotImplementedError`.
- `CampusServiceApp` wraps each menu action in one `try/catch` (`#safely`): an `AppError` prints `ERROR: <clear message>`; anything unexpected prints `UNEXPECTED ERROR`. The menu keeps running.
- Updates are validated completely before anything is applied (all-or-nothing).

## 8. How JSON data is stored and restored
- **Files (in `data/`):** `users.json`, `serviceRequests.json`, `requestHistory.json`, `auditLog.json`. Each holds an array of plain objects (strings, numbers, `null`; dates as ISO text). No code, passwords or real records.
- **Saving:** after each menu action that changes data, `CampusServiceApp` calls `DataStore.saveFrom(manager)`. It validates every user and request, converts objects with `toData()`, and calls `FileRepository.saveAll()`, which refuses records without an ID, duplicate IDs and non-JSON values, writes to `file.tmp`, then renames it over the real file (so a failed write cannot destroy good data).
- **Loading:** at start-up `DataStore.loadInto(manager)` reads the four files (a missing file becomes `[]`; an empty file is treated as `[]`), then rebuilds objects:
  1. `UserFactory.createFromData()` picks the subclass from `userType`.
  2. `ServiceRequestFactory.createFromData()` picks the subclass from `requestType` (`ICTSupportRequest`, ...), links the requester and Technician objects by ID, passes in the saved status, dates and history, and calls `validate()`.
  3. `AuditEntry.fromData()` restores audit records.
  4. `manager.restoreState()` replaces the manager's arrays (rejecting duplicates).
- Because objects are rebuilt through the real constructors, restored requests keep specialised validation, overridden methods and polymorphic behaviour.
- **Errors:** a broken or unreadable file raises `StorageError`; the app prints `FILE ERROR: ...` and stops, so a damaged file is never overwritten. A failed save prints a warning that the change is only in memory.

## 9. How tests are organised
Run with `npm test` (built-in `node:test`, no packages). Tests never touch `data/`: file tests create a temporary folder with `fs.mkdtemp(os.tmpdir())`.
| File | Tests | Covers |
|---|---|---|
| `tests/pass.test.js` | P1–P13 | Pass: construction, validation, duplicates, ownership, cancel, search, summary, complete console workflow |
| `tests/credit.test.js` | C1–C13 | Inheritance and `super()`, specialised validation, role permissions, status transitions, overriding, filter/sort, history |
| `tests/distinction.test.js` | D1–D15 | Abstract-style errors, polymorphism, audit trail, JSON save/load/restore, missing/empty/broken files, write errors, repositories, reports, console persistence, factories |

## 10. Known limitations and future improvements
| Limitation | Possible improvement |
|---|---|
| Users identify themselves by typing an ID; no passwords | Add login with hashed passwords |
| All four files are rewritten after each change | Write only changed records; add file locking |
| Console only; one user at a time | Add a web interface / REST API |
| No notifications | E-mail or SMS updates to requesters |
| A Resolved request cannot be re-opened | Add a *Reopened* status with officer approval |
| Target hours are fixed rules | Make them configurable; add real business-hours calendars |
| Reports print to the console | Export to CSV or PDF |
