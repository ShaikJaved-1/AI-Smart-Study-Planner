const { query } = require('../config/db');
const createCrudRepository = require('./crudRepository');

const crud = createCrudRepository({
  table: 'topics', idColumn: 'topic_id', columns: ['subject_id', 'topic_name', 'description', 'status']
});

module.exports = {
  ...crud,
  list(userId, filters = {}) {
    const where = ['t.user_id = ?'];
    const params = [userId];
    if (filters.subject_id) { where.push('t.subject_id = ?'); params.push(filters.subject_id); }
    if (filters.status) { where.push('t.status = ?'); params.push(filters.status); }
    return query(
      `SELECT t.*, s.subject_name FROM topics t JOIN subjects s ON s.subject_id = t.subject_id
       WHERE ${where.join(' AND ')} ORDER BY s.subject_name, t.topic_name`, params);
  }
};
