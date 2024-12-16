# pip install virtualenv
# python -m virtualenv venv --python=python3.12
# .\venv\Scripts\activate
# pip install "playwright==1.40"
# playwright install firefox
# pip install wetrade
# pip install python-vipaccess

$path = './venv/Lib/site-packages/wetrade/api.py';
(Get-Content $path) -replace 'v1/accounts/{}/portfolio.json', 'v1/accounts/{}/portfolio.json?count=1000&totalsRequired=true' | Set-Content $path