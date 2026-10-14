const { todayStr, isValidDateString } = require('../utils/dateUtils');
const logic = require('./plannerLogic');
const assignmentRepository = require('../repositories/assignmentRepository');
const examRepository = require('../repositories/examRepository');
const goalRepository = require('../repositories/goalRepository');
const planRepository = require('../repositories/planRepository');
const userRepository = require('../repositories/userRepository');
const notificationRepository = require('../repositories/notificationRepository');
const notificationService = require('./notificationService');

// Turns open assignments and future exams into planner tasks.
async function buildTasks(userId, today) {
  const [assignments, exams] = await Promise.all([
    assignmentRepository.listOpenForPlanning(userId),
    examRepository.listAfter(userId, today)
  ]);
  const tasks = assignments.map((a) => ({
    key: `a-${a.assignment_id}`, type: 'assignment', refId: a.assignment_id, subjectId: a.subject_id,
    title: a.title, deadline: a.deadline, priority: a.priority, subjectPriority: a.subject_priority,
    totalHours: Number(a.estimated_hours)
  }));
  exams.forEach((e) => tasks.push({
    key: `e-${e.exam_id}`, type: 'exam', refId: e.exam_id, subjectId: e.subject_id,
    title: `Exam prep: ${e.exam_name}`, deadline: e.exam_date, priority: e.priority, subjectPriority: e.subject_priority,
    totalHours: Number(e.preparation_hours)
  }));
  return tasks;
}

async function loadSettings(userId) {
  const [daily, weekly, user] = await Promise.all([
    goalRepository.latestTarget(userId, 'daily'),
    goalRepository.latestTarget(userId, 'weekly'),
    userRepository.findById(userId)
  ]);
  return {
    dailyHours: daily || 2,
    weeklyHours: weekly || null,
    dayStartTime: user && user.preferred_start_time ? String(user.preferred_start_time).slice(0, 5) : '17:00'
  };
}

const toLogicItem = (row) => ({
  key: row.assignment_id ? `a-${row.assignment_id}` : `e-${row.exam_id}`,
  date: row.session_date,
  startTime: String(row.start_time).slice(0, 5),
  endTime: String(row.end_time).slice(0, 5),
  durationHours: Number(row.duration_hours),
  status: row.status
});

// Shared by "generate" and "reschedule": keeps completed sessions, marks old unfinished ones as missed,
// and stores a fresh set of future sessions for everything that still needs time.
async function rebuildPlan(userId) {
  const today = todayStr();
  let plan = await planRepository.getActive(userId);
  if (!plan) plan = await planRepository.create(userId, today);

  const [existingRows, tasks, settings] = await Promise.all([
    planRepository.listItemsForPlan(plan.plan_id), buildTasks(userId, today), loadSettings(userId)
  ]);
  const result = logic.rescheduleIncompleteTasks(tasks, existingRows.map(toLogicItem), { ...settings, startDate: today });

  await planRepository.replaceFutureItems({ planId: plan.plan_id, userId, today, sessions: result.sessions });
  await notificationService.refresh(userId);

  return {
    plan_id: plan.plan_id,
    sessions_created: result.sessions.length,
    planned_hours: logic.sumStudyHours(result.sessions),
    missed_sessions: result.missed.length,
    settings,
    unscheduled: result.unscheduled
  };
}

async function generate(userId) {
  return rebuildPlan(userId);
}

async function reschedule(userId) {
  const summary = await rebuildPlan(userId);
  await notificationRepository.addIfNew(userId, 'plan',
    `Your study plan was rescheduled (${summary.sessions_created} sessions, ${summary.missed_sessions} missed sessions re-planned)`, null);
  return summary;
}

// Called after a deadline, exam date, hours or priority changes, or after a task is deleted.
async function autoReschedule(userId) {
  try {
    if (await planRepository.getActive(userId)) return await rebuildPlan(userId);
  } catch (err) {
    console.error('Automatic rescheduling failed:', err.message);
  }
  return null;
}

async function getPlan(userId, filters) {
  const f = { ...filters };
  if (f.from && !isValidDateString(f.from)) delete f.from;
  if (f.to && !isValidDateString(f.to)) delete f.to;
  const [plan, items] = await Promise.all([planRepository.getActive(userId), planRepository.listItems(userId, f)]);
  const live = items.filter((i) => i.status !== 'Missed');
  const summary = {
    planned_hours: logic.sumStudyHours(live.map((i) => ({ durationHours: i.duration_hours }))),
    completed_hours: logic.sumStudyHours(items.filter((i) => i.status === 'Completed').map((i) => ({ durationHours: i.duration_hours }))),
    missed_sessions: items.filter((i) => i.status === 'Missed').length
  };
  return { plan, items, summary };
}

module.exports = { generate, reschedule, autoReschedule, getPlan };
