'use strict';

const ServiceRequest = require('./ServiceRequest');
const { CATEGORY, GENERAL_SERVICE_AREAS } = require('../utils/constants');
const { requireOneOf } = require('../utils/validators');

/** Any campus service that is not ICT, maintenance or cleaning. */
class GeneralServiceRequest extends ServiceRequest {
  #serviceArea;

  constructor(commonRequestData, specialisedData = {}) {
    super({ ...commonRequestData, category: CATEGORY.GENERAL });
    this.#serviceArea = requireOneOf(specialisedData.serviceArea, GENERAL_SERVICE_AREAS, 'Service area');
  }

  get serviceArea() { return this.#serviceArea; }

  validateSpecialisedFields() {
    requireOneOf(this.#serviceArea, GENERAL_SERVICE_AREAS, 'Service area');
    return true;
  }

  allowsCategoryChange() { return false; }

  calculatePriorityScore() {
    return this.getPriorityWeight();
  }

  getTargetResolutionHours() {
    return this.getPriorityTargetHours();
  }

  getRequestSummary() {
    return `${this.getCommonSummary()}\n--- General service details ---\nService area  : ${this.#serviceArea}`;
  }

  getSpecialisedData() {
    return { serviceArea: this.#serviceArea };
  }
}

module.exports = GeneralServiceRequest;
