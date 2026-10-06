'use strict';

const User = require('./User');
const { ValidationError, WorkflowError, NotImplementedError } = require('../utils/errors');
const {
  CATEGORIES, PRIORITIES, PRIORITY_WEIGHT, PRIORITY_TARGET_HOURS, STATUS, STATUS_TRANSITIONS,
} = require('../utils/constants');
const { requireText, requireOneOf } = require('../utils/validators');

const EDITABLE_FIELDS = ['title', 'description', 'location', 'category', 'priority'];

/**
 * Abstract-style base class for every campus service request.
 * It holds the data and workflow rules every request shares, but it does NOT
 * know how to score, time or summarise a request: getRequestSummary(),
 * calculatePriorityScore() and getTargetResolutionHours() throw a clear error
 * until a subclass (ICTSupportRequest, MaintenanceRequest, CleaningRequest,
 * GeneralServiceRequest) supplies the behaviour.
 */
class ServiceRequest {
  #requestId;
  #requester;
  #title;
  #description;
  #location;
  #category;
  #priority;
  #status;
  #dateSubmitted;
  #dateUpdated;
  #assignedTechnician = null;
  #history = [];

  /**
   * The optional fields below (status ... history) are used when a saved request
   * is restored from JSON. A brand-new request leaves them out.
   */
  constructor({
    requestId, requester, title, description, location, category, priority = 'Medium',
    status, dateSubmitted, dateUpdated, assignedTechnician = null, history,
  } = {}) {
    if (!(requester instanceof User)) {
      throw new ValidationError('A request must have a valid requester (User object).');
    }
    this.#requestId = requireText(requestId, 'Request ID');
    this.#requester = requester;
    this.#title = requireText(title, 'Title');
    this.#description = requireText(description, 'Description');
    this.#location = requireText(location, 'Campus location');
    this.#category = requireOneOf(category, CATEGORIES, 'Category');
    this.#priority = requireOneOf(priority, PRIORITIES, 'Priority');
    this.#status = status === undefined ? STATUS.SUBMITTED : requireOneOf(status, Object.values(STATUS), 'Status');
    this.#dateSubmitted = dateSubmitted === undefined ? new Date() : ServiceRequest.#toDate(dateSubmitted, 'Date submitted');
    this.#dateUpdated = dateUpdated === undefined ? new Date(this.#dateSubmitted) : ServiceRequest.#toDate(dateUpdated, 'Date updated');
    if (assignedTechnician !== null && assignedTechnician !== undefined) {
      if (!(assignedTechnician instanceof User) || !assignedTechnician.canWorkOnRequests()) {
        throw new ValidationError('The assigned Technician must be a Technician user.');
      }
      this.#assignedTechnician = assignedTechnician;
    }
    if (history === undefined) {
      this.#record(null, STATUS.SUBMITTED, 'Request Submitted', requester, 'Request submitted by requester.');
    } else {
      this.#history = history.map((entry) => ServiceRequest.#normaliseHistoryEntry(entry));
    }
  }

  static #toDate(value, field) {
    const date = value instanceof Date ? new Date(value) : new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      throw new ValidationError(`${field} "${value}" is not a valid date.`);
    }
    return date;
  }

  static #normaliseHistoryEntry(entry) {
    if (entry === null || typeof entry !== 'object') {
      throw new ValidationError('A history entry must be an object.');
    }
    if (entry.previousStatus !== null && entry.previousStatus !== undefined) {
      requireOneOf(entry.previousStatus, Object.values(STATUS), 'History previous status');
    }
    return {
      previousStatus: entry.previousStatus ?? null,
      newStatus: requireOneOf(entry.newStatus, Object.values(STATUS), 'History new status'),
      action: requireText(entry.action, 'History action'),
      actorId: requireText(entry.actorId, 'History actor ID'),
      actorRole: requireText(entry.actorRole, 'History actor role'),
      comment: entry.comment ?? '',
      timestamp: ServiceRequest.#toDate(entry.timestamp, 'History time'),
    };
  }

  // ---- getters ----------------------------------------------------------
  get requestId() { return this.#requestId; }
  get requester() { return this.#requester; }
  get title() { return this.#title; }
  get description() { return this.#description; }
  get location() { return this.#location; }
  get category() { return this.#category; }
  get priority() { return this.#priority; }
  get status() { return this.#status; }
  get assignedTechnician() { return this.#assignedTechnician; }
  get dateSubmitted() { return new Date(this.#dateSubmitted); }
  get dateUpdated() { return new Date(this.#dateUpdated); }

  // ---- controlled setters (each one validates and stamps dateUpdated) ----
  set title(v) { this.#title = requireText(v, 'Title'); this.#touch(); }
  set description(v) { this.#description = requireText(v, 'Description'); this.#touch(); }
  set location(v) { this.#location = requireText(v, 'Campus location'); this.#touch(); }
  set category(v) { this.#category = requireOneOf(v, CATEGORIES, 'Category'); this.#touch(); }
  set priority(v) { this.#priority = requireOneOf(v, PRIORITIES, 'Priority'); this.#touch(); }

  #touch() {
    this.#dateUpdated = new Date();
  }

  /** Adds one entry to the history array (previous status, new status, action, actor, comment, time). */
  #record(previousStatus, newStatus, action, actor, comment) {
    this.#history.push({
      previousStatus,
      newStatus,
      action,
      actorId: actor.userId,
      actorRole: actor.userType,
      comment: comment ?? '',
      timestamp: new Date(),
    });
    this.#touch();
  }

  /** Checks the whole object. Throws ValidationError when something is wrong. */
  validate() {
    if (!(this.#requester instanceof User)) {
      throw new ValidationError('A request must have a valid requester (User object).');
    }
    requireText(this.#requestId, 'Request ID');
    requireText(this.#title, 'Title');
    requireText(this.#description, 'Description');
    requireText(this.#location, 'Campus location');
    requireOneOf(this.#category, CATEGORIES, 'Category');
    requireOneOf(this.#priority, PRIORITIES, 'Priority');
    requireOneOf(this.#status, Object.values(STATUS), 'Status');
    const needsTechnician = [STATUS.ASSIGNED, STATUS.IN_PROGRESS, STATUS.RESOLVED, STATUS.CLOSED];
    if (needsTechnician.includes(this.#status) && !this.#assignedTechnician) {
      throw new ValidationError(`Request ${this.#requestId} is ${this.#status} but has no assigned Technician.`);
    }
    this.validateSpecialisedFields();
    return true;
  }

  /** Subclasses override this to check their own fields. */
  validateSpecialisedFields() {
    return true;
  }

  /** Subclasses whose category is fixed by their type return false. */
  allowsCategoryChange() {
    return true;
  }

  /**
   * Changes title, description, location, category or priority.
   * Only allowed while the request is still Submitted. All changes are
   * checked first so a bad value cannot leave the request half-updated.
   */
  updateDetails(changes = {}, actor = this.#requester) {
    if (this.#status !== STATUS.SUBMITTED) {
      throw new WorkflowError(`Request ${this.#requestId} is ${this.#status} and can no longer be updated.`);
    }
    const keys = Object.keys(changes);
    if (keys.length === 0) {
      throw new ValidationError('No changes were supplied.');
    }
    const unknown = keys.filter((k) => !EDITABLE_FIELDS.includes(k));
    if (unknown.length > 0) {
      throw new ValidationError(`These fields cannot be updated: ${unknown.join(', ')}.`);
    }
    if ('category' in changes && changes.category !== this.#category && !this.allowsCategoryChange()) {
      throw new ValidationError(`The category of a ${this.constructor.name} cannot be changed. Submit a new request instead.`);
    }
    // 1. validate everything first
    if ('title' in changes) requireText(changes.title, 'Title');
    if ('description' in changes) requireText(changes.description, 'Description');
    if ('location' in changes) requireText(changes.location, 'Campus location');
    if ('category' in changes) requireOneOf(changes.category, CATEGORIES, 'Category');
    if ('priority' in changes) requireOneOf(changes.priority, PRIORITIES, 'Priority');
    // 2. then apply
    for (const key of keys) {
      this[key] = changes[key];
    }
    this.#record(this.#status, this.#status, 'Details Updated', actor, `Updated: ${keys.join(', ')}.`);
    return this;
  }

  cancelRequest(actor = this.#requester) {
    if (this.#status === STATUS.CANCELLED) {
      throw new WorkflowError(`Request ${this.#requestId} is already Cancelled.`);
    }
    if (this.#status !== STATUS.SUBMITTED) {
      throw new WorkflowError(`Request ${this.#requestId} is ${this.#status}. Only Submitted requests can be cancelled.`);
    }
    return this.transitionTo(STATUS.CANCELLED, { actor, action: 'Request Cancelled', comment: 'Cancelled by requester.' });
  }

  // ---- controlled workflow ---------------------------------------------------
  /** Moves the request to a new status only if the workflow allows it. */
  transitionTo(newStatus, { actor, action, comment = '' } = {}) {
    requireOneOf(newStatus, Object.values(STATUS), 'Status');
    if (!(actor instanceof User)) {
      throw new ValidationError('A status change must name the user who performed it.');
    }
    this.#assertTransition(newStatus);
    const previous = this.#status;
    this.#status = newStatus;
    this.#record(previous, newStatus, action ?? `Status changed to ${newStatus}`, actor, comment);
    return this;
  }

  #assertTransition(newStatus) {
    const allowed = STATUS_TRANSITIONS[this.#status];
    if (!allowed.includes(newStatus)) {
      throw new WorkflowError(
        `Invalid status change for ${this.#requestId}: ${this.#status} -> ${newStatus}. ` +
        `Allowed next status: ${allowed.length ? allowed.join(', ') : 'none (final status)'}.`
      );
    }
  }

  /** Officer sets the priority while the request is Submitted or Reviewed. */
  assignPriority(priority, actor, comment = '') {
    if (![STATUS.SUBMITTED, STATUS.REVIEWED].includes(this.#status)) {
      throw new WorkflowError(`Priority cannot be changed while the request is ${this.#status}.`);
    }
    this.#priority = requireOneOf(priority, PRIORITIES, 'Priority');
    this.#record(this.#status, this.#status, 'Priority Assigned', actor, comment || `Priority set to ${priority}.`);
    return this;
  }

  assignTechnician(technician, actor, comment = '') {
    if (!(technician instanceof User) || !technician.canWorkOnRequests()) {
      throw new ValidationError('Only a Technician can be assigned to a request.');
    }
    this.#assertTransition(STATUS.ASSIGNED);     // check first, so nothing changes on failure
    this.#assignedTechnician = technician;
    return this.transitionTo(STATUS.ASSIGNED, {
      actor, action: 'Technician Assigned', comment: comment || `Assigned to ${technician.getFullName()}.`,
    });
  }

  addProgressNote(note, actor) {
    if (this.#status !== STATUS.IN_PROGRESS) {
      throw new WorkflowError(`Progress notes can only be added while the request is In Progress (now ${this.#status}).`);
    }
    this.#record(this.#status, this.#status, 'Progress Note', actor, requireText(note, 'Progress note'));
    return this;
  }

  /** Copies of the history entries, oldest first. */
  getHistory() {
    return this.#history.map((entry) => ({ ...entry }));
  }

  // ---- abstract-style methods: every subclass MUST override these ---------------
  calculatePriorityScore() {
    throw new NotImplementedError(`${this.constructor.name} must implement calculatePriorityScore().`);
  }

  getTargetResolutionHours() {
    throw new NotImplementedError(`${this.constructor.name} must implement getTargetResolutionHours().`);
  }

  getRequestSummary() {
    throw new NotImplementedError(`${this.constructor.name} must implement getRequestSummary().`);
  }

  // ---- shared helpers that subclasses can use ------------------------------------
  getPriorityWeight() {
    return PRIORITY_WEIGHT[this.#priority];
  }

  getPriorityTargetHours() {
    return PRIORITY_TARGET_HOURS[this.#priority];
  }

  /** The lines every request type shares. Subclasses add their own details after these. */
  getCommonSummary() {
    const technician = this.#assignedTechnician
      ? `${this.#assignedTechnician.getFullName()} (${this.#assignedTechnician.userId})`
      : 'Not assigned';
    return [
      `Request ID : ${this.#requestId}`,
      `Title      : ${this.#title}`,
      `Requester  : ${this.#requester.getFullName()} (${this.#requester.userId})`,
      `Category   : ${this.#category}`,
      `Location   : ${this.#location}`,
      `Priority   : ${this.#priority}`,
      `Status     : ${this.#status}`,
      `Technician : ${technician}`,
      `Submitted  : ${this.#dateSubmitted.toLocaleString()}`,
      `Updated    : ${this.#dateUpdated.toLocaleString()}`,
      `Details    : ${this.#description}`,
    ].join('\n');
  }

  /** Extra fields a subclass wants saved. */
  getSpecialisedData() {
    return {};
  }

  /** Plain data (no methods, no objects) that can be written to JSON. History is saved separately. */
  toData() {
    return {
      requestId: this.#requestId,
      requestType: this.constructor.name,
      requesterId: this.#requester.userId,
      title: this.#title,
      description: this.#description,
      location: this.#location,
      category: this.#category,
      priority: this.#priority,
      status: this.#status,
      assignedTechnicianId: this.#assignedTechnician ? this.#assignedTechnician.userId : null,
      dateSubmitted: this.#dateSubmitted.toISOString(),
      dateUpdated: this.#dateUpdated.toISOString(),
      specialisedData: this.getSpecialisedData(),
    };
  }
}

module.exports = ServiceRequest;
