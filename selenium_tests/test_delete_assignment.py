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

    delete_buttons = driver.find_elements(
        By.CSS_SELECTOR, "[data-act='del']"
    )

    if not delete_buttons:
        print("No assignment found")
        print("DELETE ASSIGNMENT TEST FAILED")
    else:
        delete_buttons[0].click()
        time.sleep(1)

        # Confirm browser popup
        driver.switch_to.alert.accept()

        time.sleep(3)

        print("Assignment deleted successfully")
        print("DELETE ASSIGNMENT TEST PASSED")

    input("Press Enter to close Chrome...")

except Exception as e:
    print("DELETE ASSIGNMENT TEST FAILED")
    print(e)

finally:
    driver.quit()