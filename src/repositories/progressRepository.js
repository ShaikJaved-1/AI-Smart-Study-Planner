
const { query, withTransaction } = require('../config/db');

module.exports = {
  list(userId, f = {}) {
    const where = ['g.user_id = ?'];
    const params = [userId];

    if (f.status) {
      where.push('g.status = ?');
      params.push(f.status);
    }
    if (f.subject_id) {
      where.push('g.subject_id = ?');
      params.push(f.subject_id);
    }
    if (f.from) {
      where.push('i.session_date >= ?');
      params.push(f.from);
    }
    if (f.to) {
      where.push('i.session_date <= ?');
      params.push(f.to);
    }

    return query(
      `SELECT g.progress_id, g.item_id, g.status, g.hours_completed,
        g.completed_at, i.title, i.session_date, i.start_time,
        i.end_time, i.duration_hours, i.topic_id, i.assignment_id,
        i.exam_id, s.subject_name
       FROM progress g
       JOIN plan_items i ON i.item_id = g.item_id
       JOIN subjects s ON s.subject_id = g.subject_id
       WHERE ${where.join(' AND ')}
       ORDER BY i.session_date DESC, i.start_time
       LIMIT 300`,
      params
    );
  },

  async findById(progressId, userId) {
    const rows = await query(
      `SELECT g.*, i.topic_id, i.assignment_id, i.exam_id,
        i.duration_hours, i.title
       FROM progress g
       JOIN plan_items i ON i.item_id = g.item_id
       WHERE g.progress_id = ? AND g.user_id = ?`,
      [progressId, userId]
    );

    return rows[0] || null;
  },

  update({ progressId, itemId, status, hours }) {
    return withTransaction(async (tx) => {
      await tx.query(
        `UPDATE progress
         SET status = ?, hours_completed = ?, completed_at = ?
         WHERE progress_id = ?`,
        [
          status,
          hours,
          status === 'Completed' ? new Date() : null,
          progressId
        ]
      );

      await tx.query(
        'UPDATE plan_items SET status = ? WHERE item_id = ?',
        [status, itemId]
      );
    });
  },

    async completedHoursForTopic(topicId) {
    const rows = await query(
      `SELECT COALESCE(SUM(hours_completed), 0) AS h
       FROM progress g
       JOIN plan_items i ON i.item_id = g.item_id
       WHERE i.topic_id = ? AND g.status = 'Completed'`,
      [topicId]
    );

    return Number(rows[0].h);
  },
  
  async completedHoursForAssignment(assignmentId) {
    const rows = await query(
      `SELECT COALESCE(SUM(duration_hours), 0) AS h
       FROM plan_items
       WHERE assignment_id = ? AND status = 'Completed'`,
      [assignmentId]
    );

    return Number(rows[0].h);
  }
};
