'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const User = require('../src/models/User');
const ServiceRequest = require('../src/models/ServiceRequest');
const ServiceRequestManager = require('../src/services/ServiceRequestManager');
const CampusServiceApp = require('../src/CampusServiceApp');
const { ValidationError, DuplicateError, PermissionError, WorkflowError } = require('../src/utils/errors');

const userData = (id = 'DWU2026001') => ({
  userId: id, firstName: 'Mary', lastName: 'Kila', email: `${id.toLowerCase()}@dwu.ac.pg`, userType: 'Student',
});
const requestData = (requester, id = 'REQ001') => ({
  requestId: id, requester, title: 'Broken projector', description: 'Room 3 projector will not turn on',
  location: 'Block B Room 3', category: 'ICT Support', priority: 'High',
});
function setup() {
  const manager = new ServiceRequestManager();
  const mary = manager.registerUser(new User(userData('DWU2026001')));
  const john = manager.registerUser(new User({ ...userData('DWU2026002'), firstName: 'John' }));
  return { manager, mary, john };
}

// ---- required Pass tests --------------------------------------------------
test('P1 valid user registration: user is added successfully', () => {
  const manager = new ServiceRequestManager();
  manager.registerUser(new User(userData()));
  assert.equal(manager.getAllUsers().length, 1);
  assert.equal(manager.findUserById('DWU2026001').getFullName(), 'Mary Kila');
});

test('P2 duplicate user ID: second user is rejected', () => {
  const { manager } = setup();
  assert.throws(() => manager.registerUser(new User(userData('DWU2026001'))), DuplicateError);
  assert.equal(manager.getAllUsers().length, 2);
});

test('P3 valid request submission: stored with Submitted status', () => {
  const { manager, mary } = setup();
  manager.submitRequest(new ServiceRequest(requestData(mary)));
  assert.equal(manager.getAllRequests().length, 1);
  assert.equal(manager.findRequestById('REQ001').status, 'Submitted');
});

test('P4 invalid request category: request is rejected clearly', () => {
  const { mary } = setup();
  assert.throws(
    () => new ServiceRequest({ ...requestData(mary), category: 'Catering' }),
    (err) => err instanceof ValidationError && /Category "Catering" is not supported/.test(err.message)
  );
});

test('P5 view requester records: only the selected user\'s requests are shown', () => {
  const { manager, mary, john } = setup();
  manager.submitRequest(new ServiceRequest(requestData(mary, 'REQ001')));
  manager.submitRequest(new ServiceRequest(requestData(john, 'REQ002')));
  const marys = manager.getRequestsByUser('DWU2026001');
  assert.deepEqual(marys.map((r) => r.requestId), ['REQ001']);
});

test('P6 cancel Submitted request: status changes to Cancelled', () => {
  const { manager, mary } = setup();
  manager.submitRequest(new ServiceRequest(requestData(mary)));
  manager.cancelRequest('REQ001', 'DWU2026001');
  assert.equal(manager.findRequestById('REQ001').status, 'Cancelled');
});

// ---- extra validation tests -----------------------------------------------
test('P7 invalid user data is rejected (missing ID, names, bad email)', () => {
  assert.throws(() => new User({ ...userData(), userId: '' }), ValidationError);
  assert.throws(() => new User({ ...userData(), firstName: ' ' }), ValidationError);
  assert.throws(() => new User({ ...userData(), lastName: '' }), ValidationError);
  assert.throws(() => new User({ ...userData(), email: 'not-an-email' }), ValidationError);
});

test('P8 duplicate request ID, missing title/description and bad priority are rejected', () => {
  const { manager, mary } = setup();
  manager.submitRequest(new ServiceRequest(requestData(mary)));
  assert.throws(() => manager.submitRequest(new ServiceRequest(requestData(mary))), DuplicateError);
  assert.throws(() => new ServiceRequest({ ...requestData(mary, 'REQ009'), title: '' }), ValidationError);
  assert.throws(() => new ServiceRequest({ ...requestData(mary, 'REQ009'), description: '' }), ValidationError);
  assert.throws(() => new ServiceRequest({ ...requestData(mary, 'REQ009'), priority: 'Critical' }), ValidationError);
});

test('P9 another user cannot update or cancel a request', () => {
  const { manager, mary } = setup();
  manager.submitRequest(new ServiceRequest(requestData(mary)));
  assert.throws(() => manager.updateRequest('REQ001', 'DWU2026002', { title: 'Hacked' }), PermissionError);
  assert.throws(() => manager.cancelRequest('REQ001', 'DWU2026002'), PermissionError);
  assert.equal(manager.findRequestById('REQ001').title, 'Broken projector');
});

test('P10 an already Cancelled request cannot be cancelled or updated again', () => {
  const { manager, mary } = setup();
  manager.submitRequest(new ServiceRequest(requestData(mary)));
  manager.cancelRequest('REQ001', 'DWU2026001');
  assert.throws(() => manager.cancelRequest('REQ001', 'DWU2026001'), /already Cancelled/);
  assert.throws(() => manager.updateRequest('REQ001', 'DWU2026001', { title: 'x' }), WorkflowError);
});

test('P11 update changes only valid fields and is all-or-nothing', () => {
  const { manager, mary } = setup();
  manager.submitRequest(new ServiceRequest(requestData(mary)));
  manager.updateRequest('REQ001', 'DWU2026001', { title: 'Projector dead', priority: 'Urgent' });
  const r = manager.findRequestById('REQ001');
  assert.equal(r.title, 'Projector dead');
  assert.equal(r.priority, 'Urgent');
  assert.throws(() => manager.updateRequest('REQ001', 'DWU2026001', { title: 'Nope', category: 'Bad' }), ValidationError);
  assert.equal(r.title, 'Projector dead');   // unchanged because the category was invalid
});

test('P12 search and status summary use the stored requests', () => {
  const { manager, mary } = setup();
  manager.submitRequest(new ServiceRequest(requestData(mary, 'REQ001')));
  manager.submitRequest(new ServiceRequest({ ...requestData(mary, 'REQ002'), title: 'Leaking tap' }));
  manager.cancelRequest('REQ002', 'DWU2026001');
  assert.deepEqual(manager.searchRequests('tap').map((r) => r.requestId), ['REQ002']);
  assert.deepEqual(manager.searchRequests('req001').map((r) => r.requestId), ['REQ001']);
  const totals = manager.getRequestSummaryByStatus();   // Credit adds more statuses, all start at 0
  assert.equal(totals.Submitted, 1);
  assert.equal(totals.Cancelled, 1);
});

test('P13 the console workflow runs from registration to cancellation', async () => {
  const answers = [
    '1', 'DWU2026001', 'Mary', 'Kila', 'mary@dwu.ac.pg', '1', 'BSc IS', '2', // register (Student)
    '2', 'DWU2026001', 'Wi-Fi down', 'No signal', 'Library', '1', '3',       // submit (ICT, High)
    'Laptop', 'Campus Wi-Fi', '3', '2',                                       //   ICT details
    '4', 'DWU2026001',                                                        // view mine
    '8', 'wi-fi',                                                             // search
    '6', 'DWU2026001', 'REQ001', 'Wi-Fi very slow', '', '', '',                 // update
    '7', 'DWU2026001', 'REQ001',                                              // cancel
    '9', '10',                                                                // summary, exit
  ];
  const output = [];
  const app = new CampusServiceApp({ ask: async () => answers.shift(), write: (t) => output.push(t) });
  await app.run();
  const text = output.join('\n');
  assert.match(text, /SUCCESS: User registered/);
  assert.match(text, /SUCCESS: Request submitted/);
  assert.match(text, /Wi-Fi very slow/);
  assert.match(text, /Request REQ001 is now Cancelled/);
  assert.match(text, /Cancelled   : 1/);
});
