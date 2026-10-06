'use strict';

const User = require('./User');
const { ValidationError } = require('../utils/errors');
const { requireText } = require('../utils/validators');

class StudentRequester extends User {
  #programme;
  #yearLevel;

  constructor(commonData, { programme, yearLevel } = {}) {
    super({ ...commonData, userType: 'Student' });        // constructor chaining
    this.#programme = requireText(programme, 'Programme');
    this.#yearLevel = StudentRequester.#checkYear(yearLevel);
  }

  static #checkYear(value) {
    const year = Number(value);
    if (!Number.isInteger(year) || year < 1 || year > 6) {
      throw new ValidationError('Year level must be a whole number from 1 to 6.');
    }
    return year;
  }

  get programme() { return this.#programme; }
  get yearLevel() { return this.#yearLevel; }
  set programme(v) { this.#programme = requireText(v, 'Programme'); }
  set yearLevel(v) { this.#yearLevel = StudentRequester.#checkYear(v); }

  displayInfo() {
    return `${super.displayInfo()}\nProgramme : ${this.#programme} (Year ${this.#yearLevel})`;
  }

  getSpecialisedData() { return { programme: this.#programme, yearLevel: this.#yearLevel }; }
}

module.exports = StudentRequester;
