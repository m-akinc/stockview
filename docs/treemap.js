export class TreeMap extends HTMLElement {
    //static observedAttributes = ["color", "size"];
    resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            if (entry.contentBoxSize) {
                const newSize = entry.contentBoxSize[0];
                console.log('content box resize', newSize);
                this.update();
            }
        }
    });
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
  
    // attributeChangedCallback(name, oldValue, newValue) {
    //   console.log(`Attribute ${name} has changed.`);
    // }

    update() {
        this.root.innerHTML = '';
        const absoluteMaximum = Math.max(...this.positions.map(x => Math.abs(x.daysChangePercent)));
        this.layout(this.root, 100, this.positions, absoluteMaximum);
    }

    layout(container, containerPercent, positions, absoluteChangeMaximum) {
        if (positions.length === 0) {
            return;
        }
        const largest = positions[0];
        const largestAsPercentOfContainer = largest.percentOfPortfolio / containerPercent;
        const rect = container.getBoundingClientRect();
        if (rect.width >= rect.height) {
            container.classList.remove('tall');
        } else {
            container.classList.add('tall');
        }
        const largestDiv = document.createElement('div');
        const restDiv = document.createElement('div');
        largestDiv.style.flexBasis = `${largestAsPercentOfContainer}%`;
        largestDiv.style.backgroundColor = this.getPositionColor(largest.daysChangePercent, absoluteChangeMaximum);
        container.appendChild(largestDiv);
        container.appendChild(restDiv);
        this.layout(restDiv, containerPercent - (100 - largestAsPercentOfContainer), positions.shift());
    }

    getPositionColor(percentChange, absMaximum) {
        const rangeMax = Math.max(absMaximum, 15);
        let r, g, b;
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
  }
  
  customElements.define("stockview-treemap", TreeMap);
  