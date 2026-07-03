class SubscriptionSelectorWidget extends HTMLElement {
  constructor() {
    super();
    this._initialized = false;
    this.boundHandleDeliveryClick = this.handleDeliveryButtonClick.bind(this);
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

    // this.mergeDuplicatePlans();
    this.attachEventListeners();
    this.initState();
  }

  // 重复计划解决方案
  mergeDuplicatePlans() {
    const buttons = Array.from(this.container.querySelectorAll('.yx-delivery-btn'));
    const uniqueButtons = new Map();

    buttons.forEach((btn) => {
      const interval = (btn.dataset.interval || '').trim().toLowerCase();
      if (!interval) {
        return;
      }

      const existing = uniqueButtons.get(interval);
      const currentDiscount = parseFloat(btn.dataset.discountRate || '0');

      if (!existing) {
        uniqueButtons.set(interval, btn);
        return;
      }

      const existingDiscount = parseFloat(existing.dataset.discountRate || '0');
      if (currentDiscount > existingDiscount) {
        existing.remove();
        uniqueButtons.set(interval, btn);
      } else {
        btn.remove();
      }
    });

    this.deliveryBtns = this.container.querySelectorAll('.yx-delivery-btn');
    this.purchaseRadios = this.container.querySelectorAll('[data-purchase-type]');
    this.planHiddens = this.container.querySelectorAll('.yx-selling-plan-hidden');
  }

  attachEventListeners() {
    this.deliveryBtns.forEach((btn) => {
      btn.addEventListener('click', this.boundHandleDeliveryClick);
    });
  }

  disconnectedCallback() {
    this.deliveryBtns.forEach((btn) => {
      btn.removeEventListener('click', this.boundHandleDeliveryClick);
    });
  }

  initState() {
    this.saveBenefitEls.forEach((el) => {
      el.style.display = 'none';
    });
  }
  updateTitle(percent, isSelected) {
    const title = this.querySelector('.yx-sub-card__title-text')
    if (isSelected) return title.textContent = 'SUBSCRIBE & SAVE';
    if (percent > 0) {
      title.textContent = 'SUBSCRIBE & SAVE';
    } else {
      title.textContent = 'SUBSCRIBE';
    }
  }
  updateSaveRate(discountRate, isSelected = false) {
    const value = parseFloat(discountRate || 0);
    const percent = Number.isFinite(value) ? Math.round(value) : 0;
    this.updateTitle(percent, isSelected)
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

  handleDeliveryButtonClick(event) {
    event.stopPropagation();
    const btn = event.currentTarget;

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
      this.updateSaveRate(0, isSelected);
      // 清除选中状态
      this.subscriptionChangeEvent({planId: '', groupId, discountRate: 0});
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
    this.subscriptionChangeEvent({planId, groupId, discountRate});
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

  subscriptionChangeEvent(detail) {
    console.log('detail', detail)
    document.dispatchEvent(new CustomEvent('subscription:change', { detail }));
  }
}

if (!customElements.get('subscription-selector-widget')) {
  customElements.define('subscription-selector-widget', SubscriptionSelectorWidget);
}
