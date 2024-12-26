const priceFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
});

(async () => {
    const devMode = getQueryParameter('dev') !== undefined;
    const longitude = getQueryParameter('longitude');
    let accountId = getQueryParameter('id');
    let accountValues;

    if (!accountId && !longitude) {
        accountId = localStorage.getItem('stockview-account-id');
        console.log('Got accountId from local storage:', accountId);
    }

    const response = await fetch('https://raw.githubusercontent.com/m-akinc/stockview/refs/heads/main/data.json');
    if (!response.ok) {
        document.body.innerText = `Failed to fetch data (${response.status}): ${response.statusText}`;
        return;
    }
    
    const data = await response.json();
    const lastUpdated = new Date(data.date);
    const latestSharePrice = data.cap / data.totalShares;
    document.querySelector('.date').innerText = lastUpdated.toLocaleString();
    const previousClose = data.history.reverse().find(x => new Date(x[0]).getDate() !== lastUpdated.getDate());
    const previousCloseSharePrice = previousClose[1] / data.totalShares;
    const daysChangeDollars = latestSharePrice - previousCloseSharePrice;
    const daysChangePercent = (100 * daysChangeDollars / previousCloseSharePrice).toFixed(2);

    // Populate table row (non-account values)
    const columns = document.querySelectorAll('#row td');
    // LAST
    columns[0].innerHTML = priceFormatter.format(latestSharePrice);
    // DAY'S CHANGE %
    let span = columns[4].querySelector('span');
    if (daysChangeDollars < 0) {
        span.classList.add('loss');
    }
    span.innerHTML = `${daysChangePercent}%`;

    new Chart(document.getElementById('graph'), {
        type: 'line',
        data: {
            datasets: [{
                data: data.history
                    .filter(x => new Date(x[0]).getDate() === lastUpdated.getDate())
                    .map(x => ({
                        x: x[0],
                        y: x[1] / data.totalShares
                    })),
                borderColor: '#a772e0'
            }]
        },
        options: {
            scales: {
                x: {
                    type: 'time',
                    min: new Date().setHours(8, 30, 0),
                    max: new Date().setHours(15, 0, 0)
                }
            },
            plugins: {
              legend: {
                display: false
              }
            }
        }
    });

    if (accountId) {
        accountValues = getAccountValues(data.accounts, accountId, latestSharePrice);
        populateAccountValues(accountValues, daysChangePercent);
    } else if (longitude) {
        accountId = getAccountIdFromLocation(longitude);
        accountValues = getAccountValues(data.accounts, accountId, latestSharePrice);
        populateAccountValues(accountValues, daysChangePercent);
    } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(x => {
            accountId = getAccountIdFromLocation(data.accounts, x.coords.longitude);
            if (!accountId) {
                console.log('Could not find account for longitude:', x.coords.longitude);
                const zip = prompt("Couldn't determine your accound from your location. Please enter your zip code so we can show your holdings.");
                accountId = getAccountIdFromZipCode(data.accounts, zip);
            }
            if (accountId) {
                localStorage.setItem('stockview-account-id', accountId);
            }
            accountValues = getAccountValues(data.accounts, accountId, latestSharePrice);
            populateAccountValues(accountValues, daysChangePercent);
        },x => {
            console.log('Geolocation failed:', x);
            const zip = prompt('Looks like the browser is not allowed to use your location. Please enter your zip code so we can show your holdings.');
            accountId = getAccountIdFromZipCode(data.accounts, zip);
            if (accountId) {
                localStorage.setItem('stockview-account-id', accountId);
            }
            accountValues = getAccountValues(data.accounts, accountId, latestSharePrice);
            populateAccountValues(accountValues, daysChangePercent);
        },{
            enableHighAccuracy: true,
            timeout: 2000
        });
    }
    
    const market = document.querySelector('.market');
    for (const index of data.indices) {
        market.appendChild(createCard(index[0], index[3], '%'));
    }
    const bigCard = createCard('MERT', daysChangePercent, '%');
    bigCard.classList.add('big-card');
    market.after(bigCard);

    if (devMode) {
        const updated = document.querySelector('.updated');
        const dims = document.createElement('div');
        dims.innerHTML = `Browser width: ${window.innerWidth}, height: ${window.innerHeight}`;

        const history = document.createElement('div');
        for (const x of data.history) {
            const d = document.createElement('div');
            d.innerHTML = new Date(x[0]).toLocaleString();
            history.appendChild(d);
        }

        updated.after(history);
        updated.after(dims);
    }
    
    populateMovers(positions, accountValues.value);

    requestAnimationFrame(() => document.querySelector('stockview-treemap').positions = data.positions);
})();

function populateAccountValues(accountValues, daysChangePercent) {
    const columns = document.querySelectorAll('tr:nth-of-type(2) td');
    // SHARES
    columns[1].innerHTML = accountValues.shares;
    // TOTAL VALUE
    columns[2].innerHTML = priceFormatter.format(accountValues.value);
    // DAY'S GAIN $
    const daysStartingValue = accountValues.value / (1 + daysChangePercent / 100);
    const daysGain = accountValues.value - daysStartingValue;
    let span = columns[3].querySelector('span');
    if (daysGain < 0) {
        span.classList.add('loss');
    }
    span.innerHTML = priceFormatter.format(daysGain);
    // TOTAL GAIN $
    span = columns[5].querySelector('span');
    if (accountValues.gain < 0) {
        span.classList.add('loss');
    }
    span.innerHTML = priceFormatter.format(accountValues.gain);
    // TOTAL GAIN %
    span = columns[6].querySelector('span');
    if (accountValues.gainPercent < 0) {
        span.classList.add('loss');
    }
    span.innerHTML = `${accountValues.gainPercent}%`;
}

function populateMovers(positions, accountValue) {
    const selected = document.querySelector('.movers toggle-button[aria-pressed="true"]');
    let getValue;
    let minDelta;
    let changeType;
    if (selected.innerText.includes('$')) {
        changeType = '$';
        getValue = x => positionDaysGain(x, accountValue);
        minDelta = 0.005 * accountValue;
    } else {
        changeType = '%'
        getValue = x => x.daysChangePercent;
        minDelta = 1;
    }
    let reverse = false;
    let min = -Infinity;
    let max = Infinity;
    if (selected.innerText.includes('LOSERS')) {
        reverse = true;
        max = -minDelta;
    } else {
        min = minDelta;
    }
    let movers = positions.map(x => (x.symbol, getValue(x))).filter(x => min <= x[1] && x[1] <= max);
    movers.sort((a, b) => a[1] - b[1]);
    if (reverse) {
        movers.reverse();
    }

    const list = document.querySelector('.movers-list');
    list.innerHTML = '';
    for (const tuple of movers.slice(0, 6)) {
        list.appendChild(createCard(tuple[0], tuple[1], changeType));
    }
}

function onMoversButtonClick(button) {
    const allButtons = document.querySelector('.movers .toggle-button');
    for (const x in allButtons) {
        x.ariaPressed = undefined;
    }
    button.ariaPressed = "true";
    populateMovers();
}

function positionDaysGain(p, accountValue) {
    return accountValue * p.percentOfPortfolio / (1 + p.daysChangePercent / 100);
}

function getDisplayName(symbol) {
    switch (symbol) {
        case 'VTI':
            return 'MARKET (VTI)';
        case 'DJIND':
            return 'DOW';
        case 'COMP.IDX':
            return 'NASDAQ';
        case 'SPX':
            return 'S&P 500';
        case 'MERT':
            return 'PORTFOLIO';
        default:
            return '(Unknown)';
    }
}

function getAccountIdFromLocation(accounts, longitude) {
    return accounts.find(x => Math.abs(longitude - x.longitude) < 1.0).id;
}

function getAccountIdFromZipCode(accounts, zip) {
    return accounts.find(x => zip === x.zip).id;
}

function getAccountValues(accounts, accountId, latestSharePrice) {
    const account = accounts.find(x => x.id === accountId);
    const shares = account.lots.reduce(((a, x) => a + x.n), 0);
    const costBasis = account.lots.reduce(((a, x) => a + x.n * x.price), 0);
    const value = shares * latestSharePrice;
    const gain = value - costBasis;
    const gainPercent = (100 * gain / costBasis).toFixed(2);
    return {
        shares,
        costBasis,
        value,
        gain,
        gainPercent
    };
}

function createCard(symbol, value, valueType) {
    const card = document.createElement('div');
    card.classList.add('quote-card');

    const name = document.createElement('div');
    card.appendChild(name);
    name.classList.add('quote-name');
    name.innerHTML = getDisplayName(symbol);

    const change = document.createElement('div');
    card.appendChild(change);
    change.classList.add('quote-change');
    switch (valueType) {
        case '$':
            change.innerHTML = priceFormatter.format(value);
            break;
        case '%':
            change.innerHTML = `${value}%`;
            break;
    }
    change.classList.add('changeValue');
    if (value < 0) {
        change.classList.add('loss');
    }

    return card;
}

function getQueryParameter(name) {
    const queryString = window.location.search.substring(1);
    const params = queryString.split('&');
    for (const param of params) {
        const nameAndValue = param.split('=');
        if (nameAndValue[0] === name) {
            return nameAndValue[1];
        }
    }
}
