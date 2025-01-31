// Time ranges
const DAY = 0;
const WEEK = 1;
const MONTH = 2;
const ALL = 3;

const priceFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
});
const percentFormatter = new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 2
});

let data;
let lastUpdated;
let accountValues;
let chart;
let yAxisUseDollars = false;
const chartDatasets = [];
const chartOptions = {
    elements: {
        point: {
            pointStyle: false
        }
    },
    scales: {
        x: {
            type: 'time',
            min: undefined,
            max: undefined
        },
        y: {
            ticks: {
                callback: function(value, index, ticks) {
                    return yAxisUseDollars ? priceFormatter.format(value) : percentFormatter.format(value / 100);
                }
            },
            grid: {
              color: function(context) {
                if (context.tick.value === 0) {
                  return '#525365';
                }
                return '#3a3b4a';
              },
            },
        }
    },
    plugins: {
        legend: {
            display: true
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
    const currentSharePrice = data.cap / data.totalShares;
    document.querySelector('.date').innerText = lastUpdated.toLocaleString();
    const [_, previousCloseTotalCap] = [...data.history].reverse().find(x => new Date(x[0]).getDate() !== lastUpdated.getDate());
    const previousCloseSharePrice = previousCloseTotalCap / data.totalShares;
    const sharePriceChangeSincePreviousClose = currentSharePrice - previousCloseSharePrice;
    const percentChangeSincePreviousClose = (100 * sharePriceChangeSincePreviousClose / previousCloseSharePrice).toFixed(2);

    document.querySelector('.force-refresh').addEventListener('click', () => {
        location.reload(true);
    });

    // Populate table row (non-account values)
    const columns = document.querySelectorAll('#row td');
    // LAST
    columns[0].innerHTML = priceFormatter.format(currentSharePrice);
    // DAY'S CHANGE %
    let span = columns[4].querySelector('span');
    if (sharePriceChangeSincePreviousClose < 0) {
        span.classList.add('loss');
    }
    span.innerHTML = `${percentChangeSincePreviousClose}%`;

    if (accountId) {
        accountValues = getAccountValues(data.accounts, accountId, currentSharePrice);
        populateAccountValues(accountValues, percentChangeSincePreviousClose);
    } else if (longitude) {
        accountId = getAccountIdFromLocation(longitude);
        accountValues = getAccountValues(data.accounts, accountId, currentSharePrice);
        populateAccountValues(accountValues, percentChangeSincePreviousClose);
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
            accountValues = getAccountValues(data.accounts, accountId, currentSharePrice);
            populateAccountValues(accountValues, percentChangeSincePreviousClose);
        },x => {
            console.log('Geolocation failed:', x);
            const zip = prompt('Looks like the browser is not allowed to use your location. Please enter your zip code so we can show your holdings.');
            accountId = getAccountIdFromZipCode(data.accounts, zip);
            if (accountId) {
                localStorage.setItem('stockview-account-id', accountId);
            }
            accountValues = getAccountValues(data.accounts, accountId, currentSharePrice);
            populateAccountValues(accountValues, percentChangeSincePreviousClose);
        },{
            enableHighAccuracy: true,
            timeout: 2000
        });
    }
    
    const market = document.querySelector('.market');
    for (const index of data.indices) {
        market.appendChild(createCard(index[0], index[3], '%'));
    }
    const bigCard = createCard('MERT', percentChangeSincePreviousClose, '%');
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

    if (accountId === 'A041281') {
        const vsAltButton = document.createElement('div');
        vsAltButton.innerHTML = 'SHOW OLD PF';
        vsAltButton.classList.add('button');
        vsAltButton.classList.add('toggle-button');
        vsAltButton.classList.add('vs-alt');
        vsAltButton.role = 'button';
        vsAltButton.addEventListener('click', event => {
            onGraphToggleVsAlt(event.currentTarget);
        });
        const buttonRow = document.querySelector('.graph-options');
        buttonRow.appendChild(vsAltButton);
    }
    
    chart = new Chart(document.getElementById('graph'), {
        type: 'line',
        data: {
            datasets: chartDatasets
        },
        options: chartOptions
    });
    updateChart(data, lastUpdated);
    
    populateMovers(data.positions, accountValues.value);

    requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector('stockview-treemap').positions = data.positions));
})();

function populateAccountValues(accountValues, percentChangeSincePreviousClose) {
    const columns = document.querySelectorAll('tr:nth-of-type(2) td');
    // SHARES
    columns[1].innerHTML = accountValues.shares;
    // TOTAL VALUE
    columns[2].innerHTML = priceFormatter.format(accountValues.value);
    // DAY'S GAIN $
    const daysStartingValue = accountValues.value / (1 + percentChangeSincePreviousClose / 100);
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

function getChartDatasets(data, lastUpdated, showVTI, vtiAsBaseline, vsAlt, range) {
    const earliest = getDateAgo(lastUpdated, range);
    const points = earliest
        ? data.history.filter(x => x[0] >= earliest)
        : data.history;
    let previousClose;
    if (earliest) {
        previousClose = [...data.history].reverse().find(x => x[0] < earliest);
    }
    if (!previousClose) {
        previousClose = data.history[0];
    }
    if (!showVTI && !vtiAsBaseline) {
        yAxisUseDollars = true;
        const plots = [{
            label: 'PORTFOLIO',
            data: points.map(x => ({
                x: x[0],
                y: x[1] * (accountValues.shares / data.totalShares)
            })),
            borderColor: '#a772e0'
        }];
        if (vsAlt) {
            plots.push({
                label: 'OLD PORTFOLIO',
                data: points.map(x => ({
                    x: x[0],
                    y: x[3]
                })),
                borderColor: '#697edd'
            });
        }
        return plots;
    }
    yAxisUseDollars = false;
    if (showVTI) {
        const plots = [
            {
                label: 'PORTFOLIO',
                data: points.map(x => ({
                    x: x[0],
                    y: percentChange(x[1], previousClose[1])
                })),
                borderColor: '#a772e0'
            },
            {
                label: 'VTI',
                data: points.map(x => ({
                    x: x[0],
                    y: percentChange(x[2], previousClose[2])
                })),
                borderColor: '#643e8c'
            }
        ];
        if (vsAlt) {
            plots.push({
                label: 'OLD PORTFOLIO',
                data: points.map(x => ({
                    x: x[0],
                    y: percentChange(x[3], previousClose[3])
                })),
                borderColor: '#697edd'
            });
        }
        return plots;
    }
    if (vtiAsBaseline) {
        const portfolioPcts = points.map(x => percentChange(x[1], previousClose[1]));
        const vtiPcts = points.map(x => percentChange(x[2], previousClose[2]));
        const plots = [
            {
                label: 'PORTFOLIO',
                data: points.map((x, i) => ({
                    x: x[0],
                    y: portfolioPcts[i] - vtiPcts[i]
                })),
                borderColor: '#a772e0'
            },
            {
                label: 'VTI',
                data: points.map(x => ({
                    x: x[0],
                    y: 0
                })),
                borderColor: '#643e8c'
            }
        ];
        if (vsAlt) {
            const altPcts = points.map(x => percentChange(x[3], previousClose[3]));
            plots.push({
                label: 'OLD PORTFOLIO',
                data: points.map((x, i) => ({
                    x: x[0],
                    y: altPcts[i] - vtiPcts[i]
                })),
                borderColor: '#697edd'
            });
        }
        return plots;
    }
}

function percentChange(v1, v0) {
    return 100 * (v1 - v0) / v0;
}

function isToggledOn(selector) {
    return !!document.querySelector(selector)?.ariaPressed;
}

function setToggledOn(selector, on) {
    const button = document.querySelector(selector);
    if (button) {
        button.ariaPressed = on ? 'true' : undefined;
    }
}

function updateChart(data, lastUpdated) {
    let range;
    if (isToggledOn('.toggle-button.day')) {
        range = DAY;
    } else if (isToggledOn('.toggle-button.week')) {
        range = WEEK;
    } else if (isToggledOn('.toggle-button.month')) {
        range = MONTH;
    } else {
        range = ALL;
    }
    chartOptions.scales.x.min = getDateAgo(lastUpdated, range);
    chartOptions.scales.x.max = new Date(lastUpdated.getTime()).setHours(15, 10);
    chartDatasets.length = 0;
    const showVTI = isToggledOn('.toggle-button.toggle-index');
    const vtiAsBaseline = isToggledOn('.toggle-button.as-baseline');
    const vsAlt = isToggledOn('.toggle-button.vs-alt');
    for (const dataset of getChartDatasets(data, lastUpdated, showVTI, vtiAsBaseline, vsAlt, range)) {
        chartDatasets.push(dataset);
    }
    chart.update();
}

function getDateAgo(lastUpdated, range) {
    switch (range) {
        case DAY:
            return new Date(lastUpdated.getTime()).setHours(8, 20);
        case WEEK:
            return new Date(new Date(lastUpdated.getTime()).setDate(lastUpdated.getDate() - 7)).setHours(0, 0);
        case MONTH:
            return new Date(lastUpdated.getTime()).setMonth(lastUpdated.getMonth() - 1);
        default:
            return undefined
    }
}

function onGraphToggleIndexClick(button) {
    const wasPressed = !!button.ariaPressed;
    button.ariaPressed = wasPressed ? undefined : "true";
    if (!wasPressed) {
        setToggledOn('.toggle-button.as-baseline', false);
    }
    updateChart(data, lastUpdated);
}

function onGraphToggleIndexBaseline(button) {
    const wasPressed = !!button.ariaPressed;
    button.ariaPressed = wasPressed ? undefined : "true";
    if (!wasPressed) {
        setToggledOn('.toggle-button.toggle-index', false);
    }
    updateChart(data, lastUpdated);
}

function onGraphToggleVsAlt(button) {
    const wasPressed = !!button.ariaPressed;
    button.ariaPressed = wasPressed ? undefined : "true";
    updateChart(data, lastUpdated);
}

function onGraphToggleTimeRange(button) {
    const wasPressed = !!button.ariaPressed;
    if (wasPressed) {
        return;
    }
    button.ariaPressed = "true";
    const rangeButtons = document.querySelectorAll('.time-range .toggle-button');
    for (const rangeButton of rangeButtons) {
        if (button !== rangeButton) {
            rangeButton.ariaPressed = undefined;
        }
    }
    updateChart(data, lastUpdated);
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
                change.innerHTML = `$${(value / 1000).toFixed(1)}k`;
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
