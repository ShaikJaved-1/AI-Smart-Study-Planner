// Creates demo accounts and sample study data  ->  npm run db:seed
// Safe to run twice: existing demo accounts are left untouched.
const bcrypt = require('bcryptjs');
const env = require('../src/config/env');
const { pool, query } = require('../src/config/db');
const { todayStr, addDays } = require('../src/utils/dateUtils');
const userRepository = require('../src/repositories/userRepository');
const plannerService = require('../src/services/plannerService');

const ADMIN = { name: 'Admin User', email: 'admin@studyplanner.com', password: 'Admin@123' };
const STUDENT = { name: 'Demo Student', email: 'student@example.com', password: 'Student@123' };

async function ensureUser({ name, email, password }, role) {
  const existing = await userRepository.findByEmail(email);
  if (existing) return { id: existing.user_id, isNew: false };
  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  return { id: await userRepository.create({ name, email, passwordHash, role }), isNew: true };
}

async function insert(sql, params) { return (await query(sql, params)).insertId; }

(async () => {
  await ensureUser(ADMIN, 'admin');
  const { id: uid, isNew } = await ensureUser(STUDENT, 'student');
  if (!isNew) { console.log('Demo accounts already exist. Nothing to add.'); return; }

  const today = todayStr();
  const subj = {};
  for (const [name, priority, description] of [
    ['Mathematics', 'High', 'Calculus and linear algebra'],
    ['Physics', 'Medium', 'Mechanics and waves'],
    ['Computer Science', 'High', 'Data structures and databases'],
    ['English', 'Low', 'Academic writing']
  ]) {
    subj[name] = await insert('INSERT INTO subjects (user_id, subject_name, description, priority) VALUES (?, ?, ?, ?)', [uid, name, description, priority]);
  }
  const topics = [
    ['Mathematics', 'Integration', 'In Progress'], ['Mathematics', 'Matrices', 'Not Started'],
    ['Physics', 'Newton\'s Laws', 'Completed'], ['Physics', 'Wave Motion', 'Not Started'],
    ['Computer Science', 'Binary Trees', 'In Progress'], ['Computer Science', 'SQL Joins', 'Not Started']
  ];
  for (const [s, name, status] of topics) {
    await insert('INSERT INTO topics (subject_id, user_id, topic_name, status) VALUES (?, ?, ?, ?)', [subj[s], uid, name, status]);
  }
  const assignments = [
    ['Mathematics', 'Calculus problem set', 3, 'High', 4],
    ['Physics', 'Lab report: pendulum', 5, 'Medium', 3],
    ['Computer Science', 'Database design project', 9, 'High', 8],
    ['English', 'Essay draft', 7, 'Low', 3],
    ['Computer Science', 'Binary tree exercises', 12, 'Medium', 4]
  ];
  for (const [s, title, days, priority, hours] of assignments) {
    await insert('INSERT INTO assignments (user_id, subject_id, title, description, deadline, priority, estimated_hours, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uid, subj[s], title, `Sample assignment: ${title}`, addDays(today, days), priority, hours, 'Pending']);
  }
  const exams = [
    ['Mathematics', 'Calculus midterm', 14, 'High', 10],
    ['Physics', 'Mechanics quiz', 10, 'Medium', 5],
    ['Computer Science', 'Databases final', 21, 'High', 12]
  ];
  for (const [s, name, days, priority, hours] of exams) {
    await insert('INSERT INTO exams (user_id, subject_id, exam_name, exam_date, priority, preparation_hours) VALUES (?, ?, ?, ?, ?, ?)',
      [uid, subj[s], name, addDays(today, days), priority, hours]);
  }
  await insert("INSERT INTO study_goals (user_id, goal_type, target_hours) VALUES (?, 'daily', 3)", [uid]);
  await insert("INSERT INTO study_goals (user_id, goal_type, target_hours) VALUES (?, 'weekly', 18)", [uid]);
  await insert("INSERT INTO study_goals (user_id, goal_type, subject_id, target_hours) VALUES (?, 'subject', ?, 6)", [uid, subj['Mathematics']]);

  const summary = await plannerService.generate(uid);
  console.log(`Demo data created. Study plan generated with ${summary.sessions_created} sessions (${summary.planned_hours} hours).`);
  console.log(`Admin:   ${ADMIN.email} / ${ADMIN.password}`);
  console.log(`Student: ${STUDENT.email} / ${STUDENT.password}`);
})()
  .catch((err) => { console.error('Seeding failed:', err.message); process.exitCode = 1; })
  .finally(() => pool.end());
