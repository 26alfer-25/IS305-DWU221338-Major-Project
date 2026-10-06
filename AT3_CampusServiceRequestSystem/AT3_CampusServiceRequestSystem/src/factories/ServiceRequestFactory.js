'use strict';

const ICTSupportRequest = require('../models/ICTSupportRequest');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const CleaningRequest = require('../models/CleaningRequest');
const GeneralServiceRequest = require('../models/GeneralServiceRequest');
const {
  CATEGORY, FAULT_TYPES, NETWORK_IMPACTS, HAZARD_LEVELS, HYGIENE_RISKS,
  CLEANING_SERVICE_TYPES, SERVICE_TIMES, GENERAL_SERVICE_AREAS,
} = require('../utils/constants');
const { ValidationError } = require('../utils/errors');

const CLASS_BY_TYPE_NAME = Object.freeze({
  ICTSupportRequest,
  MaintenanceRequest,
  CleaningRequest,
  GeneralServiceRequest,
});

const CLASS_BY_CATEGORY = Object.freeze({
  [CATEGORY.ICT]: ICTSupportRequest,
  [CATEGORY.MAINTENANCE]: MaintenanceRequest,
  [CATEGORY.CLEANING]: CleaningRequest,
  [CATEGORY.GENERAL]: GeneralServiceRequest,
});

/** [field name, question label, allowed values or null for free text] */
const SPECIALISED_FIELDS = Object.freeze({
  [CATEGORY.ICT]: [
    ['deviceType', 'Device type (e.g. Laptop)', null],
    ['systemName', 'System name (e.g. Campus Wi-Fi)', null],
    ['faultType', 'Fault type', FAULT_TYPES],
    ['networkImpact', 'Network impact', NETWORK_IMPACTS],
  ],
  [CATEGORY.MAINTENANCE]: [
    ['building', 'Building', null],
    ['roomNumber', 'Room number', null],
    ['hazardLevel', 'Hazard level', HAZARD_LEVELS],
    ['equipmentAffected', 'Equipment affected', null],
  ],
  [CATEGORY.CLEANING]: [
    ['cleaningArea', 'Cleaning area', null],
    ['hygieneRisk', 'Hygiene risk', HYGIENE_RISKS],
    ['serviceType', 'Service type', CLEANING_SERVICE_TYPES],
    ['preferredServiceTime', 'Preferred service time', SERVICE_TIMES],
  ],
  [CATEGORY.GENERAL]: [
    ['serviceArea', 'Service area', GENERAL_SERVICE_AREAS],
  ],
});

class ServiceRequestFactory {
  static getSpecialisedFields(category) {
    return SPECIALISED_FIELDS[category] ?? [];
  }

  /** Builds the correct request subclass for the chosen category. */
  static createRequest(commonRequestData, specialisedData = {}) {
    const RequestClass = CLASS_BY_CATEGORY[commonRequestData?.category];
    if (!RequestClass) {
      throw new ValidationError(
        `Category "${commonRequestData?.category}" is not supported. Choose one of: ${Object.keys(CLASS_BY_CATEGORY).join(', ')}.`
      );
    }
    return new RequestClass(commonRequestData, specialisedData);
  }

  /**
   * Recreates the correct request subclass from a plain object read from JSON.
   * JSON cannot store class instances, so the saved "requestType" decides which
   * class to build. Options: findUser(id) returns a User (or null) and history
   * is the saved history entries for this request.
   */
  static createFromData(savedData, { findUser = () => null, history = [] } = {}) {
    if (savedData === null || typeof savedData !== 'object') {
      throw new ValidationError('A saved request must be an object.');
    }
    const RequestClass = CLASS_BY_TYPE_NAME[savedData.requestType];
    if (!RequestClass) {
      throw new ValidationError(
        `Unknown request type "${savedData.requestType}" for request "${savedData.requestId}". ` +
        `Expected one of: ${Object.keys(CLASS_BY_TYPE_NAME).join(', ')}.`
      );
    }
    const requester = findUser(savedData.requesterId);
    if (!requester) {
      throw new ValidationError(`Request "${savedData.requestId}" refers to unknown requester "${savedData.requesterId}".`);
    }
    let assignedTechnician = null;
    if (savedData.assignedTechnicianId) {
      assignedTechnician = findUser(savedData.assignedTechnicianId);
      if (!assignedTechnician) {
        throw new ValidationError(`Request "${savedData.requestId}" refers to unknown Technician "${savedData.assignedTechnicianId}".`);
      }
    }
    const request = new RequestClass({
      requestId: savedData.requestId,
      requester,
      title: savedData.title,
      description: savedData.description,
      location: savedData.location,
      priority: savedData.priority,
      status: savedData.status,
      dateSubmitted: savedData.dateSubmitted,
      dateUpdated: savedData.dateUpdated,
      assignedTechnician,
      history,
    }, savedData.specialisedData ?? {});
    if (savedData.category && savedData.category !== request.category) {
      throw new ValidationError(
        `Request "${savedData.requestId}" has category "${savedData.category}" but type ${savedData.requestType} is "${request.category}".`
      );
    }
    request.validate();
    return request;
  }
}

module.exports = ServiceRequestFactory;
