export class TreeMap extends HTMLElement {
    resizeObserver = new ResizeObserver(this.update);
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
        if (!this.root || !this.positions) {
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
        console.log(n, containerWidth, containerHeight, containerPercent);
        container.classList.add('container');
        let horizontal, numDivisions;
        if (containerWidth >= containerHeight) {
            horizontal = true;
            //numDivisions = Math.round(containerWidth / containerHeight);
        } else {
            horizontal = false;
            //numDivisions = Math.round(containerHeight / containerWidth);
        }

        if (positions.length > 6) {
            const div1 = document.createElement('div');
            const div2 = document.createElement('div');
            div1.classList.add('container');
            div2.classList.add('container');
            if (horizontal) {
                div1.style.gridColumnStart = 1;
                div2.style.gridColumnStart = 2;
            } else {
                div1.style.gridRowStart = 1;
                div2.style.gridRowStart = 2;
            }
            container.appendChild(div1);
            container.appendChild(div2);

            const div1Positions = positions.slice(0, 6);
            const div2Positions = positions.slice(6);
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
            this.layout(div1, div1Percent, div1Width, div1Height, div1Positions, absoluteChangeMaximum, n+1);
            this.layout(div2, div2Percent, div2Width, div2Height, div2Positions, absoluteChangeMaximum, n+1);
            return;
        }

        // if (numDivisions > 1) {
        //     const blocks = [];
        //     const targetPercent = containerPercent / numDivisions;
        //     let positionIndex = 0;
        //     for (let i = 1; i <= numDivisions; i += 1) {
        //         const div = document.createElement('div');
        //         div.classList.add('container');
        //         if (horizontal) {
        //             div.style.gridColumnStart = i;
        //         } else {
        //             div.style.gridRowStart = i;
        //         }
        //         container.appendChild(div);
        //         // Pick positions that will go in this block and calculate percent of container
        //         let percent = 0;
        //         const blockPositions = [];
        //         for (; positionIndex < positions.length && percent < targetPercent; positionIndex += 1) {
        //             blockPositions.push(positions[positionIndex]);
        //             percent += positions[positionIndex].percentOfPortfolio;
        //         }
        //         blocks.push({
        //             div,
        //             percent,
        //             positions: blockPositions
        //         })
        //     }
        //     const proportions = blocks.map(x => `${x.percent}fr`).join(' ');
        //     if (horizontal) {
        //         container.style.gridTemplateColumns = proportions;
        //     } else {
        //         container.style.gridTemplateRows = proportions;
        //     }
        //     if (n <= 10) {
        //         for (const block of blocks) {
        //             let blockWidth, blockHeight;
        //             if (horizontal) {
        //                 blockWidth = containerWidth * block.percent / containerPercent;
        //                 blockHeight = containerHeight;
        //             } else {
        //                 blockWidth = containerWidth;
        //                 blockHeight = containerHeight * block.percent / containerPercent;
        //             }
        //             this.layout(block.div, block.percent, blockWidth, blockHeight, block.positions, absoluteChangeMaximum, n+1);
        //         }
        //     }
        //     return;
        // }
        positions = [...positions];
        const largest = positions.shift();
        const largestAsPercentOfContainer = largest.percentOfPortfolio / containerPercent;
        const proportions = `${largest.percentOfPortfolio}fr ${containerPercent - largest.percentOfPortfolio}fr`;
        if (horizontal) {
            container.style.gridTemplateColumns = proportions;
        } else {
            container.style.gridTemplateRows = proportions;
        }
        
        const largestDiv = document.createElement('div');
        const restDiv = document.createElement('div');
        largestDiv.classList.add('leaf');
        largestDiv.style.backgroundColor = this.getPositionColor(largest.daysChangePercent, absoluteChangeMaximum);
        largestDiv.innerHTML = `${largest.symbol}<br>${largest.percentOfPortfolio}<br>${largest.daysChangePercent.toFixed(2)}%`; 
        if (horizontal) {
            largestDiv.style.gridColumnStart = 1;
            restDiv.style.gridColumnStart = 2;
        } else {
            largestDiv.style.gridRowStart = 1;
            restDiv.style.gridRowStart = 2;
        }
        container.appendChild(largestDiv);
        container.appendChild(restDiv);
        //if (n <= 10) {
            const restPercent = 1 - largestAsPercentOfContainer;
            let restWidth, restHeight;
            if (horizontal) {
                restWidth = containerWidth * restPercent;
                restHeight = containerHeight;
            } else {
                restWidth = containerWidth;
                restHeight = containerHeight * restPercent;
            }
            this.layout(restDiv, containerPercent * restPercent, restWidth, restHeight, positions, absoluteChangeMaximum, n+1);
        //}
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
  