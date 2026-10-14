const { query } = require('../config/db');
const createCrudRepository = require('./crudRepository');

const crud = createCrudRepository({
  table: 'subjects', idColumn: 'subject_id', columns: ['subject_name', 'description', 'priority']
});

module.exports = {
  ...crud,
  list(userId) {
    return query(
      `SELECT s.*,
        (SELECT COUNT(*) FROM topics t WHERE t.subject_id = s.subject_id) AS topic_count,
        (SELECT COUNT(*) FROM assignments a WHERE a.subject_id = s.subject_id) AS assignment_count
       FROM subjects s WHERE s.user_id = ?
       ORDER BY FIELD(s.priority, 'High', 'Medium', 'Low'), s.subject_name`, [userId]);
  }
};
