const priceFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
});
const percentFormatter = new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 1
});

let data;
let lastUpdated;
let accountValues;
let chart;
const chartDatasets = [];
const chartOptions = {
    scales: {
        x: {
            type: 'time',
            min: undefined,
            max: undefined
        }
    },
    plugins: {
        legend: {
            display: false
        }
    }
};

(async () => {
    const devMode = getQueryParameter('dev') !== undefined;
    const longitude = getQueryParameter('longitude');
    let accountId = getQueryParameter('id');

    if (!accountId && !longitude) {
        accountId = localStorage.getItem('stockview-account-id');
        console.log('Got accountId from local storage:', accountId);
    }

    const response = await fetch('https://raw.githubusercontent.com/m-akinc/stockview/refs/heads/main/data.json');
    if (!response.ok) {
        document.body.innerText = `Failed to fetch data (${response.status}): ${response.statusText}`;
        return;
    }
    
    data = await response.json();
    lastUpdated = new Date(data.date);
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
    
    chart = new Chart(document.getElementById('graph'), {
        type: 'line',
        data: {
            datasets: chartDatasets
        },
        options: chartOptions
    });
    updateChart(data, lastUpdated, false, false);

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
    
    populateMovers(data.positions, accountValues.value);

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

function getChartDatasets(data, lastUpdated, includeVTI, indexAsBasis, allTime) {
    const dataSets = [];
    const points = allTime
        ? data.history.filter(x => x[2] !== undefined)
        : data.history.filter(x => new Date(x[0]).getDate() === lastUpdated.getDate());
    dataSets.push({
        label: 'PORTFOLIO',
        data: points.map(x => ({
            x: x[0],
            y: includeVTI
                ? (indexAsBasis 
                    ? x[1] / points[0][1] - x[2] / points[0][2]
                    : 100 * (x[1] - points[0][1]) / points[0][1])
                : x[1] / data.totalShares
        })),
        borderColor: '#a772e0'
    });
    if (includeVTI) {
        dataSets.push({
            label: 'VTI',
            data: points.map(x => ({
                x: x[0],
                y: indexAsBasis ? 0 : 100 * (x[2] - points[0][2]) / points[0][2]
            })),
            borderColor: '#643e8c'
        });
    }
    return dataSets;
}

function updateChart(data, lastUpdated, includeVTI, indexAsBasis, allTime) {
    chartDatasets.length = 0;
    for (const dataset of getChartDatasets(data, lastUpdated, includeVTI, indexAsBasis, allTime)) {
        chartDatasets.push(dataset);
    }
    chartOptions.scales.x.min = allTime ? undefined : new Date().setHours(8, 30, 0),
    chartOptions.scales.x.max = allTime ? undefined : new Date().setHours(15, 30, 0)
    chartOptions.plugins.legend.display = includeVTI;
    chart.update();
}

function onGraphToggleIndexClick(button) {
    const wasPressed = !!button.ariaPressed;
    button.ariaPressed = wasPressed ? undefined : "true";
    const asBasisButton = document.querySelector('.toggle-button.as-baseline');
    const allTimeButton = document.querySelector('.toggle-button.all-time');
    updateChart(data, lastUpdated, !wasPressed, !!asBasisButton.ariaPressed, !!allTimeButton.ariaPressed);
}

function onGraphToggleIndexBaseline(button) {
    const wasPressed = !!button.ariaPressed;
    button.ariaPressed = wasPressed ? undefined : "true";
    const toggleIndexButton = document.querySelector('.toggle-button.toggle-index');
    const allTimeButton = document.querySelector('.toggle-button.all-time');
    updateChart(data, lastUpdated, !!toggleIndexButton.ariaPressed, !wasPressed, !!allTimeButton.ariaPressed);
}

function onGraphToggleAllTime(button) {
    const wasPressed = !!button.ariaPressed;
    button.ariaPressed = wasPressed ? undefined : "true";
    const toggleIndexButton = document.querySelector('.toggle-button.toggle-index');
    const asBasisButton = document.querySelector('.toggle-button.as-baseline');
    updateChart(data, lastUpdated, !!toggleIndexButton.ariaPressed, !!asBasisButton.ariaPressed, !wasPressed);
}

function populateMovers(positions, accountValue) {
    const selected = document.querySelector('.movers .toggle-button[aria-pressed="true"]');
    let getValue;
    let minDelta;
    let changeType;
    if (selected.innerText.includes('$')) {
        changeType = '$';
        getValue = x => positionDaysGain(x, accountValue);
        minDelta = 0.0006 * accountValue; // at least +/- .06% of account value
    } else {
        changeType = '%'
        getValue = x => x.daysChangePercent;
        minDelta = 2.2; // at least +/-2.2%
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
    let movers = positions.map(x => [x.symbol, getValue(x)]).filter(x => min <= x[1] && x[1] <= max);
    movers.sort((a, b) => b[1] - a[1]);
    if (reverse) {
        movers.reverse();
    }
    movers = movers.slice(0, 10);

    const list = document.querySelector('.movers-list');
    list.innerHTML = '';
    if (movers.length === 0) {
        list.innerHTML = 'None';
    }
    for (const tuple of movers) {
        list.appendChild(createCard(tuple[0], tuple[1], changeType));
    }
}

function onMoversButtonClick(button) {
    const allButtons = document.querySelectorAll('.movers .toggle-button');
    for (const x of allButtons) {
        x.ariaPressed = undefined;
    }
    button.ariaPressed = "true";
    populateMovers(data.positions, accountValues.value);
}

function positionDaysGain(p, accountValue) {
    const currentAccountValue = accountValue * (p.percentOfPortfolio / 100);
    return currentAccountValue - (currentAccountValue / (1 + p.daysChangePercent / 100));
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
            return symbol;
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
            if (Math.abs(value) >= 1000) {
                change.innerHTML = `${(value / 1000).toFixed(1)}k`;
            } else {
                change.innerHTML = priceFormatter.format(value);
            }
            break;
        case '%':
            change.innerHTML = percentFormatter.format(value / 100);
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
