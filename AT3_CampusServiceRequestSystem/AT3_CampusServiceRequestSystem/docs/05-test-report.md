# Test Report
**Student:** Obert MOSES — **Student ID:** 221338
**Command:** `npm test` (built-in Node.js test runner, Node v22.22.2)
**Result:** 41 of 41 automated tests passed, 0 failed.

Evidence: run `npm test`, take a screenshot of the summary (`# tests 41`, `# pass 41`, `# fail 0`) and paste it under *Evidence* below. Automated tests use temporary files in the operating-system temp folder and never change the real `data/` folder. The IDs match the test names in `tests/*.test.js`.

| Test ID | Feature tested | Test input | Expected result | Actual result | Pass / Fail |
|---|---|---|---|---|---|
| P1 | User registration | Register DWU2026001 Mary Kila with a valid e-mail | User added; findUserById returns "Mary Kila" | As expected | **Pass** |
| P2 | Duplicate user ID | Register a second user with an existing ID | DuplicateError; user count stays 2 | As expected | **Pass** |
| P3 | Request submission | Submit a valid ICT request | Stored with status Submitted | As expected | **Pass** |
| P4 | Invalid category | Create request with category "Catering" | ValidationError: Category "Catering" is not supported | As expected | **Pass** |
| P5 | View requester records | getRequestsByUser for one of two users | Only that user's request (REQ001) returned | As expected | **Pass** |
| P6 | Cancel request | Owner cancels a Submitted request | Status becomes Cancelled | As expected | **Pass** |
| P7 | User validation | Empty ID, blank names, e-mail "not-an-email" | ValidationError for each | As expected | **Pass** |
| P8 | Request validation | Duplicate request ID; empty title; empty description; priority "Critical" | DuplicateError / ValidationError for each | As expected | **Pass** |
| P9 | Ownership | Another user updates and cancels REQ001 | PermissionError; request unchanged | As expected | **Pass** |
| P10 | Cancelled is final | Cancel twice; update after cancel | "already Cancelled" error; WorkflowError | As expected | **Pass** |
| P11 | Update details | Valid title+priority change; then title + invalid category | First applied; second rejected and nothing changed (all-or-nothing) | As expected | **Pass** |
| P12 | Search and summary | Search "tap" and "req001"; status summary | Correct requests returned; Submitted 1, Cancelled 1 | As expected | **Pass** |
| P13 | Console workflow | Scripted menu: register, submit, view, search, update, cancel, summary, exit | Every step reports SUCCESS; final summary shows Cancelled 1 | As expected | **Pass** |
| C1 | User inheritance | Create Student, Staff, Officer, Technician subclasses | All are Users; userType set through super(); specialised info shown | As expected | **Pass** |
| C2 | Request inheritance | Create ICT and Cleaning requests | Subclasses of ServiceRequest; category fixed; status Submitted | As expected | **Pass** |
| C3 | Specialised validation | Bad fault type, empty device, bad hazard, bad time, year 9, empty speciality | ValidationError for each | As expected | **Pass** |
| C4 | Officer-only actions | Requester/Technician try review, priority, assign; Officer assigns a non-Technician | PermissionError / ValidationError; Officer succeeds | As expected | **Pass** |
| C5 | Assigned Technician only | Wrong Technician / Officer try start, note, resolve; Technician closes | PermissionError each time; correct users complete the workflow to Closed | As expected | **Pass** |
| C6 | Invalid transitions | Assign before review; close early; review twice; cancel a Reviewed request; update after review | WorkflowError each; status and technician unchanged | As expected | **Pass** |
| C7 | Final statuses | Review a Cancelled request; force Cancelled→Submitted | WorkflowError | As expected | **Pass** |
| C8 | Specialised summaries | getRequestSummary() on ICT, Maintenance, Cleaning | Each shows only its own specialised fields with correct values | As expected | **Pass** |
| C9 | Overriding | Score and target hours for ICT campus-wide, Maintenance critical, Cleaning high, General | Scores 70, 85, 75, 40; hours 4, 4, 6, 24 | As expected | **Pass** |
| C10 | Search / filter / sort | Search, filter by category, status, priority, technician, combined; sort by priority and date | Correct request IDs in correct order; invalid status rejected | As expected | **Pass** |
| C11 | Request history | Run the complete workflow | 8 history entries in order with correct previous/new status, actor and comment; rejected action adds none | As expected | **Pass** |
| C12 | Requester rules | Officer submits request; change category of ICT request; change title | PermissionError; ValidationError; title updated | As expected | **Pass** |
| C13 | Factory and notes | Factory with category "Catering"; progress note before work starts | ValidationError; WorkflowError | As expected | **Pass** |
| D1 | Abstract-style base class | Call the three required methods on a base ServiceRequest | NotImplementedError "must implement ..." for each | As expected | **Pass** |
| D2 | Polymorphism | One loop over ICT, Maintenance, Cleaning, General requests | Different summaries, scores 70/85/75/40, hours 4/4/6/24 | As expected | **Pass** |
| D3 | Invalid constructor values | Null requester, bad status, bad date, non-Technician assigned | ValidationError for each | As expected | **Pass** |
| D4 | Audit trail | Successful and rejected actions | Entries in order; rejected ones marked "Rejected"; unique audit IDs; all fields present | As expected | **Pass** |
| D5 | Administrator access | Administrator, student and unknown user open admin data | Allowed / PermissionError / NotFoundError | As expected | **Pass** |
| D6 | Saving JSON | Save a closed ICT request to a temp folder | 4 files, arrays of plain data; request type, technician, status and specialised data saved; 7 history records | As expected | **Pass** |
| D7 | Loading and restoring | Save 4 request types, reload into a new manager | Correct subclasses restored; history and technician kept; scores, hours and summaries still work; workflow continues | As expected | **Pass** |
| D8 | Missing / empty files | Load from a folder that does not exist; empty file; missing file | Empty arrays, no error; missing file is created | As expected | **Pass** |
| D9 | File-reading errors | Broken JSON; JSON that is not an array; invalid user record; unknown requester; unknown request type | StorageError with clear message; nothing loaded | As expected | **Pass** |
| D10 | File-writing errors | Save into a path blocked by a file; records with no ID, duplicate IDs, functions, Date objects | StorageError / ValidationError / DuplicateError; nothing written | As expected | **Pass** |
| D11 | Repositories | create, findById, findByRequester, findByTechnician, update, duplicate create, update unknown ID | Correct records; ID cannot be changed; errors for duplicate / not found | As expected | **Pass** |
| D12 | Report calculations | Mixed requests: status, category, priority, urgent, location, per-Technician, completed, average time, overdue | All numbers and orders correct | As expected | **Pass** |
| D13 | Reports on restored data | Reports on saved-then-loaded requests | Same results as on the original objects | As expected | **Pass** |
| D14 | Console persistence | Session 1 registers and submits; session 2 views it; corrupt users.json | Data reloaded in session 2; FILE ERROR shown and file not overwritten | As expected | **Pass** |
| D15 | Factories | Create/restore users and requests with unknown types or null | Correct classes; ValidationError for unknown types | As expected | **Pass** |

## Required-test cross-check (from the assignment brief)
| Brief requires | Covered by |
|---|---|
| Valid user registration; duplicate user ID | P1, P2 |
| Valid submission; invalid category; requester records; cancel | P3, P4, P5, P6 |
| Subclass constructors call `super()`; specialised fields validated | C1, C2, C3 |
| Only Officers assign; only assigned Technician progresses; invalid transitions | C4, C5, C6, C7 |
| Specialised summaries; search, filter, sort; request history | C8, C10, C11 |
| Constructor, duplicates, roles, transitions, specialised behaviour, polymorphism | P7–P10, C4–C9, D2, D3 |
| Saving, loading/restoring, missing/empty files, report calculations, file errors | D6, D7, D8, D12, D9, D10 |

## Evidence
*(Paste your screenshot of `npm test` here.)*
