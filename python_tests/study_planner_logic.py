"""Python version of the planner's business rules (mirrors src/services/plannerLogic.js).

Kept small and dependency-free so it can be unit tested with pytest.
Dates are 'YYYY-MM-DD' strings and times are 'HH:MM' strings.
"""
import math
from datetime import date, datetime, timedelta

PRIORITY_WEIGHT = {"High": 30, "Medium": 20, "Low": 10}
MIN_BLOCK = 0.5  # smallest study session in hours


def _parse(d):
    return datetime.strptime(d, "%Y-%m-%d").date()


def _add_days(d, n):
    return (_parse(d) + timedelta(days=n)).isoformat()


def _days_between(a, b):
    return (_parse(b) - _parse(a)).days


def _week_start(d):
    return _add_days(d, -_parse(d).weekday())


def _to_minutes(t):
    h, m = t.split(":")[:2]
    return int(h) * 60 + int(m)


def _to_time(minutes):
    return "%02d:%02d" % (minutes // 60, minutes % 60)


def _round_up_half(n):
    return math.ceil(float(n) * 2) / 2


def calculate_study_hours(start_time, end_time):
    """Hours between two 'HH:MM' times. Returns 0 if the end is not after the start."""
    diff = _to_minutes(end_time) - _to_minutes(start_time)
    return round(diff / 60, 2) if diff > 0 else 0


def validate_deadline(deadline, today=None, allow_past=False):
    """Returns (is_valid, message)."""
    today = today or date.today().isoformat()
    try:
        if _parse(deadline).isoformat() != deadline:
            raise ValueError
    except (ValueError, TypeError):
        return False, "Date must be valid and in YYYY-MM-DD format"
    if not allow_past and deadline < today:
        return False, "Date cannot be in the past"
    return True, ""


def calculate_task_priority(task, today=None):
    """Higher score = more important (closer deadline, higher priority, overdue, exam)."""
    today = today or date.today().isoformat()
    days_left = _days_between(today, task["deadline"])
    urgency = 70 if days_left < 0 else 50 / (days_left + 1)
    base = PRIORITY_WEIGHT.get(task.get("priority"), 20) + 0.5 * PRIORITY_WEIGHT.get(task.get("subject_priority"), 20)
    exam_bonus = 5 if task.get("type") == "exam" else 0
    return round(base + urgency + exam_bonus, 2)


def generate_study_schedule(tasks, start_date, daily_hours=2, weekly_hours=None, day_start="17:00",
                            max_session_hours=2, max_days=90, existing_sessions=None):
    """Builds non-overlapping sessions day by day. Returns (sessions, unscheduled).

    tasks: dicts with key, type ('assignment'|'exam'), title, deadline, priority,
           subject_priority, hours_remaining
    """
    existing_sessions = existing_sessions or []
    used, next_free, week_used = {}, {}, {}
    for s in existing_sessions:
        used[s["date"]] = used.get(s["date"], 0) + s["duration_hours"]
        next_free[s["date"]] = max(next_free.get(s["date"], 0), _to_minutes(s["end_time"]))
        wk = _week_start(s["date"])
        week_used[wk] = week_used.get(wk, 0) + s["duration_hours"]

    sessions, unscheduled, active = [], [], []
    for t in tasks:
        remaining = _round_up_half(t["hours_remaining"])
        if remaining <= 0:
            continue
        last_day = _add_days(t["deadline"], -1) if t["type"] == "exam" else t["deadline"]
        item = dict(t, remaining=remaining, last_day=last_day)
        if t["type"] == "exam" and last_day < start_date:
            unscheduled.append({"key": t["key"], "hours": remaining, "reason": "Exam is too close or has already passed"})
        else:
            active.append(item)

    for i in range(max_days):
        if not any(t["remaining"] > 0 for t in active):
            break
        day = _add_days(start_date, i)
        wk = _week_start(day)
        capacity = daily_hours - used.get(day, 0)
        if weekly_hours:
            capacity = min(capacity, weekly_hours - week_used.get(wk, 0))
        capacity = math.floor(capacity * 2) / 2
        cursor = max(_to_minutes(day_start), next_free.get(day, 0))
        given_today = {}
        while capacity >= MIN_BLOCK:
            candidates = [t for t in active if t["remaining"] > 0 and (t["last_day"] >= day or t["last_day"] < start_date)]
            if not candidates:
                break
            task = max(candidates, key=lambda t: calculate_task_priority(t, day) / (1 + given_today.get(t["key"], 0)))
            block = min(capacity, task["remaining"], max_session_hours)
            if cursor + block * 60 > 24 * 60:
                break
            sessions.append({
                "date": day, "start_time": _to_time(int(cursor)), "end_time": _to_time(int(cursor + block * 60)),
                "duration_hours": block, "key": task["key"], "title": task.get("title", ""),
            })
            cursor += block * 60
            capacity -= block
            task["remaining"] -= block
            given_today[task["key"]] = given_today.get(task["key"], 0) + block
            used[day] = used.get(day, 0) + block
            week_used[wk] = week_used.get(wk, 0) + block

    for t in active:
        if t["remaining"] > 0:
            unscheduled.append({"key": t["key"], "hours": t["remaining"], "reason": "Not enough study time before the deadline"})
    return sessions, unscheduled


def reschedule_incomplete_tasks(tasks, existing_items, start_date, **options):
    """Marks old planned sessions as missed, subtracts completed hours and plans the rest again.

    tasks use total_hours; existing_items: dicts with key, date, start_time, end_time, duration_hours, status.
    Returns (sessions, unscheduled, missed_items).
    """
    items = [dict(i, status="Missed") if i["status"] == "Planned" and i["date"] < start_date else dict(i) for i in existing_items]
    completed = [i for i in items if i["status"] == "Completed"]
    done = {}
    for i in completed:
        done[i["key"]] = done.get(i["key"], 0) + i["duration_hours"]
    remaining = [dict(t, hours_remaining=max(0, t["total_hours"] - done.get(t["key"], 0))) for t in tasks]
    sessions, unscheduled = generate_study_schedule(remaining, start_date, existing_sessions=completed, **options)
    return sessions, unscheduled, [i for i in items if i["status"] == "Missed"]


def calculate_progress_percentage(completed, total):
    """Percentage (one decimal) between 0 and 100."""
    if not total or total <= 0 or not completed or completed <= 0:
        return 0
    return min(100, round(completed / total * 100, 1))
