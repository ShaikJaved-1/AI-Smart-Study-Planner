const HttpError = require('../utils/httpError');

function notFound(req, res, next) {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof HttpError) return res.status(err.status).json({ success: false, message: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ success: false, message: 'Invalid JSON body' });
  if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'A record with the same value already exists' });
  if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ success: false, message: 'Referenced record does not exist' });
  console.error(err);
  return res.status(500).json({ success: false, message: 'Internal server error' });
}

module.exports = { notFound, errorHandler };
