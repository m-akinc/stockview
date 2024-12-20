(async () => {
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

    const account = data.accounts.find(x => x.id === 'A041281');

    // Populate table
    const table = document.querySelector('table');
    for (const index of data.indices) {
        const row = document.createElement('tr');
        let column;
        for (const i of [...Array(4).keys()]) {
            column = document.createElement('td');
            column.innerHTML = index[i];
            row.appendChild(column);
        }
        table.appendChild(row);
    }

    // TODO: remove later?
    document.querySelector('.latestPrice').innerText = priceFormatter.format(latestSharePrice);
    
    const previousClose = data.history.reverse().find(x => new Date(x.date).getDate() !== lastUpdated.getDate());
    if (previousClose) {
        const previousCloseSharePrice = previousClose.cap / data.totalShares;
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
        column.innerHTML = 'MERT';
        row.appendChild(column);
        
        column = document.createElement('td');
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
        column.innerHTML = 'TODO';
        row.appendChild(column);
        
        column = document.createElement('td');
        column.innerHTML = 'TODO';
        row.appendChild(column);
        
        column = document.createElement('td');
        column.innerHTML = account.shares;
        row.appendChild(column);

        table.appendChild(row);
    }

    const positionsElement = document.querySelector('.positions');
    const absoluteMaximum = Math.max(...data.positions.map(x => Math.abs(x.daysChangePercent)));
    positionsElement.innerHTML = data.positions
        .sort((a, b) => a.percentOfPortfolio - b.percentOfPortfolio)
        .map(x => `<div style="color:${getPositionColor(x.daysChangePercent, absoluteMaximum)}">${x.symbol}: day% ${x.daysChangePercent}, port% ${x.percentOfPortfolio}</div>`)
        .join('');
        
})();

function getPositionColor(percentChange, absMaximum) {
    const rangeMax = Math.max(absMaximum, 15);
    if (percentChange > 0) {
        r = foo(percentChange, rangeMax, 9);
        g = foo(percentChange, rangeMax, 219);
        b = foo(percentChange, rangeMax, 22);
    } else if (percentChange < 0) {
        r = foo(percentChange, rangeMax, 253);
        g = foo(percentChange, rangeMax, 19);
        b = foo(percentChange, rangeMax, 12);
    } else {
        r = 238;
        g = 238;
        b = 238;
    }
    return `rgb(${r}, ${g}, ${b})`;
}

function foo(percentChange, rangeMax, minValue) {
    const logValue = Math.log(1.5 * Math.abs(percentChange) + 1);
    const logMaxInput = Math.log(1.5 * rangeMax + 1);
    const percentMagnitude = Math.min(1, logValue / logMaxInput);
    const range = 255 - minValue;
    return Math.floor(minValue + ((1 - percentMagnitude) * range));
}