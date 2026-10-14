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

    driver.get("http://localhost:3000/assignments.html")
    time.sleep(3)

    edit_buttons = driver.find_elements(
        By.CSS_SELECTOR, "[data-act='edit']"
    )

    if not edit_buttons:
        print("No assignment found")
        print("EDIT ASSIGNMENT TEST FAILED")
    else:
        edit_buttons[0].click()
        time.sleep(1)

        title = driver.find_element(By.NAME, "title")
        title.clear()
        title.send_keys("Updated Network Assignment")

        driver.find_element(
            By.CSS_SELECTOR, ".modal button[type='submit']"
        ).click()

        time.sleep(3)

        print("Assignment edited successfully")
        print("EDIT ASSIGNMENT TEST PASSED")

    input("Press Enter to close Chrome...")

except Exception as e:
    print("EDIT ASSIGNMENT TEST FAILED")
    print(e)

finally:
    driver.quit()