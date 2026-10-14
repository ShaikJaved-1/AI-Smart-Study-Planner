const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const reportService = require('../services/reportService');

exports.dashboard = asyncHandler(async (req, res) => {
  ok(res, 'Dashboard retrieved successfully', await reportService.dashboard(req.user.id));
});

exports.progress = asyncHandler(async (req, res) => {
  ok(res, 'Progress report retrieved successfully', await reportService.progressData(req.user.id));
});
