'use strict';

const path = require('node:path');
const { FileRepository } = require('./FileRepository');

class ServiceRequestFileRepository extends FileRepository {
  constructor(dataDir) {
    super(path.join(dataDir, 'serviceRequests.json'), { idField: 'requestId', label: 'service requests' });
  }

  findByRequester(userId) {
    return this.filterBy('requesterId', userId);
  }

  findByTechnician(technicianId) {
    return this.filterBy('assignedTechnicianId', technicianId);
  }
}

module.exports = ServiceRequestFileRepository;
