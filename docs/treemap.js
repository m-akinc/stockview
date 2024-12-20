export class TreeMap extends HTMLElement {
    //static observedAttributes = ["color", "size"];
    resizeObserver = new ResizeObserver(this.onResize);
  
    constructor() {
        super();
    }
  
    connectedCallback() {
        const shadow = this.attachShadow({ mode: "open" });
        const root = document.createElement("div");
        
        const linkElem = document.createElement("link");
        linkElem.setAttribute("rel", "stylesheet");
        linkElem.setAttribute("href", "treemap.css");

        shadow.appendChild(linkElem);
        shadow.appendChild(root);

        this.resizeObserver.observe(this);
    }
  
    disconnectedCallback() {
        this.resizeObserver.disconnect();
    }
  
    // attributeChangedCallback(name, oldValue, newValue) {
    //   console.log(`Attribute ${name} has changed.`);
    // }

    onResize(entries) {
        for (const entry of entries) {
            if (entry.contentBoxSize) {
                const newSize = entry.contentBoxSize[0];
                console.log('content box resize', newSize);
            }
        }
    }
  }
  
  customElements.define("treemap", TreeMap);
  