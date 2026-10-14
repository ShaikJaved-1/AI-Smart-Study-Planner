const HttpError = require('../utils/httpError');
const progressRepository = require('../repositories/progressRepository');
const assignmentRepository = require('../repositories/assignmentRepository');
const subjectRepository = require('../repositories/subjectRepository');

const ALLOWED = ['Planned', 'Completed', 'Missed'];

async function updateProgress(userId, progressId, body) {
  const row = await progressRepository.findById(progressId, userId);
  if (!row) throw new HttpError(404, 'Progress record not found');
  if (!ALLOWED.includes(body.status)) throw new HttpError(400, `Status must be one of: ${ALLOWED.join(', ')}`);

  let hours = 0;
  if (body.status === 'Completed') {
    hours = body.hours_completed === undefined || body.hours_completed === '' ? Number(row.duration_hours) : Number(body.hours_completed);
    if (!Number.isFinite(hours) || hours <= 0) throw new HttpError(400, 'Hours completed must be a positive number');
    if (hours > Number(row.duration_hours)) throw new HttpError(400, 'Hours completed cannot exceed the planned session length');
  }
  await progressRepository.update({ progressId: row.progress_id, itemId: row.item_id, status: body.status, hours });

  // When enough sessions of an assignment are done, update the assignment status automatically.
  if (row.assignment_id) {
    const assignment = await assignmentRepository.findById(row.assignment_id, userId);
    if (assignment) {
      const done = await progressRepository.completedHoursForAssignment(row.assignment_id);
      if (done >= Number(assignment.estimated_hours)) await assignmentRepository.setStatus(assignment.assignment_id, 'Completed');
      else if (done > 0 && assignment.status === 'Pending') await assignmentRepository.setStatus(assignment.assignment_id, 'In Progress');
    }
  }
  return progressRepository.findById(progressId, userId);
}

module.exports = { updateProgress };
