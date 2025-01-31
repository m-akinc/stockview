from wetrade.api import APIClient
from wetrade.quote import MultiQuote
from wetrade.market_hours import MarketHours
import json
import datetime
import math
import itertools
import more_itertools

account_key = "EuXJsu-w_D6dnA_JY-TueA"
comps = [
  ('VTI', 'Total Market'),
  ('DJIND', 'Dow'),
  ('COMP.IDX', 'Nasdaq'),
  ('SPX', 'S&P 500')
]

def main():
  marketHours = MarketHours()
  if not marketHours.market_has_opened():
    return

  with open('data.json', 'r', encoding='utf-8') as f:
    loaded = json.load(f)
    history = loaded['history']
    totalShares = loaded['totalShares']
    accounts = loaded['accounts']
    alt = loaded['alt']

  lookups = [x[0] for x in comps]
  lookups.extend(alt.keys())

  client = APIClient()

  quotes = MultiQuote(client, tuple(lookups)).get_quote()
  compsSymbols = [x[0] for x in comps]
  indices = [(
    x['Product']['symbol'],
    x['All']['lastTrade'],
    x['All']['changeClose'],
    x['All']['changeClosePercentage']
  ) for x in quotes if x['Product']['symbol'] in compsSymbols]

  response = client.request_account_portfolio(account_key)[0]['PortfolioResponse']
  portfolio = response['AccountPortfolio'][0]
  totals = response['Totals']

  positions = [{
    "symbol": "(CASH)",
    "value": totals['cashBalance'],
    "daysChangePercent": 0,
    "totalGain": 0,
    "percentOfPortfolio": totals['cashBalance'] / totals['totalMarketValue'] 
  }]
  for position in portfolio["Position"]:
    positions.append({
      "symbol": position["symbolDescription"],
      "value": position["marketValue"],
      "daysChangePercent": position["daysGainPct"],
      "totalGain": position["totalGain"],
      "percentOfPortfolio": position["pctOfPortfolio"]
    })

  
  history = decimateHistory(history)

  with open('data.json', 'w', encoding='utf-8') as f:
    nowMs = math.floor(datetime.datetime.now().timestamp() * 1000)
    total = round(totals['totalMarketValue'] + totals['cashBalance'], 4)
    vtiValue = next(x[1] for x in indices if x[0] == 'VTI')
    altValue = 0
    for item in alt.items():
      altQuote = next(x for x in quotes if x['Product']['symbol'] == item[0])
      altValue += item[1] * altQuote['All']['lastTrade']

    if history[-1][1] != total or history[-1][2] != vtiValue:
      history.append([nowMs, total, vtiValue, altValue])

    updated = loaded
    updated['date'] = nowMs
    updated['cap'] = total
    updated['history'] = history
    updated['indices'] = indices
    updated['positions'] = positions

    json.dump(updated, f, ensure_ascii=False)


def decimateHistory(history):
  today, older = priorDay(list(reversed(history)))
  decimated = today
  while True:
    dayBefore, older = priorDay(older)
    if len(dayBefore) > 0:
      decimated.append(dayBefore[0])
      if len(dayBefore) == 1:
        decimated.extend(older)
        break
  
  return list(reversed(decimated))

def priorDay(descendingHistory):
  prior = descendingHistory[0][0]
  def sameTradingDay(x):
      nonlocal prior
      hoursEarlier = datetime.timedelta(milliseconds = prior - x[0]).total_seconds() / 60 / 60
      prior = x[0]
      return hoursEarlier < 8
  day, older = more_itertools.before_and_after(sameTradingDay, descendingHistory)
  return (list(day), list(older))

def toDatetime(ms):
  return datetime.datetime.fromtimestamp(ms / 1000)


if __name__ == '__main__':
  main()