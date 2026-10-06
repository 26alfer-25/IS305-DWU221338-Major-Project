'use strict';

/**
 * Creates SIMULATED sample data in the data/ folder (or the folder given as the first argument).
 *   node scripts/generateSampleData.js            -> overwrites data/*.json
 *   node scripts/generateSampleData.js some/dir   -> writes into some/dir
 * It builds the data through the real workflow (so every rule is respected) and
 * then spreads the timestamps over the last few days so the reports have something to show.
 */
const path = require('node:path');
const ServiceRequestManager = require('../src/services/ServiceRequestManager');
const ServiceRequestFactory = require('../src/factories/ServiceRequestFactory');
const UserFactory = require('../src/factories/UserFactory');
const DataStore = require('../src/repositories/DataStore');

const HOUR = 60 * 60 * 1000;
const person = (userId, firstName, lastName, userType) => ({
  userId, firstName, lastName, userType, email: `${firstName}.${lastName}@example.com`.toLowerCase(),
});

async function main() {
  const dataDir = path.resolve(process.argv[2] ?? path.join(__dirname, '..', 'data'));
  const manager = new ServiceRequestManager();
  const add = (common, specialised) => manager.registerUser(UserFactory.createUser(common, specialised));

  add(person('DWU2026001', 'Mary', 'Kila', 'Student'), { programme: 'BSc Information Systems', yearLevel: 2 });
  add(person('DWU2026002', 'John', 'Sausau', 'Student'), { programme: 'Bachelor of Education', yearLevel: 3 });
  add(person('STAFF001', 'Grace', 'Tobby', 'Staff'), { department: 'Library' });
  add(person('SO001', 'Peter', 'Walo', 'Service Officer'), { serviceSection: 'ICT and Facilities' });
  add(person('TECH001', 'Daniel', 'Aiwa', 'Technician'), { speciality: 'Networking' });
  add(person('TECH002', 'Ruth', 'Bani', 'Technician'), { speciality: 'Electrical and Plumbing' });
  add(person('TECH003', 'Sarah', 'Nema', 'Technician'), { speciality: 'Cleaning and Sanitation' });
  add(person('ADM001', 'Anna', 'Kopi', 'Administrator'), { office: 'ICT Office' });

  const submit = (requester, id, category, title, description, location, priority, specialised) =>
    manager.submitRequest(ServiceRequestFactory.createRequest(
      { requestId: id, requester: manager.findUserById(requester), category, title, description, location, priority },
      specialised));

  // schedule: requestId -> [hours ago it was submitted, hours between workflow steps]
  const schedule = {};

  // REQ001 - full lifecycle, Closed
  submit('DWU2026001', 'REQ001', 'ICT Support', 'Unable to access campus Wi-Fi', 'Cannot connect to the campus network on Level 2.',
    'Library Level 2', 'High', { deviceType: 'Laptop', systemName: 'Campus Wi-Fi', faultType: 'Network', networkImpact: 'Department' });
  manager.reviewRequest('REQ001', 'SO001', 'Confirmed with the library.');
  manager.setRequestPriority('REQ001', 'SO001', 'High');
  manager.assignTechnician('REQ001', 'SO001', 'TECH001');
  manager.startWork('REQ001', 'TECH001');
  manager.addProgressNote('REQ001', 'TECH001', 'Access point on Level 2 had lost power.');
  manager.resolveRequest('REQ001', 'TECH001', 'Replaced the power adapter.');
  manager.closeRequest('REQ001', 'SO001', 'Tested by library staff.');
  schedule.REQ001 = [96, 2.5];

  // REQ002 - Assigned (overdue)
  submit('DWU2026002', 'REQ002', 'Facilities Maintenance', 'Broken door lock', 'The lock on the Block B store room door is jammed.',
    'Block B Room 4', 'Urgent', { building: 'Block B', roomNumber: '4', hazardLevel: 'High', equipmentAffected: 'Door lock' });
  manager.reviewRequest('REQ002', 'SO001');
  manager.assignTechnician('REQ002', 'SO001', 'TECH002');
  schedule.REQ002 = [30, 2];

  // REQ003 - In Progress (overdue)
  submit('STAFF001', 'REQ003', 'Cleaning and Sanitation', 'Spill in the cafeteria', 'Drink spilled near the serving counter.',
    'Cafeteria', 'Medium', { cleaningArea: 'Serving counter', hygieneRisk: 'High', serviceType: 'Spill Response', preferredServiceTime: 'Afternoon' });
  manager.reviewRequest('REQ003', 'SO001');
  manager.assignTechnician('REQ003', 'SO001', 'TECH003');
  manager.startWork('REQ003', 'TECH003');
  manager.addProgressNote('REQ003', 'TECH003', 'Area is blocked off; waiting for the wet vacuum.');
  schedule.REQ003 = [10, 1.5];

  // REQ004 - Submitted
  submit('DWU2026001', 'REQ004', 'General Campus Service', 'Chairs needed for Open Day', 'Forty extra chairs for the main hall.',
    'Main Hall', 'Low', { serviceArea: 'Events' });
  schedule.REQ004 = [5, 1];

  // REQ005 - Resolved (waiting for the officer to close)
  submit('STAFF001', 'REQ005', 'ICT Support', 'Projector not working', 'Projector shows no signal in Lecture Hall 2.',
    'Lecture Hall 2', 'Medium', { deviceType: 'Projector', systemName: 'Lecture Hall 2 AV system', faultType: 'Hardware', networkImpact: 'Single User' });
  manager.reviewRequest('REQ005', 'SO001');
  manager.assignTechnician('REQ005', 'SO001', 'TECH001');
  manager.startWork('REQ005', 'TECH001');
  manager.resolveRequest('REQ005', 'TECH001', 'Replaced the HDMI cable.');
  schedule.REQ005 = [20, 3];

  // REQ006 - Cancelled by the requester
  submit('DWU2026001', 'REQ006', 'Facilities Maintenance', 'Leaking tap', 'Tap in the student lounge drips slowly.',
    'Student Lounge', 'Low', { building: 'Student Centre', roomNumber: 'Lounge', hazardLevel: 'Low', equipmentAffected: 'Tap' });
  manager.cancelRequest('REQ006', 'DWU2026001');
  schedule.REQ006 = [8, 0.5];

  // REQ007 - Reviewed
  submit('DWU2026002', 'REQ007', 'ICT Support', 'Library computers cannot log in', 'Every lab PC rejects the student login.',
    'Library Level 2', 'Urgent', { deviceType: 'Desktop', systemName: 'Library lab PCs', faultType: 'Account Access', networkImpact: 'Campus-wide' });
  manager.reviewRequest('REQ007', 'SO001');
  schedule.REQ007 = [2, 0.5];

  const store = new DataStore(dataDir);
  await store.saveFrom(manager);
  await spreadTimestamps(store, schedule);
  const check = new ServiceRequestManager();
  const counts = await store.loadInto(check);          // proves the files reload into real objects
  console.log(`Sample data written to ${dataDir}`);
  console.log(`Verified reload: ${counts.users} users, ${counts.requests} requests, ${counts.audit} audit records.`);
}

/** Gives each request realistic submission times and gaps between workflow steps. */
async function spreadTimestamps(store, schedule) {
  const now = Date.now();
  const requests = await store.requestRepository.loadAll();
  const history = await store.historyRepository.loadAll();
  const audit = await store.auditRepository.loadAll();
  const iso = (ms) => new Date(ms).toISOString();
  const auditTimes = new Map();

  for (const request of requests) {
    const [hoursAgo, gapHours] = schedule[request.requestId];
    const start = now - hoursAgo * HOUR;
    const entries = history.filter((h) => h.requestId === request.requestId);
    entries.forEach((entry, index) => { entry.timestamp = iso(start + index * gapHours * HOUR); });
    request.dateSubmitted = iso(start);
    request.dateUpdated = entries[entries.length - 1].timestamp;
    auditTimes.set(request.requestId, entries.map((e) => e.timestamp));
  }
  const firstStart = Math.min(...Object.values(schedule).map(([h]) => now - h * HOUR));
  const seen = {};
  let registration = 0;
  for (const entry of audit) {
    if (entry.requestId) {
      seen[entry.requestId] = (seen[entry.requestId] ?? -1) + 1;
      entry.timestamp = auditTimes.get(entry.requestId)[seen[entry.requestId]];
    } else {
      registration += 1;
      entry.timestamp = iso(firstStart - 24 * HOUR + registration * 60 * 1000);
    }
  }
  audit.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  audit.forEach((entry, index) => { entry.auditId = `AUD${String(index + 1).padStart(5, '0')}`; });

  await store.requestRepository.saveAll(requests);
  await store.historyRepository.saveAll(history);
  await store.auditRepository.saveAll(audit);
}

main().catch((error) => {
  console.error(`Could not create sample data: ${error.message}`);
  process.exitCode = 1;
});
