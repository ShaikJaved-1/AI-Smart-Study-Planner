const { query } = require('../config/db');
const createCrudRepository = require('./crudRepository');

const crud = createCrudRepository({
  table: 'assignments', idColumn: 'assignment_id',
  columns: ['subject_id', 'title', 'description', 'deadline', 'priority', 'estimated_hours', 'status']
});

module.exports = {
  ...crud,
  list(userId, f = {}) {
    const where = ['a.user_id = ?'];
    const params = [userId];
    if (f.subject_id) { where.push('a.subject_id = ?'); params.push(f.subject_id); }
    if (f.status) { where.push('a.status = ?'); params.push(f.status); }
    if (f.priority) { where.push('a.priority = ?'); params.push(f.priority); }
    if (f.from) { where.push('a.deadline >= ?'); params.push(f.from); }
    if (f.to) { where.push('a.deadline <= ?'); params.push(f.to); }
    if (f.q) { where.push('(a.title LIKE ? OR a.description LIKE ?)'); params.push(`%${f.q}%`, `%${f.q}%`); }
    return query(
      `SELECT a.*, s.subject_name FROM assignments a JOIN subjects s ON s.subject_id = a.subject_id
       WHERE ${where.join(' AND ')} ORDER BY a.deadline ASC, a.assignment_id ASC`, params);
  },
  listOpenForPlanning(userId) {
    return query(
      `SELECT a.*, s.priority AS subject_priority FROM assignments a JOIN subjects s ON s.subject_id = a.subject_id
       WHERE a.user_id = ? AND a.status <> 'Completed'`, [userId]);
  },
  dueSoonOrOverdue(userId, untilDate) {
    return query("SELECT * FROM assignments WHERE user_id = ? AND status <> 'Completed' AND deadline <= ?", [userId, untilDate]);
  },
  async setStatus(id, status) {
    await query('UPDATE assignments SET status = ? WHERE assignment_id = ?', [status, id]);
  }
};
