const { query } = require('../config/db');

// Small helper that gives a table find/create/update/remove scoped to the owning user.
// Table and column names come from code (never from requests); values are always bound parameters.
function createCrudRepository({ table, idColumn, columns }) {
  return {
    async findById(id, userId) {
      const rows = await query(`SELECT * FROM ${table} WHERE ${idColumn} = ? AND user_id = ?`, [id, userId]);
      return rows[0] || null;
    },
    async create(userId, data) {
      const cols = columns.filter((c) => data[c] !== undefined);
      const sql = `INSERT INTO ${table} (user_id, ${cols.join(', ')}) VALUES (?${', ?'.repeat(cols.length)})`;
      const result = await query(sql, [userId, ...cols.map((c) => data[c])]);
      return result.insertId;
    },
    async update(id, userId, data) {
      const cols = columns.filter((c) => data[c] !== undefined);
      if (!cols.length) return false;
      const sql = `UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE ${idColumn} = ? AND user_id = ?`;
      const result = await query(sql, [...cols.map((c) => data[c]), id, userId]);
      return result.affectedRows > 0;
    },
    async remove(id, userId) {
      const result = await query(`DELETE FROM ${table} WHERE ${idColumn} = ? AND user_id = ?`, [id, userId]);
      return result.affectedRows > 0;
    }
  };
}
module.exports = createCrudRepository;
