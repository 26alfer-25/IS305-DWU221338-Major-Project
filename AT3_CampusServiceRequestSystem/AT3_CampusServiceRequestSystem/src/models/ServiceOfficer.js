'use strict';

const User = require('./User');
const { requireText } = require('../utils/validators');

class ServiceOfficer extends User {
  #serviceSection;

  constructor(commonData, { serviceSection } = {}) {
    super({ ...commonData, userType: 'Service Officer' });
    this.#serviceSection = requireText(serviceSection, 'Service section');
  }

  get serviceSection() { return this.#serviceSection; }
  set serviceSection(v) { this.#serviceSection = requireText(v, 'Service section'); }

  canManageRequests() { return true; }      // overrides User

  displayInfo() {
    return `${super.displayInfo()}\nSection   : ${this.#serviceSection}`;
  }

  getSpecialisedData() { return { serviceSection: this.#serviceSection }; }
}

module.exports = ServiceOfficer;
