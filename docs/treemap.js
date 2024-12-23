export class TreeMap extends HTMLElement {
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
    }

    update() {
        if (!this.root || !this.positions) {
            return;
        }
        this.root.innerHTML = '';
        const rect = this.getBoundingClientRect();
        const absoluteMaximum = Math.max(...this.positions.map(x => Math.abs(x.daysChangePercent)));
        this.layout_bisect(this.root, 100, rect.width, rect.height, this.positions, absoluteMaximum);
    }

    layout_bisect(container, containerPercent, containerWidth, containerHeight, positions, absoluteChangeMaximum, n=0) {
        const calculatedPercent = positions.reduce(((a, x) => a + x.percentOfPortfolio), 0);
        console.log(n, containerWidth, containerHeight, containerPercent, calculatedPercent);
        if (positions.length === 0) {
            return;
        }
        if (positions.length === 1) {
            this.configureLeaf(container, positions[0], absoluteChangeMaximum);
            return;
        }
        container.classList.add('container');
        const horizontal = containerWidth >= containerHeight;

        const splitIndex = Math.floor(positions.length / 2);
        const div1Positions = positions.slice(0, splitIndex);
        const div2Positions = positions.slice(splitIndex);
        const div1Percent = div1Positions.reduce(((a, x) => a + x.percentOfPortfolio), 0);
        const div2Percent = containerPercent - div1Percent;
        const proportions = `${div1Percent}fr ${div2Percent}fr`;
        let div1Width, div1Height, div2Width, div2Height;
        if (horizontal) {
            container.style.gridTemplateColumns = proportions;
            div1Width = containerWidth * div1Percent / containerPercent;
            div1Height = containerHeight;
            div2Width = containerWidth - div1Width;
            div2Height = containerHeight;
        } else {
            container.style.gridTemplateRows = proportions;
            div1Width = containerWidth;
            div1Height = containerHeight * div1Percent / containerPercent;
            div2Width = containerWidth;
            div2Height = containerHeight - div1Height;
        }
        const div1 = document.createElement('div');
        const div2 = document.createElement('div');
        container.appendChild(div1);
        container.appendChild(div2);
        if (horizontal) {
            div1.style.gridColumnStart = 1;
            div2.style.gridColumnStart = 2;
        } else {
            div1.style.gridRowStart = 1;
            div2.style.gridRowStart = 2;
        }
        this.layout_bisect(div1, div1Percent, div1Width, div1Height, div1Positions, absoluteChangeMaximum, n+1);
        this.layout_bisect(div2, div2Percent, div2Width, div2Height, div2Positions, absoluteChangeMaximum, n+1);
    }

    configureLeaf(div, position, absoluteChangeMaximum) {
        div.classList.add('leaf');
        div.style.backgroundColor = this.getPositionColor(position.daysChangePercent, absoluteChangeMaximum);
        div.innerHTML = `${position.symbol}<br>${position.percentOfPortfolio}<br>${position.daysChangePercent.toFixed(2)}%`; 
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
  