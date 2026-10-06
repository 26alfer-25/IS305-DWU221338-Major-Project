'use strict';

const User = require('./User');
const { requireText } = require('../utils/validators');

class Technician extends User {
  #speciality;

  constructor(commonData, { speciality } = {}) {
    super({ ...commonData, userType: 'Technician' });
    this.#speciality = requireText(speciality, 'Technical speciality');
  }

  get speciality() { return this.#speciality; }
  set speciality(v) { this.#speciality = requireText(v, 'Technical speciality'); }

  canWorkOnRequests() { return true; }      // overrides User

  displayInfo() {
    return `${super.displayInfo()}\nSpeciality: ${this.#speciality}`;
  }

  getSpecialisedData() { return { speciality: this.#speciality }; }
}

module.exports = Technician;
