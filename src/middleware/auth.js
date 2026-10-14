const jwt = require('jsonwebtoken');
const env = require('../config/env');
const HttpError = require('../utils/httpError');
const userRepository = require('../repositories/userRepository');

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new HttpError(401, 'Authentication required');
    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch (e) {
      throw new HttpError(401, 'Invalid or expired token');
    }
    const user = await userRepository.findById(payload.id);
    if (!user || !user.is_active) throw new HttpError(401, 'Account not found or disabled');
    req.user = { id: user.user_id, role: user.role, name: user.name, email: user.email };
    next();
  } catch (err) {
    next(err);
  }
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new HttpError(403, 'You do not have permission to access this resource'));

module.exports = { authenticate, requireRole };
