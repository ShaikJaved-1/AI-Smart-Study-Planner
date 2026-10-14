const { todayStr, addDays } = require('../utils/dateUtils');
const { calculateProgressPercentage } = require('./plannerLogic');
const reportRepository = require('../repositories/reportRepository');
const planRepository = require('../repositories/planRepository');
const notificationService = require('./notificationService');
const notificationRepository = require('../repositories/notificationRepository');

const round1 = (n) => Math.round(Number(n) * 10) / 10;

async function progressData(userId) {
  const today = todayStr();
  const from = addDays(today, -6);
  const [sessionRows, subjectRows, assignmentRows, dayRows] = await Promise.all([
    reportRepository.sessionTotals(userId), reportRepository.subjectHours(userId),
    reportRepository.subjectAssignments(userId), reportRepository.dailyHours(userId, from, today)
  ]);

  const sessions = { Planned: 0, Completed: 0, Missed: 0 };
  const hours = { Planned: 0, Completed: 0, Missed: 0 };
  sessionRows.forEach((r) => { sessions[r.status] = Number(r.c); hours[r.status] = Number(r.h); });
  const plannedHours = hours.Planned + hours.Completed; // missed hours are re-planned, so they are not counted twice

  const byId = {};
  assignmentRows.forEach((r) => { byId[r.subject_id] = { total: Number(r.total), completed: Number(r.completed) }; });
  const subjects = subjectRows.map((s) => ({
    ...s,
    percentage: calculateProgressPercentage(s.completed_hours, s.planned_hours),
    assignments_total: (byId[s.subject_id] || { total: 0 }).total,
    assignments_completed: (byId[s.subject_id] || { completed: 0 }).completed
  }));

  const dayMap = {};
  dayRows.forEach((r) => { dayMap[r.d] = r; });
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    last7Days.push({ date: d, planned: Number((dayMap[d] || {}).planned || 0), completed: Number((dayMap[d] || {}).completed || 0) });
  }

  return {
    overall: {
      planned_hours: round1(plannedHours),
      completed_hours: round1(hours.Completed),
      percentage: calculateProgressPercentage(hours.Completed, plannedHours),
      sessions_completed: sessions.Completed,
      sessions_planned: sessions.Planned,
      sessions_missed: sessions.Missed
    },
    subjects,
    last7_days: last7Days
  };
}

async function dashboard(userId) {
  const today = todayStr();
  await notificationService.refresh(userId);
  const [totals, assignmentRows, progress, upcomingAssignments, upcomingExams, todaySessions, notifications, unread] = await Promise.all([
    reportRepository.totals(userId, today), reportRepository.assignmentCounts(userId), progressData(userId),
    reportRepository.upcomingAssignments(userId), reportRepository.upcomingExams(userId, today),
    planRepository.itemsForDate(userId, today), notificationRepository.list(userId, 5), notificationRepository.unreadCount(userId)
  ]);
  const counts = { Pending: 0, 'In Progress': 0, Completed: 0 };
  assignmentRows.forEach((r) => { counts[r.status] = Number(r.c); });

  return {
    totals: {
      subjects: Number(totals.subjects), assignments: Number(totals.assignments),
      exams: Number(totals.exams), upcoming_exams: Number(totals.upcoming_exams)
    },
    assignments: {
      total: counts.Pending + counts['In Progress'] + counts.Completed,
      completed: counts.Completed, pending: counts.Pending + counts['In Progress'], in_progress: counts['In Progress']
    },
    sessions: { planned: progress.overall.sessions_planned, completed: progress.overall.sessions_completed, missed: progress.overall.sessions_missed },
    hours: { planned: progress.overall.planned_hours, completed: progress.overall.completed_hours },
    completion_percentage: progress.overall.percentage,
    today_sessions: todaySessions,
    upcoming_assignments: upcomingAssignments,
    upcoming_exams: upcomingExams,
    subject_progress: progress.subjects,
    last7_days: progress.last7_days,
    notifications,
    unread_notifications: unread
  };
}

async function adminReport() {
  const [totals, signups, top] = await Promise.all([reportRepository.adminTotals(), reportRepository.adminSignups(), reportRepository.adminTopStudents()]);
  const n = {};
  Object.keys(totals).forEach((k) => { n[k] = Number(totals[k]); });
  n.completion_percentage = calculateProgressPercentage(n.completed_sessions, n.sessions);
  return { totals: n, signups_last_7_days: signups, top_students: top };
}

module.exports = { dashboard, progressData, adminReport };
