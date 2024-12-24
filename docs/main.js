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
    const priceFormatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    })
    const lastUpdated = new Date(data.date);
    const latestSharePrice = data.cap / data.totalShares;
    document.querySelector('.date').innerText = lastUpdated.toLocaleString();
    const previousClose = data.history.reverse().find(x => new Date(x[0]).getDate() !== lastUpdated.getDate());

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
        populateAccountValues(accountValues, priceFormatter);
    } else if (longitude) {
        accountId = getAccountIdFromLocation(longitude);
        accountValues = getAccountValues(data.accounts, accountId, latestSharePrice);
        populateAccountValues(accountValues, priceFormatter);
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
            populateAccountValues(accountValues, priceFormatter);
        },x => {
            console.log('Geolocation failed:', x);
            const zip = prompt('Looks like the browser is not allowed to use your location. Please enter your zip code so we can show your holdings.');
            accountId = getAccountIdFromZipCode(data.accounts, zip);
            if (accountId) {
                localStorage.setItem('stockview-account-id', accountId);
            }
            accountValues = getAccountValues(data.accounts, accountId, latestSharePrice);
            populateAccountValues(accountValues, priceFormatter);
        },{
            enableHighAccuracy: true,
            timeout: 2000
        });
    }
    
    let daysChangePercent = 0;
    if (previousClose) {
        const previousCloseSharePrice = previousClose[1] / data.totalShares;
        const daysChangeDollars = latestSharePrice - previousCloseSharePrice;
        daysChangePercent = (100 * daysChangeDollars / previousCloseSharePrice).toFixed(2);

        // Populate table row (non-account values)
        const columns = document.querySelectorAll('#row td');
        // LAST
        columns[0].innerHTML = priceFormatter.format(latestSharePrice);
        // DAY'S CHANGE %
        span = columns[4].querySelector('span');
        if (daysChangeDollars < 0) {
            span.classList.add('loss');
        }
        span.innerHTML = `${daysChangePercent}%`;
    }

    const market = document.querySelector('.market');
    for (const index of data.indices) {
        market.appendChild(createCard(index[0], index[3]));
    }
    const bigCard = createCard('MERT', daysChangePercent);
    bigCard.classList.add('big-card');
    market.after(bigCard);

    if (devMode) {
        const history = document.createElement('div');
        for (const x of data.history) {
            const d = document.createElement('div');
            d.innerHTML = new Date(x[0]).toLocaleString();
            history.appendChild(d);
        }
        market.after(history);
    }

    requestAnimationFrame(() => document.querySelector('stockview-treemap').positions = data.positions);
})();

function populateAccountValues(accountValues, priceFormatter) {
    const columns = document.querySelectorAll('tr:nth-of-type(2) td');
    // SHARES
    columns[1].innerHTML = accountValues.shares;
    // TOTAL VALUE
    columns[2].innerHTML = priceFormatter.format(accountValues.value);
    // DAY'S GAIN $
    let span = columns[3].querySelector('span');
    if (daysChangeDollars < 0) {
        span.classList.add('loss');
    }
    span.innerHTML = priceFormatter.format(daysChangeDollars);
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

function createCard(symbol, daysPercent) {
    const card = document.createElement('div');
    card.classList.add('quote-card');

    const name = document.createElement('div');
    card.appendChild(name);
    name.classList.add('quote-name');
    name.innerHTML = getDisplayName(symbol);

    const change = document.createElement('div');
    card.appendChild(change);
    change.classList.add('quote-change');
    change.innerHTML = `${daysPercent}%`;
    change.classList.add('changeValue');
    if (daysPercent < 0) {
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
