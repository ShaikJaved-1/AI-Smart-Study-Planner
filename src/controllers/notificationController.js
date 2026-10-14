const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { ok } = require('../utils/response');
const notificationRepository = require('../repositories/notificationRepository');
const notificationService = require('../services/notificationService');

exports.list = asyncHandler(async (req, res) => {
  ok(res, 'Notifications retrieved successfully', await notificationService.listForUser(req.user.id));
});

exports.markRead = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid notification id');
  if (!(await notificationRepository.markRead(id, req.user.id))) throw new HttpError(404, 'Notification not found');
  ok(res, 'Notification marked as read');
});

exports.markAllRead = asyncHandler(async (req, res) => {
  await notificationRepository.markAllRead(req.user.id);
  ok(res, 'All notifications marked as read');
});
