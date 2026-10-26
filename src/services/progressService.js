const HttpError = require('../utils/httpError');
const progressRepository = require('../repositories/progressRepository');
const assignmentRepository = require('../repositories/assignmentRepository');
const topicRepository = require('../repositories/topicRepository');
const plannerService = require('./plannerService');

const ALLOWED = ['Planned', 'Completed', 'Missed'];

async function updateProgress(userId, progressId, body) {
  const row = await progressRepository.findById(progressId, userId);

  if (!row) {
    throw new HttpError(404, 'Progress record not found');
  }

  if (!ALLOWED.includes(body.status)) {
    throw new HttpError(
      400,
      `Status must be one of: ${ALLOWED.join(', ')}`
    );
  }

  let hours = 0;

  if (body.status === 'Completed') {
    hours = body.hours_completed === undefined || body.hours_completed === ''
      ? Number(row.duration_hours)
      : Number(body.hours_completed);

    if (!Number.isFinite(hours) || hours <= 0) {
      throw new HttpError(
        400,
        'Hours completed must be a positive number'
      );
    }

    if (hours > Number(row.duration_hours)) {
      throw new HttpError(
        400,
        'Hours completed cannot exceed the planned session length'
      );
    }
  }

  await progressRepository.update({
    progressId: row.progress_id,
    itemId: row.item_id,
    status: body.status,
    hours
  });

  if (row.topic_id) {
    const topic = await topicRepository.findById(
      row.topic_id,
      userId
    );

    if (topic) {
      const done = await progressRepository.completedHoursForTopic(
        row.topic_id
      );

      if (done >= Number(row.duration_hours)) {
        await topicRepository.update(row.topic_id, userId, {
          status: 'Completed'
        });
      } else if (body.status !== 'Completed' && topic.status === 'Completed') {
        await topicRepository.update(row.topic_id, userId, {
          status: 'Not Started'
        });
      }
    }
  }

  if (row.assignment_id) {
    const assignment = await assignmentRepository.findById(
      row.assignment_id,
      userId
    );

    if (assignment) {
      const done = await progressRepository.completedHoursForAssignment(
        row.assignment_id
      );

      if (done >= Number(assignment.estimated_hours)) {
        await assignmentRepository.setStatus(
          assignment.assignment_id,
          'Completed'
        );
      } else if (done > 0 && assignment.status === 'Pending') {
        await assignmentRepository.setStatus(
          assignment.assignment_id,
          'In Progress'
        );
      }
    }
  }

  const updated = await progressRepository.findById(
    progressId,
    userId
  );

  await plannerService.autoReschedule(userId);

  return updated;
}

module.exports = { updateProgress };