'use strict';

const { ValidationError } = require('../utils/errors');
const { requireText } = require('../utils/validators');

/** One line of the audit trail: who did what, to which request, when, and what happened. */
class AuditEntry {
  #auditId;
  #actorId;
  #actorRole;
  #action;
  #requestId;
  #description;
  #timestamp;
  #outcome;

  constructor({ auditId, actorId, actorRole, action, requestId = null, description, timestamp = new Date(), outcome }) {
    this.#auditId = requireText(auditId, 'Audit ID');
    this.#actorId = requireText(actorId, 'Audit actor ID');
    this.#actorRole = requireText(actorRole, 'Audit actor role');
    this.#action = requireText(action, 'Audit action');
    this.#requestId = requestId === null || requestId === undefined ? null : requireText(requestId, 'Audit request ID');
    this.#description = requireText(description, 'Audit description');
    this.#outcome = requireText(outcome, 'Audit outcome');
    const date = timestamp instanceof Date ? new Date(timestamp) : new Date(String(timestamp));
    if (Number.isNaN(date.getTime())) throw new ValidationError(`Audit time "${timestamp}" is not a valid date.`);
    this.#timestamp = date;
  }

  get auditId() { return this.#auditId; }
  get actorId() { return this.#actorId; }
  get actorRole() { return this.#actorRole; }
  get action() { return this.#action; }
  get requestId() { return this.#requestId; }
  get description() { return this.#description; }
  get timestamp() { return new Date(this.#timestamp); }
  get outcome() { return this.#outcome; }
  get succeeded() { return this.#outcome === 'Success'; }

  toString() {
    return `${this.#auditId} | ${this.#timestamp.toLocaleString()} | ${this.#actorId} (${this.#actorRole}) | ` +
      `${this.#action} | ${this.#requestId ?? '-'} | ${this.#outcome} | ${this.#description}`;
  }

  toData() {
    return {
      auditId: this.#auditId,
      actorId: this.#actorId,
      actorRole: this.#actorRole,
      action: this.#action,
      requestId: this.#requestId,
      description: this.#description,
      timestamp: this.#timestamp.toISOString(),
      outcome: this.#outcome,
    };
  }

  static fromData(data) {
    if (data === null || typeof data !== 'object') throw new ValidationError('An audit record must be an object.');
    return new AuditEntry(data);
  }
}

module.exports = AuditEntry;
