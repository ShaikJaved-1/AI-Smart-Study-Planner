const { query, withTransaction } = require('../config/db');

const PUBLIC_COLUMNS = `u.user_id, u.name, u.email, u.role, u.is_active, u.created_at,
  p.phone, p.institution, p.course, p.preferred_start_time`;

module.exports = {
  async findById(id) {
    const rows = await query(
      `SELECT ${PUBLIC_COLUMNS} FROM users u LEFT JOIN profiles p ON p.user_id = u.user_id WHERE u.user_id = ?`, [id]);
    return rows[0] || null;
  },
  async findByEmail(email) {
    const rows = await query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  },
  async getPasswordHash(id) {
    const rows = await query('SELECT password_hash FROM users WHERE user_id = ?', [id]);
    return rows[0] ? rows[0].password_hash : null;
  },
  create({ name, email, passwordHash, role = 'student' }) {
    return withTransaction(async (tx) => {
      const result = await tx.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [name, email, passwordHash, role]);
      await tx.query('INSERT INTO profiles (user_id) VALUES (?)', [result.insertId]);
      return result.insertId;
    });
  },
  updateProfile(id, { name, phone, institution, course, preferred_start_time }) {
    return withTransaction(async (tx) => {
      await tx.query('UPDATE users SET name = ? WHERE user_id = ?', [name, id]);
      await tx.query(
        `INSERT INTO profiles (user_id, phone, institution, course, preferred_start_time) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE phone = VALUES(phone), institution = VALUES(institution),
         course = VALUES(course), preferred_start_time = VALUES(preferred_start_time)`,
        [id, phone, institution, course, preferred_start_time]);
    });
  },
  async updatePassword(id, hash) {
    await query('UPDATE users SET password_hash = ? WHERE user_id = ?', [hash, id]);
  },
  listAll() {
    return query(
      `SELECT u.user_id, u.name, u.email, u.role, u.is_active, u.created_at,
        (SELECT COUNT(*) FROM subjects s WHERE s.user_id = u.user_id) AS subject_count,
        (SELECT COUNT(*) FROM assignments a WHERE a.user_id = u.user_id) AS assignment_count,
        (SELECT COUNT(*) FROM exams e WHERE e.user_id = u.user_id) AS exam_count
       FROM users u ORDER BY u.created_at DESC`);
  },
  async setActive(id, isActive) {
    const result = await query("UPDATE users SET is_active = ? WHERE user_id = ? AND role = 'student'", [isActive ? 1 : 0, id]);
    return result.affectedRows > 0;
  }
};
