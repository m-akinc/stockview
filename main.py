from wetrade.api import APIClient
from wetrade.quote import MultiQuote
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
  client = APIClient()

  quote = MultiQuote(client, tuple([x[0] for x in comps]))
  indices = [(
    x['Product']['symbol'],
    x['All']['lastTrade'],
    x['All']['changeClose'],
    x['All']['changeClosePercentage']
  ) for x in quote.get_quote()]

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

  try:
    with open('data.json', 'r', encoding='utf-8') as f:
      loaded = json.load(f)
      history = loaded['history'] or []
      totalShares = loaded['totalShares'] or 1
      accounts = loaded['accounts'] or []
  except:
    history = []
    totalShares = 1
    accounts = []

  history = decimateHistory(history)

  with open('data.json', 'w', encoding='utf-8') as f:
    nowMs = math.floor(datetime.datetime.now().timestamp() * 1000)
    total = totals['totalMarketValue'] + totals['cashBalance']
    history.append([nowMs, total, 0, toDatetime(nowMs).date(), toDatetime(nowMs).strftime("%Y-%m-%d %H:%M:%S")])
    updated = {
      'version': '1',
      'date': nowMs,
      'cap': total,
      'totalShares': totalShares,
      'accounts': accounts,
      'history': history,
      'indices': indices,
      'positions': positions
    }
    json.dump(updated, f, ensure_ascii=False)


def decimateHistory(history):
  today, older = priorNDays(reversed(history), 1.0)
  week, older = priorNDays(older, 7.0)
  month, older = priorNDays(older, 30.0)
  year, older = priorNDays(older, 365.0)

  week = [next(group) for key, group in itertools.groupby(week, lambda y: toDatetime(y[0]).hour)] # if key % 2 == 0]
  month = [next(group) for key, group in itertools.groupby(month, lambda y: toDatetime(y[0]).date())]
  year = [next(group) for key, group in itertools.groupby(year, lambda y: (toDatetime(y[0]).day, toDatetime(y[0]).date())) if key[0] == 5]
  older = [next(group) for key, group in itertools.groupby(older, lambda y: (toDatetime(y[0]).month, toDatetime(y[0]).year))]

  return list(reversed(today + week + month + year + older))
  

def priorNDays(descendingHistory, numDays):
  nowMs = datetime.datetime.now().timestamp() * 1000
  latest = list(itertools.takewhile(
    lambda x: datetime.timedelta(milliseconds = nowMs - x[0]).days <= numDays,
    descendingHistory
  ))
  latest = [[x[0], x[1], datetime.timedelta(milliseconds = nowMs - x[0]).days, toDatetime(x[0]).date(), toDatetime(x[0]).strftime("%Y-%m-%d %H:%M:%S")] for x in latest]
  remainder = list(descendingHistory)[len(latest):]
  return (latest, remainder)


def toDatetime(ms):
  return datetime.datetime.fromtimestamp(ms / 1000)


if __name__ == '__main__':
  main()