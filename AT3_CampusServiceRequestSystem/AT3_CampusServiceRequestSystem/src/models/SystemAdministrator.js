'use strict';

const User = require('./User');
const { requireText } = require('../utils/validators');

class SystemAdministrator extends User {
  #office;

  constructor(commonData, { office } = {}) {
    super({ ...commonData, userType: 'Administrator' });
    this.#office = requireText(office, 'Office');
  }

  get office() { return this.#office; }
  set office(v) { this.#office = requireText(v, 'Office'); }

  canViewAdminData() { return true; }       // overrides User

  displayInfo() {
    return `${super.displayInfo()}\nOffice    : ${this.#office}`;
  }

  getSpecialisedData() { return { office: this.#office }; }
}

module.exports = SystemAdministrator;
