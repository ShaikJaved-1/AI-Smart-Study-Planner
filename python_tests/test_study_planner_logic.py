import pytest

from study_planner_logic import (
    calculate_progress_percentage, calculate_study_hours, calculate_task_priority,
    generate_study_schedule, reschedule_incomplete_tasks, validate_deadline,
)


def make_task(**over):
    task = {"key": "a-1", "type": "assignment", "title": "Task", "deadline": "2030-01-10",
            "priority": "Medium", "subject_priority": "Medium", "hours_remaining": 4}
    task.update(over)
    return task


def minutes(t):
    h, m = t.split(":")
    return int(h) * 60 + int(m)


# ---- calculate study hours ----
def test_study_hours_basic():
    assert calculate_study_hours("17:00", "18:30") == 1.5


def test_study_hours_end_before_start_is_zero():
    assert calculate_study_hours("18:00", "17:00") == 0


# ---- validate deadline ----
@pytest.mark.parametrize("value,allow_past,expected", [
    ("2030-01-05", False, True),
    ("2029-12-31", False, False),
    ("2029-12-31", True, True),
    ("2030-02-30", False, False),
    ("05/01/2030", False, False),
])
def test_validate_deadline(value, allow_past, expected):
    valid, _ = validate_deadline(value, today="2030-01-01", allow_past=allow_past)
    assert valid is expected


# ---- calculate task priority ----
def test_closer_deadline_scores_higher():
    near = calculate_task_priority(make_task(deadline="2030-01-02"), "2030-01-01")
    far = calculate_task_priority(make_task(deadline="2030-01-20"), "2030-01-01")
    assert near > far


def test_high_priority_scores_higher_and_overdue_is_most_urgent():
    high = calculate_task_priority(make_task(priority="High"), "2030-01-01")
    low = calculate_task_priority(make_task(priority="Low"), "2030-01-01")
    overdue = calculate_task_priority(make_task(deadline="2029-12-25"), "2030-01-01")
    soon = calculate_task_priority(make_task(deadline="2030-01-02"), "2030-01-01")
    assert high > low
    assert overdue > soon


# ---- generate study schedule ----
def test_schedule_respects_daily_limit_deadlines_and_never_overlaps():
    tasks = [
        make_task(key="a-1", deadline="2030-01-03", hours_remaining=4, priority="High"),
        make_task(key="e-1", type="exam", deadline="2030-01-06", hours_remaining=6),
    ]
    sessions, unscheduled = generate_study_schedule(tasks, "2030-01-01", daily_hours=3)
    assert unscheduled == []
    assert sum(s["duration_hours"] for s in sessions) == 10
    per_day = {}
    for s in sessions:
        per_day[s["date"]] = per_day.get(s["date"], 0) + s["duration_hours"]
    assert all(h <= 3 for h in per_day.values())
    assert all(s["date"] <= "2030-01-03" for s in sessions if s["key"] == "a-1")
    assert all(s["date"] < "2030-01-06" for s in sessions if s["key"] == "e-1")  # before exam day
    ordered = sorted(sessions, key=lambda s: (s["date"], s["start_time"]))
    for prev, cur in zip(ordered, ordered[1:]):
        if prev["date"] == cur["date"]:
            assert minutes(cur["start_time"]) >= minutes(prev["end_time"])


def test_schedule_reports_work_that_does_not_fit():
    _, unscheduled = generate_study_schedule([make_task(deadline="2030-01-01", hours_remaining=10)], "2030-01-01", daily_hours=2)
    assert len(unscheduled) == 1
    assert unscheduled[0]["hours"] == 8


def test_weekly_limit_is_respected():
    sessions, _ = generate_study_schedule([make_task(deadline="2030-02-28", hours_remaining=30)], "2030-01-07",
                                          daily_hours=4, weekly_hours=6)
    assert sum(s["duration_hours"] for s in sessions if s["date"] <= "2030-01-13") <= 6


# ---- reschedule incomplete tasks ----
def test_reschedule_keeps_completed_and_replans_missed():
    tasks = [make_task(key="a-1", total_hours=4, deadline="2030-01-10")]
    existing = [
        {"key": "a-1", "date": "2030-01-01", "start_time": "17:00", "end_time": "19:00", "duration_hours": 2, "status": "Completed"},
        {"key": "a-1", "date": "2030-01-02", "start_time": "17:00", "end_time": "19:00", "duration_hours": 2, "status": "Planned"},
    ]
    sessions, unscheduled, missed = reschedule_incomplete_tasks(tasks, existing, "2030-01-03", daily_hours=2)
    assert len(missed) == 1
    assert sum(s["duration_hours"] for s in sessions) == 2  # 4 total - 2 completed
    assert all(s["date"] >= "2030-01-03" for s in sessions)
    assert unscheduled == []


# ---- calculate progress percentage ----
@pytest.mark.parametrize("completed,total,expected", [(1, 4, 25), (0, 0, 0), (0, 5, 0), (9, 3, 100), (1, 3, 33.3)])
def test_progress_percentage(completed, total, expected):
    assert calculate_progress_percentage(completed, total) == expected
