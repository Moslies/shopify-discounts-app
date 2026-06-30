class subscriptionCustomElement extends HTMLElement {
    
}

if (!customElements.get('subscription-block')) {
  customElements.define('subscription-block', subscriptionCustomElement);
}