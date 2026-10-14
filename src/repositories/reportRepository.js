const { query } = require('../config/db');

const one = async (sql, params) => (await query(sql, params))[0];

module.exports = {
  async totals(userId, today) {
    return one(
      `SELECT
        (SELECT COUNT(*) FROM subjects WHERE user_id = ?) AS subjects,
        (SELECT COUNT(*) FROM assignments WHERE user_id = ?) AS assignments,
        (SELECT COUNT(*) FROM exams WHERE user_id = ?) AS exams,
        (SELECT COUNT(*) FROM exams WHERE user_id = ? AND exam_date >= ?) AS upcoming_exams`,
      [userId, userId, userId, userId, today]);
  },
  assignmentCounts(userId) {
    return query('SELECT status, COUNT(*) AS c FROM assignments WHERE user_id = ? GROUP BY status', [userId]);
  },
  sessionTotals(userId) {
    return query('SELECT status, COUNT(*) AS c, COALESCE(SUM(duration_hours), 0) AS h FROM plan_items WHERE user_id = ? GROUP BY status', [userId]);
  },
  upcomingAssignments(userId, limit = 5) {
    return query(
      `SELECT a.assignment_id, a.title, a.deadline, a.priority, a.status, s.subject_name
       FROM assignments a JOIN subjects s ON s.subject_id = a.subject_id
       WHERE a.user_id = ? AND a.status <> 'Completed' ORDER BY a.deadline LIMIT ${Number(limit)}`, [userId]);
  },
  upcomingExams(userId, today, limit = 5) {
    return query(
      `SELECT e.exam_id, e.exam_name, e.exam_date, e.priority, e.preparation_hours, s.subject_name
       FROM exams e JOIN subjects s ON s.subject_id = e.subject_id
       WHERE e.user_id = ? AND e.exam_date >= ? ORDER BY e.exam_date LIMIT ${Number(limit)}`, [userId, today]);
  },
  subjectHours(userId) {
    return query(
      `SELECT s.subject_id, s.subject_name, s.priority,
        COALESCE(SUM(CASE WHEN i.status IN ('Planned','Completed') THEN i.duration_hours END), 0) AS planned_hours,
        COALESCE(SUM(CASE WHEN i.status = 'Completed' THEN i.duration_hours END), 0) AS completed_hours
       FROM subjects s LEFT JOIN plan_items i ON i.subject_id = s.subject_id
       WHERE s.user_id = ? GROUP BY s.subject_id, s.subject_name, s.priority ORDER BY s.subject_name`, [userId]);
  },
  subjectAssignments(userId) {
    return query(
      `SELECT subject_id, COUNT(*) AS total, SUM(status = 'Completed') AS completed
       FROM assignments WHERE user_id = ? GROUP BY subject_id`, [userId]);
  },
  dailyHours(userId, fromDate, toDate) {
    return query(
      `SELECT session_date AS d, SUM(duration_hours) AS planned,
        SUM(CASE WHEN status = 'Completed' THEN duration_hours ELSE 0 END) AS completed
       FROM plan_items WHERE user_id = ? AND status <> 'Missed' AND session_date BETWEEN ? AND ?
       GROUP BY session_date`, [userId, fromDate, toDate]);
  },
  adminTotals() {
    return one(
      `SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'student') AS students,
        (SELECT COUNT(*) FROM users WHERE role = 'student' AND is_active = 1) AS active_students,
        (SELECT COUNT(*) FROM subjects) AS subjects,
        (SELECT COUNT(*) FROM assignments) AS assignments,
        (SELECT COUNT(*) FROM assignments WHERE status = 'Completed') AS completed_assignments,
        (SELECT COUNT(*) FROM exams) AS exams,
        (SELECT COUNT(*) FROM plan_items) AS sessions,
        (SELECT COUNT(*) FROM plan_items WHERE status = 'Completed') AS completed_sessions,
        (SELECT COALESCE(SUM(duration_hours), 0) FROM plan_items WHERE status = 'Completed') AS completed_hours`, []);
  },
  adminSignups() {
    return query(
      `SELECT DATE(created_at) AS d, COUNT(*) AS c FROM users
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) GROUP BY DATE(created_at) ORDER BY d`);
  },
  adminTopStudents() {
    return query(
      `SELECT u.name, u.email, COALESCE(SUM(i.duration_hours), 0) AS completed_hours
       FROM users u LEFT JOIN plan_items i ON i.user_id = u.user_id AND i.status = 'Completed'
       WHERE u.role = 'student' GROUP BY u.user_id, u.name, u.email ORDER BY completed_hours DESC LIMIT 5`);
  }
};
