class SubscriptionSelectorWidget extends HTMLElement {
  constructor() {
    super();
    this._initialized = false;
  }

  connectedCallback() {
    if (this._initialized) return;
    window.sym.subscriptionWidget = this;
    this._initialized = true;

    this.container = this.querySelector('.yx-subscription-container') || this;
    this.cards = this.container.querySelectorAll('.yx-sub-card');
    this.deliveryBtns = this.container.querySelectorAll('.yx-delivery-btn');
    this.purchaseRadios = this.container.querySelectorAll('[data-purchase-type]');
    this.planHiddens = this.container.querySelectorAll('.yx-selling-plan-hidden');
    this.saveRateEls = this.container.querySelectorAll('.yx-sub-save-rate');
    this.saveBenefitEls = this.container.querySelectorAll('.yx-sub-save-benefit');

    this.attachEventListeners();
    this.initState();
  }

  attachEventListeners() {
    this.deliveryBtns.forEach((btn) => {
      btn.addEventListener('click', (event) => this.handleDeliveryButtonClick(event, btn));
    });
  }

  initState() {
    this.saveBenefitEls.forEach((el) => {
      el.style.display = 'none';
    });
  }

  updateSaveRate(discountRate) {
    const value = parseFloat(discountRate || 0);
    const percent = Number.isFinite(value) ? Math.round(value) : 0;

    this.saveRateEls.forEach((el) => {
      const benefit = el.closest('.yx-sub-benefit');
      if (percent > 0) {
        el.textContent = `Save ${percent}%`;
        if (benefit) benefit.style.display = '';
      } else {
        el.textContent = '';
        if (benefit) benefit.style.display = 'none';
      }
    });
  }

  handleDeliveryButtonClick(event, btn) {
    event.stopPropagation();

    const isSelected = btn.classList.contains('selected');
    const planId = btn.dataset.planId;
    const groupId = btn.dataset.planGroupId;
    const discountRate = btn.dataset.discountRate;
    const planName = btn.dataset.planName;

    if (isSelected) {
      this.deliveryBtns.forEach((b) => b.classList.remove('selected'));
      this.cards.forEach((card) => card.classList.remove('selected'));
      this.purchaseRadios.forEach((radio) => {
        radio.checked = false;
      });
      this.planHiddens.forEach((hidden) => {
        if (hidden.dataset.planGroupId === groupId) hidden.value = '';
      });
      this.updateSaveRate(0);
      return;
    }

    this.updateCardSelection('subscription', {
      planId,
      groupId,
      discountRate,
      planName,
    });
    this.updateSaveRate(discountRate);

    this.deliveryBtns.forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
  }

  updateCardSelection(type, planData) {
    if (type !== 'subscription' || !planData) return;

    const groupId = planData.groupId;
    this.cards.forEach((card) => {
      card.classList.remove('selected');
    });

    const targetCard = Array.from(this.cards).find((card) => {
      const btn = card.querySelector(`.yx-delivery-btn[data-plan-group-id="${groupId}"]`);
      return btn !== null;
    });

    if (targetCard) {
      targetCard.classList.add('selected');
    }

    this.purchaseRadios.forEach((radio) => {
      radio.checked = (radio.dataset.purchaseType === 'subscription' && radio.dataset.planGroupId === groupId);
    });

    this.planHiddens.forEach((hidden) => {
      if (hidden.dataset.planGroupId === groupId) {
        hidden.value = planData.planId;
      }
    });
  }

  getSelectedSellingPlan() {
    const selectedButton = this.querySelector('.yx-delivery-btn.selected');
    return selectedButton?.dataset?.planId || '';
  }
}

if (!customElements.get('subscription-selector-widget')) {
  customElements.define('subscription-selector-widget', SubscriptionSelectorWidget);
}
