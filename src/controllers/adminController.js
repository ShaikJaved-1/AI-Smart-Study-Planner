const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { ok } = require('../utils/response');
const userRepository = require('../repositories/userRepository');
const activityRepository = require('../repositories/activityRepository');
const notificationRepository = require('../repositories/notificationRepository');
const reportService = require('../services/reportService');
const { clean } = require('../services/validationService');

exports.users = asyncHandler(async (req, res) => {
  ok(res, 'Users retrieved successfully', await userRepository.listAll());
});

exports.setUserStatus = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid user id');
  if (typeof req.body.is_active !== 'boolean') throw new HttpError(400, 'is_active must be true or false');
  if (!(await userRepository.setActive(id, req.body.is_active))) throw new HttpError(404, 'Student account not found');
  ok(res, req.body.is_active ? 'Account enabled' : 'Account disabled');
});

exports.activities = asyncHandler(async (req, res) => {
  ok(res, 'Activities retrieved successfully', await activityRepository.list(100));
});

exports.reports = asyncHandler(async (req, res) => {
  ok(res, 'Admin report retrieved successfully', await reportService.adminReport());
});

exports.listNotifications = asyncHandler(async (req, res) => {
  ok(res, 'Notifications retrieved successfully', await notificationRepository.listAdminSent(50));
});

// Sends an announcement to one student (user_id) or to every active student.
exports.sendNotification = asyncHandler(async (req, res) => {
  const message = clean(req.body.message);
  if (!message) throw new HttpError(400, 'Message is required');
  if (message.length > 255) throw new HttpError(400, 'Message must be at most 255 characters');
  const userId = req.body.user_id ? Number(req.body.user_id) : null;
  if (req.body.user_id && (!Number.isInteger(userId) || userId <= 0)) throw new HttpError(400, 'Invalid user id');
  const count = await notificationRepository.broadcastToStudents(message, userId);
  if (userId && count === 0) throw new HttpError(404, 'Student account not found');
  ok(res, `Notification sent to ${count} student(s)`, { recipients: count });
});
