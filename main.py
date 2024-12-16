from wetrade.api import APIClient
import json
import datetime
import math

account_key = "EuXJsu-w_D6dnA_JY-TueA"

def main():
  client = APIClient()

  response = client.request_account_portfolio(account_key)[0]['PortfolioResponse']
  portfolio = response['AccountPortfolio'][0]
  totals = response['Totals']

  stocks = []
  for position in portfolio["Position"]:
    stocks.append({
      "symbol": position["symbolDescription"],
      "value": position["marketValue"],
      "daysChangePercent": position["daysGainPct"],
      "totalGain": position["totalGain"],
      "percentOfPortfolio": position["pctOfPortfolio"]
    })

  try:
    with open('data.json', 'r', encoding='utf-8') as f:
      history = json.load(f)['history'] or []
  except:
    history = []

  with open('data.json', 'w', encoding='utf-8') as f:
    now = math.floor(datetime.datetime.now().timestamp() * 1000)
    total = math.floor(totals['totalMarketValue'] + totals['cashBalance'])
    history.append({
      'date': now,
      'cap': total
    })
    updated = {
      'version': '1',
      'date': now,
      'cap': total,
      'totalShares': 250000,
      'history': history
    }
    json.dump(updated, f, ensure_ascii=False)


if __name__ == '__main__':
  main()