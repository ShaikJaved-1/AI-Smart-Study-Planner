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

    driver.get("http://localhost:3000/planner.html")
    time.sleep(3)

    buttons = driver.find_elements(By.CSS_SELECTOR, "[data-session='Completed']")

    if buttons:
        buttons[0].click()
        time.sleep(3)

        print("Study session marked as completed")
        print("PROGRESS TEST PASSED")
    else:
        print("No planned study session found")
        print("PROGRESS TEST FAILED")

    input("Press Enter to close Chrome...")

except Exception as e:
    print("PROGRESS TEST FAILED")
    print(e)

finally:
    driver.quit()