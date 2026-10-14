import subprocess
import sys
from pathlib import Path

TESTS = [
    "test_register.py",
    "test_login.py",
    "test_subject.py",
    "test_assignment.py",
    "test_exam.py",
    "test_edit_assignment.py",
    "test_delete_assignment.py",
    "test_generate_plan.py",
    "test_reschedule_plan.py",
    "test_progress.py",
    "test_logout.py",
]


def run_selenium_test(test_file):
    test_path = Path(__file__).parent / "selenium_tests" / test_file

    result = subprocess.run(
        [sys.executable, str(test_path)],
        input="\n",
        text=True,
        capture_output=True,
        timeout=120
    )

    output = result.stdout + result.stderr

    assert "TEST PASSED" in output, (
        f"{test_file} failed.\n\nOutput:\n{output}"
    )


def test_01_register():
    run_selenium_test("test_register.py")


def test_02_login():
    run_selenium_test("test_login.py")


def test_03_subject():
    run_selenium_test("test_subject.py")


def test_04_assignment():
    run_selenium_test("test_assignment.py")


def test_05_exam():
    run_selenium_test("test_exam.py")


def test_06_edit_assignment():
    run_selenium_test("test_edit_assignment.py")


def test_07_delete_assignment():
    run_selenium_test("test_delete_assignment.py")


def test_08_generate_plan():
    run_selenium_test("test_generate_plan.py")


def test_09_reschedule_plan():
    run_selenium_test("test_reschedule_plan.py")


def test_10_progress():
    run_selenium_test("test_progress.py")


def test_11_logout():
    run_selenium_test("test_logout.py")