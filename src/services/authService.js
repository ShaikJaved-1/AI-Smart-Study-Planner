const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const HttpError = require('../utils/httpError');
const userRepository = require('../repositories/userRepository');
const activityRepository = require('../repositories/activityRepository');

const sign = (user) => jwt.sign({ id: user.user_id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

const publicUser = (u) => ({ user_id: u.user_id, name: u.name, email: u.email, role: u.role });

async function register({ name, email, password }) {
  if (await userRepository.findByEmail(email)) throw new HttpError(400, 'Email is already registered');
  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  const id = await userRepository.create({ name, email, passwordHash, role: 'student' });
  const user = await userRepository.findById(id);
  return { token: sign(user), user: publicUser(user) };
}

async function login({ email, password }, ip) {
  const user = await userRepository.findByEmail(email);
  const valid = user && (await bcrypt.compare(password, user.password_hash));
  if (!valid) throw new HttpError(401, 'Invalid email or password');
  if (!user.is_active) throw new HttpError(403, 'This account has been disabled');
  activityRepository.log(user.user_id, 'LOGIN', null, ip).catch(() => {});
  return { token: sign(user), user: publicUser(user) };
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const hash = await userRepository.getPasswordHash(userId);
  if (!hash || !(await bcrypt.compare(currentPassword, hash))) throw new HttpError(400, 'Current password is incorrect');
  await userRepository.updatePassword(userId, await bcrypt.hash(newPassword, env.bcryptRounds));
}

module.exports = { register, login, changePassword };
