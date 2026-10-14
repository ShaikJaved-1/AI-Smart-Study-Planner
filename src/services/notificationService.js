const { todayStr, addDays, daysBetween } = require('../utils/dateUtils');
const notificationRepository = require('../repositories/notificationRepository');
const assignmentRepository = require('../repositories/assignmentRepository');
const examRepository = require('../repositories/examRepository');
const planRepository = require('../repositories/planRepository');

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Creates reminders for the current situation. A dedupe key stops the same reminder being created twice.
async function refresh(userId) {
  const today = todayStr();
  const [assignments, exams, sessions] = await Promise.all([
    assignmentRepository.dueSoonOrOverdue(userId, addDays(today, 3)),
    examRepository.between(userId, today, addDays(today, 7)),
    planRepository.itemsForDate(userId, today)
  ]);

  for (const a of assignments) {
    const days = daysBetween(today, a.deadline);
    if (days < 0) {
      await notificationRepository.addIfNew(userId, 'overdue', `Overdue: "${a.title}" was due on ${a.deadline}`, `o-${a.assignment_id}-${a.deadline}`);
    } else {
      const when = days === 0 ? 'today' : `in ${plural(days, 'day')}`;
      await notificationRepository.addIfNew(userId, 'deadline', `Assignment "${a.title}" is due ${when} (${a.deadline})`, `d-${a.assignment_id}-${a.deadline}`);
    }
  }
  for (const e of exams) {
    const days = daysBetween(today, e.exam_date);
    const when = days === 0 ? 'today' : `in ${plural(days, 'day')}`;
    await notificationRepository.addIfNew(userId, 'exam', `Exam "${e.exam_name}" is ${when} (${e.exam_date})`, `e-${e.exam_id}-${e.exam_date}`);
  }
  for (const s of sessions.filter((x) => x.status === 'Planned')) {
    await notificationRepository.addIfNew(userId, 'session',
      `Study session today: ${s.title} (${String(s.start_time).slice(0, 5)}-${String(s.end_time).slice(0, 5)})`, `s-${s.item_id}`);
  }
}

async function listForUser(userId) {
  await refresh(userId);
  const [notifications, unread] = await Promise.all([notificationRepository.list(userId), notificationRepository.unreadCount(userId)]);
  return { unread_count: unread, notifications };
}

module.exports = { refresh, listForUser };
