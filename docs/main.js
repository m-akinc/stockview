(async () => {
    const devMode = getQueryParameter('dev') !== undefined;
    const longitude = getQueryParameter('longitude');
    let accountId = getQueryParameter('id');
    let accountValues;

    const response = await fetch('https://raw.githubusercontent.com/m-akinc/stockview/refs/heads/main/data.json');
    if (!response.ok) {
        document.body.innerText = `Failed to fetch data (${response.status}): ${response.statusText}`;
        console.log();
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

    if (accountId) {
        accountValues = getAccountValues(data.accounts, accountId, latestSharePrice);
    } else if (longitude) {
        accountId = getAccountIdFromLocation(longitude);
        accountValues = getAccountValues(data.accounts, accountId, latestSharePrice);
    } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(x => {
            alert(x);
            accountId = getAccountIdFromLocation(x.coords.longitude);
            if (!accountId) {
                console.log('Could not find account for longitude:', x.coords.longitude);
                const zip = prompt("Couldn't determine your accound from your location. Please enter your zip code so we can show your holdings.");
                accountId = getAccountIdFromZipCode(data.accounts, zip);
            }
            accountValues = getAccountValues(data.accounts, accountId, latestSharePrice);
        },x => {
            alert(x);
            console.log('Geolocation failed:', x);
            const zip = prompt('Looks like the browser is not allowed to use your location. Please enter your zip code so we can show your holdings.');
            accountId = getAccountIdFromZipCode(zip);
            accountValues = getAccountValues(data.accounts, accountId, latestSharePrice);
        },{
            enableHighAccuracy: true,
            timeout: 2000
        });
    }
    alert(accountId, longitude, navigator.geolocation);

    const market = document.querySelector('.market');
    for (const index of data.indices) {
        const card = document.createElement('div');
        market.appendChild(card);
        card.classList.add('quote-card');

        const name = document.createElement('div');
        card.appendChild(name);
        name.classList.add('quote-name');
        name.innerHTML = getDisplayName(index[0]);

        const change = document.createElement('div');
        card.appendChild(change);
        change.classList.add('quote-change');
        change.innerHTML = `${index[3]}%`;
        change.classList.add('changeValue');
        if (index[3] < 0) {
            change.classList.add('loss');
        }
    }
    
    const table = document.querySelector('table');

    if (devMode) {
        const history = document.createElement('div');
        for (const x of data.history) {
            const d = document.createElement('div');
            d.innerHTML = new Date(x[0]).toLocaleString();
            history.appendChild(d);
        }
        table.after(history);
    }

    document.querySelector('.latestPrice').innerText = priceFormatter.format(latestSharePrice);
    
    const previousClose = data.history.reverse().find(x => new Date(x[0]).getDate() !== lastUpdated.getDate());
    if (previousClose) {
        const previousCloseSharePrice = previousClose[1] / data.totalShares;
        const daysChangeDollars = latestSharePrice - previousCloseSharePrice;
        const daysChangePercent = (100 * daysChangeDollars / previousCloseSharePrice).toFixed(2);
        const daysChangeDollarsElement = document.querySelector('#changeDollars'); 
        const daysChangePercentElement = document.querySelector('#changePercent'); 
        daysChangeDollarsElement.innerText = priceFormatter.format(daysChangeDollars);
        daysChangePercentElement.innerText = `${daysChangePercent}%`;
        if (daysChangeDollars < 0) {
            daysChangeDollarsElement.classList.add('loss');
            daysChangePercentElement.classList.add('loss');
        } else {
            daysChangeDollarsElement.classList.remove('loss');
            daysChangePercentElement.classList.remove('loss');
        }

        // Add to table
        const row = document.createElement('tr');
        
        let column = document.createElement('td');
        column.innerHTML = priceFormatter.format(latestSharePrice);
        row.appendChild(column);
        
        column = document.createElement('td');
        let span = document.createElement('span');
        span.classList.add('changeValue');
        if (daysChangeDollars < 0) {
            span.classList.add('loss');
        }
        span.innerHTML = priceFormatter.format(daysChangeDollars);
        column.appendChild(span);
        row.appendChild(column);
        
        column = document.createElement('td');
        span = document.createElement('span');
        span.classList.add('changeValue');
        if (daysChangeDollars < 0) {
            span.classList.add('loss');
        }
        span.innerHTML = `${daysChangePercent}%`;
        column.appendChild(span);
        row.appendChild(column);
        
        column = document.createElement('td');
        column.innerHTML = priceFormatter.format(accountValues.value);
        row.appendChild(column);
        
        column = document.createElement('td');
        span = document.createElement('span');
        span.classList.add('changeValue');
        if (accountGain < 0) {
            span.classList.add('loss');
        }
        span.innerHTML = priceFormatter.format(accountValues.gain);
        column.appendChild(span);
        row.appendChild(column);
        
        column = document.createElement('td');
        span = document.createElement('span');
        span.classList.add('changeValue');
        if (accountGainPercent < 0) {
            span.classList.add('loss');
        }
        span.innerHTML = priceFormatter.format(accountValues.gainPercent);
        column.appendChild(span);
        row.appendChild(column);
        
        column = document.createElement('td');
        column.innerHTML = accountValues.shares;
        row.appendChild(column);

        table.appendChild(row);
    }

    document.querySelector('stockview-treemap').positions = data.positions;
})();

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
        default:
            return '(Unknown)';
    }
}

function getAccountIdFromLocation(accounts, longitude) {
    return accounts.find(x => Math.abs(longitude - x.longitude) < 1.0);
}

function getAccountIdFromZipCode(accounts, zip) {
    return accounts.find(x => zip === x.zip);
}

function getAccountValues(accounts, accountId, latestSharePrice) {
    const account = accounts.find(x => x.id === accountId);
    const shares = account.lots.reduce(((a, x) => a + x.n), 0);
    const costBasis = account.lots.reduce(((a, x) => a + x.n * x.price), 0);
    const value = shares * latestSharePrice;
    const gain = value - costBasis;
    const gainPercent = gain / costBasis;
    return {
        shares,
        costBasis,
        value,
        gain,
        gainPercent
    };
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
