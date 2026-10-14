from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
import time

options = Options()
driver = webdriver.Chrome(options=options)

try:
    driver.get("http://localhost:3000/login.html")
    driver.maximize_window()

    driver.find_element(By.NAME, "email").send_keys("javed@test.com")
    driver.find_element(By.NAME, "password").send_keys("Test12345")

    driver.find_element(
        By.CSS_SELECTOR, "#auth-form button[type='submit']"
    ).click()

    time.sleep(2)

    driver.get("http://localhost:3000/exams.html")
    time.sleep(2)

    driver.find_element(By.ID, "add").click()
    time.sleep(1)

    driver.find_element(
        By.NAME, "exam_name"
    ).send_keys("Computer Networks Exam")

    exam_date = driver.find_element(By.NAME, "exam_date")

    driver.execute_script(
        """
        arguments[0].value = '2026-10-20';
        arguments[0].dispatchEvent(
            new Event('input', {bubbles: true})
        );
        arguments[0].dispatchEvent(
            new Event('change', {bubbles: true})
        );
        """,
        exam_date
    )

    driver.find_element(
        By.NAME, "preparation_hours"
    ).send_keys("5")

    driver.find_element(
        By.CSS_SELECTOR, ".modal button[type='submit']"
    ).click()

    time.sleep(2)

    print("Current URL:", driver.current_url)
    print("EXAM TEST PASSED")

    input("Press Enter to close Chrome...")

except Exception as e:
    print("EXAM TEST FAILED")
    print(e)

finally:
    driver.quit()