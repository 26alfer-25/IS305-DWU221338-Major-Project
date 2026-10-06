'use strict';

const User = require('../models/User');
const StudentRequester = require('../models/StudentRequester');
const StaffRequester = require('../models/StaffRequester');
const ServiceOfficer = require('../models/ServiceOfficer');
const Technician = require('../models/Technician');
const SystemAdministrator = require('../models/SystemAdministrator');
const { ValidationError } = require('../utils/errors');

/** Fields each user type needs on top of the common ones (used by the console menu). */
const SPECIALISED_FIELDS = Object.freeze({
  Student: [['programme', 'Programme'], ['yearLevel', 'Year level (1-6)']],
  Staff: [['department', 'Department']],
  'Service Officer': [['serviceSection', 'Service section']],
  Technician: [['speciality', 'Technical speciality']],
  Administrator: [['office', 'Office']],
});

const CLASS_BY_TYPE = Object.freeze({
  Student: StudentRequester,
  Staff: StaffRequester,
  'Service Officer': ServiceOfficer,
  Technician,
  Administrator: SystemAdministrator,
});

class UserFactory {
  static getSpecialisedFields(userType) {
    return SPECIALISED_FIELDS[userType] ?? [];
  }

  /** Builds the correct User subclass for the chosen user type. */
  static createUser(commonData, specialisedData = {}) {
    const UserClass = CLASS_BY_TYPE[commonData?.userType];
    if (!UserClass) {
      throw new ValidationError(`User type "${commonData?.userType}" is not supported.`);
    }
    return new UserClass(commonData, specialisedData);
  }

  /** Recreates the correct User subclass from a plain object read from users.json. */
  static createFromData(savedData) {
    if (savedData === null || typeof savedData !== 'object') {
      throw new ValidationError('A saved user must be an object.');
    }
    const { specialisedData, ...commonData } = savedData;
    return UserFactory.createUser(commonData, specialisedData ?? {});
  }
}

module.exports = UserFactory;
