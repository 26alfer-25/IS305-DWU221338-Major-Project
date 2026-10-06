'use strict';

const User = require('../models/User');
const ServiceRequest = require('../models/ServiceRequest');
const AuditEntry = require('../models/AuditEntry');
const { STATUS, CATEGORIES, PRIORITIES, PRIORITY_WEIGHT } = require('../utils/constants');
const {
  AppError, ValidationError, DuplicateError, NotFoundError, PermissionError,
} = require('../utils/errors');
const { isNonEmptyString, requireOneOf } = require('../utils/validators');

/**
 * Keeps every user and request in JavaScript arrays and enforces the
 * business rules: no duplicates, only the owner may change a request,
 * and only the right role may perform each workflow step.
 * Every action (successful or rejected) is written to the audit log.
 */
class ServiceRequestManager {
  #users = [];
  #requests = [];
  #auditLog = [];

  // ---- users ------------------------------------------------------------
  registerUser(user) {
    if (!(user instanceof User)) {
      throw new ValidationError('Only User objects can be registered.');
    }
    return this.#audited({
      actorId: user.userId,
      actorRole: user.userType,
      action: 'User Registered',
      description: `Registered ${user.userType} ${user.getFullName()}.`,
    }, () => {
      user.validate();
      if (this.findUserById(user.userId)) {
        throw new DuplicateError(`User ID "${user.userId}" is already registered.`);
      }
      this.#users.push(user);
      return user;
    });
  }

  findUserById(userId) {
    return this.#users.find((u) => u.userId === userId) ?? null;
  }

  getAllUsers() {
    return [...this.#users];
  }

  // ---- requests (Pass) ----------------------------------------------------
  submitRequest(request) {
    if (!(request instanceof ServiceRequest)) {
      throw new ValidationError('Only ServiceRequest objects can be submitted.');
    }
    return this.#audited({
      actorId: request.requester.userId,
      action: 'Request Created',
      requestId: request.requestId,
      description: `Submitted "${request.title}" (${request.category}).`,
    }, () => {
      request.validate();
      const requester = this.findUserById(request.requester.userId);
      if (!requester) {
        throw new NotFoundError(`Requester "${request.requester.userId}" is not registered.`);
      }
      if (!requester.canSubmitRequests()) {
        throw new PermissionError('Only a Student or Staff requester can submit service requests.');
      }
      if (this.findRequestById(request.requestId)) {
        throw new DuplicateError(`Request ID "${request.requestId}" already exists.`);
      }
      this.#requests.push(request);
      return request;
    });
  }

  findRequestById(requestId) {
    return this.#requests.find((r) => r.requestId === requestId) ?? null;
  }

  getRequestsByUser(userId) {
    if (!this.findUserById(userId)) {
      throw new NotFoundError(`User "${userId}" is not registered.`);
    }
    return this.#requests.filter((r) => r.requester.userId === userId);
  }

  getAllRequests() {
    return [...this.#requests];
  }

  updateRequest(requestId, userId, changes) {
    return this.#audited({
      actorId: userId,
      action: 'Request Updated',
      requestId,
      description: `Updated ${Object.keys(changes ?? {}).join(', ') || 'details'}.`,
    }, () => {
      const request = this.#requireRequest(requestId);
      this.#requireOwner(request, userId, 'update');
      return request.updateDetails(changes, request.requester);
    });
  }

  cancelRequest(requestId, userId) {
    return this.#audited({
      actorId: userId,
      action: 'Request Cancelled',
      requestId,
      description: 'Requester cancelled the request.',
    }, () => {
      const request = this.#requireRequest(requestId);
      this.#requireOwner(request, userId, 'cancel');
      return request.cancelRequest(request.requester);
    });
  }

  searchRequests(searchText) {
    if (!isNonEmptyString(searchText)) {
      throw new ValidationError('Search text cannot be empty.');
    }
    const text = searchText.trim().toLowerCase();
    return this.#requests.filter(
      (r) => r.requestId.toLowerCase().includes(text) || r.title.toLowerCase().includes(text)
    );
  }

  /** Returns e.g. { Submitted: 3, Assigned: 1, ... } using reduce(). */
  getRequestSummaryByStatus() {
    const empty = Object.fromEntries(Object.values(STATUS).map((s) => [s, 0]));
    return this.#requests.reduce((totals, r) => {
      totals[r.status] += 1;
      return totals;
    }, empty);
  }

  /** Suggests the next free ID: REQ001, REQ002, ... */
  getNextRequestId() {
    let n = this.#requests.length + 1;
    while (this.findRequestById(`REQ${String(n).padStart(3, '0')}`)) n += 1;
    return `REQ${String(n).padStart(3, '0')}`;
  }

  // ---- workflow (Credit) --------------------------------------------------
  /** Service Officer reviews a Submitted request. */
  reviewRequest(requestId, officerId, comment = 'Request reviewed.') {
    return this.#workflowStep(officerId, requestId, 'Status Changed', 'Status', (request) => {
      const officer = this.#requireOfficer(officerId, 'review requests');
      return request.transitionTo(STATUS.REVIEWED, { actor: officer, action: 'Request Reviewed', comment });
    });
  }

  /** Service Officer sets the priority (before the request is assigned). */
  setRequestPriority(requestId, officerId, priority, comment = '') {
    return this.#workflowStep(officerId, requestId, 'Priority Changed', 'Priority', (request) => {
      const officer = this.#requireOfficer(officerId, 'assign priorities');
      return request.assignPriority(priority, officer, comment);
    });
  }

  /** Service Officer assigns a Technician to a Reviewed request. */
  assignTechnician(requestId, officerId, technicianId, comment = '') {
    return this.#workflowStep(officerId, requestId, 'Technician Assigned', 'Technician', (request) => {
      const officer = this.#requireOfficer(officerId, 'assign Technicians');
      const technician = this.findUserById(technicianId);
      if (!technician) {
        throw new NotFoundError(`Technician "${technicianId}" is not registered.`);
      }
      return request.assignTechnician(technician, officer, comment);
    });
  }

  /** The assigned Technician starts work. */
  startWork(requestId, technicianId, comment = 'Work started.') {
    return this.#workflowStep(technicianId, requestId, 'Status Changed', 'Status', (request) => {
      const technician = this.#requireAssignedTechnician(request, technicianId, 'start work on');
      return request.transitionTo(STATUS.IN_PROGRESS, { actor: technician, action: 'Work Started', comment });
    });
  }

  /** The assigned Technician records a progress update. */
  addProgressNote(requestId, technicianId, note) {
    return this.#workflowStep(technicianId, requestId, 'Progress Note Added', 'Note', (request) => {
      const technician = this.#requireAssignedTechnician(request, technicianId, 'add progress notes to');
      return request.addProgressNote(note, technician);
    });
  }

  /** The assigned Technician resolves the request. */
  resolveRequest(requestId, technicianId, comment = 'Work completed.') {
    return this.#workflowStep(technicianId, requestId, 'Request Resolved', 'Status', (request) => {
      const technician = this.#requireAssignedTechnician(request, technicianId, 'resolve');
      return request.transitionTo(STATUS.RESOLVED, { actor: technician, action: 'Request Resolved', comment });
    });
  }

  /** Service Officer verifies and closes a Resolved request. */
  closeRequest(requestId, officerId, comment = 'Resolution verified.') {
    return this.#workflowStep(officerId, requestId, 'Request Closed', 'Status', (request) => {
      const officer = this.#requireOfficer(officerId, 'close requests');
      return request.transitionTo(STATUS.CLOSED, { actor: officer, action: 'Request Closed', comment });
    });
  }

  // ---- filter, sort ----------------------------------------------------------
  getRequestsByTechnician(technicianId) {
    return this.#requests.filter((r) => r.assignedTechnician?.userId === technicianId);
  }

  /** Any combination of category, status, priority and technicianId. Blank criteria are ignored. */
  filterRequests({ category, status, priority, technicianId } = {}) {
    if (category) requireOneOf(category, CATEGORIES, 'Category');
    if (status) requireOneOf(status, Object.values(STATUS), 'Status');
    if (priority) requireOneOf(priority, PRIORITIES, 'Priority');
    return this.#requests
      .filter((r) => !category || r.category === category)
      .filter((r) => !status || r.status === status)
      .filter((r) => !priority || r.priority === priority)
      .filter((r) => !technicianId || r.assignedTechnician?.userId === technicianId);
  }

  /** order: 'asc' = oldest first, 'desc' = newest first. Returns a new sorted array. */
  sortByDateSubmitted(order = 'asc', requests = this.#requests) {
    const direction = order === 'desc' ? -1 : 1;
    return [...requests].sort((a, b) => direction * (a.dateSubmitted - b.dateSubmitted));
  }

  /** order: 'desc' = most important first (default). Ties keep the older request first. */
  sortByPriority(order = 'desc', requests = this.#requests) {
    const direction = order === 'asc' ? 1 : -1;
    return [...requests].sort(
      (a, b) => direction * (PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority])
        || (a.dateSubmitted - b.dateSubmitted)
    );
  }

  // ---- audit trail and administrator access (Distinction) ------------------------
  getAuditLog() {
    return [...this.#auditLog];
  }

  getAuditEntriesForRequest(requestId) {
    return this.#auditLog.filter((entry) => entry.requestId === requestId);
  }

  /** Reports and the audit log are only for System Administrators. */
  assertCanViewAdminData(userId) {
    const user = this.findUserById(userId);
    if (!user) {
      throw new NotFoundError(`User "${userId}" is not registered.`);
    }
    if (!user.canViewAdminData()) {
      throw new PermissionError(`Only a System Administrator can view this. "${userId}" is a ${user.userType}.`);
    }
    return user;
  }

  /** Replaces everything with objects restored from the JSON files. Used once at start-up. */
  restoreState({ users = [], requests = [], auditEntries = [] } = {}) {
    const assertUnique = (items, idOf, label) => {
      const ids = new Set();
      for (const item of items) {
        if (ids.has(idOf(item))) throw new DuplicateError(`Saved data contains ${label} "${idOf(item)}" twice.`);
        ids.add(idOf(item));
      }
    };
    if (!users.every((u) => u instanceof User) || !requests.every((r) => r instanceof ServiceRequest)
      || !auditEntries.every((a) => a instanceof AuditEntry)) {
      throw new ValidationError('Restored data must contain User, ServiceRequest and AuditEntry objects.');
    }
    assertUnique(users, (u) => u.userId, 'user');
    assertUnique(requests, (r) => r.requestId, 'request');
    assertUnique(auditEntries, (a) => a.auditId, 'audit record');
    this.#users = [...users];
    this.#requests = [...requests];
    this.#auditLog = [...auditEntries];
  }

  // ---- private helpers --------------------------------------------------
  #requireRequest(requestId) {
    const request = this.findRequestById(requestId);
    if (!request) {
      throw new NotFoundError(`Request "${requestId}" was not found.`);
    }
    return request;
  }

  #requireOwner(request, userId, action) {
    if (request.requester.userId !== userId) {
      throw new PermissionError(`User "${userId}" cannot ${action} request ${request.requestId} because it belongs to another user.`);
    }
  }

  #requireOfficer(officerId, action) {
    const officer = this.findUserById(officerId);
    if (!officer) {
      throw new NotFoundError(`User "${officerId}" is not registered.`);
    }
    if (!officer.canManageRequests()) {
      throw new PermissionError(`Only a Service Officer can ${action}. "${officerId}" is a ${officer.userType}.`);
    }
    return officer;
  }

  #requireAssignedTechnician(request, technicianId, action) {
    const technician = this.findUserById(technicianId);
    if (!technician) {
      throw new NotFoundError(`User "${technicianId}" is not registered.`);
    }
    if (!technician.canWorkOnRequests() || request.assignedTechnician?.userId !== technicianId) {
      throw new PermissionError(`Only the assigned Technician can ${action} request ${request.requestId}.`);
    }
    return technician;
  }

  /** Finds the request, runs one workflow step and audits it with a before/after description. */
  #workflowStep(actorId, requestId, action, what, perform) {
    let before = null;
    return this.#audited({
      actorId,
      action,
      requestId,
      description: (request) => this.#describeChange(what, before, request),
    }, () => {
      const request = this.#requireRequest(requestId);
      before = {
        status: request.status,
        priority: request.priority,
        technician: request.assignedTechnician?.userId ?? 'nobody',
        notes: request.getHistory().length,
      };
      return perform(request);
    });
  }

  #describeChange(what, before, request) {
    switch (what) {
      case 'Priority': return `Priority ${before.priority} -> ${request.priority}.`;
      case 'Technician': return `Assigned to ${request.assignedTechnician.userId}; status ${before.status} -> ${request.status}.`;
      case 'Note': return 'Technician recorded a progress note.';
      default: return `Status ${before.status} -> ${request.status}.`;
    }
  }

  /** Runs an operation and records the outcome (Success or Rejected) in the audit log. */
  #audited({ actorId, actorRole, action, requestId = null, description }, operation) {
    const role = actorRole ?? this.findUserById(actorId)?.userType ?? 'Unknown';
    try {
      const result = operation();
      const text = typeof description === 'function' ? description(result) : description;
      this.#addAudit({ actorId, actorRole: role, action, requestId, description: text, outcome: 'Success' });
      return result;
    } catch (error) {
      if (error instanceof AppError) {
        const text = typeof description === 'string' ? description : `${action} was attempted.`;
        this.#addAudit({ actorId, actorRole: role, action, requestId, description: text, outcome: `Rejected - ${error.message}` });
      }
      throw error;
    }
  }

  #addAudit({ actorId, actorRole, action, requestId, description, outcome }) {
    try {
      const auditId = `AUD${String(this.#auditLog.length + 1).padStart(5, '0')}`;
      this.#auditLog.push(new AuditEntry({
        auditId,
        actorId: actorId || 'unknown',
        actorRole,
        action,
        requestId: requestId || null,
        description,
        outcome,
      }));
    } catch {
      // A problem while writing the audit entry must never hide the real result.
    }
  }
}

module.exports = ServiceRequestManager;
