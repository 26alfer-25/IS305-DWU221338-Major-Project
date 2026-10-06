'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const ServiceRequest = require('../src/models/ServiceRequest');
const ICTSupportRequest = require('../src/models/ICTSupportRequest');
const MaintenanceRequest = require('../src/models/MaintenanceRequest');
const CleaningRequest = require('../src/models/CleaningRequest');
const GeneralServiceRequest = require('../src/models/GeneralServiceRequest');
const StudentRequester = require('../src/models/StudentRequester');
const Technician = require('../src/models/Technician');
const ServiceOfficer = require('../src/models/ServiceOfficer');
const SystemAdministrator = require('../src/models/SystemAdministrator');
const ServiceRequestManager = require('../src/services/ServiceRequestManager');
const ReportService = require('../src/services/ReportService');
const ServiceRequestFactory = require('../src/factories/ServiceRequestFactory');
const UserFactory = require('../src/factories/UserFactory');
const DataStore = require('../src/repositories/DataStore');
const UserFileRepository = require('../src/repositories/UserFileRepository');
const ServiceRequestFileRepository = require('../src/repositories/ServiceRequestFileRepository');
const CampusServiceApp = require('../src/CampusServiceApp');
const { NotImplementedError, StorageError, DuplicateError, ValidationError, PermissionError, NotFoundError } = require('../src/utils/errors');

const person = (id) => ({ userId: id, firstName: 'Test', lastName: id, email: `${id.toLowerCase()}@example.com` });
const base = (requester, id, extra = {}) => ({
  requestId: id, requester, title: `Title ${id}`, description: 'Some description', location: 'Library', priority: 'High', ...extra,
});
const ict = { deviceType: 'Laptop', systemName: 'Wi-Fi', faultType: 'Network', networkImpact: 'Campus-wide' };
const maint = { building: 'Block A', roomNumber: '2', hazardLevel: 'Critical', equipmentAffected: 'Wiring' };
const clean = { cleaningArea: 'Toilets', hygieneRisk: 'High', serviceType: 'Spill Response', preferredServiceTime: 'Morning' };

function world() {
  const manager = new ServiceRequestManager();
  const student = manager.registerUser(new StudentRequester(person('S1'), { programme: 'BSc IS', yearLevel: 1 }));
  manager.registerUser(new ServiceOfficer(person('SO1'), { serviceSection: 'ICT' }));
  manager.registerUser(new Technician(person('T1'), { speciality: 'Network' }));
  manager.registerUser(new Technician(person('T2'), { speciality: 'Electrical' }));
  manager.registerUser(new SystemAdministrator(person('A1'), { office: 'ICT Office' }));
  return { manager, student };
}
async function tempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'campus-test-'));       // tests never touch the real data/ folder
}
function fullLifecycle(manager, id) {
  manager.reviewRequest(id, 'SO1');
  manager.assignTechnician(id, 'SO1', 'T1');
  manager.startWork(id, 'T1');
  manager.addProgressNote(id, 'T1', 'Working on it');
  manager.resolveRequest(id, 'T1');
  manager.closeRequest(id, 'SO1');
}

test('D1 abstract-style base class: required methods throw a clear error', () => {
  const { student } = world();
  const bare = new ServiceRequest({ ...base(student, 'R1'), category: 'ICT Support' });
  assert.throws(() => bare.getRequestSummary(), (e) => e instanceof NotImplementedError && /must implement getRequestSummary/.test(e.message));
  assert.throws(() => bare.calculatePriorityScore(), NotImplementedError);
  assert.throws(() => bare.getTargetResolutionHours(), NotImplementedError);
});

test('D2 polymorphism: one loop gives each request type its own result', () => {
  const { student } = world();
  const requests = [
    new ICTSupportRequest(base(student, 'R1'), ict),
    new MaintenanceRequest(base(student, 'R2'), maint),
    new CleaningRequest(base(student, 'R3'), clean),
    new GeneralServiceRequest(base(student, 'R4'), { serviceArea: 'Events' }),
  ];
  const results = [];
  for (const request of requests) {
    results.push([request.getRequestSummary(), request.calculatePriorityScore(), request.getTargetResolutionHours()]);
  }
  assert.deepEqual(results.map((r) => r[1]), [70, 85, 75, 40]);
  assert.deepEqual(results.map((r) => r[2]), [4, 4, 6, 24]);
  assert.match(results[0][0], /Network impact : Campus-wide/);
  assert.match(results[1][0], /Hazard level       : Critical/);
  assert.match(results[2][0], /Service type   : Spill Response/);
  assert.match(results[3][0], /Service area  : Events/);
});

test('D3 invalid constructor values are rejected (requester, dates, restored status)', () => {
  const { student } = world();
  assert.throws(() => new ICTSupportRequest({ ...base(student, 'R1'), requester: null }, ict), ValidationError);
  assert.throws(() => new ICTSupportRequest({ ...base(student, 'R1'), status: 'Flying' }, ict), ValidationError);
  assert.throws(() => new ICTSupportRequest({ ...base(student, 'R1'), dateSubmitted: 'not a date' }, ict), ValidationError);
  assert.throws(() => new ICTSupportRequest({ ...base(student, 'R1'), assignedTechnician: student }, ict), ValidationError);
});

test('D4 the audit trail records successes and rejected attempts', () => {
  const { manager, student } = world();
  manager.submitRequest(new ICTSupportRequest(base(student, 'R1'), ict));
  manager.reviewRequest('R1', 'SO1');
  assert.throws(() => manager.assignTechnician('R1', 'S1', 'T1'), PermissionError);
  assert.throws(() => manager.registerUser(new Technician(person('T1'), { speciality: 'x' })), DuplicateError);
  manager.setRequestPriority('R1', 'SO1', 'Urgent');
  manager.assignTechnician('R1', 'SO1', 'T1');
  manager.startWork('R1', 'T1');
  manager.resolveRequest('R1', 'T1');
  manager.closeRequest('R1', 'SO1');
  const log = manager.getAuditLog();
  const actions = log.filter((a) => a.requestId === 'R1').map((a) => `${a.action}:${a.outcome.split(' ')[0]}`);
  assert.deepEqual(actions, [
    'Request Created:Success', 'Status Changed:Success', 'Technician Assigned:Rejected', 'Priority Changed:Success',
    'Technician Assigned:Success', 'Status Changed:Success', 'Request Resolved:Success', 'Request Closed:Success',
  ]);
  assert.ok(log.some((a) => a.action === 'User Registered' && a.outcome.startsWith('Rejected')));
  assert.equal(new Set(log.map((a) => a.auditId)).size, log.length);          // unique audit IDs
  assert.ok(log.every((a) => a.actorId && a.actorRole && a.description && a.timestamp instanceof Date));
});

test('D5 only a System Administrator may open admin data', () => {
  const { manager } = world();
  assert.equal(manager.assertCanViewAdminData('A1').userId, 'A1');
  assert.throws(() => manager.assertCanViewAdminData('S1'), PermissionError);
  assert.throws(() => manager.assertCanViewAdminData('NOPE'), NotFoundError);
});

test('D6 saving JSON: four files with plain data only', async () => {
  const dir = await tempDir();
  const { manager, student } = world();
  manager.submitRequest(new ICTSupportRequest(base(student, 'R1'), ict));
  fullLifecycle(manager, 'R1');
  const store = new DataStore(dir);
  await store.saveFrom(manager);
  for (const file of ['users.json', 'serviceRequests.json', 'requestHistory.json', 'auditLog.json']) {
    const parsed = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'));
    assert.ok(Array.isArray(parsed), `${file} holds an array`);
  }
  const saved = JSON.parse(await fs.readFile(path.join(dir, 'serviceRequests.json'), 'utf8'))[0];
  assert.equal(saved.requestType, 'ICTSupportRequest');
  assert.equal(saved.assignedTechnicianId, 'T1');
  assert.equal(saved.status, 'Closed');
  assert.deepEqual(saved.specialisedData, ict);
  const history = JSON.parse(await fs.readFile(path.join(dir, 'requestHistory.json'), 'utf8'));
  assert.equal(history.length, 7);
  assert.ok(!JSON.stringify(saved).includes('function'));
});

test('D7 loading restores the correct specialised objects', async () => {
  const dir = await tempDir();
  const { manager, student } = world();
  manager.submitRequest(new ICTSupportRequest(base(student, 'R1'), ict));
  manager.submitRequest(new MaintenanceRequest(base(student, 'R2'), maint));
  manager.submitRequest(new CleaningRequest(base(student, 'R3'), clean));
  manager.submitRequest(new GeneralServiceRequest(base(student, 'R4'), { serviceArea: 'Security' }));
  fullLifecycle(manager, 'R2');
  const store = new DataStore(dir);
  await store.saveFrom(manager);

  const reloaded = new ServiceRequestManager();
  const counts = await store.loadInto(reloaded);
  assert.deepEqual(counts, { users: 5, requests: 4, audit: manager.getAuditLog().length });
  const types = reloaded.getAllRequests().map((r) => r.constructor.name);
  assert.deepEqual(types, ['ICTSupportRequest', 'MaintenanceRequest', 'CleaningRequest', 'GeneralServiceRequest']);
  assert.ok(reloaded.findUserById('S1') instanceof StudentRequester);
  assert.ok(reloaded.findUserById('T1') instanceof Technician);
  const r2 = reloaded.findRequestById('R2');
  assert.equal(r2.status, 'Closed');
  assert.equal(r2.assignedTechnician.userId, 'T1');
  assert.equal(r2.getHistory().length, manager.findRequestById('R2').getHistory().length);
  // restored objects keep specialised validation, overriding and polymorphism
  assert.equal(r2.calculatePriorityScore(), 85);
  assert.equal(reloaded.findRequestById('R1').getTargetResolutionHours(), 4);
  assert.match(reloaded.findRequestById('R3').getRequestSummary(), /Hygiene risk   : High/);
  assert.throws(() => r2.transitionTo('Submitted', { actor: reloaded.findUserById('SO1') }), /Invalid status change/);
  // the workflow continues after a reload
  reloaded.submitRequest(new ICTSupportRequest(base(reloaded.findUserById('S1'), 'R5'), ict));
  reloaded.reviewRequest('R5', 'SO1');
  assert.equal(reloaded.findRequestById('R5').status, 'Reviewed');
});

test('D8 missing and empty data files load as empty arrays', async () => {
  const dir = await tempDir();
  const manager = new ServiceRequestManager();
  const counts = await new DataStore(path.join(dir, 'does', 'not', 'exist')).loadInto(manager);
  assert.deepEqual(counts, { users: 0, requests: 0, audit: 0 });
  await fs.writeFile(path.join(dir, 'users.json'), '', 'utf8');            // empty file
  assert.deepEqual(await new UserFileRepository(dir).loadAll(), []);
  const created = await new ServiceRequestFileRepository(dir).loadAll();   // missing file is created
  assert.deepEqual(created, []);
  assert.equal(JSON.parse(await fs.readFile(path.join(dir, 'serviceRequests.json'), 'utf8')).length, 0);
});

test('D9 file-reading errors give clear messages and load nothing', async () => {
  const dir = await tempDir();
  await fs.writeFile(path.join(dir, 'users.json'), '{ broken', 'utf8');
  await assert.rejects(new UserFileRepository(dir).loadAll(), (e) => e instanceof StorageError && /valid JSON/.test(e.message));
  await fs.writeFile(path.join(dir, 'users.json'), '{"a":1}', 'utf8');
  await assert.rejects(new UserFileRepository(dir).loadAll(), /must contain a JSON array/);
  await fs.writeFile(path.join(dir, 'users.json'), JSON.stringify([{ userId: 'X', firstName: 'A', lastName: 'B', email: 'bad', userType: 'Student', specialisedData: {} }]));
  const manager = new ServiceRequestManager();
  await assert.rejects(new DataStore(dir).loadInto(manager), (e) => e instanceof StorageError && /not valid and was not loaded/.test(e.message));
  assert.equal(manager.getAllUsers().length, 0);
  // a request that points at a user who does not exist
  await fs.writeFile(path.join(dir, 'users.json'), '[]');
  await fs.writeFile(path.join(dir, 'serviceRequests.json'), JSON.stringify([{ requestId: 'R1', requestType: 'ICTSupportRequest', requesterId: 'GHOST' }]));
  await assert.rejects(new DataStore(dir).loadInto(new ServiceRequestManager()), /unknown requester/);
  await fs.writeFile(path.join(dir, 'serviceRequests.json'), JSON.stringify([{ requestId: 'R1', requestType: 'MagicRequest' }]));
  await assert.rejects(new DataStore(dir).loadInto(new ServiceRequestManager()), /Unknown request type/);
});

test('D10 file-writing errors are reported and invalid records are never saved', async () => {
  const dir = await tempDir();
  const blocker = path.join(dir, 'blocker');
  await fs.writeFile(blocker, 'I am a file, not a folder');
  const { manager, student } = world();
  manager.submitRequest(new ICTSupportRequest(base(student, 'R1'), ict));
  await assert.rejects(new DataStore(path.join(blocker, 'data')).saveFrom(manager), (e) => e instanceof StorageError && /Cannot write/.test(e.message));
  const repo = new ServiceRequestFileRepository(dir);
  await assert.rejects(repo.saveAll([{ title: 'no id' }]), /missing its requestId/);
  await assert.rejects(repo.saveAll([{ requestId: 'A' }, { requestId: 'A' }]), DuplicateError);
  await assert.rejects(repo.saveAll([{ requestId: 'A', bad: () => 1 }]), /cannot be saved as JSON/);
  await assert.rejects(repo.saveAll([{ requestId: 'A', when: new Date() }]), /cannot be saved as JSON/);
  await assert.rejects(fs.access(path.join(dir, 'serviceRequests.json')));      // nothing was written
});

test('D11 repository methods: create, findById, findByRequester, findByTechnician, update', async () => {
  const dir = await tempDir();
  const repo = new ServiceRequestFileRepository(dir);
  await repo.create({ requestId: 'R1', requesterId: 'S1', assignedTechnicianId: 'T1', status: 'Assigned' });
  await repo.create({ requestId: 'R2', requesterId: 'S2', assignedTechnicianId: null, status: 'Submitted' });
  await assert.rejects(repo.create({ requestId: 'R1' }), DuplicateError);
  assert.equal((await repo.findById('R2')).requesterId, 'S2');
  assert.equal(await repo.findById('NOPE'), null);
  assert.deepEqual((await repo.findByRequester('S1')).map((r) => r.requestId), ['R1']);
  assert.deepEqual((await repo.findByTechnician('T1')).map((r) => r.requestId), ['R1']);
  const updated = await repo.update('R2', { status: 'Reviewed', requestId: 'HACK' });
  assert.equal(updated.status, 'Reviewed');
  assert.equal(updated.requestId, 'R2');                                       // ID cannot change
  await assert.rejects(repo.update('NOPE', {}), NotFoundError);
  assert.equal((await repo.loadAll()).length, 2);
});

test('D12 report calculations are correct', () => {
  const { manager, student } = world();
  manager.submitRequest(new ICTSupportRequest(base(student, 'R1', { location: 'Library' }), ict));                       // score 70, open
  manager.submitRequest(new MaintenanceRequest(base(student, 'R2', { priority: 'Low', location: 'Block A' }), { ...maint, hazardLevel: 'Low' }));
  manager.submitRequest(new CleaningRequest(base(student, 'R3', { priority: 'Medium', location: 'Library' }), clean));
  manager.submitRequest(new GeneralServiceRequest(base(student, 'R4', { priority: 'Urgent' }), { serviceArea: 'Events' }));
  fullLifecycle(manager, 'R2');
  manager.cancelRequest('R3', 'S1');
  const reports = new ReportService(manager);

  const byStatus = reports.requestsByStatus();
  assert.equal(byStatus.Submitted, 2);
  assert.equal(byStatus.Closed, 1);
  assert.equal(byStatus.Cancelled, 1);
  assert.equal(byStatus.Reviewed, 0);
  assert.equal(reports.requestsByCategory()['ICT Support'], 1);
  assert.deepEqual(reports.requestsByPriority(), { Low: 1, Medium: 1, High: 1, Urgent: 1 });
  assert.deepEqual(reports.urgentRequests().map((r) => [r.request.requestId, r.score]), [['R4', 60], ['R1', 70]].sort((a, b) => b[1] - a[1]));
  assert.deepEqual(reports.volumeByLocation(), [{ location: 'Library', count: 3 }, { location: 'Block A', count: 1 }]);
  assert.deepEqual(reports.requestsPerTechnician(), [{ technicianId: 'T1', name: 'Test T1', total: 1, open: 0 }]);
  assert.deepEqual(reports.completedByTechnician().map((r) => [r.technicianId, r.completed]), [['T1', 1]]);
  const average = reports.averageResolutionTime();
  assert.equal(average.count, 1);
  assert.ok(average.averageHours >= 0 && average.averageHours < 0.1);         // lifecycle ran in milliseconds
  // overdue: look 100 hours into the future - every open request is past its target
  const overdue = reports.overdueRequests(new Date(Date.now() + 100 * 3600 * 1000));
  assert.deepEqual(overdue.map((o) => o.request.requestId).sort(), ['R1', 'R4']);
  assert.deepEqual(reports.overdueRequests(new Date()), []);
});

test('D13 reports work on requests restored from JSON', async () => {
  const dir = await tempDir();
  const { manager, student } = world();
  manager.submitRequest(new ICTSupportRequest(base(student, 'R1'), ict));
  manager.submitRequest(new CleaningRequest(base(student, 'R2'), clean));
  const store = new DataStore(dir);
  await store.saveFrom(manager);
  const reloaded = new ServiceRequestManager();
  await store.loadInto(reloaded);
  assert.deepEqual(new ReportService(reloaded).requestsByStatus(), new ReportService(manager).requestsByStatus());
  assert.deepEqual(new ReportService(reloaded).urgentRequests().map((r) => r.score), [70, 75].sort((a, b) => b - a));
});

test('D14 the console saves after each action and the next run reloads it', async () => {
  const dir = await tempDir();
  const run = async (answers) => {
    const out = [];
    await new CampusServiceApp({ store: new DataStore(dir), ask: async () => answers.shift() ?? null, write: (t) => out.push(t) }).run();
    return out.join('\n');
  };
  const first = await run([
    '1', 'S9', 'Amy', 'Pole', 'amy@example.com', '1', 'BSc', '2',
    '2', 'S9', 'Broken chair', 'Loose leg', 'Block A', '2', '2', 'Block A', '3', '2', 'Chair', '10',
  ]);
  assert.match(first, /SUCCESS: Request submitted/);
  const second = await run(['3', 'REQ001', '10']);
  assert.match(second, /Loaded 1 users, 1 requests/);
  assert.match(second, /Broken chair/);
  assert.match(second, /Equipment affected : Chair/);
  // corrupt file: the app reports the problem and does not overwrite it
  await fs.writeFile(path.join(dir, 'users.json'), 'oops');
  const third = await run(['10']);
  assert.match(third, /FILE ERROR/);
  assert.equal(await fs.readFile(path.join(dir, 'users.json'), 'utf8'), 'oops');
});

test('D15 factories build the right classes and reject unknown types', () => {
  assert.ok(UserFactory.createFromData({ ...person('T9'), userType: 'Technician', specialisedData: { speciality: 'Net' } }) instanceof Technician);
  assert.throws(() => UserFactory.createFromData({ ...person('X'), userType: 'Alien', specialisedData: {} }), ValidationError);
  assert.throws(() => ServiceRequestFactory.createRequest({ category: 'Nope' }), ValidationError);
  assert.throws(() => ServiceRequestFactory.createFromData(null), ValidationError);
});
