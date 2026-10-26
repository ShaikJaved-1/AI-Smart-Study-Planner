const test = require('node:test');
const assert = require('node:assert');
const logic = require('../../src/services/plannerLogic');
const { timeToMinutes } = require('../../src/utils/dateUtils');

function task(overrides = {}) {
  return {
    key: 'a-1',
    type: 'assignment',
    refId: 1,
    subjectId: 10,
    title: 'Assignment',
    deadline: '2030-01-10',
    priority: 'Medium',
    subjectPriority: 'Medium',
    hoursRemaining: 2,
    ...overrides
  };
}

test('calculateStudyHours calculates the duration correctly', () => {
  assert.strictEqual(logic.calculateStudyHours('17:00', '18:30'), 1.5);
  assert.strictEqual(logic.calculateStudyHours('09:00', '10:00'), 1);
  assert.strictEqual(logic.calculateStudyHours('18:00', '17:00'), 0);
});

test('validateDeadline validates dates correctly', () => {
  assert.strictEqual(
    logic.validateDeadline('2030-01-10', { today: '2030-01-01' }).valid,
    true
  );

  assert.strictEqual(
    logic.validateDeadline('2029-12-31', { today: '2030-01-01' }).valid,
    false
  );

  assert.strictEqual(
    logic.validateDeadline('invalid-date', { today: '2030-01-01' }).valid,
    false
  );
});

test('calculateTaskPriority ranks closer deadlines and higher priority first', () => {
  const nearDeadline = logic.calculateTaskPriority(
    task({ deadline: '2030-01-02' }),
    '2030-01-01'
  );

  const farDeadline = logic.calculateTaskPriority(
    task({ deadline: '2030-01-10' }),
    '2030-01-01'
  );

  const highPriority = logic.calculateTaskPriority(
    task({ priority: 'High', deadline: '2030-01-02' }),
    '2030-01-01'
  );

  assert.ok(nearDeadline > farDeadline);
  assert.ok(highPriority > nearDeadline);
});

test('generateSchedule respects daily hours, deadlines and never overlaps', () => {
  const result = logic.generateSchedule(
    [
      task({ key: 'a-1', hoursRemaining: 2 }),
      task({
        key: 'a-2',
        refId: 2,
        title: 'Assignment 2',
        hoursRemaining: 2
      })
    ],
    {
      startDate: '2030-01-01',
      dailyHours: 2,
      dayStartTime: '17:00',
      maxSessionHours: 1,
      maxDays: 10
    }
  );

  assert.ok(result.sessions.length > 0);

  const dailyHours = {};

  for (const session of result.sessions) {
    assert.ok(session.date <= '2030-01-10');
    dailyHours[session.date] =
      (dailyHours[session.date] || 0) + session.durationHours;
  }

  for (const hours of Object.values(dailyHours)) {
    assert.ok(hours <= 2);
  }

  const sessionsByDate = {};

  for (const session of result.sessions) {
    if (!sessionsByDate[session.date]) {
      sessionsByDate[session.date] = [];
    }

    sessionsByDate[session.date].push(session);
  }

  for (const sessions of Object.values(sessionsByDate)) {
    sessions.sort(
      (a, b) =>
        timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    );

    for (let i = 1; i < sessions.length; i++) {
      assert.ok(
        timeToMinutes(sessions[i].startTime) >=
          timeToMinutes(sessions[i - 1].endTime)
      );
    }
  }
});

test('generateSchedule reports work that cannot fit before the deadline', () => {
  const result = logic.generateSchedule(
    [
      task({
        deadline: '2030-01-02',
        hoursRemaining: 10
      })
    ],
    {
      startDate: '2030-01-01',
      dailyHours: 1,
      maxSessionHours: 1,
      maxDays: 5
    }
  );

  assert.ok(result.unscheduled.length > 0);
});

test('rescheduleIncompleteTasks keeps completed work and re-plans missed sessions', () => {
  const tasks = [
    {
      ...task({ key: 'a-1', totalHours: 3 }),
      totalHours: 3
    }
  ];

  const existingItems = [
    {
      key: 'a-1',
      date: '2030-01-01',
      startTime: '17:00',
      endTime: '18:00',
      durationHours: 1,
      status: 'Completed'
    },
    {
      key: 'a-1',
      date: '2030-01-02',
      startTime: '17:00',
      endTime: '18:00',
      durationHours: 1,
      status: 'Planned'
    }
  ];

  const result = logic.rescheduleIncompleteTasks(tasks, existingItems, {
    startDate: '2030-01-03',
    dailyHours: 2,
    dayStartTime: '17:00',
    maxSessionHours: 1,
    maxDays: 10
  });

  assert.strictEqual(result.missed.length, 1);
  assert.strictEqual(result.missed[0].status, 'Missed');

  assert.ok(
    result.sessions.reduce(
      (sum, session) => sum + session.durationHours,
      0
    ) <= 2
  );

  assert.ok(result.sessions.every((session) => session.key === 'a-1'));
});

test('calculateProgressPercentage calculates progress correctly', () => {
  assert.strictEqual(logic.calculateProgressPercentage(5, 10), 50);
  assert.strictEqual(logic.calculateProgressPercentage(1, 3), 33.3);
  assert.strictEqual(logic.calculateProgressPercentage(0, 10), 0);
  assert.strictEqual(logic.calculateProgressPercentage(10, 0), 0);
  assert.strictEqual(logic.calculateProgressPercentage(15, 10), 100);
});

test('generateTopicSchedule schedules topics before their exams', () => {
  const topics = [
    {
      topic_id: 1,
      subject_id: 10,
      topic_name: 'Arrays',
      status: 'Not Started'
    },
    {
      topic_id: 2,
      subject_id: 10,
      topic_name: 'Linked Lists',
      status: 'Not Started'
    }
  ];

  const exams = [
    { subjectId: 10, examDate: '2030-01-05' }
  ];

  const result = logic.generateTopicSchedule(topics, exams, {
    startDate: '2030-01-01',
    dailyHours: 2,
    random: () => 0
  });

  assert.strictEqual(result.sessions.length, 2);
  assert.ok(result.sessions.every((s) => s.date < '2030-01-05'));
  assert.ok(result.sessions.every((s) => s.type === 'topic'));
  assert.strictEqual(result.unscheduled.length, 0);
});

test('generateTopicSchedule skips completed topics', () => {
  const topics = [
    {
      topic_id: 1,
      subject_id: 10,
      topic_name: 'Arrays',
      status: 'Completed'
    },
    {
      topic_id: 2,
      subject_id: 10,
      topic_name: 'Linked Lists',
      status: 'Not Started'
    }
  ];

  const exams = [
    { subjectId: 10, examDate: '2030-01-05' }
  ];

  const result = logic.generateTopicSchedule(topics, exams, {
    startDate: '2030-01-01',
    dailyHours: 2,
    random: () => 0
  });

  assert.strictEqual(result.sessions.length, 1);
  assert.strictEqual(result.sessions[0].title, 'Linked Lists');
});

test('generateSchedule schedules topics strictly before their exam date', () => {
  const result = logic.generateSchedule(
    [
      task({
        key: 't-1',
        type: 'topic',
        title: 'Arrays',
        deadline: '2030-01-03',
        hoursRemaining: 1
      })
    ],
    {
      startDate: '2030-01-01',
      dailyHours: 2,
      maxDays: 5
    }
  );

  assert.strictEqual(result.sessions.length, 1);
  assert.ok(result.sessions[0].date < '2030-01-03');
});

test('generateSchedule shares daily limits across topics and assignments', () => {
  const result = logic.generateSchedule(
    [
      task({
        key: 't-1',
        type: 'topic',
        title: 'Arrays',
        deadline: '2030-01-05',
        hoursRemaining: 1
      }),
      task({
        key: 'a-2',
        type: 'assignment',
        title: 'Assignment 2',
        deadline: '2030-01-05',
        hoursRemaining: 2
      })
    ],
    {
      startDate: '2030-01-01',
      dailyHours: 2,
      maxSessionHours: 1,
      maxDays: 5
    }
  );

  const dailyHours = {};

  for (const session of result.sessions) {
    dailyHours[session.date] =
      (dailyHours[session.date] || 0) + session.durationHours;
  }

  for (const hours of Object.values(dailyHours)) {
    assert.ok(hours <= 2);
  }
});

test('generateSchedule does not schedule topics after their exam date', () => {
  const result = logic.generateSchedule(
    [
      task({
        key: 't-1',
        type: 'topic',
        title: 'Arrays',
        deadline: '2030-01-02',
        hoursRemaining: 1
      })
    ],
    {
      startDate: '2030-01-02',
      dailyHours: 2,
      maxDays: 5
    }
  );

  assert.strictEqual(result.sessions.length, 0);
  assert.strictEqual(result.unscheduled.length, 1);
});