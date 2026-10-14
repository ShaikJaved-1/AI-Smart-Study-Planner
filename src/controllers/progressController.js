const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { ok } = require('../utils/response');
const stringParams = require('../utils/query');
const progressRepository = require('../repositories/progressRepository');
const progressService = require('../services/progressService');

exports.list = asyncHandler(async (req, res) => {
  ok(res, 'Progress retrieved successfully', await progressRepository.list(req.user.id, stringParams(req.query)));
});

exports.update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid progress id');
  ok(res, 'Progress updated successfully', await progressService.updateProgress(req.user.id, id, req.body || {}));
});
