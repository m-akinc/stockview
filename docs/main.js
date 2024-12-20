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
    document.querySelector('.latestPrice').innerText = priceFormatter.format(latestSharePrice);
    
    const previousClose = data.history.reverse().find(x => new Date(x.date).getDate() !== lastUpdated.getDate());
    if (previousClose) {
        const previousCloseSharePrice = previousClose.cap / data.totalShares;
        const daysChangeDollars = latestSharePrice - previousCloseSharePrice;
        const daysChangePercent = (100 * daysChangeDollars / previousCloseSharePrice).toFixed(2);
        const daysChangeDollarsElement = document.querySelector('.daysChangeDollars'); 
        const daysChangePercentElement = document.querySelector('.daysChangePercent'); 
        daysChangeDollarsElement.innerText = priceFormatter.format(daysChangeDollars);
        daysChangePercentElement.innerText = `${daysChangePercent}%`;
        if (daysChangeDollars < 0) {
            daysChangeDollarsElement.classList.add('loss');
            daysChangePercentElement.classList.add('loss');
        } else {
            daysChangeDollarsElement.classList.remove('loss');
            daysChangePercentElement.classList.remove('loss');
        }
    }
    const positionsElement = document.querySelector('.positions');
    const absoluteMaximum = Math.max(...data.positions.map(x => Math.abs(x.daysChangePercent)));
    positionsElement.innerHTML = data.positions
        .sort((a, b) => a.percentOfPortfolio - b.percentOfPortfolio)
        .map(x => `<span style="color:${getPositionColor(x.daysChangePercent, absoluteMaximum)}">${x.symbol}: day% ${x.daysChangePercent}, port% ${x.percentOfPortfolio}</span>`)
        .join('\n');
        
})();

function getPositionColor(percentChange, absMaximum) {
    const intensity = Math.abs(percentChange / absMaximum);
    if (percentChange > 0) {
        return `rgb(${intensity * 9}, 219, ${intensity * 22})`;
    }
    if (percentChange < 0) {
        return `rgb(253, ${intensity * 19}, ${intensity * 12})`;
    }
    return 'rgb(238, 238, 238)';
}