const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const stringParams = require('../utils/query');
const plannerService = require('../services/plannerService');

exports.generate = asyncHandler(async (req, res) => {
  ok(res, 'Study plan generated successfully', await plannerService.generate(req.user.id));
});

exports.reschedule = asyncHandler(async (req, res) => {
  ok(res, 'Study plan rescheduled successfully', await plannerService.reschedule(req.user.id));
});

exports.get = asyncHandler(async (req, res) => {
  ok(res, 'Study plan retrieved successfully', await plannerService.getPlan(req.user.id, stringParams(req.query)));
});
