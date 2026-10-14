const { query } = require('../config/db');
const createCrudRepository = require('./crudRepository');

const crud = createCrudRepository({
  table: 'study_goals', idColumn: 'goal_id', columns: ['subject_id', 'goal_type', 'target_hours']
});

module.exports = {
  ...crud,
  list(userId) {
    return query(
      `SELECT g.*, s.subject_name FROM study_goals g LEFT JOIN subjects s ON s.subject_id = g.subject_id
       WHERE g.user_id = ? ORDER BY g.goal_type, g.goal_id DESC`, [userId]);
  },
  async latestTarget(userId, type) {
    const rows = await query(
      'SELECT target_hours FROM study_goals WHERE user_id = ? AND goal_type = ? ORDER BY goal_id DESC LIMIT 1', [userId, type]);
    return rows[0] ? Number(rows[0].target_hours) : null;
  }
};
