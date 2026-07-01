class BundleSelectorWidget extends HTMLElement {
  constructor() {
    super();
    this._initialized = false;
    this.boundHandleCurrencyChange = this.handleCurrencyChange.bind(this);
    this.boundVariantSelectChange = this.boundVariantSelectChange.bind(this);
  }

  connectedCallback() {
    if (this._initialized) return;
    window.sym.bundleWidget = this;
    this._initialized = true;

    this.container = this.querySelector('.bundle-selector');
    if (!this.container) return;

    this.popularIndexs = parseInt(this.container.dataset.popular_indexs || '2', 10);
    this.specification = this.container.dataset.specification || '';
    this.tiers = JSON.parse(this.container.dataset.tiers || '[]');
    this.variantFlag = parseInt(this.container.dataset.variantFlag || '0', 10);
    this.tierContainer = this.container.querySelector('#bundle-tier-options');
    this.variantSelect = this.container.querySelector('.bundle-single-select');

    if (!this.tierContainer || !this.variantSelect) return;

    this.variantSelect.addEventListener('change', this.boundVariantSelectChange);

    document.addEventListener('currency:change', this.boundHandleCurrencyChange);
    document.addEventListener('currencyChanged', this.boundHandleCurrencyChange);
    document.addEventListener('shopify:currency:change', this.boundHandleCurrencyChange);
    document.addEventListener('shopify:currencyChanged', this.boundHandleCurrencyChange);

    this.renderTiers();

    if (this.tiers.some((tier) => tier.minQuantity === 1)) {
      const singleEl = this.container.querySelector('.bundle-option[data-qty="1"]');
      if (singleEl) {
        singleEl.style.display = 'none';
        const tierRadio = this.container.querySelector('#bundle-tier-options .bundle-option[data-qty="1"] input[type="radio"]');
        if (tierRadio) tierRadio.checked = true;
      }
    }

    this.updateSinglePrice();
    this.updateAllTierPrices();
    this.updateAllAvailability();
    this.handleCurrencyChange();
  }

  disconnectedCallback() {
    this.variantSelect?.removeEventListener('change', this.boundVariantSelectChange);
    document.removeEventListener('currency:change', this.boundHandleCurrencyChange);
    document.removeEventListener('currencyChanged', this.boundHandleCurrencyChange);
    document.removeEventListener('shopify:currency:change', this.boundHandleCurrencyChange);
    document.removeEventListener('shopify:currencyChanged', this.boundHandleCurrencyChange);
  }

  mergeTiers(rawTiers, basePrice) {
    const map = new Map();
    rawTiers.forEach((tier) => {
      const key = `${tier.minQuantity}-${tier.type || 'percentage'}`;
      const val = parseFloat(tier.value);
      if (!map.has(key) || val > parseFloat(map.get(key).value)) {
        map.set(key, { ...tier });
      }
    });

    const byQty = new Map();
    for (const tier of map.values()) {
      const existing = byQty.get(tier.minQuantity);
      if (!existing) {
        byQty.set(tier.minQuantity, tier);
        continue;
      }

      const existingSavings = existing.type === 'fixed_amount'
        ? parseFloat(existing.value) * 100 * existing.minQuantity
        : basePrice * existing.minQuantity * (parseFloat(existing.value) / 100);
      const tierSavings = tier.type === 'fixed_amount'
        ? parseFloat(tier.value) * 100 * tier.minQuantity
        : basePrice * tier.minQuantity * (parseFloat(tier.value) / 100);

      if (tierSavings > existingSavings) {
        byQty.set(tier.minQuantity, tier);
      }
    }

    return Array.from(byQty.values()).sort((a, b) => a.minQuantity - b.minQuantity);
  }

  getSelectPrice(select) {
    const selected = select.options[select.selectedIndex];
    return parseInt(selected?.dataset.price || '0', 10);
  }

  getCurrencyCode() {
    return this.container.dataset.currencyCode || (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || 'USD';
  }

  updateCurrencyCode(code) {
    if (!code) return;
    this.container.dataset.currencyCode = code;
  }

  buildVariantSelects(qty) {
    const optionsHtml = Array.from(this.variantSelect.options)
      .map((opt) => `
          <option value="${opt.value}" data-price="${opt.dataset.price}" data-available="${opt.dataset.available}" ${opt.disabled ? 'disabled' : ''} ${opt.value === this.variantSelect.value ? 'selected' : ''}>
            ${opt.text}
          </option>`)
      .join('');

    return Array.from({ length: qty }, (_, index) => `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
          <span class="bundle-option-index" style="display: ${qty === 1 ? 'none' : 'block'};">#${index + 1}</span>
          <div class="variant-select-wrapper">
            <select class="bundle-tier-select variant-select" data-index="${index + 1}">
              ${optionsHtml}
            </select>
            <div class="variant-availability-message"></div>
          </div>
        </div>`).join('');
  }

  formatMoney(cents) {
    const currency = this.getCurrencyCode();
    const amount = (cents / 100).toFixed(2);
    const currencySymbols = {
      USD: '$',
      CAD: '$',
      AUD: '$',
      NZD: '$',
      HKD: '$',
      SGD: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥',
      CNY: '¥',
      SEK: 'kr',
      NOK: 'kr',
      DKK: 'kr',
      CHF: 'CHF',
      KRW: '₩',
      INR: '₹',
    };

    if (currencySymbols[currency]) {
      return `${currencySymbols[currency]}${amount}`;
    }

    try {
      const formatted = new Intl.NumberFormat(navigator.language || 'en-US', {
        style: 'currency',
        currency,
        currencyDisplay: 'symbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(cents / 100);
      return formatted.replace(/\s*([A-Z]{2,3})\s*/g, '').trim();
    } catch (error) {
      return `${currency} ${amount}`;
    }
  }

  updateSinglePrice() {
    const priceEl = this.container.querySelector('.bundle-option[data-qty="1"] .bundle-price');
    if (!priceEl) return;
    priceEl.textContent = this.formatMoney(this.getSelectPrice(this.variantSelect));
  }

  updateTierPrice(label) {
    const tierSelects = Array.from(label.querySelectorAll('.bundle-tier-select'));
    const originalTotal = tierSelects.reduce((sum, select) => sum + this.getSelectPrice(select), 0);
    const discountValue = parseFloat(label.dataset.discountValue || '0');
    const discountType = label.dataset.discountType || 'percentage';

    let discountedTotal;
    let savedAmount;

    if (discountType === 'fixed_amount') {
      const qty = tierSelects.length;
      const discountCents = discountValue * 100 * qty;
      discountedTotal = Math.max(0, originalTotal - discountCents);
      savedAmount = originalTotal - discountedTotal;
    } else {
      discountedTotal = Math.round(originalTotal * (1 - discountValue / 100));
      savedAmount = originalTotal - discountedTotal;
    }

    label.querySelector('.bundle-price').textContent = this.formatMoney(discountedTotal);
    label.querySelector('.bundle-original-price').textContent = this.formatMoney(originalTotal);
    const saveBadge = label.querySelector('.bundle-save-badge');
    if (saveBadge) {
      saveBadge.textContent = `SAVE ${this.formatMoney(savedAmount)}`;
    }
  }

  isOptionAvailable(option) {
    return option && (option.dataset.available === 'true' || option.dataset.available === true);
  }

  updateAvailability(select) {
    const option = select.options[select.selectedIndex];
    const wrapper = select.closest('div');
    const messageEl = wrapper?.querySelector('.variant-availability-message');
    const selectWrapper = select.closest('.variant-select-wrapper');

    if (!messageEl) return;

    if (!this.isOptionAvailable(option)) {
      messageEl.textContent = 'Sorry, This variant is sold out, please choose another option.';
      if (selectWrapper) selectWrapper.classList.add('unavailable');
    } else {
      messageEl.textContent = '';
      if (selectWrapper) selectWrapper.classList.remove('unavailable');
    }
  }

  updateAllAvailability() {
    this.updateAvailability(this.variantSelect);
    Array.from(this.container.querySelectorAll('.bundle-tier-select')).forEach((select) => this.updateAvailability(select));
  }

  /**
   * 为标签中的所有层级选择器添加事件监听器
   * @param {HTMLElement} label - 包含层级选择器的DOM元素
   */
  attachTierSelectListeners(label) {
    Array.from(label.querySelectorAll('.bundle-tier-select')).forEach((select) => {
      select.addEventListener('change', () => {
        this.updateTierPrice(label);
        this.updateAvailability(select);
      });
    });
  }

  renderTiers() {
    this.tierContainer.innerHTML = '';

    const tierNames = ['', 'Single', 'Duo', 'Trio', 'Quad'];
    const hasQty1Tier = this.tiers.some((tier) => tier.minQuantity === 1);
    const popularIndex = (this.popularIndexs - 2) + (hasQty1Tier ? 1 : 0);
    const basePrice = this.getSelectPrice(this.variantSelect);
    const mergedTiers = this.mergeTiers(this.tiers, basePrice);

    mergedTiers.forEach((tier, index) => {
      const qty = tier.minQuantity;
      const discountValue = parseFloat(tier.value);
      const discountType = tier.type || 'percentage';
      const originalTotal = basePrice * qty;

      let discountedTotal;
      let savedAmount;
      if (discountType === 'fixed_amount') {
        const discountCents = discountValue * 100 * qty;
        discountedTotal = Math.max(0, originalTotal - discountCents);
        savedAmount = originalTotal - discountedTotal;
      } else {
        discountedTotal = Math.round(originalTotal * (1 - discountValue / 100));
        savedAmount = originalTotal - discountedTotal;
      }

      const name = tierNames[qty] || `${qty} Pack`;
      const isPopular = index === popularIndex;

      const label = document.createElement('label');
      label.className = 'bundle-option';
      label.dataset.qty = qty;
      label.dataset.discountValue = discountValue;
      label.dataset.discountType = discountType;
      label.style.marginTop = '12px';
      label.innerHTML = `
          <div class="bundle-left">
            <div class="bundle-option-content">
              <input class="yx-option__radio" style="width: 20px; height: 20px;" type="radio" name="bundle-qty" value="${qty}">
              <div>
                <div class="bundle-name">
                  <span>${name}</span>
                  <span class="bundle-save-badge">SAVE ${this.formatMoney(savedAmount)}</span>
                </div>
                <div class="bundle-desc">${discountType === 'fixed_amount' ? `Save ${this.formatMoney(discountValue * 100)} off each` : `save ${discountValue}% off`}</div>
              </div>
            </div>
            <div class="bundle-variant" style="--variant-height: ${this.variantFlag ? (qty * 44 + 22 + 'px') : 0}; --variant-margin-top: ${this.variantFlag ? '8px' : '0'}; --variant-qty: ${qty * 0.05 + 0.1}s;">
              <div class="variant-specification">${this.specification}</div>
              ${this.buildVariantSelects(qty)}
            </div>
          </div>
          <div class="bundle-right">
            <div class="bundle-price">${this.formatMoney(discountedTotal)}</div>
            <div class="bundle-original-price">${this.formatMoney(originalTotal)}</div>
          </div>
          ${isPopular ? '<div class="popular-badge">Most Popular</div>' : ''}`;

      this.tierContainer.appendChild(label);
      this.attachTierSelectListeners(label);
    });
  }

  generateBid(number, salt = 'my_secret_key') {
    let str = number.toString() + salt;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }

    hash = Math.abs(hash);
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let bid = '';
    for (let i = 0; i < 4; i++) {
      bid += charset[hash % 64];
      hash = Math.floor(hash / 64);
    }
    return bid;
  }

  updateAllTierPrices() {
    const tierLabels = Array.from(this.container.querySelectorAll('.bundle-option')).filter((label) => label.dataset.qty !== '1');
    tierLabels.forEach((label) => this.updateTierPrice(label));
  }

  handleCurrencyChange(event) {
    const newCurrency = event?.detail?.currency || (window.Shopify && window.Shopify.currency && window.Shopify.currency.active);
    if (newCurrency) {
      this.updateCurrencyCode(newCurrency);
      this.updateSinglePrice();
      this.updateAllTierPrices();
      this.updateAllAvailability();
    }
  }

  boundVariantSelectChange() {
    this.updateSinglePrice();
    this.updateAllTierPrices();
    this.updateAvailability(this.variantSelect);
    this.updateAllAvailability();
  }

  getBundleSelectedVariants() {
    const selectedRadio = this.container.querySelector('input[name="bundle-qty"]:checked');
    const selectedQty = parseInt(selectedRadio?.value || '1', 10);
    const selectedLabel = selectedRadio?.closest('.bundle-option');

    if (!selectedLabel) return [];

    if (selectedQty === 1 && selectedLabel.dataset.qty === '1') {
      return [{
        id: parseInt(this.variantSelect.value, 10),
        quantity: 1,
        properties: {
          _yx_bundles: JSON.stringify({ deal: 'VIR1', main: true, bid: this.generateBid(selectedLabel.dataset.qty) })
        }
      }];
    }

    const tierSelects = Array.from(selectedLabel.querySelectorAll('.bundle-tier-select'));
    return tierSelects.map((select) => ({
      id: parseInt(select.value, 10),
      quantity: 1,
      properties: {
        _yx_bundles: JSON.stringify({ deal: 'VIR1', main: true, bid: this.generateBid(selectedLabel.dataset.qty) + this.generateBid(selectedLabel.dataset.discountValue) + this.generateBid(selectedLabel.dataset.discountType) })
      }
    }));
  }
}

if (!customElements.get('bundle-selector-widget')) {
  customElements.define('bundle-selector-widget', BundleSelectorWidget);
}
