// Pure planning functions (no database, no Express) so they can be unit tested on their own.
const {
  isValidDateString, addDays, daysBetween, todayStr, weekStart, timeToMinutes, minutesToTime
} = require('../utils/dateUtils');

const PRIORITY_WEIGHT = { High: 30, Medium: 20, Low: 10 };
const MIN_BLOCK = 0.5; // smallest study session, in hours

const round2 = (n) => Math.round(n * 100) / 100;
const roundUpHalf = (n) => Math.ceil(Number(n) * 2) / 2;

/** Hours between two 'HH:MM' times, e.g. ('17:00','18:30') -> 1.5 */
function calculateStudyHours(startTime, endTime) {
  const diff = timeToMinutes(endTime) - timeToMinutes(startTime);
  return diff > 0 ? round2(diff / 60) : 0;
}

/** Total hours of a list of sessions ({ durationHours }) */
function sumStudyHours(sessions) {
  return round2(sessions.reduce((sum, s) => sum + Number(s.durationHours || 0), 0));
}

/** Checks a deadline / exam date. Past dates are rejected unless options.allowPast is true. */
function validateDeadline(deadline, options = {}) {
  const today = options.today || todayStr();
  if (!isValidDateString(deadline)) return { valid: false, message: 'Date must be valid and in YYYY-MM-DD format' };
  if (!options.allowPast && deadline < today) return { valid: false, message: 'Date cannot be in the past' };
  return { valid: true, message: '' };
}

/**
 * Higher score = more important. Considers task priority, subject priority,
 * how close the deadline is, and whether the task is already overdue.
 * task: { priority, subjectPriority, deadline, type }
 */
function calculateTaskPriority(task, today = todayStr()) {
  const daysLeft = daysBetween(today, task.deadline);
  const urgency = daysLeft < 0 ? 70 : 50 / (daysLeft + 1); // overdue work is most urgent
  const base = (PRIORITY_WEIGHT[task.priority] || 20) + 0.5 * (PRIORITY_WEIGHT[task.subjectPriority] || 20);
  const examBonus = task.type === 'exam' ? 5 : 0;
  return round2(base + urgency + examBonus);
}

/**
 * Builds non-overlapping study sessions day by day, always giving the next block of time
 * to the most important task that still has hours left and is still before its deadline.
 *
 * tasks: [{ key, type: 'assignment'|'exam', refId, subjectId, title, deadline, priority,
 *           subjectPriority, hoursRemaining }]
 * options: { startDate, dailyHours, weeklyHours, dayStartTime, maxSessionHours, maxDays,
 *            existingSessions: [{ date, startTime, endTime, durationHours }] }  (already completed work)
 * Returns { sessions, unscheduled }.
 */
function generateSchedule(tasks, options = {}) {
  const {
    startDate = todayStr(), dailyHours = 2, weeklyHours = null, dayStartTime = '17:00',
    maxSessionHours = 2, maxDays = 90, existingSessions = []
  } = options;

  const sessions = [];
  const unscheduled = [];
  const usedHours = {};
  const nextFree = {};
  const weekUsed = {};

  for (const s of existingSessions) {
    usedHours[s.date] = (usedHours[s.date] || 0) + Number(s.durationHours);
    nextFree[s.date] = Math.max(nextFree[s.date] || 0, timeToMinutes(s.endTime));
    const wk = weekStart(s.date);
    weekUsed[wk] = (weekUsed[wk] || 0) + Number(s.durationHours);
  }

  const active = [];
  for (const t of tasks) {
    const remaining = roundUpHalf(t.hoursRemaining);
    if (remaining <= 0) continue;
    // Exams must be prepared for BEFORE the exam day; assignments can be worked on up to the deadline day.
    const lastDay = t.type === 'exam' ? addDays(t.deadline, -1) : t.deadline;
    const item = { ...t, remaining, lastDay };
    if (t.type === 'exam' && lastDay < startDate) {
      unscheduled.push(toUnscheduled(item, 'Exam is too close or has already passed'));
    } else {
      active.push(item);
    }
  }

  for (let i = 0; i < maxDays && active.some((t) => t.remaining > 0); i++) {
    const date = addDays(startDate, i);
    const wk = weekStart(date);
    let capacity = dailyHours - (usedHours[date] || 0);
    if (weeklyHours) capacity = Math.min(capacity, weeklyHours - (weekUsed[wk] || 0));
    capacity = Math.floor(capacity * 2) / 2;
    let cursor = Math.max(timeToMinutes(dayStartTime), nextFree[date] || 0);
    const todayHours = {};

    while (capacity >= MIN_BLOCK) {
      // Overdue assignments (lastDay before startDate) may be studied on any day.
      const candidates = active.filter((t) => t.remaining > 0 && (t.lastDay >= date || t.lastDay < startDate));
      if (!candidates.length) break;
      // Dividing by hours already given today spreads time across tasks instead of one task taking it all.
      const scored = candidates.map((t) => ({ t, score: calculateTaskPriority({ ...t }, date) / (1 + (todayHours[t.key] || 0)) }));
      scored.sort((a, b) => b.score - a.score);
      const task = scored[0].t;
      const block = Math.min(capacity, task.remaining, maxSessionHours);
      if (cursor + block * 60 > 24 * 60) break; // never run past midnight

      sessions.push({
        date,
        startTime: minutesToTime(cursor),
        endTime: minutesToTime(cursor + block * 60),
        durationHours: block,
        key: task.key, type: task.type, refId: task.refId, subjectId: task.subjectId, title: task.title
      });
      cursor += block * 60;
      capacity -= block;
      task.remaining -= block;
      todayHours[task.key] = (todayHours[task.key] || 0) + block;
      usedHours[date] = (usedHours[date] || 0) + block;
      weekUsed[wk] = (weekUsed[wk] || 0) + block;
    }
  }

  for (const t of active) {
    if (t.remaining > 0) unscheduled.push(toUnscheduled(t, 'Not enough study time before the deadline. Increase daily hours or move the deadline.'));
  }
  return { sessions, unscheduled };
}

function toUnscheduled(t, reason) {
  return { key: t.key, type: t.type, refId: t.refId, title: t.title, hours: t.remaining, reason };
}

/** Planned sessions from earlier days that were never completed become 'Missed'. */
function markMissedSessions(items, today = todayStr()) {
  return items.map((i) => (i.status === 'Planned' && i.date < today ? { ...i, status: 'Missed' } : i));
}

/**
 * Re-plans the work that is still unfinished.
 * tasks: like generateSchedule tasks but with `totalHours` instead of `hoursRemaining`.
 * existingItems: [{ key, date, startTime, endTime, durationHours, status }] from the current plan.
 * Completed sessions are kept and their hours are subtracted; missed hours are planned again.
 */
function rescheduleIncompleteTasks(tasks, existingItems = [], options = {}) {
  const today = options.startDate || todayStr();
  const items = markMissedSessions(existingItems, today);
  const completed = items.filter((i) => i.status === 'Completed');
  const doneByKey = {};
  completed.forEach((i) => { doneByKey[i.key] = (doneByKey[i.key] || 0) + Number(i.durationHours); });

  const remainingTasks = tasks.map((t) => ({ ...t, hoursRemaining: Math.max(0, t.totalHours - (doneByKey[t.key] || 0)) }));
  const result = generateSchedule(remainingTasks, { ...options, startDate: today, existingSessions: completed });
  return { ...result, missed: items.filter((i) => i.status === 'Missed') };
}

/** completed / total as a percentage with one decimal, always between 0 and 100 */
function calculateProgressPercentage(completed, total) {
  const c = Number(completed);
  const t = Number(total);
  if (!t || t <= 0 || !c || c <= 0) return 0;
  return Math.min(100, Math.round((c / t) * 1000) / 10);
}

module.exports = {
  calculateStudyHours, sumStudyHours, validateDeadline, calculateTaskPriority,
  generateSchedule, markMissedSessions, rescheduleIncompleteTasks, calculateProgressPercentage
};
