class TestNavigationComponent extends HTMLElement {
  constructor() {
      super()
      this.shadow = this.attachShadow({ mode: "open" })
  }

  connectedCallback() {
      this.shadow.innerHTML = `
          <style>
              :host {
                display: block;
                border: 1px dotted #900
              }
          </style>
          <div class="component">Hello World!</div>
      `
  }
}

customElements.define('test-navigation', TestNavigationComponent)
