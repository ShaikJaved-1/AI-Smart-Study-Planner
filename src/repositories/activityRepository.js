const { query } = require('../config/db');

module.exports = {
  async log(userId, action, details, ip) {
    await query('INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [userId, String(action).slice(0, 150), details, ip ? String(ip).slice(0, 64) : null]);
  },
  list(limit = 100) {
    return query(
      `SELECT l.log_id, l.action, l.details, l.ip_address, l.created_at, u.name, u.email
       FROM activity_logs l LEFT JOIN users u ON u.user_id = l.user_id
       ORDER BY l.log_id DESC LIMIT ${Number(limit)}`);
  }
};
