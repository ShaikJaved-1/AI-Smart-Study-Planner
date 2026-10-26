const { validateDeadline } = require('./plannerLogic');
const subjectRepository = require('../repositories/subjectRepository');

const PRIORITIES = ['Low', 'Medium', 'High'];
const STATUSES = ['Pending', 'In Progress', 'Completed'];
const TOPIC_STATUSES = ['Not Started', 'In Progress', 'Completed'];
const GOAL_TYPES = ['daily', 'weekly', 'subject'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Removes control characters and trims. Output is HTML-escaped by the frontend when displayed.
const clean = (v) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim() : v);
const isBlank = (v) => v === undefined || v === null || clean(v) === '';

function requiredText(body, field, label, max, errors) {
  const v = clean(body[field]);
  if (isBlank(v)) errors.push(`${label} is required`);
  else if (String(v).length > max) errors.push(`${label} must be at most ${max} characters`);
  return v;
}
function optionalText(body, field, label, max, errors) {
  const v = isBlank(body[field]) ? null : clean(body[field]);
  if (v && v.length > max) errors.push(`${label} must be at most ${max} characters`);
  return v;
}
function enumValue(body, field, label, allowed, fallback, errors) {
  const v = isBlank(body[field]) ? fallback : clean(body[field]);
  if (!allowed.includes(v)) errors.push(`${label} must be one of: ${allowed.join(', ')}`);
  return v;
}
function positiveNumber(body, field, label, max, errors) {
  const n = Number(body[field]);
  if (isBlank(body[field]) || !Number.isFinite(n) || n <= 0) errors.push(`${label} must be a positive number`);
  else if (n > max) errors.push(`${label} must be at most ${max}`);
  return n;
}
async function ownedSubjectId(body, userId, errors) {
  const id = Number(body.subject_id);
  if (!Number.isInteger(id) || id <= 0) { errors.push('Subject is required'); return null; }
  const subject = await subjectRepository.findById(id, userId);
  if (!subject) errors.push('Subject not found');
  return id;
}
function dateField(body, field, label, existing, errors) {
  const v = clean(body[field]);
  const check = validateDeadline(v, { allowPast: !!existing && existing[field] === v });
  if (!check.valid) errors.push(`${label}: ${check.message}`);
  return v;
}

function validateRegister(body) {
  const errors = [];
  const name = requiredText(body, 'name', 'Name', 100, errors);
  const email = String(clean(body.email) || '').toLowerCase();
  if (!EMAIL_RE.test(email)) errors.push('A valid email address is required');
  else if (email.length > 150) errors.push('Email must be at most 150 characters');
  const password = body.password;
  if (typeof password !== 'string' || password.length < 8) errors.push('Password must be at least 8 characters');
  else if (password.length > 72) errors.push('Password must be at most 72 characters');
  return { errors, value: { name, email, password } };
}

function validateLogin(body) {
  const errors = [];
  const email = String(clean(body.email) || '').toLowerCase();
  if (!EMAIL_RE.test(email)) errors.push('A valid email address is required');
  if (typeof body.password !== 'string' || !body.password) errors.push('Password is required');
  return { errors, value: { email, password: body.password } };
}

function validateProfile(body) {
  const errors = [];
  const name = requiredText(body, 'name', 'Name', 100, errors);
  const phone = optionalText(body, 'phone', 'Phone', 30, errors);
  const institution = optionalText(body, 'institution', 'Institution', 150, errors);
  const course = optionalText(body, 'course', 'Course', 100, errors);
  let start = isBlank(body.preferred_start_time) ? '17:00' : clean(body.preferred_start_time).slice(0, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) errors.push('Preferred start time must be HH:MM');
  return { errors, value: { name, phone, institution, course, preferred_start_time: start } };
}

function validatePasswordChange(body) {
  const errors = [];
  if (typeof body.current_password !== 'string' || !body.current_password) errors.push('Current password is required');
  const np = body.new_password;
  if (typeof np !== 'string' || np.length < 8) errors.push('New password must be at least 8 characters');
  else if (np.length > 72) errors.push('New password must be at most 72 characters');
  return { errors, value: { currentPassword: body.current_password, newPassword: np } };
}

async function validateSubject(body, existing, userId) {
  const errors = [];
  const value = {
    subject_name: requiredText(body, 'subject_name', 'Subject name', 100, errors),
    description: optionalText(body, 'description', 'Description', 1000, errors),
    priority: enumValue(body, 'priority', 'Priority', PRIORITIES, 'Medium', errors)
  };
  return { errors, value };
}

async function validateTopic(body, existing, userId) {
  const errors = [];
  const value = {
    subject_id: await ownedSubjectId(body, userId, errors),
    topic_name: requiredText(body, 'topic_name', 'Topic name', 150, errors),
    description: optionalText(body, 'description', 'Description', 1000, errors),
    status: enumValue(body, 'status', 'Status', TOPIC_STATUSES, 'Not Started', errors)
  };
  return { errors, value };
}

async function validateAssignment(body, existing, userId) {
  const errors = [];
  const value = {
    subject_id: await ownedSubjectId(body, userId, errors),
    title: requiredText(body, 'title', 'Title', 150, errors),
    description: optionalText(body, 'description', 'Description', 2000, errors),
    deadline: dateField(body, 'deadline', 'Deadline', existing, errors),
    priority: enumValue(body, 'priority', 'Priority', PRIORITIES, 'Medium', errors),
    estimated_hours: positiveNumber(body, 'estimated_hours', 'Estimated hours', 200, errors),
    status: enumValue(body, 'status', 'Status', STATUSES, 'Pending', errors)
  };
  return { errors, value };
}

async function validateExam(body, existing, userId) {
  const errors = [];
  const value = {
    subject_id: await ownedSubjectId(body, userId, errors),
    exam_name: requiredText(body, 'exam_name', 'Exam name', 150, errors),
    exam_date: dateField(body, 'exam_date', 'Exam date', existing, errors),
    priority: enumValue(body, 'priority', 'Priority', PRIORITIES, 'Medium', errors),
    // Kept in the database for backward compatibility. The planner estimates
    // preparation time automatically, so this field is no longer required.
    preparation_hours: isBlank(body.preparation_hours)
      ? (existing && Number(existing.preparation_hours) > 0
        ? Number(existing.preparation_hours)
        : 1)
      : positiveNumber(body, 'preparation_hours', 'Preparation hours', 500, errors)
  };
  return { errors, value };
}

async function validateGoal(body, existing, userId) {
  const errors = [];
  const goalType = enumValue(body, 'goal_type', 'Goal type', GOAL_TYPES, undefined, errors);
  const max = goalType === 'daily' ? 12 : 84;
  const value = {
    goal_type: goalType,
    target_hours: positiveNumber(body, 'target_hours', 'Target hours', max, errors),
    subject_id: null
  };
  if (goalType === 'subject') value.subject_id = await ownedSubjectId(body, userId, errors);
  return { errors, value };
}

module.exports = {
  PRIORITIES, STATUSES, clean,
  validateRegister, validateLogin, validateProfile, validatePasswordChange,
  validateSubject, validateTopic, validateAssignment, validateExam, validateGoal
};
