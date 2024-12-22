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
        const absoluteMaximum = Math.max(...this.positions.map(x => Math.abs(x.daysChangePercent)));
        this.layout(this.root, 100, this.positions, absoluteMaximum);
    }

    layout(container, containerPercent, positions, absoluteChangeMaximum) {
        if (positions.length === 0) {
            return;
        }
        const rect = container.getBoundingClientRect();
        let smallerDimension, largerDimension;
        if (rect.width >= rect.height) {
            smallerDimension = rect.height;
            largerDimension = rect.width;
            container.classList.remove('tall');
        } else {
            smallerDimension = rect.width;
            largerDimension = rect.height;
            container.classList.add('tall');
        }
        const divisions = Math.round(largerDimension / smallerDimension);
        console.log(largerDimension, smallerDimension, divisions);
        if (divisions > 1) {
            const targetPercent = containerPercent / divisions;
            let positionIndex = 0;
            const blocks = [...Array(divisions).keys()].map(x => document.createElement('div'));
            for (const div of blocks) {
                container.appendChild(div);
                let blockPercent = 0;
                const blockPositions = [];
                for (; positionIndex < positions.length && blockPercent < targetPercent; positionIndex += 1) {
                    blockPositions.push(positions[positionIndex]);
                    blockPercent += positions[positionIndex].percentOfPortfolio;
                }
                const divPercentOfContainer = 100 * blockPercent / containerPercent;
                div.style.flexBasis = `${divPercentOfContainer}%`;
                this.layout(div, blockPercent, blockPositions, absoluteChangeMaximum);
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
        this.layout(restDiv, containerPercent * (1 - (largestAsPercentOfContainer / 100)), positions, absoluteChangeMaximum);
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
  