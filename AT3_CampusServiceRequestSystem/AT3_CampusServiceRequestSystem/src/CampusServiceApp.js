'use strict';

const ServiceRequestManager = require('./services/ServiceRequestManager');
const ServiceRequestFactory = require('./factories/ServiceRequestFactory');
const UserFactory = require('./factories/UserFactory');
const { CATEGORIES, PRIORITIES, USER_TYPES, STATUS } = require('./utils/constants');
const ReportService = require('./services/ReportService');
const DataStore = require('./repositories/DataStore');
const { AppError, StorageError } = require('./utils/errors');
const { createConsolePrompter } = require('./utils/consolePrompter');

/** Thrown when the input stream ends (e.g. Ctrl+D) so the menu can stop cleanly. */
class InputClosed extends Error {}

const MENU = `
=====================================
   CAMPUS SERVICE REQUEST SYSTEM
=====================================
 1. Register User
 2. Submit Service Request
 3. View Request by ID
 4. View My Requests
 5. View All Requests
 6. Update My Request
 7. Cancel My Request
 8. Search Requests
 9. View Request Summary
10. Exit
-------------------------------------
11. Service Officer Menu
12. Technician Menu
13. Administrator Menu
-------------------------------------`;

/**
 * The console user interface. It only asks questions, calls the manager and
 * prints results - the business rules live in the other classes.
 */
class CampusServiceApp {
  #manager;
  #store;
  #reports;
  #ask;
  #write;

  /** store is optional: without it the app works in memory only (used by some tests). */
  constructor({ manager = new ServiceRequestManager(), store = null, ask, write = console.log } = {}) {
    this.#manager = manager;
    this.#store = store;
    this.#reports = new ReportService(manager);
    this.#ask = ask;
    this.#write = write;
  }

  async run() {
    if (!(await this.#loadSavedData())) return;
    try {
      let running = true;
      while (running) {
        this.#write(MENU);
        const choice = await this.#read('Enter your choice (1-13): ');
        running = await this.#handleChoice(choice);
      }
    } catch (error) {
      if (!(error instanceof InputClosed)) throw error;
    }
    this.#write('\nThank you for using the Campus Service Request System. Goodbye!');
  }

  // ---- menu dispatch ------------------------------------------------------
  async #handleChoice(choice) {
    const actions = {
      1: () => this.#registerUser(),
      2: () => this.#submitRequest(),
      3: () => this.#viewRequestById(),
      4: () => this.#viewMyRequests(),
      5: () => this.#viewAllRequests(),
      6: () => this.#updateMyRequest(),
      7: () => this.#cancelMyRequest(),
      8: () => this.#searchRequests(),
      9: () => this.#viewSummary(),
      11: () => this.#officerMenu(),
      12: () => this.#technicianMenu(),
      13: () => this.#administratorMenu(),
    };
    if (choice === '10') return false;
    const action = actions[choice];
    if (!action) {
      this.#write('Invalid choice. Please enter a number from 1 to 13.');
      return true;
    }
    await this.#safely(action);
    return true;
  }

  /** Runs one menu action and turns expected errors into clear messages. */
  async #safely(action) {
    try {
      await action();
    } catch (error) {
      if (error instanceof InputClosed) throw error;
      if (error instanceof AppError) this.#write(`\nERROR: ${error.message}`);
      else this.#write(`\nUNEXPECTED ERROR: ${error.message}`);
    }
  }

  async #runSubmenu(title, entries) {
    for (;;) {
      this.#write(`\n--- ${title} ---`);
      entries.forEach(([label], index) => this.#write(` ${index + 1}. ${label}`));
      this.#write(' 0. Back to main menu');
      const choice = await this.#read('Choose: ');
      if (choice === '0') return;
      const entry = entries[Number(choice) - 1];
      if (!entry) {
        this.#write('Invalid choice.');
        continue;
      }
      await this.#safely(entry[1]);
    }
  }

  // ---- Pass menu actions -----------------------------------------------------
  async #registerUser() {
    await this.#saving(() => this.#registerUserCore());
  }

  async #registerUserCore() {
    this.#write('\n--- Register User ---');
    const userId = await this.#read('User ID (e.g. DWU2026001): ');
    const firstName = await this.#read('First name: ');
    const lastName = await this.#read('Last name: ');
    const email = await this.#read('Email address: ');
    const userType = await this.#choose('User type', USER_TYPES);
    const specialised = await this.#promptFields(UserFactory.getSpecialisedFields(userType));
    const user = UserFactory.createUser({ userId, firstName, lastName, email, userType }, specialised);
    this.#manager.registerUser(user);
    this.#write(`\nSUCCESS: User registered.\n${user.displayInfo()}`);
  }

  async #submitRequest() {
    await this.#saving(() => this.#submitRequestCore());
  }

  async #submitRequestCore() {
    this.#write('\n--- Submit Service Request ---');
    const userId = await this.#read('Your user ID: ');
    const requester = this.#manager.findUserById(userId);
    if (!requester) {
      this.#write(`\nERROR: User "${userId}" is not registered. Register first (option 1).`);
      return;
    }
    const title = await this.#read('Title: ');
    const description = await this.#read('Description: ');
    const location = await this.#read('Campus location: ');
    const category = await this.#choose('Category', CATEGORIES);
    const priority = await this.#choose('Priority', PRIORITIES, 'Medium');
    const specialised = await this.#promptFields(ServiceRequestFactory.getSpecialisedFields(category));
    const request = ServiceRequestFactory.createRequest({
      requestId: this.#manager.getNextRequestId(),
      requester, title, description, location, category, priority,
    }, specialised);
    this.#manager.submitRequest(request);
    this.#write(`\nSUCCESS: Request submitted.\n${request.getRequestSummary()}`);
  }

  async #viewRequestById() {
    const requestId = await this.#read('Request ID: ');
    const request = this.#manager.findRequestById(requestId);
    if (!request) {
      this.#write(`\nNo request found with ID "${requestId}".`);
      return;
    }
    this.#write(`\n${request.getRequestSummary()}`);
    this.#printHistory(request);
  }

  async #viewMyRequests() {
    const userId = await this.#read('Your user ID: ');
    this.#printRequests(this.#manager.getRequestsByUser(userId), `Requests for ${userId}`);
  }

  async #viewAllRequests() {
    this.#printRequests(this.#manager.getAllRequests(), 'All requests');
  }

  async #updateMyRequest() {
    await this.#saving(() => this.#updateMyRequestCore());
  }

  async #updateMyRequestCore() {
    const userId = await this.#read('Your user ID: ');
    const requestId = await this.#read('Request ID to update: ');
    const existing = this.#manager.findRequestById(requestId);
    this.#write('Press Enter to keep the current value.');
    const changes = {};
    const title = await this.#read('New title: ');
    if (title) changes.title = title;
    const description = await this.#read('New description: ');
    if (description) changes.description = description;
    const location = await this.#read('New campus location: ');
    if (location) changes.location = location;
    if (!existing || existing.allowsCategoryChange()) {
      const category = await this.#choose('New category', CATEGORIES, '');
      if (category) changes.category = category;
    }
    const priority = await this.#choose('New priority', PRIORITIES, '');
    if (priority) changes.priority = priority;
    const request = this.#manager.updateRequest(requestId, userId, changes);
    this.#write(`\nSUCCESS: Request updated.\n${request.getRequestSummary()}`);
  }

  async #cancelMyRequest() {
    await this.#saving(() => this.#cancelMyRequestCore());
  }

  async #cancelMyRequestCore() {
    const userId = await this.#read('Your user ID: ');
    const requestId = await this.#read('Request ID to cancel: ');
    const request = this.#manager.cancelRequest(requestId, userId);
    this.#write(`\nSUCCESS: Request ${request.requestId} is now ${request.status}.`);
  }

  async #searchRequests() {
    const text = await this.#read('Search text (request ID or title): ');
    this.#printRequests(this.#manager.searchRequests(text), `Search results for "${text}"`);
  }

  async #viewSummary() {
    const totals = this.#manager.getRequestSummaryByStatus();
    this.#write('\n--- Request Summary by Status ---');
    for (const [status, count] of Object.entries(totals)) {
      this.#write(`${status.padEnd(12)}: ${count}`);
    }
  }

  // ---- Credit menus ------------------------------------------------------------
  async #officerMenu() {
    await this.#runSubmenu('SERVICE OFFICER MENU', [
      ['Review a request', () => this.#officerReview()],
      ['Assign priority', () => this.#officerPriority()],
      ['Assign Technician', () => this.#officerAssign()],
      ['Verify and close a Resolved request', () => this.#officerClose()],
      ['Filter requests', () => this.#filterRequests()],
      ['Sort requests', () => this.#sortRequests()],
    ]);
  }

  async #technicianMenu() {
    await this.#runSubmenu('TECHNICIAN MENU', [
      ['View my assigned requests', () => this.#techViewAssigned()],
      ['Start work', () => this.#techStart()],
      ['Add progress note', () => this.#techNote()],
      ['Resolve request', () => this.#techResolve()],
    ]);
  }

  async #officerReview() {
    await this.#saving(() => this.#officerReviewCore());
  }

  async #officerReviewCore() {
    const officerId = await this.#read('Your Service Officer ID: ');
    const requestId = await this.#read('Request ID to review: ');
    const comment = await this.#read('Comment (optional): ');
    const request = this.#manager.reviewRequest(requestId, officerId, comment || undefined);
    this.#write(`\nSUCCESS: Request ${request.requestId} is now ${request.status}.`);
  }

  async #officerPriority() {
    await this.#saving(() => this.#officerPriorityCore());
  }

  async #officerPriorityCore() {
    const officerId = await this.#read('Your Service Officer ID: ');
    const requestId = await this.#read('Request ID: ');
    const priority = await this.#choose('New priority', PRIORITIES);
    const request = this.#manager.setRequestPriority(requestId, officerId, priority);
    this.#write(`\nSUCCESS: Request ${request.requestId} priority is now ${request.priority}.`);
  }

  async #officerAssign() {
    await this.#saving(() => this.#officerAssignCore());
  }

  async #officerAssignCore() {
    const officerId = await this.#read('Your Service Officer ID: ');
    const requestId = await this.#read('Request ID: ');
    const technicianId = await this.#read('Technician user ID: ');
    const request = this.#manager.assignTechnician(requestId, officerId, technicianId);
    this.#write(`\nSUCCESS: Request ${request.requestId} assigned to ${request.assignedTechnician.getFullName()}. Status: ${request.status}.`);
  }

  async #officerClose() {
    await this.#saving(() => this.#officerCloseCore());
  }

  async #officerCloseCore() {
    const officerId = await this.#read('Your Service Officer ID: ');
    const requestId = await this.#read('Request ID to close: ');
    const request = this.#manager.closeRequest(requestId, officerId);
    this.#write(`\nSUCCESS: Request ${request.requestId} is now ${request.status}.`);
  }

  async #techViewAssigned() {
    const technicianId = await this.#read('Your Technician ID: ');
    const technician = this.#manager.findUserById(technicianId);
    if (!technician) {
      this.#write(`\nERROR: User "${technicianId}" is not registered.`);
      return;
    }
    this.#printRequests(this.#manager.getRequestsByTechnician(technicianId), `Requests assigned to ${technicianId}`);
  }

  async #techStart() {
    await this.#saving(() => this.#techStartCore());
  }

  async #techStartCore() {
    const technicianId = await this.#read('Your Technician ID: ');
    const requestId = await this.#read('Request ID: ');
    const request = this.#manager.startWork(requestId, technicianId);
    this.#write(`\nSUCCESS: Request ${request.requestId} is now ${request.status}.`);
  }

  async #techNote() {
    await this.#saving(() => this.#techNoteCore());
  }

  async #techNoteCore() {
    const technicianId = await this.#read('Your Technician ID: ');
    const requestId = await this.#read('Request ID: ');
    const note = await this.#read('Progress note: ');
    this.#manager.addProgressNote(requestId, technicianId, note);
    this.#write('\nSUCCESS: Progress note recorded.');
  }

  async #techResolve() {
    await this.#saving(() => this.#techResolveCore());
  }

  async #techResolveCore() {
    const technicianId = await this.#read('Your Technician ID: ');
    const requestId = await this.#read('Request ID: ');
    const comment = await this.#read('Resolution comment (optional): ');
    const request = this.#manager.resolveRequest(requestId, technicianId, comment || undefined);
    this.#write(`\nSUCCESS: Request ${request.requestId} is now ${request.status}.`);
  }

  async #filterRequests() {
    this.#write('Leave a filter blank to ignore it.');
    const category = await this.#choose('Category filter', CATEGORIES, '');
    const status = await this.#choose('Status filter', Object.values(STATUS), '');
    const priority = await this.#choose('Priority filter', PRIORITIES, '');
    const technicianId = await this.#read('Technician ID filter (blank = any): ');
    const results = this.#manager.filterRequests({ category, status, priority, technicianId });
    this.#printRequests(results, 'Filtered requests');
  }

  async #sortRequests() {
    const by = await this.#choose('Sort by', ['Date submitted', 'Priority']);
    const order = await this.#choose('Order', ['Ascending', 'Descending']);
    const direction = order.toLowerCase().startsWith('asc') ? 'asc' : 'desc';
    const sorted = by === 'Priority'
      ? this.#manager.sortByPriority(direction)
      : this.#manager.sortByDateSubmitted(direction);
    this.#printRequests(sorted, `Requests sorted by ${by.toLowerCase()} (${direction})`);
  }

  // ---- Distinction: administrator menu, audit trail, reports -------------------------
  async #administratorMenu() {
    await this.#runSubmenu('ADMINISTRATOR MENU', [
      ['View audit log', () => this.#adminAuditLog()],
      ['Management reports', () => this.#adminReports()],
      ['View all users', () => this.#adminUsers()],
      ['Polymorphism demonstration (all requests)', () => this.#adminPolymorphism()],
    ]);
  }

  async #adminAuditLog() {
    const adminId = await this.#read('Your Administrator ID: ');
    this.#manager.assertCanViewAdminData(adminId);
    const entries = this.#manager.getAuditLog();
    this.#write(`\n--- Audit log (${entries.length} records) ---`);
    entries.forEach((entry) => this.#write(entry.toString()));
  }

  async #adminUsers() {
    const adminId = await this.#read('Your Administrator ID: ');
    this.#manager.assertCanViewAdminData(adminId);
    const users = this.#manager.getAllUsers();
    this.#write(`\n--- All users (${users.length}) ---`);
    users.forEach((u) => this.#write(`\n${u.displayInfo()}`));
  }

  /** The same three method calls work for every request type - each one answers in its own way. */
  async #adminPolymorphism() {
    const adminId = await this.#read('Your Administrator ID: ');
    this.#manager.assertCanViewAdminData(adminId);
    const requests = this.#manager.getAllRequests();
    this.#write(`\n--- Polymorphism demonstration (${requests.length} requests) ---`);
    for (const request of requests) {
      this.#write(`\n[${request.constructor.name}]`);
      this.#write(request.getRequestSummary());
      this.#write(`Priority score          : ${request.calculatePriorityScore()}`);
      this.#write(`Target resolution hours : ${request.getTargetResolutionHours()}`);
    }
  }

  async #adminReports() {
    const adminId = await this.#read('Your Administrator ID: ');
    this.#manager.assertCanViewAdminData(adminId);
    const names = ReportService.REPORT_NAMES;
    this.#write('\nAvailable reports:');
    names.forEach((name, index) => this.#write(`  ${index + 1}. ${name}`));
    const answer = await this.#read(`Choose a report (1-${names.length}, or "all"): `);
    const chosen = answer.toLowerCase() === 'all' ? names.map((_, i) => i) : [Number(answer) - 1];
    if (chosen.some((i) => !Number.isInteger(i) || i < 0 || i >= names.length)) {
      this.#write('Invalid report number.');
      return;
    }
    chosen.forEach((i) => this.#printReport(i));
  }

  #printReport(index) {
    const reports = this.#reports;
    const counts = (obj) => Object.entries(obj).forEach(([key, value]) => this.#write(`  ${key.padEnd(26)}: ${value}`));
    const hours = (n) => `${n.toFixed(1)} h`;
    this.#write(`\n=== ${ReportService.REPORT_NAMES[index]} ===`);
    switch (index) {
      case 0: counts(reports.requestsByStatus()); break;
      case 1: counts(reports.requestsByCategory()); break;
      case 2: counts(reports.requestsByPriority()); break;
      case 3: {
        const rows = reports.urgentRequests();
        if (rows.length === 0) this.#write('  No urgent open requests.');
        rows.forEach(({ request, score }) =>
          this.#write(`  ${request.requestId} | score ${score} | ${request.priority} | ${request.status} | ${request.title}`));
        break;
      }
      case 4: {
        const rows = reports.overdueRequests();
        if (rows.length === 0) this.#write('  No overdue requests.');
        rows.forEach(({ request, hoursOpen, targetHours, hoursOverdue }) =>
          this.#write(`  ${request.requestId} | open ${hours(hoursOpen)} | target ${targetHours} h | overdue by ${hours(hoursOverdue)} | ${request.title}`));
        break;
      }
      case 5: {
        const rows = reports.requestsPerTechnician();
        if (rows.length === 0) this.#write('  No requests are assigned yet.');
        rows.forEach((r) => this.#write(`  ${r.technicianId} ${r.name}: ${r.total} assigned, ${r.open} still open`));
        break;
      }
      case 6: {
        const rows = reports.completedByTechnician();
        if (rows.length === 0) this.#write('  No completed requests yet.');
        rows.forEach((r) => this.#write(`  ${r.technicianId} ${r.name}: ${r.completed} completed (${r.requestIds.join(', ')})`));
        break;
      }
      case 7: {
        const result = reports.averageResolutionTime();
        this.#write(`  Resolved requests: ${result.count}`);
        this.#write(`  Average resolution time: ${hours(result.averageHours)}`);
        result.byCategory.forEach((c) => this.#write(`    ${c.category.padEnd(26)}: ${hours(c.averageHours)} (${c.count})`));
        break;
      }
      default:
        reports.volumeByLocation().forEach((row) => this.#write(`  ${row.location.padEnd(26)}: ${row.count}`));
    }
  }

  // ---- saving and loading (through DataStore; the app never touches files) ------------
  async #loadSavedData() {
    if (!this.#store) return true;
    try {
      const counts = await this.#store.loadInto(this.#manager);
      this.#write(`Loaded ${counts.users} users, ${counts.requests} requests and ${counts.audit} audit records from "${this.#store.dataDir}".`);
      return true;
    } catch (error) {
      if (!(error instanceof StorageError)) throw error;
      this.#write(`\nFILE ERROR: ${error.message}`);
      this.#write('The program stopped so your saved data is not overwritten. Fix or remove the file and start again.');
      return false;
    }
  }

  /** Runs a change, then saves. Saved even when the change was rejected, so the audit trail keeps the attempt. */
  async #saving(action) {
    try {
      await action();
    } finally {
      await this.#save();
    }
  }

  async #save() {
    if (!this.#store) return;
    try {
      await this.#store.saveFrom(this.#manager);
    } catch (error) {
      if (!(error instanceof StorageError)) throw error;
      this.#write(`\nFILE ERROR: ${error.message}`);
      this.#write('WARNING: the last change is in memory but was NOT saved to disk.');
    }
  }

  // ---- helpers ------------------------------------------------------------
  async #read(label) {
    const answer = await this.#ask(label);
    if (answer === null || answer === undefined) throw new InputClosed();
    return answer.trim();
  }

  /** Shows a numbered list; accepts the number or the exact text. */
  async #choose(label, options, defaultValue) {
    this.#write(`${label}:`);
    options.forEach((option, index) => this.#write(`  ${index + 1}. ${option}`));
    const hint = defaultValue !== undefined ? ` (Enter = ${defaultValue || 'skip'})` : '';
    const answer = await this.#read(`Choose ${label.toLowerCase()}${hint}: `);
    if (answer === '' && defaultValue !== undefined) return defaultValue;
    const byNumber = options[Number(answer) - 1];
    return byNumber ?? answer;        // unknown text is rejected later by validation
  }

  /** Asks for each specialised field: [key, label, allowedValues|null]. */
  async #promptFields(fields) {
    const values = {};
    for (const [key, label, allowed] of fields) {
      values[key] = allowed ? await this.#choose(label, allowed) : await this.#read(`${label}: `);
    }
    return values;
  }

  #printRequests(requests, heading) {
    this.#write(`\n--- ${heading} (${requests.length}) ---`);
    if (requests.length === 0) {
      this.#write('No requests found.');
      return;
    }
    requests.forEach((r) => this.#write(`\n${r.getRequestSummary()}`));
  }

  #printHistory(request) {
    this.#write('\n--- Request history ---');
    request.getHistory().forEach((h) => {
      const change = h.previousStatus ? `${h.previousStatus} -> ${h.newStatus}` : `(new) -> ${h.newStatus}`;
      this.#write(`${h.timestamp.toLocaleString()} | ${change} | ${h.action} | ${h.actorId} (${h.actorRole}) | ${h.comment}`);
    });
  }
}

if (require.main === module) {
  const prompter = createConsolePrompter();
  new CampusServiceApp({ store: new DataStore(process.env.CAMPUS_DATA_DIR || undefined), ask: prompter.ask })
    .run()
    .catch((error) => {
      console.error(`Fatal error: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(() => prompter.close());
}

module.exports = CampusServiceApp;
