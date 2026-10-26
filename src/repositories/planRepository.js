
const { query, withTransaction } = require('../config/db');

const ITEM_SELECT = `SELECT i.*, s.subject_name, g.progress_id, g.hours_completed
  FROM plan_items i JOIN subjects s ON s.subject_id = i.subject_id
  LEFT JOIN progress g ON g.item_id = i.item_id`;

module.exports = {
  async getActive(userId) {
    const rows = await query(
      "SELECT * FROM study_plans WHERE user_id = ? AND status = 'Active' ORDER BY plan_id DESC LIMIT 1",
      [userId]
    );
    return rows[0] || null;
  },

  async create(userId, startDate) {
    const result = await query(
      "INSERT INTO study_plans (user_id, status, start_date) VALUES (?, 'Active', ?)",
      [userId, startDate]
    );
    return {
      plan_id: result.insertId,
      user_id: userId,
      start_date: startDate
    };
  },

  listItemsForPlan(planId) {
    return query(
      'SELECT * FROM plan_items WHERE plan_id = ? ORDER BY session_date, start_time',
      [planId]
    );
  },

  listItems(userId, f = {}) {
    const where = ['i.user_id = ?'];
    const params = [userId];

    if (f.from) {
      where.push('i.session_date >= ?');
      params.push(f.from);
    }
    if (f.to) {
      where.push('i.session_date <= ?');
      params.push(f.to);
    }
    if (f.status) {
      where.push('i.status = ?');
      params.push(f.status);
    }
    if (f.subject_id) {
      where.push('i.subject_id = ?');
      params.push(f.subject_id);
    }

    return query(
      `${ITEM_SELECT} WHERE ${where.join(' AND ')} ORDER BY i.session_date, i.start_time`,
      params
    );
  },

  itemsForDate(userId, date) {
    return query(
      `${ITEM_SELECT} WHERE i.user_id = ? AND i.session_date = ? ORDER BY i.start_time`,
      [userId, date]
    );
  },

  // Keeps completed and missed history, replaces future planned sessions,
  // and stores new topic, assignment, and exam sessions.
  replaceFutureItems({ planId, userId, today, sessions }) {
    return withTransaction(async (tx) => {
      await tx.query(
        "UPDATE plan_items SET status = 'Missed' WHERE plan_id = ? AND status = 'Planned' AND session_date < ?",
        [planId, today]
      );

      await tx.query(
        `UPDATE progress g
         JOIN plan_items i ON i.item_id = g.item_id
         SET g.status = 'Missed'
         WHERE i.plan_id = ? AND i.status = 'Missed' AND g.status <> 'Missed'`,
        [planId]
      );

      await tx.query(
        "DELETE FROM plan_items WHERE plan_id = ? AND status = 'Planned' AND session_date >= ?",
        [planId, today]
      );

      if (sessions.length) {
        const rows = sessions.map((s) => [
          planId,
          userId,
          s.subjectId,
          s.type === 'topic' ? s.refId : null,
          s.type === 'assignment' ? s.refId : null,
          s.type === 'exam' ? s.refId : null,
          s.title,
          s.date,
          s.startTime,
          s.endTime,
          s.durationHours,
          'Planned',
          s.rescheduledFromMissed ? 1 : 0
        ]);

        await tx.query(
          `INSERT INTO plan_items (
            plan_id, user_id, subject_id, topic_id, assignment_id, exam_id,
            title, session_date, start_time, end_time, duration_hours, status, rescheduled_from_missed
          ) VALUES ?`,
          [rows]
        );
      }

      await tx.query(
        `INSERT INTO progress (user_id, item_id, subject_id, status)
         SELECT p.user_id, p.item_id, p.subject_id, p.status
         FROM plan_items p
         LEFT JOIN progress g ON g.item_id = p.item_id
         WHERE p.plan_id = ? AND g.item_id IS NULL`,
        [planId]
      );

      await tx.query(
        `UPDATE study_plans
         SET generated_at = NOW(),
             end_date = (
               SELECT MAX(session_date)
               FROM plan_items
               WHERE plan_id = ?
             )
         WHERE plan_id = ?`,
        [planId, planId]
      );
    });
  }
};
