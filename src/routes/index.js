const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const activityLogger = require('../middleware/activityLogger');

const auth = require('../controllers/authController');
const users = require('../controllers/userController');
const subjects = require('../controllers/subjectController');
const topics = require('../controllers/topicController');
const assignments = require('../controllers/assignmentController');
const exams = require('../controllers/examController');
const goals = require('../controllers/goalController');
const planner = require('../controllers/plannerController');
const progress = require('../controllers/progressController');
const reports = require('../controllers/reportController');
const notifications = require('../controllers/notificationController');
const admin = require('../controllers/adminController');

const router = express.Router();
const student = requireRole('student');
const adminOnly = requireRole('admin');

// Simple health check (handy for JMeter)
router.get('/health', (req, res) => res.json({ success: true, message: 'OK', data: {} }));

// Public
router.post('/auth/register', auth.register);
router.post('/auth/login', auth.login);

// Everything below needs a valid token
router.use(authenticate, activityLogger);
router.post('/auth/logout', auth.logout);

router.get('/users/me', users.me);
router.put('/users/me', users.updateMe);
router.put('/users/password', users.changePassword);

function crudRoutes(path, controller) {
  router.get(path, student, controller.list);
  router.post(path, student, controller.create);
  router.put(`${path}/:id`, student, controller.update);
  router.delete(`${path}/:id`, student, controller.remove);
}
crudRoutes('/subjects', subjects);
crudRoutes('/topics', topics);
crudRoutes('/assignments', assignments);
crudRoutes('/exams', exams);
crudRoutes('/goals', goals);

router.post('/planner/generate', student, planner.generate);
router.post('/planner/reschedule', student, planner.reschedule);
router.get('/planner', student, planner.get);

router.get('/progress', student, progress.list);
router.put('/progress/:id', student, progress.update);

router.get('/reports/dashboard', student, reports.dashboard);
router.get('/reports/progress', student, reports.progress);

router.get('/notifications', notifications.list);
router.put('/notifications/read-all', notifications.markAllRead);
router.put('/notifications/:id/read', notifications.markRead);

router.get('/admin/users', adminOnly, admin.users);
router.put('/admin/users/:id/status', adminOnly, admin.setUserStatus);
router.get('/admin/activities', adminOnly, admin.activities);
router.get('/admin/reports', adminOnly, admin.reports);
router.get('/admin/notifications', adminOnly, admin.listNotifications);
router.post('/admin/notifications', adminOnly, admin.sendNotification);

module.exports = router;
