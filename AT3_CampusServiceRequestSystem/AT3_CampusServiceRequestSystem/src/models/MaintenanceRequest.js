'use strict';

const ServiceRequest = require('./ServiceRequest');
const { CATEGORY, HAZARD_LEVELS } = require('../utils/constants');
const { requireText, requireOneOf } = require('../utils/validators');

const HAZARD_SCORE = Object.freeze({ None: 0, Low: 5, Medium: 15, High: 30, Critical: 45 });
const HAZARD_HOURS = Object.freeze({ None: 72, Low: 72, Medium: 48, High: 12, Critical: 4 });

/** Damaged buildings, rooms, furniture or equipment. */
class MaintenanceRequest extends ServiceRequest {
  #building;
  #roomNumber;
  #hazardLevel;
  #equipmentAffected;

  constructor(commonRequestData, specialisedData = {}) {
    super({ ...commonRequestData, category: CATEGORY.MAINTENANCE });   // constructor chaining
    const { building, roomNumber, hazardLevel = 'None', equipmentAffected } = specialisedData;
    this.#building = requireText(building, 'Building');
    this.#roomNumber = requireText(String(roomNumber ?? ''), 'Room number');
    this.#hazardLevel = requireOneOf(hazardLevel, HAZARD_LEVELS, 'Hazard level');
    this.#equipmentAffected = requireText(equipmentAffected, 'Equipment affected');
  }

  get building() { return this.#building; }
  get roomNumber() { return this.#roomNumber; }
  get hazardLevel() { return this.#hazardLevel; }
  get equipmentAffected() { return this.#equipmentAffected; }

  validateSpecialisedFields() {
    requireText(this.#building, 'Building');
    requireText(this.#roomNumber, 'Room number');
    requireOneOf(this.#hazardLevel, HAZARD_LEVELS, 'Hazard level');
    requireText(this.#equipmentAffected, 'Equipment affected');
    return true;
  }

  allowsCategoryChange() { return false; }

  /** Priority weight plus a bonus for the hazard level. */
  calculatePriorityScore() {
    return this.getPriorityWeight() + HAZARD_SCORE[this.#hazardLevel];
  }

  /** Dangerous faults must be fixed first. */
  getTargetResolutionHours() {
    return HAZARD_HOURS[this.#hazardLevel];
  }

  getRequestSummary() {
    return [
      this.getCommonSummary(),
      '--- Maintenance details ---',
      `Building           : ${this.#building}`,
      `Room number        : ${this.#roomNumber}`,
      `Hazard level       : ${this.#hazardLevel}`,
      `Equipment affected : ${this.#equipmentAffected}`,
    ].join('\n');
  }

  getSpecialisedData() {
    return {
      building: this.#building,
      roomNumber: this.#roomNumber,
      hazardLevel: this.#hazardLevel,
      equipmentAffected: this.#equipmentAffected,
    };
  }
}

module.exports = MaintenanceRequest;
