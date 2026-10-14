from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
import time

options = Options()
driver = webdriver.Chrome(options=options)

try:
    driver.get("http://localhost:3000/register.html")
    driver.maximize_window()

    name = driver.find_element(By.NAME, "name")
    email = driver.find_element(By.NAME, "email")
    password = driver.find_element(By.NAME, "password")
    register_button = driver.find_element(
        By.CSS_SELECTOR, "#auth-form button[type='submit']"
    )

    name.send_keys("Selenium Test User")
    email.send_keys("seleniumtest123@test.com")
    password.send_keys("Test12345")

    register_button.click()

    time.sleep(2)

    print("Current URL:", driver.current_url)
    print("Page title:", driver.title)

    print("REGISTRATION TEST PASSED")

    input("Press Enter to close Chrome...")

except Exception as e:
    print("REGISTRATION TEST FAILED")
    print(e)

finally:
    driver.quit()