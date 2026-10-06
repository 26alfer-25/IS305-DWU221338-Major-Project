'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const User = require('../src/models/User');
const StudentRequester = require('../src/models/StudentRequester');
const StaffRequester = require('../src/models/StaffRequester');
const ServiceOfficer = require('../src/models/ServiceOfficer');
const Technician = require('../src/models/Technician');
const SystemAdministrator = require('../src/models/SystemAdministrator');
const ServiceRequest = require('../src/models/ServiceRequest');
const ICTSupportRequest = require('../src/models/ICTSupportRequest');
const MaintenanceRequest = require('../src/models/MaintenanceRequest');
const CleaningRequest = require('../src/models/CleaningRequest');
const GeneralServiceRequest = require('../src/models/GeneralServiceRequest');
const ServiceRequestFactory = require('../src/factories/ServiceRequestFactory');
const ServiceRequestManager = require('../src/services/ServiceRequestManager');
const { ValidationError, PermissionError, WorkflowError } = require('../src/utils/errors');

const common = (id, extra = {}) => ({
  userId: id, firstName: 'Test', lastName: id, email: `${id.toLowerCase()}@dwu.ac.pg`, ...extra,
});
const reqCommon = (requester, id = 'REQ001', extra = {}) => ({
  requestId: id, requester, title: 'Wi-Fi not working', description: 'Cannot connect on level 2',
  location: 'Library Level 2', priority: 'High', ...extra,
});
const ictData = { deviceType: 'Laptop', systemName: 'Campus Wi-Fi', faultType: 'Network', networkImpact: 'Department' };

function setup() {
  const manager = new ServiceRequestManager();
  const student = manager.registerUser(new StudentRequester(common('DWU2026001'), { programme: 'BSc IS', yearLevel: 2 }));
  const staff = manager.registerUser(new StaffRequester(common('STAFF001'), { department: 'Library' }));
  const officer = manager.registerUser(new ServiceOfficer(common('SO001'), { serviceSection: 'ICT Services' }));
  const tech = manager.registerUser(new Technician(common('TECH001'), { speciality: 'Networking' }));
  const tech2 = manager.registerUser(new Technician(common('TECH002'), { speciality: 'Electrical' }));
  const admin = manager.registerUser(new SystemAdministrator(common('ADM001'), { office: 'ICT Office' }));
  return { manager, student, staff, officer, tech, tech2, admin };
}
const submitIct = (manager, student, id = 'REQ001', extra = {}) =>
  manager.submitRequest(ServiceRequestFactory.createRequest(
    reqCommon(student, id, { category: 'ICT Support', ...extra }), ictData));

// ---- C1 inheritance and super() -------------------------------------------------
test('C1 User subclasses call super() and inherit User behaviour', () => {
  const { student, staff, officer, tech } = setup();
  for (const u of [student, staff, officer, tech]) {
    assert.ok(u instanceof User);
    assert.equal(typeof u.getFullName(), 'string');
  }
  assert.equal(student.userType, 'Student');          // set by super() from the subclass
  assert.equal(staff.userType, 'Staff');
  assert.equal(officer.userType, 'Service Officer');
  assert.equal(tech.userType, 'Technician');
  assert.equal(student.userId, 'DWU2026001');          // stored by the User constructor
  assert.match(student.displayInfo(), /Programme : BSc IS \(Year 2\)/);
});

test('C2 request subclasses call super() and fix their category', () => {
  const { student } = setup();
  const ict = new ICTSupportRequest(reqCommon(student), ictData);
  assert.ok(ict instanceof ServiceRequest);
  assert.equal(ict.category, 'ICT Support');
  assert.equal(ict.status, 'Submitted');
  assert.equal(ict.requester.userId, 'DWU2026001');
  const cleaning = new CleaningRequest(reqCommon(student, 'REQ002'), {
    cleaningArea: 'Lecture Hall 1', hygieneRisk: 'High', serviceType: 'Spill Response', preferredServiceTime: 'Morning',
  });
  assert.equal(cleaning.category, 'Cleaning and Sanitation');
});

test('C3 specialised fields are validated', () => {
  const { student } = setup();
  assert.throws(() => new ICTSupportRequest(reqCommon(student), { ...ictData, faultType: 'Magic' }), ValidationError);
  assert.throws(() => new ICTSupportRequest(reqCommon(student), { ...ictData, deviceType: '' }), ValidationError);
  assert.throws(() => new MaintenanceRequest(reqCommon(student), { building: 'A', roomNumber: '1', hazardLevel: 'Extreme', equipmentAffected: 'Door' }), ValidationError);
  assert.throws(() => new CleaningRequest(reqCommon(student), { cleaningArea: 'Hall', hygieneRisk: 'High', serviceType: 'Deep Clean', preferredServiceTime: 'Midnight' }), ValidationError);
  assert.throws(() => new StudentRequester(common('X1'), { programme: 'BSc', yearLevel: 9 }), ValidationError);
  assert.throws(() => new Technician(common('X2'), { speciality: '' }), ValidationError);
});

test('C4 only Service Officers can review, prioritise and assign Technicians', () => {
  const { manager, student, tech } = setup();
  submitIct(manager, student);
  assert.throws(() => manager.reviewRequest('REQ001', 'DWU2026001'), PermissionError);
  assert.throws(() => manager.reviewRequest('REQ001', 'TECH001'), PermissionError);
  manager.reviewRequest('REQ001', 'SO001');
  assert.throws(() => manager.setRequestPriority('REQ001', 'TECH001', 'Urgent'), PermissionError);
  assert.throws(() => manager.assignTechnician('REQ001', 'DWU2026001', 'TECH001'), PermissionError);
  assert.throws(() => manager.assignTechnician('REQ001', 'SO001', 'DWU2026001'), ValidationError);   // not a Technician
  manager.assignTechnician('REQ001', 'SO001', 'TECH001');
  assert.equal(manager.findRequestById('REQ001').assignedTechnician.userId, tech.userId);
});

test('C5 only the assigned Technician can start, update and resolve work', () => {
  const { manager, student } = setup();
  submitIct(manager, student);
  manager.reviewRequest('REQ001', 'SO001');
  manager.assignTechnician('REQ001', 'SO001', 'TECH001');
  assert.throws(() => manager.startWork('REQ001', 'TECH002'), PermissionError);
  assert.throws(() => manager.startWork('REQ001', 'SO001'), PermissionError);
  manager.startWork('REQ001', 'TECH001');
  assert.throws(() => manager.addProgressNote('REQ001', 'TECH002', 'hack'), PermissionError);
  manager.addProgressNote('REQ001', 'TECH001', 'Replaced access point');
  assert.throws(() => manager.resolveRequest('REQ001', 'TECH002'), PermissionError);
  manager.resolveRequest('REQ001', 'TECH001');
  assert.throws(() => manager.closeRequest('REQ001', 'TECH001'), PermissionError);
  manager.closeRequest('REQ001', 'SO001');
  assert.equal(manager.findRequestById('REQ001').status, 'Closed');
});

test('C6 invalid status transitions are rejected', () => {
  const { manager, student } = setup();
  submitIct(manager, student);
  assert.throws(() => manager.assignTechnician('REQ001', 'SO001', 'TECH001'), WorkflowError);   // not Reviewed yet
  assert.throws(() => manager.closeRequest('REQ001', 'SO001'), WorkflowError);
  manager.reviewRequest('REQ001', 'SO001');
  assert.throws(() => manager.reviewRequest('REQ001', 'SO001'), WorkflowError);                 // already Reviewed
  assert.throws(() => manager.cancelRequest('REQ001', 'DWU2026001'), /Only Submitted requests can be cancelled/);
  assert.throws(() => manager.updateRequest('REQ001', 'DWU2026001', { title: 'x' }), WorkflowError);
  const request = manager.findRequestById('REQ001');
  assert.equal(request.status, 'Reviewed');                    // nothing changed after the failures
  assert.equal(request.assignedTechnician, null);
});

test('C7 Cancelled and Closed are final statuses', () => {
  const { manager, student } = setup();
  submitIct(manager, student, 'REQ001');
  manager.cancelRequest('REQ001', 'DWU2026001');
  assert.throws(() => manager.reviewRequest('REQ001', 'SO001'), WorkflowError);
  const r = manager.findRequestById('REQ001');
  assert.throws(() => r.transitionTo('Submitted', { actor: student, action: 'x' }), WorkflowError);
});

test('C8 specialised summaries show the correct information', () => {
  const { student } = setup();
  const ict = new ICTSupportRequest(reqCommon(student), ictData);
  const maint = new MaintenanceRequest(reqCommon(student, 'REQ002', { title: 'Broken door' }),
    { building: 'Block A', roomNumber: 12, hazardLevel: 'High', equipmentAffected: 'Door lock' });
  const clean = new CleaningRequest(reqCommon(student, 'REQ003', { title: 'Spill' }),
    { cleaningArea: 'Cafeteria', hygieneRisk: 'Medium', serviceType: 'Spill Response', preferredServiceTime: 'Afternoon' });
  assert.match(ict.getRequestSummary(), /Network impact : Department/);
  assert.match(ict.getRequestSummary(), /Fault type     : Network/);
  assert.match(maint.getRequestSummary(), /Hazard level       : High/);
  assert.match(maint.getRequestSummary(), /Room number        : 12/);
  assert.match(clean.getRequestSummary(), /Service type   : Spill Response/);
  assert.doesNotMatch(ict.getRequestSummary(), /Hazard level/);
});

test('C9 subclasses override score and target hours differently', () => {
  const { student } = setup();
  const ict = new ICTSupportRequest(reqCommon(student, 'R1', { priority: 'High' }), { ...ictData, networkImpact: 'Campus-wide' });
  const maint = new MaintenanceRequest(reqCommon(student, 'R2', { priority: 'High' }),
    { building: 'B', roomNumber: '1', hazardLevel: 'Critical', equipmentAffected: 'Wiring' });
  const clean = new CleaningRequest(reqCommon(student, 'R3', { priority: 'High' }),
    { cleaningArea: 'Toilets', hygieneRisk: 'High', serviceType: 'Spill Response', preferredServiceTime: 'Morning' });
  const general = new GeneralServiceRequest(reqCommon(student, 'R4', { priority: 'High' }), { serviceArea: 'Security' });
  assert.equal(ict.calculatePriorityScore(), 40 + 30);
  assert.equal(maint.calculatePriorityScore(), 40 + 45);
  assert.equal(clean.calculatePriorityScore(), 40 + 25 + 10);
  assert.equal(general.calculatePriorityScore(), 40);
  assert.deepEqual([ict, maint, clean, general].map((r) => r.getTargetResolutionHours()), [4, 4, 6, 24]);
});

const pause = () => new Promise((resolve) => setTimeout(resolve, 5));   // makes submission times differ

test('C10 search, filter and sort return correct results', async () => {
  const { manager, student, staff } = setup();
  submitIct(manager, student, 'REQ001', { priority: 'Low', title: 'Wi-Fi down' });
  await pause();
  manager.submitRequest(new MaintenanceRequest(reqCommon(staff, 'REQ002', { priority: 'Urgent', title: 'Broken door' }),
    { building: 'A', roomNumber: '2', hazardLevel: 'High', equipmentAffected: 'Door' }));
  await pause();
  submitIct(manager, student, 'REQ003', { priority: 'High', title: 'Printer offline' });
  manager.reviewRequest('REQ003', 'SO001');
  manager.assignTechnician('REQ003', 'SO001', 'TECH001');

  assert.deepEqual(manager.searchRequests('door').map((r) => r.requestId), ['REQ002']);
  assert.deepEqual(manager.searchRequests('REQ00').map((r) => r.requestId), ['REQ001', 'REQ002', 'REQ003']);
  assert.deepEqual(manager.filterRequests({ category: 'ICT Support' }).map((r) => r.requestId), ['REQ001', 'REQ003']);
  assert.deepEqual(manager.filterRequests({ status: 'Assigned' }).map((r) => r.requestId), ['REQ003']);
  assert.deepEqual(manager.filterRequests({ priority: 'Urgent' }).map((r) => r.requestId), ['REQ002']);
  assert.deepEqual(manager.filterRequests({ technicianId: 'TECH001' }).map((r) => r.requestId), ['REQ003']);
  assert.deepEqual(manager.filterRequests({ category: 'ICT Support', status: 'Submitted' }).map((r) => r.requestId), ['REQ001']);
  assert.deepEqual(manager.sortByPriority('desc').map((r) => r.requestId), ['REQ002', 'REQ003', 'REQ001']);
  assert.deepEqual(manager.sortByPriority('asc').map((r) => r.requestId), ['REQ001', 'REQ003', 'REQ002']);
  assert.equal(manager.sortByDateSubmitted('asc')[0].requestId, 'REQ001');
  assert.equal(manager.sortByDateSubmitted('desc')[2].requestId, 'REQ001');
  assert.throws(() => manager.filterRequests({ status: 'Flying' }), ValidationError);
});

test('C11 request history records every approved workflow action', () => {
  const { manager, student } = setup();
  submitIct(manager, student);
  manager.reviewRequest('REQ001', 'SO001', 'Looks valid');
  manager.setRequestPriority('REQ001', 'SO001', 'Urgent');
  manager.assignTechnician('REQ001', 'SO001', 'TECH001');
  manager.startWork('REQ001', 'TECH001');
  manager.addProgressNote('REQ001', 'TECH001', 'Ordered part');
  manager.resolveRequest('REQ001', 'TECH001', 'Part fitted');
  manager.closeRequest('REQ001', 'SO001');
  const history = manager.findRequestById('REQ001').getHistory();
  assert.deepEqual(history.map((h) => h.action), [
    'Request Submitted', 'Request Reviewed', 'Priority Assigned', 'Technician Assigned',
    'Work Started', 'Progress Note', 'Request Resolved', 'Request Closed',
  ]);
  assert.deepEqual(history[1], { ...history[1], previousStatus: 'Submitted', newStatus: 'Reviewed', actorId: 'SO001', actorRole: 'Service Officer', comment: 'Looks valid' });
  assert.ok(history.every((h) => h.timestamp instanceof Date));
  // a rejected action leaves no history entry
  assert.throws(() => manager.reviewRequest('REQ001', 'SO001'), WorkflowError);
  assert.equal(manager.findRequestById('REQ001').getHistory().length, 8);
});

test('C12 requester rules: only requesters submit; specialised category cannot change', () => {
  const { manager, officer, student } = setup();
  const bad = new ICTSupportRequest(reqCommon(officer, 'REQ009'), ictData);
  assert.throws(() => manager.submitRequest(bad), PermissionError);
  submitIct(manager, student);
  assert.throws(() => manager.updateRequest('REQ001', 'DWU2026001', { category: 'Facilities Maintenance' }), ValidationError);
  manager.updateRequest('REQ001', 'DWU2026001', { title: 'Wi-Fi keeps dropping' });
  assert.equal(manager.findRequestById('REQ001').title, 'Wi-Fi keeps dropping');
});

test('C13 factory rejects unsupported categories and progress notes need In Progress', () => {
  const { manager, student } = setup();
  assert.throws(() => ServiceRequestFactory.createRequest(reqCommon(student, 'R', { category: 'Catering' }), {}), ValidationError);
  submitIct(manager, student);
  manager.reviewRequest('REQ001', 'SO001');
  manager.assignTechnician('REQ001', 'SO001', 'TECH001');
  assert.throws(() => manager.addProgressNote('REQ001', 'TECH001', 'too early'), WorkflowError);
});
