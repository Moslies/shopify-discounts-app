class BundleSelectorWidget extends HTMLElement {
  constructor() {
    super();
    this._initialized = false;
    this.subscriptionDiscount = 0;
    this.boundHandleCurrencyChange = this.handleCurrencyChange.bind(this);
    this.boundVariantSelectChange = this.boundVariantSelectChange.bind(this);
    this.boundSubscriptionChange = this.handleSubscriptionChange.bind(this);
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
    this.compareAtPrice = parseInt(this.container.dataset['compare_at_price'] || '0', 10);
    this.basePrice = parseInt(this.container.dataset.basePrice || '0', 10);
    this.tierContainer = this.container.querySelector('#bundle-tier-options');
    this.variantSelect = this.container.querySelector('.bundle-single-select');

    if (!this.tierContainer || !this.variantSelect) return;

    this.variantSelect.addEventListener('change', this.boundVariantSelectChange);

    document.addEventListener('currency:change', this.boundHandleCurrencyChange);
    document.addEventListener('currencyChanged', this.boundHandleCurrencyChange);
    document.addEventListener('shopify:currency:change', this.boundHandleCurrencyChange);
    document.addEventListener('shopify:currencyChanged', this.boundHandleCurrencyChange);

    this.renderTiers();
    this.boundBundleOptionChange = this.handleBundleOptionChange.bind(this);
    this.tierContainer.addEventListener('change', this.boundBundleOptionChange);

    this.updateSinglePrice();
    this.updateAllTierPrices();
    this.updateAllAvailability();
    this.handleCurrencyChange();
    this.toggleSubscribeItems();
    document.addEventListener('subscription:change', this.boundSubscriptionChange);
  }

  disconnectedCallback() {
    this.variantSelect?.removeEventListener('change', this.boundVariantSelectChange);
    this.tierContainer?.removeEventListener('change', this.boundBundleOptionChange);
    document.removeEventListener('currency:change', this.boundHandleCurrencyChange);
    document.removeEventListener('currencyChanged', this.boundHandleCurrencyChange);
    document.removeEventListener('shopify:currency:change', this.boundHandleCurrencyChange);
    document.removeEventListener('shopify:currencyChanged', this.boundHandleCurrencyChange);
    document.removeEventListener('subscription:change', this.boundSubscriptionChange);
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

  getBundleBasePrice() {
    // 返回商品的基础售价（sale price），优先使用 data-base-price，再回退到 select 上的价格
    return this.basePrice > 0 ? this.basePrice : this.getSelectPrice(this.variantSelect);
  }

  getProductDiscount() {
    if (this.compareAtPrice > this.basePrice) {
      return Math.round(((this.compareAtPrice - this.basePrice) / this.compareAtPrice) * 100);
    }
    return 0;
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

  updateSaveBadge(saveBadge, amount) {
    if (!saveBadge) return;
    const amountEl = saveBadge.querySelector('strong');
    if (amountEl) {
      amountEl.textContent = this.formatMoney(amount);
    } else {
      saveBadge.textContent = `You Save ${this.formatMoney(amount)}`;
    }
  }

  updateSinglePrice() {
    const priceEl = this.container.querySelector('.bundle-option[data-qty="1"] .bundle-price');
    if (!priceEl) return;
    // 使用当前选中的规格价格作为基础售卖价
    const selectedBase = this.getSelectPrice(this.variantSelect);
    let bundlePrice = selectedBase;
    const subDiscount = parseFloat(this.subscriptionDiscount || 0);
    if (subDiscount > 0) {
      bundlePrice = Math.round(bundlePrice * (1 - subDiscount / 100));
    }
    priceEl.textContent = this.formatMoney(bundlePrice);

    const label = priceEl.closest('.bundle-option');
    if (label) {
      const crossedOriginal = this.compareAtPrice > 0 ? this.compareAtPrice : selectedBase;
      const totalSaved = crossedOriginal - bundlePrice;
      const saveBadge = label.querySelector('.bundle-save-badge');
      const originalPriceEl = label.querySelector('.bundle-original-price');
      if (saveBadge) {
        if (totalSaved > 0) {
          this.updateSaveBadge(saveBadge, totalSaved);
          saveBadge.style.display = '';
        } else {
          saveBadge.style.display = 'none';
        }
      }
      if (originalPriceEl) {
        originalPriceEl.style.display = totalSaved > 0 ? '' : 'none';
        originalPriceEl.textContent = this.formatMoney(crossedOriginal);
      }

      // 更新 product-discount 文案（基于当前选中规格）
      const productDiscountEl = label.querySelector('.product-discount');
      if (productDiscountEl) {
        const productDiscountPercent = this.compareAtPrice > selectedBase
          ? Math.round(((this.compareAtPrice - selectedBase) / this.compareAtPrice) * 100)
          : 0;
        productDiscountEl.style.display = productDiscountPercent > 0 ? '' : 'none';
        productDiscountEl.textContent = productDiscountPercent > 0 ? `On sale ${productDiscountPercent}% OFF` : '';
      }
    }
    this.updateSubscribePrice(label);
  }

  updateTierPrice(label) {
    const tierSelects = Array.from(label.querySelectorAll('.bundle-tier-select'));
    const qty = tierSelects.length;

    // baseTotal: 使用每个已选择规格的价格求和（支持不同规格价格不同）
    let baseTotal = 0;
    if (tierSelects.length > 0) {
      baseTotal = tierSelects.reduce((sum, select) => sum + this.getSelectPrice(select), 0);
    } else {
      baseTotal = this.getBundleBasePrice() * qty;
    }
    // originalCrossed: 如果存在 compareAtPrice 则显示为原价，总和为 compareAtPrice * qty
    const originalCrossed = this.compareAtPrice > 0 ? this.compareAtPrice * qty : baseTotal;

    const discountValue = parseFloat(label.dataset.discountValue || '0');
    const discountType = label.dataset.discountType || 'percentage';

    let discountedTotal;

    if (discountType === 'fixed_amount') {
      const discountCents = discountValue * 100 * qty;
      discountedTotal = Math.max(0, baseTotal - discountCents);
    } else {
      discountedTotal = Math.round(baseTotal * (1 - discountValue / 100));
    }

    // 叠加订阅折扣（bundle-price 应包含订阅折扣）
    const subDiscount = parseFloat(this.subscriptionDiscount || 0);
    if (subDiscount > 0) {
      discountedTotal = Math.round(discountedTotal * (1 - subDiscount / 100));
    }

    // discountedTotal 为捆绑后的售价（包含订阅折扣，如果存在）

    label.querySelector('.bundle-price').textContent = this.formatMoney(discountedTotal);
    label.querySelector('.bundle-original-price').textContent = this.formatMoney(originalCrossed);
    const totalSaved = originalCrossed - discountedTotal;
    const saveBadge = label.querySelector('.bundle-save-badge');
    if (saveBadge) {
      if (totalSaved > 0) {
        this.updateSaveBadge(saveBadge, totalSaved);
        saveBadge.style.display = '';
      } else {
        saveBadge.style.display = 'none';
      }
    }
    const originalPriceEl = label.querySelector('.bundle-original-price');
    if (originalPriceEl) {
      originalPriceEl.style.display = totalSaved > 0 ? '' : 'none';
    }

    // 更新 product-discount（基于当前每个规格的售卖价平均）
    const productDiscountEl = label.querySelector('.product-discount');
    if (productDiscountEl) {
      const avgBase = qty > 0 ? Math.round(baseTotal / qty) : 0;
      const productDiscountPercent = this.compareAtPrice > avgBase
        ? Math.round(((this.compareAtPrice - avgBase) / this.compareAtPrice) * 100)
        : 0;
      productDiscountEl.style.display = productDiscountPercent > 0 ? '' : 'none';
      productDiscountEl.textContent = productDiscountPercent > 0 ? `On sale ${productDiscountPercent}% OFF` : '';
    }

    this.updateSubscribePrice(label);
  }

  updateSubscribePrice(label) {
    if (!label) return;
    const subContentEl = label.querySelector('.subscribe-item-content');
    if (!subContentEl) return;
    const subDiscount = parseFloat(this.subscriptionDiscount || 0);
    if (subDiscount > 0) {
      subContentEl.textContent =`Subscribe save ${Math.round(subDiscount)}%`
      subContentEl.style.display = 'block';
    } else {
      subContentEl.style.display = 'none';
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
      messageEl.textContent = 'sold out, please choose another option';
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
        // 如果这是数量为1的阶梯，同步到隐藏的master select
        if (label.dataset.qty === '1') {
          this.variantSelect.value = select.value;
          this.updateSinglePrice();
        }
      });
    });
  }

  renderTiers() {
    this.tierContainer.innerHTML = '';

    const tierNames = ['', 'Single', 'Duo', 'Trio', 'Quad'];
    let hasQty1Tier = this.tiers.some((tier) => tier.minQuantity === 1);

    if (!hasQty1Tier) {
      this.tiers.unshift({ minQuantity: 1, value: "0", message: "", type: "percentage" });
      hasQty1Tier = true;
    }

    const popularIndex = (this.popularIndexs - 2) + (hasQty1Tier ? 1 : 0);
    const basePrice = this.getBundleBasePrice();
    const mergedTiers = this.mergeTiers(this.tiers, basePrice);

    mergedTiers.forEach((tier, index) => {
      const qty = tier.minQuantity;
      const discountValue = parseFloat(tier.value);
      const discountType = tier.type || 'percentage';
      // baseTotal 使用商品售卖价（不含 compare_at_price），originalCrossed 使用 compare_at_price（若存在）
      const baseTotal = basePrice * qty;
      const originalCrossed = this.compareAtPrice > 0 ? this.compareAtPrice * qty : baseTotal;

      let discountedTotal;
      let savedAmount;
      if (discountType === 'fixed_amount') {
        const discountCents = discountValue * 100 * qty;
        discountedTotal = Math.max(0, baseTotal - discountCents);
        const subDiscount = parseFloat(this.subscriptionDiscount || 0);
        if (subDiscount > 0) {
          discountedTotal = Math.round(discountedTotal * (1 - subDiscount / 100));
        }
        savedAmount = originalCrossed - discountedTotal;
      } else {
        discountedTotal = Math.round(baseTotal * (1 - discountValue / 100));
        const subDiscount = parseFloat(this.subscriptionDiscount || 0);
        if (subDiscount > 0) {
          discountedTotal = Math.round(discountedTotal * (1 - subDiscount / 100));
        }
        savedAmount = originalCrossed - discountedTotal;
      }

      const name = tierNames[qty] || `${qty} Pack`;
      const isPopular = index === popularIndex;
      const productDiscount = this.getProductDiscount();

      const label = document.createElement('label');
      label.className = 'bundle-option';
      label.dataset.qty = qty;
      label.dataset.discountValue = discountValue;
      label.dataset.discountType = discountType;
      label.innerHTML = `
          <div class="bundle-content">
            <div class="bundle-left">
              <div class="bundle-option-content">
                <div class="bundle-radio-item">
                  <input class="yx-option__radio" style="width: 20px; height: 20px;" type="radio" name="bundle-qty" value="${qty}">
                  <div class="bundle-name">
                    <span>${name}</span>
                    <div class="bundle-save-badge" style="${savedAmount > 0 ? '' : 'display:none'}">
                      <span>You Save</span>
                      <strong>${this.formatMoney(savedAmount)}</strong>
                    </div>  
                  </div>
                </div>
                <div class="bundle-subscribe-item">
                    <div class="product-discount" style="${productDiscount > 0 ? '' : 'display:none'}">On sale ${productDiscount}% OFF</div>
                    <div class="bundle-desc" style="${discountValue > 0 ? '' : 'display:none'}">
                      ${discountType === 'fixed_amount' ? `Bundle save ${this.formatMoney(discountValue * 100)} off each` : `Bundle save ${discountValue}%`}
                    </div>
                    <div class="subscribe-item-content"></div>
                  </div>
              </div>
            </div>
            <div class="bundle-right">
              <div class="bundle-price-item">
                <div class="bundle-price">${this.formatMoney(discountedTotal)}</div>
                <div class="bundle-original-price" style="${savedAmount > 0 ? '' : 'display:none'}">${this.formatMoney(originalCrossed)}</div>
              </div>
            </div>
          </div>
          <div class="bundle-variant" style="--variant-height: ${this.variantFlag ? (qty * 44 + 22 + 'px') : 0}; --variant-qty: ${qty * 0.05 + 0.1}s;">
            <div class="variant-specification">${this.specification}</div>
            ${this.buildVariantSelects(qty)}
          </div>
          ${isPopular ? '<div class="popular-badge">Most Popular</div>' : ''}`;

      this.tierContainer.appendChild(label);
      this.attachTierSelectListeners(label);
    });

    // 默认选中数量为1的选项
    const qty1Radio = this.tierContainer.querySelector('input[value="1"]');
    if (qty1Radio) {
      qty1Radio.checked = true;
    }
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
    const tierLabels = Array.from(this.container.querySelectorAll('.bundle-option'));
    tierLabels.forEach((label) => this.updateTierPrice(label));
  }

  toggleSubscribeItems() {
    const subDiscount = parseFloat(this.subscriptionDiscount || 0);
    if (subDiscount > 0) {
      this.container.classList.add('has-subscription');
    } else {
      this.container.classList.remove('has-subscription');
    }
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

  handleBundleOptionChange(event) {
    const target = event.target;
  
    if (!target || target.name !== 'bundle-qty') return;

    const selectedRadio = this.container.querySelector('input[name="bundle-qty"]:checked');
    const selectedLabel = selectedRadio?.closest('.bundle-option');
    const discountRate = selectedLabel?.dataset.discountValue || '';
    const discountType = selectedLabel?.dataset.discountType || '';
    this.boundChangeEvent({discountRate, discountType});
  }

/**
 * 获取选中的捆绑商品变体信息
 * 该方法用于处理捆绑商品的选中状态，并根据不同的数量返回相应的变体信息
 * @returns {Array} 返回包含变体信息的数组，每个元素是一个对象，包含id、quantity和properties属性
 */
  getBundleSelectedVariants() {
  // 获取选中的单选按钮元素
    const selectedRadio = this.container.querySelector('input[name="bundle-qty"]:checked');
  // 将选中的值转换为整数，默认值为1
    const selectedQty = parseInt(selectedRadio?.value || '1', 10);
  // 获取选中单选按钮最近的.bundle-option父元素
    const selectedLabel = selectedRadio?.closest('.bundle-option');

  // 如果没有选中的元素，返回空数组
    if (!selectedLabel) return [];

  // 处理数量为1且数据属性qty也为1的特殊情况
    if (selectedQty === 1 && selectedLabel.dataset.qty === '1') {
    // 返回单个变体对象，包含id、数量和属性信息
      return [{
        id: parseInt(this.variantSelect.value, 10),
        quantity: 1,
        properties: {
        // 将捆绑信息转换为JSON字符串，包含deal、main和bid属性
          _yx_bundles: JSON.stringify({ deal: 'VIR1', main: true, bid: this.generateBid(selectedLabel.dataset.qty) })
        }
      }];
    }

  // 获取所有捆绑层级选择器
    const tierSelects = Array.from(selectedLabel.querySelectorAll('.bundle-tier-select'));
  // 返回映射后的变体数组，每个变体包含id、数量和属性信息
    return tierSelects.map((select) => ({
      id: parseInt(select.value, 10),
      quantity: 1,
      properties: {
      // 将捆绑信息转换为JSON字符串，包含deal、main和bid属性
      // bid值由多个数据属性生成
        _yx_bundles: JSON.stringify({ deal: 'VIR1', main: true, bid: this.generateBid(selectedLabel.dataset.qty) + this.generateBid(selectedLabel.dataset.discountValue) + this.generateBid(selectedLabel.dataset.discountType) })
      }
    }));
  }
  // 发布阶梯优惠变化事件
   boundChangeEvent(detail) {
    console.log('detail', detail)
    document.dispatchEvent(new CustomEvent('bundle:change', { detail }));
  }

  // 订阅变化事件
  handleSubscriptionChange(e) {
    this.subscriptionDiscount = e.detail.discountRate;
    this.toggleSubscribeItems();
    this.updateSinglePrice();
    this.updateAllTierPrices();
  }
}

if (!customElements.get('bundle-selector-widget')) {
  customElements.define('bundle-selector-widget', BundleSelectorWidget);
}
