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

    driver.find_element(By.ID, "logout-btn").click()

    time.sleep(2)

    print("Current URL:", driver.current_url)
    print("LOGOUT TEST PASSED")

    input("Press Enter to close Chrome...")

except Exception as e:
    print("LOGOUT TEST FAILED")
    print(e)

finally:
    driver.quit()