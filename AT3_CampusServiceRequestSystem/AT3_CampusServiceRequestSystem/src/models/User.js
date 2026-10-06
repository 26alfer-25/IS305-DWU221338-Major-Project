'use strict';

const { ValidationError } = require('../utils/errors');
const { USER_TYPES } = require('../utils/constants');
const { isValidEmail, requireText, requireOneOf } = require('../utils/validators');

/**
 * Base class for every person who uses the system.
 * All fields are private (#) so they can only change through the
 * getters/setters below, which validate every new value.
 * Subclasses (StudentRequester, Technician, ...) extend this class.
 */
class User {
  #userId;
  #firstName;
  #lastName;
  #email;
  #userType;

  constructor({ userId, firstName, lastName, email, userType } = {}) {
    this.#userId = requireText(userId, 'User ID');
    this.#firstName = requireText(firstName, 'First name');
    this.#lastName = requireText(lastName, 'Last name');
    if (!isValidEmail(email)) {
      throw new ValidationError(`Email address "${email}" is not valid.`);
    }
    this.#email = email.trim();
    this.#userType = requireOneOf(userType, USER_TYPES, 'User type');
  }

  // ---- getters ----------------------------------------------------------
  get userId() { return this.#userId; }
  get firstName() { return this.#firstName; }
  get lastName() { return this.#lastName; }
  get email() { return this.#email; }
  get userType() { return this.#userType; }

  // ---- controlled setters (the user ID is never changed after creation) --
  set firstName(value) { this.#firstName = requireText(value, 'First name'); }
  set lastName(value) { this.#lastName = requireText(value, 'Last name'); }
  set email(value) {
    if (!isValidEmail(value)) {
      throw new ValidationError(`Email address "${value}" is not valid.`);
    }
    this.#email = value.trim();
  }
  set userType(value) { this.#userType = requireOneOf(value, USER_TYPES, 'User type'); }

  getFullName() {
    return `${this.#firstName} ${this.#lastName}`;
  }

  /** Re-checks the current state. Throws ValidationError when something is wrong. */
  validate() {
    requireText(this.#userId, 'User ID');
    requireText(this.#firstName, 'First name');
    requireText(this.#lastName, 'Last name');
    if (!isValidEmail(this.#email)) {
      throw new ValidationError(`Email address "${this.#email}" is not valid.`);
    }
    requireOneOf(this.#userType, USER_TYPES, 'User type');
    return true;
  }

  displayInfo() {
    return [
      `User ID   : ${this.#userId}`,
      `Name      : ${this.getFullName()}`,
      `Email     : ${this.#email}`,
      `User type : ${this.#userType}`,
    ].join('\n');
  }

  // ---- role permissions (subclasses override these) ------------------------
  canSubmitRequests() { return this.#userType === 'Student' || this.#userType === 'Staff'; }
  canManageRequests() { return false; }     // review, prioritise, assign, close
  canWorkOnRequests() { return false; }     // start, progress notes, resolve
  canViewAdminData() { return false; }      // audit log and management reports

  /** Plain data for saving later (Distinction). Subclasses add their own fields. */
  getSpecialisedData() { return {}; }
  toData() {
    return {
      userId: this.#userId,
      firstName: this.#firstName,
      lastName: this.#lastName,
      email: this.#email,
      userType: this.#userType,
      specialisedData: this.getSpecialisedData(),
    };
  }
}

module.exports = User;
