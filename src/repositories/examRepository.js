const { query } = require('../config/db');
const createCrudRepository = require('./crudRepository');

const crud = createCrudRepository({
  table: 'exams', idColumn: 'exam_id',
  columns: ['subject_id', 'exam_name', 'exam_date', 'priority', 'preparation_hours']
});

module.exports = {
  ...crud,
  list(userId, f = {}) {
    const where = ['e.user_id = ?'];
    const params = [userId];
    if (f.subject_id) { where.push('e.subject_id = ?'); params.push(f.subject_id); }
    if (f.priority) { where.push('e.priority = ?'); params.push(f.priority); }
    if (f.from) { where.push('e.exam_date >= ?'); params.push(f.from); }
    if (f.to) { where.push('e.exam_date <= ?'); params.push(f.to); }
    if (f.q) { where.push('e.exam_name LIKE ?'); params.push(`%${f.q}%`); }
    return query(
      `SELECT e.*, s.subject_name, s.priority AS subject_priority FROM exams e JOIN subjects s ON s.subject_id = e.subject_id
       WHERE ${where.join(' AND ')} ORDER BY e.exam_date ASC`, params);
  },
  listAfter(userId, date) {
    return query(
      `SELECT e.*, s.priority AS subject_priority FROM exams e JOIN subjects s ON s.subject_id = e.subject_id
       WHERE e.user_id = ? AND e.exam_date > ?`, [userId, date]);
  },
  between(userId, fromDate, toDate) {
    return query('SELECT * FROM exams WHERE user_id = ? AND exam_date BETWEEN ? AND ? ORDER BY exam_date', [userId, fromDate, toDate]);
  }
};
