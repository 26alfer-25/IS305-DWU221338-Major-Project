'use strict';

const CATEGORY = Object.freeze({
  ICT: 'ICT Support',
  MAINTENANCE: 'Facilities Maintenance',
  CLEANING: 'Cleaning and Sanitation',
  GENERAL: 'General Campus Service',
});
const CATEGORIES = Object.freeze(Object.values(CATEGORY));

const PRIORITIES = Object.freeze(['Low', 'Medium', 'High', 'Urgent']);
const PRIORITY_WEIGHT = Object.freeze({ Low: 10, Medium: 20, High: 40, Urgent: 60 });
const PRIORITY_TARGET_HOURS = Object.freeze({ Urgent: 8, High: 24, Medium: 72, Low: 120 });

const STATUS = Object.freeze({
  SUBMITTED: 'Submitted',
  REVIEWED: 'Reviewed',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',      // final status
});

/** The only status changes the system accepts. Closed and Cancelled are final. */
const STATUS_TRANSITIONS = Object.freeze({
  [STATUS.SUBMITTED]: [STATUS.REVIEWED, STATUS.CANCELLED],
  [STATUS.REVIEWED]: [STATUS.ASSIGNED],
  [STATUS.ASSIGNED]: [STATUS.IN_PROGRESS],
  [STATUS.IN_PROGRESS]: [STATUS.RESOLVED],
  [STATUS.RESOLVED]: [STATUS.CLOSED],
  [STATUS.CLOSED]: [],
  [STATUS.CANCELLED]: [],
});

const USER_TYPES = Object.freeze([
  'Student',
  'Staff',
  'Service Officer',
  'Technician',
  'Administrator',
]);

// Allowed values for specialised request fields
const FAULT_TYPES = Object.freeze(['Hardware', 'Software', 'Network', 'Account Access', 'Other']);
const NETWORK_IMPACTS = Object.freeze(['None', 'Single User', 'Department', 'Campus-wide']);
const HAZARD_LEVELS = Object.freeze(['None', 'Low', 'Medium', 'High', 'Critical']);
const HYGIENE_RISKS = Object.freeze(['Low', 'Medium', 'High']);
const CLEANING_SERVICE_TYPES = Object.freeze(['Routine', 'Deep Clean', 'Spill Response', 'Waste Removal']);
const SERVICE_TIMES = Object.freeze(['Morning', 'Afternoon', 'Evening', 'After Hours']);
const GENERAL_SERVICE_AREAS = Object.freeze(['Administration', 'Security', 'Transport', 'Events', 'Other']);

module.exports = {
  CATEGORY, CATEGORIES, PRIORITIES, PRIORITY_WEIGHT, PRIORITY_TARGET_HOURS,
  STATUS, STATUS_TRANSITIONS, USER_TYPES,
  FAULT_TYPES, NETWORK_IMPACTS, HAZARD_LEVELS, HYGIENE_RISKS,
  CLEANING_SERVICE_TYPES, SERVICE_TIMES, GENERAL_SERVICE_AREAS,
};
