# Requirements Document
**Project:** Campus Service Request Management System (IS305 AT3)
**Student:** Obert MOSES — **Student ID:** 221338

## 1. Project background
Students and staff at the campus currently report ICT problems, damaged facilities, cleaning needs and other service issues by telephone, informal conversations or handwritten notes. Nothing is recorded in one place, so nobody can easily see who is responsible for a problem, how far the work has progressed, or whether it was really fixed.

## 2. Problem statement
Without a central record, campus service requests are lost, duplicated or forgotten. Service Officers cannot assign work fairly, Technicians cannot see what they are responsible for, requesters cannot check progress, and management cannot measure performance.

## 3. Project objectives
1. Record every service request in one system with a unique ID, a category, a location and a priority.
2. Let requesters submit, view, update and cancel their own requests.
3. Let Service Officers review requests, set priority, assign a Technician and verify completion.
4. Let Technicians see their assigned work, add progress notes and resolve requests.
5. Enforce a controlled workflow so a request cannot skip steps or be changed by the wrong person.
6. Keep a history of every request and an audit trail of every action.
7. Keep data after the program closes (JSON files) and provide management reports.
8. Demonstrate object-oriented programming: classes, encapsulation, inheritance, polymorphism and abstraction.

## 4. Project scope
**In scope:** a Node.js console application; four request categories (ICT Support, Facilities Maintenance, Cleaning and Sanitation, General Campus Service); five user roles; the workflow Submitted → Reviewed → Assigned → In Progress → Resolved → Closed (or Cancelled); JSON file storage; nine management reports; automated tests.

**Out of scope:** databases (MongoDB, MySQL, SQLite, ...); a graphical or web interface; passwords and login security; e-mail or SMS notifications; multi-user access at the same time; real institutional data.

## 5. Actors and user roles
| Actor | Class | Responsibilities |
|---|---|---|
| Student or Staff Requester | `StudentRequester`, `StaffRequester` | Submit requests, view progress, update and cancel their own Submitted requests |
| Service Officer | `ServiceOfficer` | Review requests, set priority, assign a Technician, verify and close Resolved requests |
| Technician | `Technician` | View assigned requests, start work, add progress notes, resolve requests |
| System Administrator | `SystemAdministrator` | View audit history, users and management reports |

## 6. Functional requirements
| ID | Requirement |
|---|---|
| FR1 | The system shall register users; it shall reject missing IDs or names, invalid e-mail addresses and duplicate user IDs. |
| FR2 | The system shall let a registered Student or Staff requester submit a request with title, description, campus location, category and priority. |
| FR3 | The system shall reject missing titles/descriptions, unsupported categories, unsupported priorities and duplicate request IDs. |
| FR4 | Every new request shall have the status *Submitted*. |
| FR5 | The system shall show a request by ID, a requester's own requests, and all requests. |
| FR6 | A requester shall be able to update only their own Submitted request; another user's attempt shall be rejected. |
| FR7 | A requester shall be able to cancel only their own Submitted request; an already Cancelled request cannot be cancelled again. |
| FR8 | The system shall search requests by request ID or title. |
| FR9 | The system shall show a count of requests for every status. |
| FR10 | Each request type shall keep its own specialised data (ICT, Maintenance, Cleaning, General) and validate it. |
| FR11 | Only a Service Officer shall review requests, set priority, assign a Technician and close a Resolved request. |
| FR12 | Only the assigned Technician shall start work, add progress notes and resolve the request. |
| FR13 | The system shall allow only the status changes Submitted→Reviewed→Assigned→In Progress→Resolved→Closed, and Submitted→Cancelled; every other change shall be rejected. |
| FR14 | The system shall filter requests by category, status, priority and Technician, and sort by date submitted and priority. |
| FR15 | Every request shall keep a history (previous status, new status, action, actor, comment, date/time). |
| FR16 | The system shall calculate a priority score and a target resolution time that depend on the request type. |
| FR17 | The system shall save users, requests, request history and the audit log to JSON files and reload them when it starts. |
| FR18 | The system shall record an audit entry (ID, actor, action, request ID, description, time, outcome) for registration, creation, updates, priority changes, assignment, status changes, cancellation, resolution and closure — including rejected attempts. |
| FR19 | A System Administrator shall be able to run at least four management reports (nine are provided). |
| FR20 | The system shall show clear messages for invalid input and for file-reading or file-writing problems. |

## 7. Non-functional requirements
| ID | Requirement |
|---|---|
| NFR1 | **Usability:** numbered menus, prompts that list valid choices, and error messages that say what went wrong and how to fix it. |
| NFR2 | **Reliability:** invalid data is never stored; an invalid update changes nothing; a failed save leaves the old file intact (temporary file + rename). |
| NFR3 | **Maintainability:** one class per file; console menu, business rules and file access are in separate classes. |
| NFR4 | **Portability:** runs on any system with Node.js 20 or newer; no extra packages (only built-in modules). |
| NFR5 | **Security and privacy:** JSON files hold simulated data only — no passwords, code or confidential records. |
| NFR6 | **Testability:** at least 10 automated tests using the built-in Node.js test runner; tests use temporary files. |
| NFR7 | **Performance:** all operations finish instantly for the expected size (hundreds of requests). |

## 8. Assumptions and limitations
- A user identifies themselves by typing their user ID (no passwords) — this is a teaching system.
- One person uses the program at a time.
- All data is simulated.
- The whole JSON file set is rewritten after each change (fine for a small system).
- A request cannot be re-opened after it is Resolved, and only requesters can cancel (Submitted requests only).

## 9. User stories
1. As a **student**, I want to register and submit a request so that my problem is recorded.
2. As a **requester**, I want to view only my own requests so that I can check their progress.
3. As a **requester**, I want to update the description of my Submitted request so that the details are correct.
4. As a **requester**, I want to cancel my Submitted request if the problem goes away.
5. As a **Service Officer**, I want to review a request and set its priority so that urgent problems are handled first.
6. As a **Service Officer**, I want to assign a Technician so that someone is responsible for the work.
7. As a **Technician**, I want to see my assigned requests so that I know what work to do.
8. As a **Technician**, I want to add progress notes and resolve a request so that everyone can follow the work.
9. As a **Service Officer**, I want to verify and close a Resolved request so that only confirmed fixes are finished.
10. As a **System Administrator**, I want to read the audit log so that I can see who did what and when.
11. As a **System Administrator**, I want management reports (status, overdue, workload, resolution time) so that I can improve the service.
12. As any **user**, I want my data to be saved when I close the program so that nothing is lost.
