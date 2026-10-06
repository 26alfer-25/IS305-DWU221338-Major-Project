'use strict';

const path = require('node:path');
const { FileRepository } = require('./FileRepository');

class AuditFileRepository extends FileRepository {
  constructor(dataDir) {
    super(path.join(dataDir, 'auditLog.json'), { idField: 'auditId', label: 'audit log' });
  }

  findByRequest(requestId) {
    return this.filterBy('requestId', requestId);
  }

  findByActor(actorId) {
    return this.filterBy('actorId', actorId);
  }
}

module.exports = AuditFileRepository;
