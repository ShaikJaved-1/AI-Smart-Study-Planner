const createCrudController = require('./crudController');
const repo = require('../repositories/subjectRepository');
const { validateSubject } = require('../services/validationService');

module.exports = createCrudController({ label: 'Subject', repo, validate: validateSubject });
