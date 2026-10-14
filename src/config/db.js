const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,      // DATE/TIME columns come back as 'YYYY-MM-DD' / 'HH:MM:SS'
  decimalNumbers: true    // DECIMAL columns come back as numbers
});

// Prepared (parameterized) query. Returns rows, or a result header for INSERT/UPDATE/DELETE.
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params.map((p) => (p === undefined ? null : p)));
  return rows;
}

// Runs several queries atomically. `work` receives { query } bound to one connection.
async function withTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work({
      query: async (sql, params = []) => {
        const [rows] = await conn.query(sql, params); // ? placeholders are escaped by mysql2
        return rows;
      }
    });
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, query, withTransaction };
