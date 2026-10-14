const { query } = require('../config/db');

module.exports = {
  async addIfNew(userId, type, message, dedupeKey) {
    await query('INSERT IGNORE INTO notifications (user_id, type, message, dedupe_key) VALUES (?, ?, ?, ?)',
      [userId, type, String(message).slice(0, 255), dedupeKey]);
  },
  list(userId, limit = 50) {
    return query(`SELECT * FROM notifications WHERE user_id = ? ORDER BY notification_id DESC LIMIT ${Number(limit)}`, [userId]);
  },
  async unreadCount(userId) {
    const rows = await query('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0', [userId]);
    return Number(rows[0].c);
  },
  async markRead(id, userId) {
    const result = await query('UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?', [id, userId]);
    return result.affectedRows > 0;
  },
  async markAllRead(userId) {
    await query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
  },
  async broadcastToStudents(message, userId = null) {
    const sql = userId
      ? "INSERT INTO notifications (user_id, type, message) SELECT user_id, 'admin', ? FROM users WHERE user_id = ? AND role = 'student'"
      : "INSERT INTO notifications (user_id, type, message) SELECT user_id, 'admin', ? FROM users WHERE role = 'student' AND is_active = 1";
    const result = await query(sql, userId ? [message, userId] : [message]);
    return result.affectedRows;
  },
  listAdminSent(limit = 50) {
    return query(
      `SELECT n.notification_id, n.message, n.created_at, n.is_read, u.name AS student_name
       FROM notifications n JOIN users u ON u.user_id = n.user_id WHERE n.type = 'admin'
       ORDER BY n.notification_id DESC LIMIT ${Number(limit)}`);
  }
};
