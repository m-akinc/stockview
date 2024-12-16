import os

try:
    USERNAME = os.environ["USERNAME"]
    PASSWORD = os.environ["PASSWORD"]
    CLIENT_SECRET = os.environ["CLIENT_SECRET"]
    TOTP_SECRET = os.environ["TOTP_SECRET"]
except KeyError:
    raise "USERNAME, PASSWORD, CLIENT_SECRET, and TOTP_SECRET env vars not available!"

# E-Trade settings
login_method = 'auto' # 'auto', 'manual'
#headless_login = False
use_2fa = True # needed to disable SMS auth - requires totp_secret
config_id = 'prod'
config_options = {
  'sandbox':{
    'base_url': 'https://apisb.etrade.com/',
    'client_key': 'dc6a0f6dd9028cd217d25221ac985bb1',
    'client_secret': '0011ad65bab26f550be794452c09ba663f138d9aadc4af23e9b9bfb914bacead',
    'username': USERNAME,
    'password': PASSWORD,
    'totp_secret': TOTP_SECRET
  },
  'prod':{
    'base_url': 'https://api.etrade.com/',
    'client_key': '0f89d11cfdad43e1b2ad5a5078de1405',
    'client_secret': CLIENT_SECRET,
    'username': USERNAME,
    'password': PASSWORD,
    'totp_secret': TOTP_SECRET
  }
}
enable_logging = False
quote_bucket = 'your-quote-bucket'

config = config_options[config_id]