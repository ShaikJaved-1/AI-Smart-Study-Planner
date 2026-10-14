const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { ok, created } = require('../utils/response');
const authService = require('../services/authService');
const { validateRegister, validateLogin } = require('../services/validationService');

exports.register = asyncHandler(async (req, res) => {
  const { errors, value } = validateRegister(req.body || {});
  if (errors.length) throw new HttpError(400, errors.join('. '));
  created(res, 'Registration successful', await authService.register(value));
});

exports.login = asyncHandler(async (req, res) => {
  const { errors, value } = validateLogin(req.body || {});
  if (errors.length) throw new HttpError(400, errors.join('. '));
  ok(res, 'Login successful', await authService.login(value, req.ip));
});

// Tokens are stateless JWTs: the client discards its token. The server just confirms the request.
exports.logout = asyncHandler(async (req, res) => {
  ok(res, 'Logged out successfully');
});
