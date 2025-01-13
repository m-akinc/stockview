from wetrade.api import APIClient
from wetrade.quote import MultiQuote
from wetrade.market_hours import MarketHours
import json
import datetime
import math
import itertools

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

  try:
    with open('data.json', 'r', encoding='utf-8') as f:
      loaded = json.load(f)
      history = loaded['history'] or []
      totalShares = loaded['totalShares'] or 1
      accounts = loaded['accounts'] or []
      alt = loaded['alt'] or {}
  except:
    history = []
    totalShares = 1
    accounts = []
    alt = {}

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
    for alt in alt.items():
      altQuote = next(x for x in quotes if x['Product']['symbol'] == alt[0])
      altValue += alt[1] * altQuote['All']['lastTrade']

    if history[-1][1] != total or history[-1][2] != vtiValue:
      history.append([nowMs, total, vtiValue, altValue])

    updated = {
      'version': '1',
      'date': nowMs,
      'cap': total,
      'totalShares': totalShares,
      'accounts': accounts,
      'alt': alt,
      'historySymbols': ['MERT', 'VTI', 'Alt'],
      'history': history,
      'indices': indices,
      'positions': positions
    }
    json.dump(updated, f, ensure_ascii=False)


def decimateHistory(history):
  today, older = priorNDays(list(reversed(history)), 1.0)
  decimated = today
  daysAgo = 1.0
  while True:
    dayBefore, older = priorNDays(older, daysAgo)
    if len(dayBefore) == 1:
      decimated.append(dayBefore[0])
      decimated.extend(older)
      break
    if len(dayBefore) > 0:
      decimated.append(dayBefore[0])
    daysAgo += 1
  
  return list(reversed(decimated))
  

def priorNDays(descendingHistory, numDays):
  nowMs = datetime.datetime.now().timestamp() * 1000
  latest = list(itertools.takewhile(
    lambda x: datetime.timedelta(milliseconds = nowMs - x[0]).days <= numDays,
    descendingHistory
  ))
  remainder = list(descendingHistory)[len(latest):]
  return (latest, remainder)


def toDatetime(ms):
  return datetime.datetime.fromtimestamp(ms / 1000)


if __name__ == '__main__':
  main()