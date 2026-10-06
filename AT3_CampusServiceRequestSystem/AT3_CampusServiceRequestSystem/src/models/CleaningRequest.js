'use strict';

const ServiceRequest = require('./ServiceRequest');
const { CATEGORY, HYGIENE_RISKS, CLEANING_SERVICE_TYPES, SERVICE_TIMES } = require('../utils/constants');
const { requireText, requireOneOf } = require('../utils/validators');

const HYGIENE_SCORE = Object.freeze({ Low: 0, Medium: 10, High: 25 });
const HYGIENE_HOURS = Object.freeze({ Low: 48, Medium: 24, High: 6 });

/** Cleaning, sanitation and waste requests. */
class CleaningRequest extends ServiceRequest {
  #cleaningArea;
  #hygieneRisk;
  #serviceType;
  #preferredServiceTime;

  constructor(commonRequestData, specialisedData = {}) {
    super({ ...commonRequestData, category: CATEGORY.CLEANING });      // constructor chaining
    const { cleaningArea, hygieneRisk = 'Low', serviceType, preferredServiceTime } = specialisedData;
    this.#cleaningArea = requireText(cleaningArea, 'Cleaning area');
    this.#hygieneRisk = requireOneOf(hygieneRisk, HYGIENE_RISKS, 'Hygiene risk');
    this.#serviceType = requireOneOf(serviceType, CLEANING_SERVICE_TYPES, 'Service type');
    this.#preferredServiceTime = requireOneOf(preferredServiceTime, SERVICE_TIMES, 'Preferred service time');
  }

  get cleaningArea() { return this.#cleaningArea; }
  get hygieneRisk() { return this.#hygieneRisk; }
  get serviceType() { return this.#serviceType; }
  get preferredServiceTime() { return this.#preferredServiceTime; }

  validateSpecialisedFields() {
    requireText(this.#cleaningArea, 'Cleaning area');
    requireOneOf(this.#hygieneRisk, HYGIENE_RISKS, 'Hygiene risk');
    requireOneOf(this.#serviceType, CLEANING_SERVICE_TYPES, 'Service type');
    requireOneOf(this.#preferredServiceTime, SERVICE_TIMES, 'Preferred service time');
    return true;
  }

  allowsCategoryChange() { return false; }

  /** Priority weight plus hygiene risk, with a bonus for spills. */
  calculatePriorityScore() {
    const spillBonus = this.#serviceType === 'Spill Response' ? 10 : 0;
    return this.getPriorityWeight() + HYGIENE_SCORE[this.#hygieneRisk] + spillBonus;
  }

  /** High hygiene risks are cleaned within hours. */
  getTargetResolutionHours() {
    return HYGIENE_HOURS[this.#hygieneRisk];
  }

  getRequestSummary() {
    return [
      this.getCommonSummary(),
      '--- Cleaning details ---',
      `Cleaning area  : ${this.#cleaningArea}`,
      `Hygiene risk   : ${this.#hygieneRisk}`,
      `Service type   : ${this.#serviceType}`,
      `Preferred time : ${this.#preferredServiceTime}`,
    ].join('\n');
  }

  getSpecialisedData() {
    return {
      cleaningArea: this.#cleaningArea,
      hygieneRisk: this.#hygieneRisk,
      serviceType: this.#serviceType,
      preferredServiceTime: this.#preferredServiceTime,
    };
  }
}

module.exports = CleaningRequest;
