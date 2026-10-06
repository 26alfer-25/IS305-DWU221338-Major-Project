'use strict';

const { STATUS, PRIORITIES, CATEGORIES } = require('../utils/constants');

const OPEN_STATUSES = Object.freeze([STATUS.SUBMITTED, STATUS.REVIEWED, STATUS.ASSIGNED, STATUS.IN_PROGRESS]);
const COMPLETED_STATUSES = Object.freeze([STATUS.RESOLVED, STATUS.CLOSED]);
const URGENT_SCORE = 70;
const MS_PER_HOUR = 60 * 60 * 1000;

/** Counts items by a key using reduce(). `keys` makes sure empty groups still appear as 0. */
function countBy(items, keyOf, keys = []) {
  return items.reduce((totals, item) => {
    const key = keyOf(item);
    totals[key] = (totals[key] ?? 0) + 1;
    return totals;
  }, Object.fromEntries(keys.map((k) => [k, 0])));
}

/**
 * Management reports built with filter(), map(), reduce() and sort().
 * Every report returns plain data, so the console menu (and the tests)
 * decide how to show it.
 */
class ReportService {
  #manager;

  constructor(manager) {
    this.#manager = manager;
  }

  #requests() {
    return this.#manager.getAllRequests();
  }

  /** 1. Requests grouped by status. */
  requestsByStatus() {
    return countBy(this.#requests(), (r) => r.status, Object.values(STATUS));
  }

  /** 2. Requests grouped by category. */
  requestsByCategory() {
    return countBy(this.#requests(), (r) => r.category, CATEGORIES);
  }

  /** 3. Requests grouped by priority. */
  requestsByPriority() {
    return countBy(this.#requests(), (r) => r.priority, PRIORITIES);
  }

  /** 4. Open requests that are Urgent or score 70+, most important first (uses polymorphism). */
  urgentRequests() {
    return this.#requests()
      .filter((r) => OPEN_STATUSES.includes(r.status))
      .map((r) => ({ request: r, score: r.calculatePriorityScore() }))
      .filter(({ request, score }) => request.priority === 'Urgent' || score >= URGENT_SCORE)
      .sort((a, b) => b.score - a.score || a.request.dateSubmitted - b.request.dateSubmitted);
  }

  /** 5. Open requests that have been open longer than their target resolution hours. */
  overdueRequests(now = new Date()) {
    return this.#requests()
      .filter((r) => OPEN_STATUSES.includes(r.status))
      .map((r) => {
        const hoursOpen = (now - r.dateSubmitted) / MS_PER_HOUR;
        const targetHours = r.getTargetResolutionHours();
        return { request: r, hoursOpen, targetHours, hoursOverdue: hoursOpen - targetHours };
      })
      .filter((row) => row.hoursOverdue > 0)
      .sort((a, b) => b.hoursOverdue - a.hoursOverdue);
  }

  /** 6. Requests currently assigned to each Technician (open work and total). */
  requestsPerTechnician() {
    const assigned = this.#requests().filter((r) => r.assignedTechnician);
    const grouped = assigned.reduce((groups, r) => {
      const id = r.assignedTechnician.userId;
      groups[id] ??= { technicianId: id, name: r.assignedTechnician.getFullName(), total: 0, open: 0 };
      groups[id].total += 1;
      if (OPEN_STATUSES.includes(r.status)) groups[id].open += 1;
      return groups;
    }, {});
    return Object.values(grouped).sort((a, b) => b.total - a.total || a.technicianId.localeCompare(b.technicianId));
  }

  /** 7. Resolved or Closed requests for each Technician. */
  completedByTechnician() {
    const completed = this.#requests().filter((r) => r.assignedTechnician && COMPLETED_STATUSES.includes(r.status));
    const grouped = completed.reduce((groups, r) => {
      const id = r.assignedTechnician.userId;
      groups[id] ??= { technicianId: id, name: r.assignedTechnician.getFullName(), completed: 0, requestIds: [] };
      groups[id].completed += 1;
      groups[id].requestIds.push(r.requestId);
      return groups;
    }, {});
    return Object.values(grouped).sort((a, b) => b.completed - a.completed || a.technicianId.localeCompare(b.technicianId));
  }

  /** 8. Average hours from submission to resolution, overall and per category. */
  averageResolutionTime() {
    const hoursFor = (request) => {
      const resolved = request.getHistory().find((h) => h.newStatus === STATUS.RESOLVED);
      return resolved ? (resolved.timestamp - request.dateSubmitted) / MS_PER_HOUR : null;
    };
    const rows = this.#requests()
      .filter((r) => COMPLETED_STATUSES.includes(r.status))
      .map((r) => ({ category: r.category, hours: hoursFor(r) }))
      .filter((row) => row.hours !== null);
    const average = (list) => (list.length ? list.reduce((sum, row) => sum + row.hours, 0) / list.length : 0);
    const byCategory = CATEGORIES
      .map((category) => {
        const inCategory = rows.filter((row) => row.category === category);
        return { category, count: inCategory.length, averageHours: average(inCategory) };
      })
      .filter((row) => row.count > 0);
    return { count: rows.length, averageHours: average(rows), byCategory };
  }

  /** 9. Number of requests for each campus location, busiest first. */
  volumeByLocation() {
    const totals = countBy(this.#requests(), (r) => r.location);
    return Object.entries(totals)
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count || a.location.localeCompare(b.location));
  }

  /** The list of reports offered by the console menu. */
  static get REPORT_NAMES() {
    return [
      'Requests grouped by status',
      'Requests grouped by category',
      'Requests grouped by priority',
      'Urgent requests',
      'Overdue requests',
      'Requests assigned to each Technician',
      'Completed requests by Technician',
      'Average resolution time',
      'Request volume by campus location',
    ];
  }
}

module.exports = ReportService;
