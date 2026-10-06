'use strict';

const User = require('./User');
const { requireText } = require('../utils/validators');

class StaffRequester extends User {
  #department;

  constructor(commonData, { department } = {}) {
    super({ ...commonData, userType: 'Staff' });
    this.#department = requireText(department, 'Department');
  }

  get department() { return this.#department; }
  set department(v) { this.#department = requireText(v, 'Department'); }

  displayInfo() {
    return `${super.displayInfo()}\nDepartment: ${this.#department}`;
  }

  getSpecialisedData() { return { department: this.#department }; }
}

module.exports = StaffRequester;
