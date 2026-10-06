'use strict';

const path = require('node:path');
const UserFileRepository = require('./UserFileRepository');
const ServiceRequestFileRepository = require('./ServiceRequestFileRepository');
const RequestHistoryFileRepository = require('./RequestHistoryFileRepository');
const AuditFileRepository = require('./AuditFileRepository');
const UserFactory = require('../factories/UserFactory');
const ServiceRequestFactory = require('../factories/ServiceRequestFactory');
const AuditEntry = require('../models/AuditEntry');
const { StorageError, AppError } = require('../utils/errors');

const DEFAULT_DATA_DIR = path.join(__dirname, '..', '..', 'data');

/**
 * Connects the in-memory ServiceRequestManager to the four JSON files:
 * loadInto() rebuilds real objects at start-up, saveFrom() writes them back.
 */
class DataStore {
  #users;
  #requests;
  #history;
  #audit;

  constructor(dataDir = DEFAULT_DATA_DIR) {
    this.dataDir = dataDir;
    this.#users = new UserFileRepository(dataDir);
    this.#requests = new ServiceRequestFileRepository(dataDir);
    this.#history = new RequestHistoryFileRepository(dataDir);
    this.#audit = new AuditFileRepository(dataDir);
  }

  /** Loads the four files and restores User, request and AuditEntry objects into the manager. */
  async loadInto(manager) {
    const [userData, requestData, historyData, auditData] = await Promise.all([
      this.#users.loadAll(), this.#requests.loadAll(), this.#history.loadAll(), this.#audit.loadAll(),
    ]);
    try {
      const users = userData.map((record) => UserFactory.createFromData(record));
      const usersById = new Map(users.map((u) => [u.userId, u]));
      const historyByRequest = new Map();
      for (const entry of historyData) {
        if (!historyByRequest.has(entry.requestId)) historyByRequest.set(entry.requestId, []);
        historyByRequest.get(entry.requestId).push(entry);
      }
      const requests = requestData.map((record) => ServiceRequestFactory.createFromData(record, {
        findUser: (id) => usersById.get(id) ?? null,
        history: historyByRequest.get(record.requestId) ?? [],
      }));
      const auditEntries = auditData.map((record) => AuditEntry.fromData(record));
      manager.restoreState({ users, requests, auditEntries });
    } catch (error) {
      if (error instanceof StorageError) throw error;
      if (error instanceof AppError) {
        throw new StorageError(`The saved data in "${this.dataDir}" is not valid and was not loaded: ${error.message}`);
      }
      throw error;
    }
    return { users: userData.length, requests: requestData.length, audit: auditData.length };
  }

  /** Validates everything first, then writes all four files. Nothing is written if a record is invalid. */
  async saveFrom(manager) {
    const users = manager.getAllUsers();
    const requests = manager.getAllRequests();
    const auditEntries = manager.getAuditLog();
    try {
      users.forEach((u) => u.validate());
      requests.forEach((r) => r.validate());
    } catch (error) {
      throw new StorageError(`Nothing was saved because a record is invalid: ${error.message}`);
    }
    const historyRecords = requests.flatMap((request) =>
      request.getHistory().map((h, index) => ({
        historyId: `${request.requestId}-H${String(index + 1).padStart(3, '0')}`,
        requestId: request.requestId,
        previousStatus: h.previousStatus,
        newStatus: h.newStatus,
        action: h.action,
        actorId: h.actorId,
        actorRole: h.actorRole,
        comment: h.comment,
        timestamp: h.timestamp.toISOString(),
      })));
    await this.#users.saveAll(users.map((u) => u.toData()));
    await this.#requests.saveAll(requests.map((r) => r.toData()));
    await this.#history.saveAll(historyRecords);
    await this.#audit.saveAll(auditEntries.map((a) => a.toData()));
  }

  get userRepository() { return this.#users; }
  get requestRepository() { return this.#requests; }
  get historyRepository() { return this.#history; }
  get auditRepository() { return this.#audit; }
}

module.exports = DataStore;
