const activityRepository = require('../repositories/activityRepository');

// Records successful write requests (POST/PUT/DELETE) of logged-in users for the admin activity view.
module.exports = (req, res, next) => {
  res.on('finish', () => {
    if (req.user && req.method !== 'GET' && res.statusCode < 400) {
      activityRepository
        .log(req.user.id, `${req.method} ${req.originalUrl.split('?')[0]}`, null, req.ip)
        .catch((e) => console.error('Activity log failed:', e.message));
    }
  });
  next();
};
