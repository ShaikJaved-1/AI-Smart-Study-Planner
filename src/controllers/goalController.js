const createCrudController = require('./crudController');
const repo = require('../repositories/goalRepository');
const { validateGoal } = require('../services/validationService');

module.exports = createCrudController({ label: 'Study goal', repo, validate: validateGoal });
