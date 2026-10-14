-- AI-Based Smart Study Planner - MySQL 8.0 schema
-- Run:  mysql -u root -p < sql/schema.sql   (or: npm run db:init)
-- Tables use IF NOT EXISTS, so re-running is safe and keeps existing data.

CREATE DATABASE IF NOT EXISTS ai_smart_study_planner;
USE ai_smart_study_planner;

CREATE TABLE IF NOT EXISTS users (
  user_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('student','admin') NOT NULL DEFAULT 'student',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS profiles (
  profile_id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id              INT UNSIGNED NOT NULL,
  phone                VARCHAR(30) NULL,
  institution          VARCHAR(150) NULL,
  course               VARCHAR(100) NULL,
  preferred_start_time TIME NOT NULL DEFAULT '17:00:00',
  updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_profiles_user (user_id),
  CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS subjects (
  subject_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL,
  subject_name VARCHAR(100) NOT NULL,
  description  TEXT NULL,
  priority     ENUM('Low','Medium','High') NOT NULL DEFAULT 'Medium',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_subjects_user_name (user_id, subject_name),
  CONSTRAINT fk_subjects_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS topics (
  topic_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subject_id  INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  topic_name  VARCHAR(150) NOT NULL,
  description TEXT NULL,
  status      ENUM('Not Started','In Progress','Completed') NOT NULL DEFAULT 'Not Started',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_topics_subject (subject_id),
  KEY idx_topics_user (user_id),
  CONSTRAINT fk_topics_subject FOREIGN KEY (subject_id) REFERENCES subjects(subject_id) ON DELETE CASCADE,
  CONSTRAINT fk_topics_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assignments (
  assignment_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  subject_id      INT UNSIGNED NOT NULL,
  title           VARCHAR(150) NOT NULL,
  description     TEXT NULL,
  deadline        DATE NOT NULL,
  priority        ENUM('Low','Medium','High') NOT NULL DEFAULT 'Medium',
  estimated_hours DECIMAL(5,2) NOT NULL,
  status          ENUM('Pending','In Progress','Completed') NOT NULL DEFAULT 'Pending',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_assignments_user_deadline (user_id, deadline),
  KEY idx_assignments_user_status (user_id, status),
  KEY idx_assignments_subject (subject_id),
  CONSTRAINT fk_assignments_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_assignments_subject FOREIGN KEY (subject_id) REFERENCES subjects(subject_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS exams (
  exam_id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id           INT UNSIGNED NOT NULL,
  subject_id        INT UNSIGNED NOT NULL,
  exam_name         VARCHAR(150) NOT NULL,
  exam_date         DATE NOT NULL,
  priority          ENUM('Low','Medium','High') NOT NULL DEFAULT 'Medium',
  preparation_hours DECIMAL(5,2) NOT NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_exams_user_date (user_id, exam_date),
  KEY idx_exams_subject (subject_id),
  CONSTRAINT fk_exams_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_exams_subject FOREIGN KEY (subject_id) REFERENCES subjects(subject_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS study_goals (
  goal_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL,
  subject_id   INT UNSIGNED NULL,
  goal_type    ENUM('daily','weekly','subject') NOT NULL,
  target_hours DECIMAL(5,2) NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_goals_user_type (user_id, goal_type),
  CONSTRAINT fk_goals_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_goals_subject FOREIGN KEY (subject_id) REFERENCES subjects(subject_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS study_plans (
  plan_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL,
  status       ENUM('Active','Archived') NOT NULL DEFAULT 'Active',
  start_date   DATE NOT NULL,
  end_date     DATE NULL,
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_plans_user_status (user_id, status),
  CONSTRAINT fk_plans_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS plan_items (
  item_id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  plan_id        INT UNSIGNED NOT NULL,
  user_id        INT UNSIGNED NOT NULL,
  subject_id     INT UNSIGNED NOT NULL,
  assignment_id  INT UNSIGNED NULL,
  exam_id        INT UNSIGNED NULL,
  title          VARCHAR(200) NOT NULL,
  session_date   DATE NOT NULL,
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  duration_hours DECIMAL(4,2) NOT NULL,
  status         ENUM('Planned','Completed','Missed') NOT NULL DEFAULT 'Planned',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_items_user_date (user_id, session_date),
  KEY idx_items_plan_status (plan_id, status),
  KEY idx_items_assignment (assignment_id),
  KEY idx_items_exam (exam_id),
  CONSTRAINT fk_items_plan FOREIGN KEY (plan_id) REFERENCES study_plans(plan_id) ON DELETE CASCADE,
  CONSTRAINT fk_items_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_items_subject FOREIGN KEY (subject_id) REFERENCES subjects(subject_id) ON DELETE CASCADE,
  CONSTRAINT fk_items_assignment FOREIGN KEY (assignment_id) REFERENCES assignments(assignment_id) ON DELETE CASCADE,
  CONSTRAINT fk_items_exam FOREIGN KEY (exam_id) REFERENCES exams(exam_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS progress (
  progress_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  item_id         INT UNSIGNED NOT NULL,
  subject_id      INT UNSIGNED NOT NULL,
  hours_completed DECIMAL(4,2) NOT NULL DEFAULT 0,
  status          ENUM('Planned','Completed','Missed') NOT NULL DEFAULT 'Planned',
  completed_at    DATETIME NULL,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_progress_item (item_id),
  KEY idx_progress_user_status (user_id, status),
  KEY idx_progress_subject (subject_id),
  CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_item FOREIGN KEY (item_id) REFERENCES plan_items(item_id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_subject FOREIGN KEY (subject_id) REFERENCES subjects(subject_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  notification_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  type            ENUM('deadline','exam','session','overdue','plan','admin') NOT NULL,
  message         VARCHAR(255) NOT NULL,
  dedupe_key      VARCHAR(120) NULL,
  is_read         TINYINT(1) NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_notifications_dedupe (user_id, dedupe_key),
  KEY idx_notifications_user_read (user_id, is_read),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS activity_logs (
  log_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NULL,
  action     VARCHAR(150) NOT NULL,
  details    VARCHAR(255) NULL,
  ip_address VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_activity_created (created_at),
  KEY idx_activity_user (user_id),
  CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;
