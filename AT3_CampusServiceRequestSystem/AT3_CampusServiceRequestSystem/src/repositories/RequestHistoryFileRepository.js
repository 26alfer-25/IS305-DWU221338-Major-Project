'use strict';

const path = require('node:path');
const { FileRepository } = require('./FileRepository');

class RequestHistoryFileRepository extends FileRepository {
  constructor(dataDir) {
    super(path.join(dataDir, 'requestHistory.json'), { idField: 'historyId', label: 'request history' });
  }

  findByRequest(requestId) {
    return this.filterBy('requestId', requestId);
  }
}

module.exports = RequestHistoryFileRepository;
