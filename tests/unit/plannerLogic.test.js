const test = require('node:test');
const assert = require('node:assert');
const logic = require('../../src/services/plannerLogic');
const { timeToMinutes } = require('../../src/utils/dateUtils');

const task = (over) => ({
  key: 'a-1', type: 'assignment', refId: 1, subjectId: 1, title: 'Task', deadline: '2030-01-10',
  priority: 'Medium', subjectPriority: 'Medium', hoursRemaining: 4, ...over
});

test('calculateStudyHours', () => {
  assert.strictEqual(logic.calculateStudyHours('17:00', '18:30'), 1.5);
  assert.strictEqual(logic.calculateStudyHours('18:00', '17:00'), 0);
});

test('validateDeadline', () => {
  assert.strictEqual(logic.validateDeadline('2030-02-30', { today: '2030-01-01' }).valid, false);
  assert.strictEqual(logic.validateDeadline('2029-12-31', { today: '2030-01-01' }).valid, false);
  assert.strictEqual(logic.validateDeadline('2029-12-31', { today: '2030-01-01', allowPast: true }).valid, true);
  assert.strictEqual(logic.validateDeadline('2030-01-05', { today: '2030-01-01' }).valid, true);
});

test('calculateTaskPriority ranks closer deadlines and higher priority first', () => {
  const today = '2030-01-01';
  const near = logic.calculateTaskPriority(task({ deadline: '2030-01-02' }), today);
  const far = logic.calculateTaskPriority(task({ deadline: '2030-01-20' }), today);
  const high = logic.calculateTaskPriority(task({ priority: 'High' }), today);
  const low = logic.calculateTaskPriority(task({ priority: 'Low' }), today);
  const overdue = logic.calculateTaskPriority(task({ deadline: '2029-12-25' }), today);
  assert.ok(near > far);
  assert.ok(high > low);
  assert.ok(overdue > near);
});

test('generateSchedule respects daily hours, deadlines and never overlaps', () => {
  const tasks = [
    task({ key: 'a-1', deadline: '2030-01-03', hoursRemaining: 4, priority: 'High' }),
    task({ key: 'e-1', type: 'exam', refId: 1, deadline: '2030-01-06', hoursRemaining: 6 })
  ];
  const { sessions, unscheduled } = logic.generateSchedule(tasks, { startDate: '2030-01-01', dailyHours: 3 });
  assert.strictEqual(unscheduled.length, 0);
  const perDay = {};
  sessions.forEach((s) => { perDay[s.date] = (perDay[s.date] || 0) + s.durationHours; });
  Object.values(perDay).forEach((h) => assert.ok(h <= 3));
  sessions.filter((s) => s.key === 'a-1').forEach((s) => assert.ok(s.date <= '2030-01-03'));
  sessions.filter((s) => s.key === 'e-1').forEach((s) => assert.ok(s.date < '2030-01-06')); // before exam day
  const sorted = [...sessions].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].date === sorted[i - 1].date) {
      assert.ok(timeToMinutes(sorted[i].startTime) >= timeToMinutes(sorted[i - 1].endTime));
    }
  }
  assert.strictEqual(logic.sumStudyHours(sessions), 10);
});

test('generateSchedule reports work that cannot fit before the deadline', () => {
  const { unscheduled } = logic.generateSchedule([task({ deadline: '2030-01-01', hoursRemaining: 10 })], { startDate: '2030-01-01', dailyHours: 2 });
  assert.strictEqual(unscheduled.length, 1);
  assert.strictEqual(unscheduled[0].hours, 8);
});

test('rescheduleIncompleteTasks keeps completed work and re-plans missed sessions', () => {
  const tasks = [task({ key: 'a-1', totalHours: 4, deadline: '2030-01-10' })];
  const existing = [
    { key: 'a-1', date: '2030-01-01', startTime: '17:00', endTime: '19:00', durationHours: 2, status: 'Completed' },
    { key: 'a-1', date: '2030-01-02', startTime: '17:00', endTime: '19:00', durationHours: 2, status: 'Planned' }
  ];
  const r = logic.rescheduleIncompleteTasks(tasks, existing, { startDate: '2030-01-03', dailyHours: 2 });
  assert.strictEqual(r.missed.length, 1);
  assert.strictEqual(logic.sumStudyHours(r.sessions), 2); // 4 total - 2 completed
  assert.ok(r.sessions.every((s) => s.date >= '2030-01-03'));
});

test('calculateProgressPercentage', () => {
  assert.strictEqual(logic.calculateProgressPercentage(1, 4), 25);
  assert.strictEqual(logic.calculateProgressPercentage(0, 0), 0);
  assert.strictEqual(logic.calculateProgressPercentage(9, 3), 100);
});
