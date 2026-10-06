'use strict';

const path = require('node:path');
const { FileRepository } = require('./FileRepository');

class UserFileRepository extends FileRepository {
  constructor(dataDir) {
    super(path.join(dataDir, 'users.json'), { idField: 'userId', label: 'users' });
  }

  async findByEmail(email) {
    const records = await this.loadAll();
    return records.find((r) => String(r.email).toLowerCase() === String(email).toLowerCase()) ?? null;
  }
}

module.exports = UserFileRepository;
