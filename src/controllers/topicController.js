const createCrudController = require('./crudController');
const repo = require('../repositories/topicRepository');
const { validateTopic } = require('../services/validationService');

module.exports = createCrudController({ label: 'Topic', repo, validate: validateTopic });
