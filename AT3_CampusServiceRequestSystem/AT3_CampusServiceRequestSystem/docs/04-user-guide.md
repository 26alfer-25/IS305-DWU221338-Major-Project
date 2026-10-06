# User Guide
**Student:** Obert MOSES — **Student ID:** 221338

## 1. Installation requirements
- **Node.js 20 or newer** (download the LTS version from <https://nodejs.org>). Check with `node --version`.
- A terminal: Windows Terminal / Command Prompt / PowerShell, or the terminal inside Visual Studio Code.
- No other software or packages are needed (no database).

## 2. Setup instructions
1. Unzip the project (or clone the GitHub repository) and open a terminal **inside** the `AT3_CampusServiceRequestSystem` folder.
2. Run `npm install` (there are no dependencies, so it finishes at once and creates `package-lock.json`).
3. (Optional) Create fresh simulated demo data: `node scripts/generateSampleData.js`.

## 3. How to start the application
```
node src/CampusServiceApp.js
```
(or `npm start`). The program prints how many records it loaded, then shows the main menu. Type a number and press Enter. Choose **10** to exit. Data is saved automatically after every change.

Demo users created by the sample data: `DWU2026001` and `DWU2026002` (students), `STAFF001` (staff), `SO001` (Service Officer), `TECH001`–`TECH003` (Technicians), `ADM001` (Administrator).

## 4. How to register or select a user
There are no passwords. **Select** a user by typing their user ID whenever the program asks *"Your user ID"*. To **register**, choose **1**, then enter the user ID, names, e-mail address, user type and the extra field for that type (programme and year for a Student, department for Staff, service section for a Service Officer, speciality for a Technician, office for an Administrator).
```
Enter your choice (1-13): 1
User ID (e.g. DWU2026001): DWU2026001
First name: Mary
Last name: Kila
Email address: mary@example.com
User type:
  1. Student   2. Staff   3. Service Officer   4. Technician   5. Administrator
Choose user type: 1
Programme: BSc Information Systems
Year level (1-6): 2

SUCCESS: User registered.
User ID   : DWU2026001
Name      : Mary Kila
Email     : mary@example.com
User type : Student
Programme : BSc Information Systems (Year 2)
```

## 5. How to submit a request (Student or Staff)
Choose **2**. Enter your user ID, title, description and campus location, pick a category and a priority, then answer the questions for that category.
```
Choose category: 1        (ICT Support)
Choose priority (Enter = Medium): 3
Device type (e.g. Laptop): Laptop
System name (e.g. Campus Wi-Fi): Campus Wi-Fi
Choose fault type: 3      (Network)
Choose network impact: 3  (Department)

SUCCESS: Request submitted.
Request ID : REQ001
Title      : Unable to access campus Wi-Fi
Requester  : Mary Kila (DWU2026001)
Category   : ICT Support
Location   : Library Level 2
Priority   : High
Status     : Submitted
Technician : Not assigned
```
Other requester options: **3** view a request by ID (also shows its history), **4** view my requests, **6** update my Submitted request (press Enter to keep a value), **7** cancel my Submitted request.

## 6. How to assign and process a request
| Step | Who | Menu | Result |
|---|---|---|---|
| 1 | Service Officer | **11** → 1 *Review a request* | Submitted → Reviewed |
| 2 | Service Officer | **11** → 2 *Assign priority* | Priority set (Reviewed or Submitted only) |
| 3 | Service Officer | **11** → 3 *Assign Technician* | Reviewed → Assigned |
| 4 | Technician | **12** → 2 *Start work* | Assigned → In Progress |
| 5 | Technician | **12** → 3 *Add progress note* | Note saved in the history |
| 6 | Technician | **12** → 4 *Resolve request* | In Progress → Resolved |
| 7 | Service Officer | **11** → 4 *Verify and close* | Resolved → Closed |

Only the right role can do each step. Use **0** to leave a sub-menu. Technicians can see their work with **12** → 1.
```
Enter your choice (1-13): 11
--- SERVICE OFFICER MENU ---
 1. Review a request  2. Assign priority  3. Assign Technician
 4. Verify and close a Resolved request  5. Filter requests  6. Sort requests
 0. Back to main menu
Choose: 3
Your Service Officer ID: SO001
Request ID: REQ001
Technician user ID: TECH001

SUCCESS: Request REQ001 assigned to Daniel Aiwa. Status: Assigned.
```

## 7. How to search, filter, sort and generate reports
- **Search:** main menu **8**, then part of a request ID or title.
- **Summary by status:** main menu **9**.
- **Filter / sort:** Service Officer Menu (**11**) → 5 *Filter requests* (category, status, priority, Technician — leave blank to ignore) or 6 *Sort requests* (date submitted or priority, ascending or descending).
- **Reports and audit log (Administrator only):** main menu **13**, enter an Administrator ID.
  1. *View audit log* — who did what, when, and whether it succeeded or was rejected.
  2. *Management reports* — choose 1–9 or type `all`: by status, category, priority; urgent requests; overdue requests; requests per Technician; completed by Technician; average resolution time; volume by campus location.
  3. *View all users*.
  4. *Polymorphism demonstration* — one loop showing each request type's own summary, priority score and target hours.
```
=== Overdue requests ===
  REQ002 | open 30.0 h | target 12 h | overdue by 18.0 h | Broken door lock
  REQ003 | open 10.0 h | target 6 h | overdue by 4.0 h | Spill in the cafeteria
```

## 8. Example console screenshots
Take screenshots of your own runs (Windows: `Win + Shift + S`) and paste them into your submitted copy of this guide: (a) the main menu, (b) a successful registration, (c) a submitted request, (d) an error message, (e) a report, (f) the audit log, (g) `npm test` passing. The text blocks above show what they should look like.

## 9. Common errors and solutions
| Message | Cause | Solution |
|---|---|---|
| `ERROR: User ID "X" is already registered.` | Duplicate user ID | Use a different ID |
| `ERROR: Email address "..." is not valid.` | Missing `@` or domain | Enter e.g. `name@example.com` |
| `ERROR: Category "..." is not supported.` | Typed text not in the list | Pick the number from the list |
| `ERROR: User "X" is not registered.` | Unknown user ID | Register first (option 1) or check spelling |
| `ERROR: ... belongs to another user.` | You tried to change someone else's request | Use the ID of the request's owner |
| `ERROR: Only a Service Officer can ...` / `Only the assigned Technician can ...` | Wrong role for the step | Use a user of the required type (or the Technician who was assigned) |
| `ERROR: Invalid status change ... Allowed next status: ...` | Step done out of order | Follow the workflow in section 6 |
| `ERROR: ... is Reviewed and can no longer be updated.` | Only Submitted requests can be updated/cancelled | Submit a new request |
| `FILE ERROR: ... does not contain valid JSON` | A data file was edited by hand and broken | Fix the file, or delete the `data` files (or run `node scripts/generateSampleData.js`) |
| `FILE ERROR: Cannot write ...` | Folder is read-only or the disk is full | Check permissions/space; the change was **not** saved |
| `'node' is not recognized` | Node.js not installed / terminal opened before install | Install Node.js, then open a new terminal |
| `Cannot find module ...` | Terminal is in the wrong folder | `cd` into `AT3_CampusServiceRequestSystem` |
