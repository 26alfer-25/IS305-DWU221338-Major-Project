'use strict';

const ServiceRequest = require('./ServiceRequest');
const { CATEGORY, FAULT_TYPES, NETWORK_IMPACTS } = require('../utils/constants');
const { requireText, requireOneOf } = require('../utils/validators');

const IMPACT_SCORE = Object.freeze({ None: 0, 'Single User': 5, Department: 15, 'Campus-wide': 30 });
const IMPACT_HOURS = Object.freeze({ None: 48, 'Single User': 24, Department: 8, 'Campus-wide': 4 });

/** A fault with a computer, network, printer or other ICT system. */
class ICTSupportRequest extends ServiceRequest {
  #deviceType;
  #systemName;
  #faultType;
  #networkImpact;

  constructor(commonRequestData, specialisedData = {}) {
    super({ ...commonRequestData, category: CATEGORY.ICT });     // constructor chaining
    const { deviceType, systemName, faultType, networkImpact = 'None' } = specialisedData;
    this.#deviceType = requireText(deviceType, 'Device type');
    this.#systemName = requireText(systemName, 'System name');
    this.#faultType = requireOneOf(faultType, FAULT_TYPES, 'Fault type');
    this.#networkImpact = requireOneOf(networkImpact, NETWORK_IMPACTS, 'Network impact');
  }

  get deviceType() { return this.#deviceType; }
  get systemName() { return this.#systemName; }
  get faultType() { return this.#faultType; }
  get networkImpact() { return this.#networkImpact; }

  validateSpecialisedFields() {
    requireText(this.#deviceType, 'Device type');
    requireText(this.#systemName, 'System name');
    requireOneOf(this.#faultType, FAULT_TYPES, 'Fault type');
    requireOneOf(this.#networkImpact, NETWORK_IMPACTS, 'Network impact');
    return true;
  }

  allowsCategoryChange() { return false; }

  /** Priority weight plus a bonus for how many people the fault affects. */
  calculatePriorityScore() {
    return this.getPriorityWeight() + IMPACT_SCORE[this.#networkImpact];
  }

  /** The wider the network impact, the faster it must be fixed. */
  getTargetResolutionHours() {
    return IMPACT_HOURS[this.#networkImpact];
  }

  getRequestSummary() {
    return [
      this.getCommonSummary(),
      '--- ICT Support details ---',
      `Device type    : ${this.#deviceType}`,
      `System name    : ${this.#systemName}`,
      `Fault type     : ${this.#faultType}`,
      `Network impact : ${this.#networkImpact}`,
    ].join('\n');
  }

  getSpecialisedData() {
    return {
      deviceType: this.#deviceType,
      systemName: this.#systemName,
      faultType: this.#faultType,
      networkImpact: this.#networkImpact,
    };
  }
}

module.exports = ICTSupportRequest;
