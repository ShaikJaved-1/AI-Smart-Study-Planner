const createCrudController = require('./crudController');
const repo = require('../repositories/examRepository');
const { validateExam } = require('../services/validationService');
const plannerService = require('../services/plannerService');

module.exports = createCrudController({
  label: 'Exam', repo, validate: validateExam,
  afterChange: (userId) => plannerService.autoReschedule(userId)
});
