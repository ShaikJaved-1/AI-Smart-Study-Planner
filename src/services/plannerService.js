const { todayStr, isValidDateString, addDays } = require('../utils/dateUtils');
const logic = require('./plannerLogic');
const assignmentRepository = require('../repositories/assignmentRepository');
const examRepository = require('../repositories/examRepository');
const topicRepository = require('../repositories/topicRepository');
const goalRepository = require('../repositories/goalRepository');
const planRepository = require('../repositories/planRepository');
const userRepository = require('../repositories/userRepository');
const notificationRepository = require('../repositories/notificationRepository');
const notificationService = require('./notificationService');

async function buildTasks(userId, today) {
  const [assignments, exams] = await Promise.all([
    assignmentRepository.listOpenForPlanning(userId),
    examRepository.listAfter(userId, today)
  ]);

  const tasks = assignments.map((a) => ({
    key: `a-${a.assignment_id}`,
    type: 'assignment',
    refId: a.assignment_id,
    subjectId: a.subject_id,
    title: a.title,
    deadline: String(a.deadline).slice(0, 10),
    priority: a.priority,
    subjectPriority: a.subject_priority,
    totalHours: Number(a.estimated_hours)
  }));

  exams.forEach((e) => {
    tasks.push({
      key: `e-${e.exam_id}`,
      type: 'exam',
      refId: e.exam_id,
      subjectId: e.subject_id,
      title: `Exam prep: ${e.exam_name}`,
      deadline: String(e.exam_date).slice(0, 10),
      priority: e.priority || 'High',
      subjectPriority: e.subject_priority || 'Medium',
      totalHours: Number(e.preparation_hours)
    });
  });

  return { tasks, exams };
}

async function loadSettings(userId) {
  const [daily, weekly, user] = await Promise.all([
    goalRepository.latestTarget(userId, 'daily'),
    goalRepository.latestTarget(userId, 'weekly'),
    userRepository.findById(userId)
  ]);

  return {
    dailyHours: daily || 4,
    weeklyHours: weekly || null,
    dayStartTime: user && user.preferred_start_time
      ? String(user.preferred_start_time).slice(0, 5)
      : '17:00'
  };
}

const toLogicItem = (row) => ({
  key: row.topic_id
    ? `t-${row.topic_id}`
    : row.assignment_id
      ? `a-${row.assignment_id}`
      : `e-${row.exam_id}`,
  date: String(row.session_date).slice(0, 10),
  startTime: String(row.start_time).slice(0, 5),
  endTime: String(row.end_time).slice(0, 5),
  durationHours: Number(row.duration_hours),
  status: row.status
});

async function rebuildPlan(userId) {
  const today = todayStr();
  let plan = await planRepository.getActive(userId);

  if (!plan) {
    plan = await planRepository.create(userId, today);
  }

  const [
    existingRows,
    taskData,
    topics,
    settings
  ] = await Promise.all([
    planRepository.listItemsForPlan(plan.plan_id),
    buildTasks(userId, today),
    topicRepository.list(userId),
    loadSettings(userId)
  ]);

  const existingItems = existingRows.map(toLogicItem);
  const tasks = [...taskData.tasks];
  const examDates = new Map();

  taskData.exams.forEach((exam) => {
    const subjectId = String(exam.subject_id);
    const examDate = String(exam.exam_date).slice(0, 10);
    const current = examDates.get(subjectId);

    if (!current || examDate < current) {
      examDates.set(subjectId, examDate);
    }
  });

  // Preparation hours are estimated automatically from pending topics. The
  // database column remains for compatibility, but students no longer need to
  // enter a manual number. Topic sessions cover learning; this exam task is for
  // revision/practice after topic learning.
  const pendingTopicsBySubject = new Map();
  topics.forEach((topic) => {
    if (topic.status !== 'Completed') {
      const subjectKey = String(topic.subject_id);
      pendingTopicsBySubject.set(
        subjectKey,
        (pendingTopicsBySubject.get(subjectKey) || 0) + 1
      );
    }
  });

  tasks.forEach((task) => {
    if (task.type !== 'exam') return;
    const pendingCount = pendingTopicsBySubject.get(String(task.subjectId)) || 0;
    task.totalHours = pendingCount > 0
      ? Math.max(1, Math.ceil(pendingCount * 0.5))
      : 2;
  });

  const unscheduledTopics = [];

  topics.forEach((topic) => {
    if (topic.status === 'Completed') {
      return;
    }

    const examDate = examDates.get(String(topic.subject_id));

    if (!examDate) {
      unscheduledTopics.push({
        key: `t-${topic.topic_id}`,
        type: 'topic',
        refId: topic.topic_id,
        title: topic.topic_name,
        hours: 1,
        reason: 'No upcoming exam was found for this subject.'
      });
      return;
    }

    if (!isValidDateString(examDate)) {
      unscheduledTopics.push({
        key: `t-${topic.topic_id}`,
        type: 'topic',
        refId: topic.topic_id,
        title: topic.topic_name,
        hours: 1,
        reason: 'The subject exam date is invalid.'
      });
      return;
    }

    tasks.push({
      key: `t-${topic.topic_id}`,
      type: 'topic',
      refId: topic.topic_id,
      subjectId: topic.subject_id,
      title: topic.topic_name,
      deadline: examDate,
      priority: 'High',
      subjectPriority: 'High',
      totalHours: 1
    });
  });

  const result = logic.rescheduleIncompleteTasks(
    tasks,
    existingItems,
    {
      ...settings,
      startDate: today,
      maxSessionHours: 1.5,
      breakMinutes: 15
    }
  );

  const missedKeys = new Set(result.missed.map((item) => item.key));
  const sessions = result.sessions.map((session) => ({
    ...session,
    rescheduledFromMissed: missedKeys.has(session.key)
  }));

  await planRepository.replaceFutureItems({
    planId: plan.plan_id,
    userId,
    today,
    sessions
  });

  await notificationService.refresh(userId);

  return {
    plan_id: plan.plan_id,
    sessions_created: sessions.length,
    planned_hours: logic.sumStudyHours(sessions),
    missed_sessions: result.missed.length,
    settings,
    unscheduled: [
      ...unscheduledTopics,
      ...result.unscheduled
    ]
  };
}

async function generate(userId) {
  return rebuildPlan(userId);
}

async function reschedule(userId) {
  const summary = await rebuildPlan(userId);

  await notificationRepository.addIfNew(
    userId,
    'plan',
    `Your study plan was rescheduled (${summary.sessions_created} sessions, ${summary.missed_sessions} missed sessions re-planned)`,
    null
  );

  return summary;
}

async function autoReschedule(userId) {
  try {
    if (await planRepository.getActive(userId)) {
      return await rebuildPlan(userId);
    }
  } catch (err) {
    console.error('Automatic rescheduling failed:', err.message);
  }

  return null;
}

async function getPlan(userId, filters) {
  const f = { ...filters };

  if (f.from && !isValidDateString(f.from)) {
    delete f.from;
  }

  if (f.to && !isValidDateString(f.to)) {
    delete f.to;
  }

  const [plan, items] = await Promise.all([
    planRepository.getActive(userId),
    planRepository.listItems(userId, f)
  ]);

  const live = items.filter((item) => item.status !== 'Missed');

  const summary = {
    planned_hours: logic.sumStudyHours(
      live.map((item) => ({
        durationHours: item.duration_hours
      }))
    ),
    completed_hours: logic.sumStudyHours(
      items
        .filter((item) => item.status === 'Completed')
        .map((item) => ({
          durationHours: item.duration_hours
        }))
    ),
    missed_sessions: items.filter(
      (item) => item.status === 'Missed'
    ).length
  };

  return { plan, items, summary };
}

module.exports = {
  generate,
  reschedule,
  autoReschedule,
  getPlan
};