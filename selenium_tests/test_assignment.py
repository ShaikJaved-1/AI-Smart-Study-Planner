from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
import time

options = Options()
driver = webdriver.Chrome(options=options)

try:
    driver.get("http://localhost:3000/login.html")
    driver.maximize_window()

    # Login
    driver.find_element(By.NAME, "email").send_keys("javed@test.com")
    driver.find_element(By.NAME, "password").send_keys("Test12345")
    driver.find_element(
        By.CSS_SELECTOR,
        "#auth-form button[type='submit']"
    ).click()

    time.sleep(2)

    # Open Assignments page
    driver.get("http://localhost:3000/assignments.html")
    time.sleep(2)

    # Click Add assignment
    driver.find_element(By.ID, "add").click()

    time.sleep(1)

    # Fill assignment form
    driver.find_element(By.NAME, "title").send_keys("Network Assignment")

    driver.find_element(
        By.NAME, "description"
    ).send_keys("Complete Computer Networks assignment")

    deadline = driver.find_element(By.NAME, "deadline")

    driver.execute_script(
        """
        arguments[0].value = '2026-10-15';
        arguments[0].dispatchEvent(new Event('input', {bubbles: true}));
        arguments[0].dispatchEvent(new Event('change', {bubbles: true}));
        """,
        deadline
    )

    driver.find_element(
        By.NAME, "estimated_hours"
    ).send_keys("2")

    # Click Add assignment
    driver.find_element(
        By.CSS_SELECTOR,
        ".modal button[type='submit']"
    ).click()

    time.sleep(2)

    print("Current URL:", driver.current_url)
    print("ASSIGNMENT TEST PASSED")

    input("Press Enter to close Chrome...")

except Exception as e:
    print("ASSIGNMENT TEST FAILED")
    print(e)

finally:
    driver.quit()