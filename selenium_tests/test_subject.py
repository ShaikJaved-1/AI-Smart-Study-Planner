from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
import time

options = Options()
driver = webdriver.Chrome(options=options)

try:
    # Open login page
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

    # Open Subjects page
    driver.get("http://localhost:3000/subjects.html")
    time.sleep(2)

    # Click Add Subject
    driver.find_element(By.ID, "add-subject").click()

    time.sleep(1)

    # Fill subject form
    driver.find_element(
        By.NAME, "subject_name"
    ).send_keys("Computer Networks")

    driver.find_element(
        By.NAME, "description"
    ).send_keys("Study of computer networks and protocols")

    # Priority is already Medium by default

    # Click Add subject
    driver.find_element(
        By.CSS_SELECTOR,
        ".modal button[type='submit']"
    ).click()

    time.sleep(2)

    print("Current URL:", driver.current_url)
    print("SUBJECT TEST PASSED")

    input("Press Enter to close Chrome...")

except Exception as e:
    print("SUBJECT TEST FAILED")
    print(e)

finally:
    driver.quit()
    