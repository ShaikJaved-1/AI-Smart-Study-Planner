# AI-Based Smart Study Planner

A full-stack study planning web app with a **rule-based (non-AI) scheduling engine**. Students manage subjects, topics, assignments, exams, and goals; the planner automatically generates and re-balances a study schedule around deadlines, priorities, and available study hours. Admins get a read-only view across all students, activity logs, and can broadcast notifications.

No external AI APIs are used — "smart" scheduling comes from a deterministic priority + greedy-allocation algorithm (see `src/services/plannerLogic.js`).

## Features

- **Auth**: JWT-based login/registration, bcrypt-hashed passwords, student/admin roles
- **Subjects, Topics, Assignments, Exams, Goals**: full CRUD, scoped per user
- **Rule-based scheduler**: prioritizes tasks by urgency (deadline proximity), priority level, and exam status; allocates study sessions within daily/weekly hour caps without overlaps
- **Auto-rescheduling**: any assignment/exam change automatically triggers a replan of future (not-yet-completed) sessions; missed sessions are tracked separately
- **Progress tracking**: log completed hours per session; assignment status auto-updates (Not Started → In Progress → Completed)
- **Reports & dashboard**: study-hour totals, per-subject breakdowns, upcoming items, admin-wide stats and top students
- **Notifications**: auto-generated reminders (due/overdue assignments, upcoming exams, today's sessions) plus admin broadcast messages
- **Search & filter** on list views; **light/dark theme** (persisted); responsive layout (desktop/tablet/mobile)
- **Plain HTML/CSS/JavaScript frontend** — no frontend framework
- **Logic tests**: Node's built-in test runner (JS) and pytest (Python mirror of the scheduling logic)

## Tech Stack

| Layer      | Technology |
|------------|------------|
| Backend    | Node.js, Express (layered MVC: routes → controllers → services → repositories) |
| Database   | MySQL 8.0 (via `mysql2`, parameterized queries) |
| Auth       | JSON Web Tokens (`jsonwebtoken`) + `bcryptjs` |
| Frontend   | Vanilla HTML, CSS, JavaScript (no build step) |
| Logic tests| Node `node:test`, Python `pytest` |
| Load tests | Apache JMeter (REST endpoints documented below) |

## Folder Structure

```
ai-smart-study-planner/
├── server.js                  # Express app entry point
├── package.json
├── .env.example                # copy to .env and fill in
├── sql/
│   ├── schema.sql               # MySQL schema (CREATE TABLE IF NOT EXISTS)
│   ├── init.js                  # runs schema.sql -> npm run db:init
│   └── seed.js                  # demo data -> npm run db:seed
├── src/
│   ├── config/                  # env loader, MySQL pool
│   ├── middleware/               # JWT auth, error handling, activity logging
│   ├── routes/                  # single index.js wiring all /api routes
│   ├── controllers/              # request/response handling
│   ├── services/                 # business logic, incl. plannerLogic.js (the scheduler)
│   ├── repositories/              # parameterized SQL data access
│   └── utils/                    # date math, response helpers, etc.
├── public/                     # frontend (HTML/CSS/JS, served statically)
├── tests/unit/                 # node:test — plannerLogic.js tests
└── python_tests/                # pytest — Python mirror of the scheduling logic
```

## Prerequisites

- Node.js 18+
- MySQL 8.0 (running locally or reachable)
- Python 3.8+ and `pip install pytest` (only needed for the Python logic tests)
- Apache JMeter (only needed for load testing)

## Installation & Setup

1. **Install dependencies**
   ```bash
   cd ai-smart-study-planner
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your MySQL credentials:
   ```
   PORT=3000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=yourpassword
   DB_NAME=study_planner
   JWT_SECRET=change-this-to-a-long-random-string
   JWT_EXPIRES_IN=7d
   BCRYPT_ROUNDS=10
   ```
   Create the database itself first (schema.sql doesn't create the database, only tables):
   ```sql
   CREATE DATABASE study_planner;
   ```

3. **Initialize the schema**
   ```bash
   npm run db:init
   ```

4. **(Optional) Seed demo data**
   ```bash
   npm run db:seed
   ```
   Creates a demo admin and student with subjects, topics, assignments, exams, goals, and an initial generated plan.

   | Role    | Email                     | Password    |
   |---------|---------------------------|-------------|
   | Admin   | admin@studyplanner.com    | Admin@123   |
   | Student | student@example.com       | Student@123 |

5. **Run the server**
   ```bash
   npm start        # production
   npm run dev       # auto-restart on file changes (node --watch)
   ```
   Then open `http://localhost:3000` in a browser.

## API Endpoints

Base path: `/api`. All routes except `/health`, `/auth/register`, and `/auth/login` require `Authorization: Bearer <token>`.

**Auth**
- `POST /auth/register` — create account
- `POST /auth/login` — get JWT
- `POST /auth/logout`

**Profile**
- `GET /users/me` / `PUT /users/me` / `PUT /users/password`

**CRUD resources** (student role) — same shape for each:
- `GET|POST /subjects`, `PUT|DELETE /subjects/:id`
- `GET|POST /topics`, `PUT|DELETE /topics/:id`
- `GET|POST /assignments`, `PUT|DELETE /assignments/:id`
- `GET|POST /exams`, `PUT|DELETE /exams/:id`
- `GET|POST /goals`, `PUT|DELETE /goals/:id`

**Planner**
- `POST /planner/generate` — build a fresh schedule
- `POST /planner/reschedule` — replan remaining/incomplete sessions
- `GET /planner` — fetch current plan (supports date/range filters)

**Progress**
- `GET /progress` / `PUT /progress/:id`

**Reports**
- `GET /reports/dashboard`, `GET /reports/progress`

**Notifications**
- `GET /notifications`, `PUT /notifications/read-all`, `PUT /notifications/:id/read`

**Admin** (admin role)
- `GET /admin/users`, `PUT /admin/users/:id/status`
- `GET /admin/activities`, `GET /admin/reports`
- `GET /admin/notifications`, `POST /admin/notifications`

**Health**
- `GET /health` — used as the JMeter smoke-test target

## Testing

### Scheduling logic (Node)
```bash
npm test
```
Runs `tests/unit/plannerLogic.test.js` via Node's built-in test runner — covers daily/weekly hour caps, no-overlap guarantees, deadline respect, unscheduled-task reporting, rescheduling, and progress-percentage math.

### Scheduling logic (Python mirror)
```bash
npm run test:py
# or
cd python_tests && python -m pytest -v
```
18 parametrized pytest cases validating the same rules against `study_planner_logic.py`, a Python port of the JS scheduler — useful for teams that want to validate the algorithm outside Node.

### Load/API testing (JMeter)

Point a JMeter Thread Group at `http://localhost:3000/api` and exercise:

1. `GET /health` — baseline connectivity check
2. `POST /auth/register` then `POST /auth/login` — capture the returned JWT with a Regular Expression Extractor / JSON Extractor and feed it into an `Authorization: Bearer ${token}` HTTP Header Manager for subsequent requests
3. `GET/POST /subjects`, `GET/POST /assignments`, `GET/POST /exams`
4. `POST /planner/generate`
5. `GET /reports/dashboard`

Suggested plan: run auth once per virtual user (or reuse a small pool of seeded users), then loop the CRUD + planner + reports requests to measure throughput and latency under load.

## Notes on the Scheduler

`src/services/plannerLogic.js` is pure and DB-free, so it's independently testable:

- **Priority score** = urgency (based on days until deadline, or a fixed high score if overdue) + priority weight (task priority × subject priority) + an exam bonus.
- **Allocation** is a greedy day-by-day pass that respects per-day and per-week hour caps and a max session length, never double-books a day beyond its cap, and always schedules exam-prep sessions before the exam date.
- **Rescheduling** preserves completed sessions, marks past uncompleted sessions as `Missed`, and re-runs allocation for remaining hours from "today" forward.

## License

For educational/demo use.
