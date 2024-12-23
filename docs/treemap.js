export class TreeMap extends HTMLElement {
    resizeObserver = new ResizeObserver(() => this.update());
    root;
    _positions;

    set positions(value) {
        this._positions = value.sort((a, b) => b.percentOfPortfolio - a.percentOfPortfolio);
        this.update();
    }

    get positions() {
        return this._positions;
    }
  
    constructor() {
        super();
    }
  
    connectedCallback() {
        const shadow = this.attachShadow({ mode: "open" });
        this.root = document.createElement("div");
        
        const linkElem = document.createElement("link");
        linkElem.setAttribute("rel", "stylesheet");
        linkElem.setAttribute("href", "treemap.css");

        shadow.appendChild(linkElem);
        shadow.appendChild(this.root);

        this.resizeObserver.observe(this);
    }
  
    disconnectedCallback() {
        this.resizeObserver.disconnect();
    }

    update() {
        if (!this.positions) {
            return;
        }
        this.root.innerHTML = '';
        const rect = this.getBoundingClientRect();
        const absoluteMaximum = Math.max(...this.positions.map(x => Math.abs(x.daysChangePercent)));
        this.layout(this.root, 100, rect.width, rect.height, this.positions, absoluteMaximum);
    }

    layout(container, containerPercent, containerWidth, containerHeight, positions, absoluteChangeMaximum, n=0) {
        if (positions.length === 0) {
            return;
        }
        container.classList.add('container');
        let smallerDimension, largerDimension;
        if (containerWidth >= containerHeight) {
            smallerDimension = containerHeight;
            largerDimension = containerWidth;
            container.classList.remove('tall');
        } else {
            smallerDimension = containerWidth;
            largerDimension = containerHeight;
            container.classList.add('tall');
        }
        const divisions = Math.round(largerDimension / smallerDimension);
        console.log(largerDimension, smallerDimension, divisions);
        if (divisions > 1) {
            const targetPercent = containerPercent / divisions;
            let positionIndex = 0;
            const blocks = [...Array(divisions).keys()].map(x => document.createElement('div'));
            for (const div of blocks) {
                div.classList.add('container');
            }
            for (const div of blocks) {
                container.appendChild(div);
                let blockPercent = 0;
                const blockPositions = [];
                for (; positionIndex < positions.length && blockPercent < targetPercent; positionIndex += 1) {
                    blockPositions.push(positions[positionIndex]);
                    blockPercent += positions[positionIndex].percentOfPortfolio;
                }
                const divPercentOfContainer = blockPercent / containerPercent;
                div.style.flexBasis = `${100 * divPercentOfContainer}%`;
                let blockWidth, blockHeight;
                if (largerDimension === containerWidth) {
                    blockWidth = (containerWidth * divPercentOfContainer);
                    blockHeight = containerHeight;
                } else {
                    blockWidth = containerWidth;
                    blockHeight = (containerHeight * divPercentOfContainer);
                }
                this.layout(div, blockPercent, blockWidth, blockHeight, blockPositions, absoluteChangeMaximum, n+1);
            }
            return;
        }
        positions = [...positions];
        const largest = positions.shift();
        const largestAsPercentOfContainer = 100 * largest.percentOfPortfolio / containerPercent;
        
        const largestDiv = document.createElement('div');
        const restDiv = document.createElement('div');
        largestDiv.style.flexBasis = `${largestAsPercentOfContainer}%`;
        largestDiv.style.backgroundColor = this.getPositionColor(largest.daysChangePercent, absoluteChangeMaximum);
        largestDiv.innerHTML = `${largest.symbol}<br>${largest.percentOfPortfolio}<br>${largest.daysChangePercent}%`
        container.appendChild(largestDiv);
        container.appendChild(restDiv);
        const restPercent = 1 - (largestAsPercentOfContainer / 100);
        let restWidth, restHeight;
        if (largerDimension === containerWidth) {
            restWidth = (containerWidth * restPercent);
            restHeight = containerHeight;
        } else {
            restWidth = containerWidth;
            restHeight = (containerHeight * restPercent);
        }
        if (n > 5) {
            return;
        }
        this.layout(restDiv, containerPercent * restPercent, restWidth, restHeight, positions, absoluteChangeMaximum, n+1);
    }

    getPositionColor(percentChange, absMaximum) {
        const rangeMax = Math.max(absMaximum, 15);
        let r, g, b;
        if (percentChange > 0) {
            r = this.scaleColorValue(percentChange, rangeMax, 9);
            g = this.scaleColorValue(percentChange, rangeMax, 219);
            b = this.scaleColorValue(percentChange, rangeMax, 22);
        } else if (percentChange < 0) {
            r = this.scaleColorValue(percentChange, rangeMax, 253);
            g = this.scaleColorValue(percentChange, rangeMax, 19);
            b = this.scaleColorValue(percentChange, rangeMax, 12);
        } else {
            r = 238;
            g = 238;
            b = 238;
        }
        return `rgb(${r}, ${g}, ${b})`;
    }

    scaleColorValue(percentChange, rangeMax, minValue) {
        const logValue = Math.log(1.5 * Math.abs(percentChange) + 1);
        const logMaxInput = Math.log(1.5 * rangeMax + 1);
        const percentMagnitude = Math.min(1, logValue / logMaxInput);
        const range = 255 - minValue;
        return Math.floor(minValue + ((1 - percentMagnitude) * range));
    }
  }
  
  customElements.define("stockview-treemap", TreeMap);
  