const createCrudController = require('./crudController');
const repo = require('../repositories/assignmentRepository');
const { validateAssignment } = require('../services/validationService');
const plannerService = require('../services/plannerService');

// Changing or deleting an assignment re-plans the affected study sessions automatically.
module.exports = createCrudController({
  label: 'Assignment', repo, validate: validateAssignment,
  afterChange: (userId) => plannerService.autoReschedule(userId)
});
