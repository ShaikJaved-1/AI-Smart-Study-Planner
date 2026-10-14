from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
import time

options = Options()
driver = webdriver.Chrome(options=options)

try:
    driver.get("http://localhost:3000/login.html")
    driver.maximize_window()

    email = driver.find_element(By.NAME, "email")
    password = driver.find_element(By.NAME, "password")
    login_button = driver.find_element(By.CSS_SELECTOR, "#auth-form button[type='submit']")

    email.send_keys("javed@test.com")
    password.send_keys("Test12345")

    login_button.click()

    time.sleep(2)

    print("Current URL:", driver.current_url)
    print("Page title:", driver.title)

    print("LOGIN TEST PASSED")

    input("Press Enter to close Chrome...")

except Exception as e:
    print("LOGIN TEST FAILED")
    print(e)

finally:
    driver.quit()