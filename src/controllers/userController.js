const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { ok } = require('../utils/response');
const userRepository = require('../repositories/userRepository');
const authService = require('../services/authService');
const { validateProfile, validatePasswordChange } = require('../services/validationService');

const strip = ({ is_active, ...rest }) => rest;

exports.me = asyncHandler(async (req, res) => {
  ok(res, 'Profile retrieved successfully', strip(await userRepository.findById(req.user.id)));
});

exports.updateMe = asyncHandler(async (req, res) => {
  const { errors, value } = validateProfile(req.body || {});
  if (errors.length) throw new HttpError(400, errors.join('. '));
  await userRepository.updateProfile(req.user.id, value);
  ok(res, 'Profile updated successfully', strip(await userRepository.findById(req.user.id)));
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { errors, value } = validatePasswordChange(req.body || {});
  if (errors.length) throw new HttpError(400, errors.join('. '));
  await authService.changePassword(req.user.id, value);
  ok(res, 'Password changed successfully');
});
