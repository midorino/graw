#!/usr/bin/python
# -*- coding: utf-8 -*-

# this avoids different pylint behaviour for python 2 and 3
from __future__ import print_function

from datetime import datetime, timedelta, tzinfo
from getpass import getpass
from math import floor
from platform import python_version
from subprocess import call
from timeit import default_timer as timer

import argparse
import csv
import io
import json
import logging
import os
import os.path
import re
import string
import sys
import unicodedata
import zipfile

python3 = sys.version_info.major == 3
if python3:
    import http.cookiejar
    import urllib.error
    import urllib.parse
    import urllib.request
    import urllib
    from urllib.parse import urlencode
    from urllib.request import Request, HTTPError, URLError
    COOKIE_JAR = http.cookiejar.CookieJar()
    OPENER = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(COOKIE_JAR), urllib.request.HTTPSHandler(debuglevel=0))
else:
    import cookielib
    import urllib2
    from urllib import urlencode
    from urllib2 import Request, HTTPError, URLError
    COOKIE_JAR = cookielib.CookieJar()
    OPENER = urllib2.build_opener(urllib2.HTTPCookieProcessor(COOKIE_JAR), urllib2.HTTPSHandler(debuglevel=0))

SCRIPT_VERSION = '0.0.1'

# this is almost the datetime format Garmin used in the activity-search-service
# JSON 'display' fields (Garmin didn't zero-pad the date and the hour, but %d and %H do)
ALMOST_RFC_1123 = "%a, %d %b %Y %H:%M"

# used by sanitize_filename()
VALID_FILENAME_CHARS = "-_.() %s%s" % (string.ascii_letters, string.digits)

# map the numeric parentTypeId to its name for the CSV output
PARENT_TYPE_ID = {
    1: 'running',
    2: 'cycling',
    3: 'hiking',
    4: 'other',
    9: 'walking',
    17: 'any',
    26: 'swimming',
    29: 'fitness_equipment',
    71: 'motorcycling',
    83: 'transition',
    144: 'diving',
    149: 'yoga',
    165: 'winter_sports'
}

# typeId values using pace instead of speed
USES_PACE = {1, 3, 9}  # running, hiking, walking

# Maximum number of activities you can request at once.
# Used to be 100 and enforced by Garmin for older endpoints; for the current endpoint 'URL_GC_LIST'
# the limit is not known (I have less than 1000 activities and could get them all in one go)
LIMIT_MAXIMUM = 1000

MAX_TRIES = 3

CSV_TEMPLATE = os.path.join(os.path.dirname(os.path.realpath(__file__)), "csv_header_default.properties")

WEBHOST = "https://connect.garmin.com"
REDIRECT = "https://connect.garmin.com/modern/"
BASE_URL = "https://connect.garmin.com/en-US/signin"
SSO = "https://sso.garmin.com/sso"
CSS = "https://static.garmincdn.com/com.garmin.connect/ui/css/gauth-custom-v1.2-min.css"

DATA = {
    'service': REDIRECT,
    'webhost': WEBHOST,
    'source': BASE_URL,
    'redirectAfterAccountLoginUrl': REDIRECT,
    'redirectAfterAccountCreationUrl': REDIRECT,
    'gauthHost': SSO,
    'locale': 'en_US',
    'id': 'gauth-widget',
    'cssUrl': CSS,
    'clientId': 'GarminConnect',
    'rememberMeShown': 'true',
    'rememberMeChecked': 'false',
    'createAccountShown': 'true',
    'openCreateAccount': 'false',
    'displayNameShown': 'false',
    'consumeServiceTicket': 'false',
    'initialFocus': 'true',
    'embedWidget': 'false',
    'generateExtraServiceTicket': 'true',
    'generateTwoExtraServiceTickets': 'false',
    'generateNoServiceTicket': 'false',
    'globalOptInShown': 'true',
    'globalOptInChecked': 'false',
    'mobile': 'false',
    'connectLegalTerms': 'true',
    'locationPromptShown': 'true',
    'showPassword': 'true'
}

# URLs for various services.

URL_GC_LOGIN = 'https://sso.garmin.com/sso/signin?' + urlencode(DATA)
URL_GC_POST_AUTH = 'https://connect.garmin.com/modern/activities?'
URL_GC_PROFILE = 'https://connect.garmin.com/modern/profile'
URL_GC_USERSTATS = 'https://connect.garmin.com/modern/proxy/userstats-service/statistics/'
URL_GC_LIST = 'https://connect.garmin.com/modern/proxy/activitylist-service/activities/search/activities?'
URL_GC_ACTIVITY = 'https://connect.garmin.com/modern/proxy/activity-service/activity/'
URL_GC_DEVICE = 'https://connect.garmin.com/modern/proxy/device-service/deviceservice/app-info/'
URL_GC_GEAR = 'https://connect.garmin.com/modern/proxy/gear-service/gear/filterGear?activityId='
URL_GC_ACT_PROPS = 'https://connect.garmin.com/modern/main/js/properties/activity_types/activity_types.properties'
URL_GC_EVT_PROPS = 'https://connect.garmin.com/modern/main/js/properties/event_types/event_types.properties'
URL_GC_GPX_ACTIVITY = 'https://connect.garmin.com/modern/proxy/download-service/export/gpx/activity/'
URL_GC_TCX_ACTIVITY = 'https://connect.garmin.com/modern/proxy/download-service/export/tcx/activity/'
URL_GC_ORIGINAL_ACTIVITY = 'http://connect.garmin.com/proxy/download-service/files/activity/'

def http_req(url, post=None, headers=None):
    """
    Helper function that makes the HTTP requests.
    :param url:          URL for the request
    :param post:         dictionary of POST parameters
    :param headers:      dictionary of headers
    :return: response body (type 'str' with Python 2, type 'bytes' with Python 3
    """
    request = Request(url)
    # Tell Garmin we're some supported browser.
    request.add_header('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, \
        like Gecko) Chrome/54.0.2816.0 Safari/537.36')
    if headers:
        if python3:
            for header_key, header_value in headers.items():
                request.add_header(header_key, header_value)
        else:
            for header_key, header_value in headers.iteritems():
                request.add_header(header_key, header_value)
    if post:
        post = urlencode(post)  # Convert dictionary to POST parameter string.
        if python3:
            post = post.encode("utf-8")
    start_time = timer()
    try:
        response = OPENER.open(request, data=post)
    except URLError as ex:
        if hasattr(ex, 'reason'):
            logging.error('Failed to reach url %s, error: %s', url, ex)
            raise
        else:
            raise
    logging.debug('Got %s in %s s from %s', response.getcode(), timer() - start_time, url)

    # N.B. urllib2 will follow any 302 redirects.
    # print(response.getcode())
    if response.getcode() == 204:
        # 204 = no content, e.g. for activities without GPS coordinates there is no GPX download.
        # Write an empty file to prevent redownloading it.
        logging.info('Got 204 for %s, returning empty response', url)
        return b''
    elif response.getcode() != 200:
        raise Exception('Bad return code (' + str(response.getcode()) + ') for: ' + url)

    return response.read()

def http_req_as_string(url, post=None, headers=None):
    """Helper function that makes the HTTP requests, returning a string instead of bytes."""
    if python3:
        return http_req(url, post, headers).decode()
    else:
        return http_req(url, post, headers)

def parse_arguments(argv):
    """
    Setup the argument parser and parse the command line arguments.
    """
    current_date = datetime.now().strftime('%Y-%m-%d')
    activities_directory = './' + current_date + '_garmin_connect_export'

    parser = argparse.ArgumentParser(description='Garmin Connect Exporter')

    parser.add_argument('--version', action='version', version='%(prog)s ' + SCRIPT_VERSION,
        help='print version and exit')
    parser.add_argument('-v', '--verbosity', action='count', default=0,
        help='increase output verbosity')
    parser.add_argument('--username',
        help='your Garmin Connect username or email address (otherwise, you will be prompted)')
    parser.add_argument('--password',
        help='your Garmin Connect password (otherwise, you will be prompted)')
    parser.add_argument('-c', '--count', default='1',
        help='number of recent activities to download, or \'all\' (default: 1)')
    parser.add_argument('-e', '--external',
        help='path to external program to pass CSV file too')
    parser.add_argument('-a', '--args',
        help='additional arguments to pass to external program')
    parser.add_argument('-f', '--format', choices=['gpx', 'tcx', 'original', 'json'], default='gpx',
        help="export format; can be 'gpx', 'tcx', 'original' or 'json' (default: 'gpx')")
    parser.add_argument('-d', '--directory', default=activities_directory,
        help='the directory to export to (default: \'./YYYY-MM-DD_garmin_connect_export\')')
    parser.add_argument('-s', "--subdir",
        help="the subdirectory for activity files (tcx, gpx etc.), supported placeholders are {YYYY} and {MM}"
                        " (default: export directory)" )
    parser.add_argument('-u', '--unzip', action='store_true',
        help='if downloading ZIP files (format: \'original\'), unzip the file and remove the ZIP file')
    parser.add_argument('-ot', '--originaltime', action='store_true',
        help='will set downloaded (and possibly unzipped) file time to the activity start time')
    parser.add_argument('--desc', type=int, nargs='?', const=0, default=None,
        help='append the activity\'s description to the file name of the download; limit size if number is given')
    parser.add_argument('-t', '--template', default=CSV_TEMPLATE,
        help='template file with desired columns for CSV output')
    parser.add_argument('-fp', '--fileprefix', action='count', default=0,
        help="set the local time as activity file name prefix")
    parser.add_argument('-sa', '--start_activity_no', type=int, default=1,
        help="give index for first activity to import, i.e. skipping the newest activites")

    return parser.parse_args(argv[1:])

def login_to_garmin_connect(args):
    """
    Perform all HTTP requests to login to Garmin Connect.
    """
    if python3:
        username = args.username if args.username else input('Username: ')
    else:
        username = args.username if args.username else raw_input('Username: ')
    password = args.password if args.password else getpass()

    logging.debug("Login params: %s", urlencode(DATA))

    # Initially, we need to get a valid session cookie, so we pull the login page.
    print('Connecting to Garmin Connect...', end='')
    logging.info('Connecting to %s', URL_GC_LOGIN)
    connect_response = http_req_as_string(URL_GC_LOGIN)
    # write_to_file('connect_response.html', connect_response, 'w')
    for cookie in COOKIE_JAR:
        logging.debug("Cookie %s : %s", cookie.name, cookie.value)
    print(' Done.')

    # Now we'll actually login.
    # Fields that are passed in a typical Garmin login.
    post_data = {
        'username': username,
        'password': password,
        'embed': 'false',
        'rememberme': 'on'
    }

    headers = {
        'referer': URL_GC_LOGIN
    }

    print('Requesting Login ticket...', end='')
    login_response = http_req_as_string(URL_GC_LOGIN + '#', post_data, headers)

    for cookie in COOKIE_JAR:
        logging.debug("Cookie %s : %s", cookie.name, cookie.value)
    # write_to_file('login-response.html', login_response, 'w')

    # extract the ticket from the login response
    pattern = re.compile(r".*\?ticket=([-\w]+)\";.*", re.MULTILINE | re.DOTALL)
    match = pattern.match(login_response)
    if not match:
        raise Exception('Couldn\'t find ticket in the login response. Cannot log in. '
                        'Did you enter the correct username and password?')
    login_ticket = match.group(1)
    print(' Done. Ticket=', login_ticket, sep='')

    print("Authenticating...", end='')
    logging.info('Authentication URL %s', URL_GC_POST_AUTH + 'ticket=' + login_ticket)
    http_req(URL_GC_POST_AUTH + 'ticket=' + login_ticket)
    print(' Done.')

def setup_logging():
    """Setup logging"""
    logging.basicConfig(
        filename='gcexport.log',
        level=logging.DEBUG,
        format='%(asctime)s [%(levelname)-7.7s] %(message)s'
    )

    # set up logging to console
    console = logging.StreamHandler()
    console.setLevel(logging.WARN)
    formatter = logging.Formatter('[%(levelname)s] %(message)s')
    console.setFormatter(formatter)
    logging.getLogger('').addHandler(console)


def logging_verbosity(verbosity):
    """Adapt logging verbosity, separately for logfile and console output"""
    logger = logging.getLogger()
    for handler in logger.handlers:
        if isinstance(handler, logging.FileHandler):
            # this is the logfile handler
            level = logging.DEBUG if verbosity > 0 else logging.INFO
            handler.setLevel(level)
            logging.info('New logfile level: %s', logging.getLevelName(level))
        elif isinstance(handler, logging.StreamHandler):
            # this is the console handler
            level = logging.DEBUG if verbosity > 1 else (logging.INFO if verbosity > 0 else logging.WARN)
            handler.setLevel(level)
            logging.debug('New console log level: %s', logging.getLevelName(level))

def main(argv):
    """
    Main entry point for gcexport.py
    """
    setup_logging()
    logging.info("Starting %s version %s, using Python version %s", argv[0], SCRIPT_VERSION, python_version())
    args = parse_arguments(argv)
    logging_verbosity(args.verbosity)

    print('Welcome to Garmin Connect Exporter!')

    login_to_garmin_connect(args)

if __name__ == "__main__":
    try:
        main(sys.argv)
    except KeyboardInterrupt:
        print('Interrupted')
        sys.exit(0)