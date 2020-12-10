#!/usr/bin/env python3

from garminconnect import (
    Garmin,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
    GarminConnectAuthenticationError,
)

from datetime import date
import getpass

"""
Enable debug logging
"""
import logging
logging.basicConfig(level=logging.DEBUG)

today = date.today()

username = input("Username: ")
password = getpass.getpass("Password: ")


"""
Initialize Garmin client with credentials
Only needed when your program is initialized
"""
print("Garmin(email, password)")
print("----------------------------------------------------------------------------------------")
try:    
    client = Garmin(username, password)
except (
    GarminConnectConnectionError,
    GarminConnectAuthenticationError,
    GarminConnectTooManyRequestsError,
) as err:
    print("Error occurred during Garmin Connect Client init: %s" % err)
    quit()
except Exception:  # pylint: disable=broad-except
    print("Unknown error occurred during Garmin Connect Client init")
    quit()


"""
Login to Garmin Connect portal
Only needed at start of your program
The library will try to relogin when session expires
"""
print("client.login()")
print("----------------------------------------------------------------------------------------")
try:
    client.login()
except (
    GarminConnectConnectionError,
    GarminConnectAuthenticationError,
    GarminConnectTooManyRequestsError,
) as err:
    print("Error occurred during Garmin Connect Client login: %s" % err)
    quit()
except Exception:  # pylint: disable=broad-except
    print("Unknown error occurred during Garmin Connect Client login")
    quit()


"""
Get full name from profile
"""
print("client.get_full_name()")
print("----------------------------------------------------------------------------------------")
try:
    print(client.get_full_name())
except (
    GarminConnectConnectionError,
    GarminConnectAuthenticationError,
    GarminConnectTooManyRequestsError,
) as err:
    print("Error occurred during Garmin Connect Client get full name: %s" % err)
    quit()
except Exception:  # pylint: disable=broad-except
    print("Unknown error occurred during Garmin Connect Client get full name")
    quit()


"""
Get steps data
"""
print("client.get_steps_data\(%s\)", today.isoformat())
print("----------------------------------------------------------------------------------------")
try:
    print(client.get_steps_data(today.isoformat()))
except (
    GarminConnectConnectionError,
    GarminConnectAuthenticationError,
    GarminConnectTooManyRequestsError,
) as err:
    print("Error occurred during Garmin Connect Client get steps data: %s" % err)
    quit()
except Exception:  # pylint: disable=broad-except
    print("Unknown error occurred during Garmin Connect Client get steps data")
    quit()
    
    
"""
Test 
"""

url = "https://connect.garmin.com/modern/adhoc-challenge/35BB6263757143F9A2C3273619882C56"

print("client.fetch_data\(%s\)", url)
print("----------------------------------------------------------------------------------------")
try:
    r = client.req.get(url, headers=client.headers)
    page_source = r.text
    page_source = page_source.split('\n')
    print("\nURL:", url) 
    print("--------------------------------------")
    # print the first five lines of the page source
    for row in page_source[:100]:
        print(row)
    print("--------------------------------------")
    #print(response)
    #print(client.fetch_data(url))
except (
    GarminConnectConnectionError,
    GarminConnectAuthenticationError,
    GarminConnectTooManyRequestsError,
) as err:
    print("Error occurred during Garmin Connect Client fetch data: %s" % err)
    quit()
except Exception:  # pylint: disable=broad-except
    print("Unknown error occurred during Garmin Connect Client fetch data")
    quit()
    
