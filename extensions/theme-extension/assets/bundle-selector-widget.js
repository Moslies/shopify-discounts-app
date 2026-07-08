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
    this.updatePriceToProductDetail();
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

  getSelectCompareAtPrice(select) {
    const selected = select.options[select.selectedIndex];
    return parseInt(selected?.dataset.compare_at_price || '0', 10);
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
          <option value="${opt.value}" data-price="${opt.dataset.price}" data-compare_at_price="${opt.dataset.compare_at_price}" data-available="${opt.dataset.available}" ${opt.disabled ? 'disabled' : ''} ${opt.value === this.variantSelect.value ? 'selected' : ''}>
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
    // 确保 badge 内有描述 span 和强文本 strong，若缺失则创建
    let labelEl = saveBadge.querySelector('span');
    if (!labelEl) {
      labelEl = document.createElement('span');
      labelEl.textContent = 'SAVE';
      saveBadge.appendChild(labelEl);
    }
    let amountEl = saveBadge.querySelector('strong');
    if (!amountEl) {
      amountEl = document.createElement('strong');
      saveBadge.appendChild(amountEl);
    }
    amountEl.textContent = this.formatMoney(amount);
  }

  /* 更新单个商品的价格 */
  updateSinglePrice() {
    const priceEl = this.container.querySelector('.bundle-option[data-qty="1"] .bundle-price');
    if (!priceEl) return;
    // 使用当前选中的规格价格作为基础售卖价
    const selectedBase = this.getSelectPrice(this.variantSelect);
    const selectedCompareAtPrice = this.getSelectCompareAtPrice(this.variantSelect);
    let bundlePrice = selectedBase;
    const subDiscount = parseFloat(this.subscriptionDiscount || 0);
    const subBps = Math.round(subDiscount * 100);
    if (subBps > 0) {
      bundlePrice = Math.round(bundlePrice * (10000 - subBps) / 10000);
    }
    priceEl.textContent = this.formatMoney(bundlePrice);

    const label = priceEl.closest('.bundle-option');
    const crossedOriginal = selectedCompareAtPrice > 0 ? selectedCompareAtPrice : selectedBase;
    if (label) {
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
        const productDiscountPercent = selectedCompareAtPrice > selectedBase
          ? Math.round(((selectedCompareAtPrice - selectedBase) / selectedCompareAtPrice) * 100)
          : 0;
        productDiscountEl.style.display = productDiscountPercent > 0 ? '' : 'none';
        productDiscountEl.textContent = productDiscountPercent > 0 ? `On sale ${productDiscountPercent}% off` : '';
      }
    }
    this.updateSubscribePrice(label);
  }

  updateTierPrice(label) {
    const tierSelects = Array.from(label.querySelectorAll('.bundle-tier-select'));
    const qty = tierSelects.length;

    // baseTotal: 使用每个已选择规格的价格求和（支持不同规格价格不同）
    let baseTotal = 0;
    let compareAtTotal = 0;
    if (tierSelects.length > 0) {
      baseTotal = tierSelects.reduce((sum, select) => sum + this.getSelectPrice(select), 0);
      compareAtTotal = tierSelects.reduce((sum, select) => sum + this.getSelectCompareAtPrice(select), 0);
    } else {
      baseTotal = this.getBundleBasePrice() * qty;
      compareAtTotal = this.compareAtPrice > 0 ? this.compareAtPrice * qty : 0;
    }
    // originalCrossed: 如果存在 compareAtTotal 则显示为原价，总和为每个选中变体的 compare_at_price
    const originalCrossed = compareAtTotal > 0 ? compareAtTotal : baseTotal;

    const discountValue = parseFloat(label.dataset.discountValue || '0');
    const discountType = label.dataset.discountType || 'percentage';
    const discountBps = Math.round(discountValue * 100); // 转为基点，如 15 → 1500

    let discountedTotal;
    const subBps = Math.round(parseFloat(this.subscriptionDiscount || 0) * 100);

    if (tierSelects.length > 0) {
      // 将折扣应用到单个商品，得到优惠后单价，再求和（支持不同变体价格不同）
      if (discountType === 'fixed_amount') {
        const discountCents = Math.round(discountValue * 100);
        discountedTotal = tierSelects.reduce((sum, select) => {
          let itemPrice = Math.max(0, this.getSelectPrice(select) - discountCents);
          if (subBps > 0) {
            itemPrice = Math.round(itemPrice * (10000 - subBps) / 10000);
          }
          return sum + itemPrice;
        }, 0);
      } else {
        discountedTotal = tierSelects.reduce((sum, select) => {
          let itemPrice = this.getSelectPrice(select);
          itemPrice = Math.round(itemPrice * (10000 - discountBps) / 10000);
          if (subBps > 0) {
            itemPrice = Math.round(itemPrice * (10000 - subBps) / 10000);
          }
          return sum + itemPrice;
        }, 0);
      }
    } else {
      // 无变体选择器时，所有商品同价，先折扣再求和结果相同
      if (discountType === 'fixed_amount') {
        const discountCents = Math.round(discountValue * 100) * qty;
        discountedTotal = Math.max(0, baseTotal - discountCents);
      } else {
        discountedTotal = Math.round(baseTotal * (10000 - discountBps) / 10000);
      }
      if (subBps > 0) {
        discountedTotal = Math.round(discountedTotal * (10000 - subBps) / 10000);
      }
    }

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

    // 更新 product-discount（基于当前选中变体 compare_at_price 总和）
    const productDiscountEl = label.querySelector('.product-discount');
    if (productDiscountEl) {
      const productDiscountPercent = compareAtTotal > baseTotal
        ? Math.round(((compareAtTotal - baseTotal) / compareAtTotal) * 100)
        : 0;
      productDiscountEl.style.display = productDiscountPercent > 0 ? '' : 'none';
      productDiscountEl.textContent = productDiscountPercent > 0 ? `On sale ${productDiscountPercent}% off` : '';
    }

    this.updateSubscribePrice(label);
  }

  updateSubscribePrice(label) {
    if (!label) return;
    const subContentEl = label.querySelector('.subscribe-item-content');
    if (!subContentEl) return;
    const subDiscount = parseFloat(this.subscriptionDiscount || 0);
    if (subDiscount > 0) {
      subContentEl.textContent =`Subscribe ${Math.round(subDiscount)}% off`
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
        // 如果当前修改的是选中套餐内的变体，同步更新商品详情价格
        if (label === this.container.querySelector('input[name="bundle-qty"]:checked')?.closest('.bundle-option')) {
          this.updatePriceToProductDetail();
        }
      });
    });
  }

/**
 * 转换徽章文本
 * @param {string} text - 需要转换的徽章文本
 * @returns {Array} 转换后的数组
 */
  transformBadge(text, styles) {
  // 如果输入文本为空，则返回空数组
    if (!text) return [];
  // 此处似乎缺少条件判断语句，需要补充完整
    return text.split(',').map((style) => {
      if (styles.includes(style.trim())) {
        return style.trim();
      }
      return '';
    });
  }

  /* 渲染阶梯选项 */
  renderTiers() {
    this.tierContainer.innerHTML = '';

    let hasQty1Tier = this.tiers.some((tier) => tier.minQuantity === 1);

    if (!hasQty1Tier) {
      // this.tiers.unshift({ minQuantity: 1, value: "0", message: "", type: "percentage" });
      hasQty1Tier = true;
    }

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
        const discountCents = Math.round(discountValue * 100) * qty;
        discountedTotal = Math.max(0, baseTotal - discountCents);
        const subDiscount = parseFloat(this.subscriptionDiscount || 0);
        const subBps = Math.round(subDiscount * 100);
        if (subBps > 0) {
          discountedTotal = Math.round(discountedTotal * (10000 - subBps) / 10000);
        }
        savedAmount = originalCrossed - discountedTotal;
      } else {
        const discountBps = Math.round(discountValue * 100);
        discountedTotal = Math.round(baseTotal * (10000 - discountBps) / 10000);
        const subDiscount = parseFloat(this.subscriptionDiscount || 0);
        const subBps = Math.round(subDiscount * 100);
        if (subBps > 0) {
          discountedTotal = Math.round(discountedTotal * (10000 - subBps) / 10000);
        }
        savedAmount = originalCrossed - discountedTotal;
      }
      
      const badgeText = tier.badgeText || ``;
      const comboName = tier.comboName || `${qty} Pack`;

      const badgeStyle = this.container.dataset.all_badge_style || 'Style-1';
      
      const badgeStyleList = this.transformBadge(this.container.dataset.badges_style_list, ['Style-1', 'Style-2', 'Style-3', 'Style-4'])

      const badgePosition = this.container.dataset.all_badge_position
      const badgePositionList = this.transformBadge(this.container.dataset.badges_position_list, ['upper-right-corner', 'right-tilt', 'left-tilt'])

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
                    <span>${comboName}</span>
                    <div class="bundle-save-badge" style="${savedAmount > 0 ? '' : 'display:none'}">
                      <svg
                        aria-hidden="true"
                        focusable="false"
                        class="icon icon--small"
                        viewBox="0 0 12 12"
                      >
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M7 0h3a2 2 0 012 2v3a1 1 0 01-.3.7l-6 6a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4l6-6A1 1 0 017 0zm2 2a1 1 0 102 0 1 1 0 00-2 0z" fill="currentColor">
                      </svg>
                      <span>SAVE</span>
                      <strong></strong>
                    </div>  
                  </div>
                </div>
                <div class="bundle-subscribe-item">
                    <div class="product-discount"></div>
                    <div class="bundle-desc" style="${discountValue > 0 ? '' : 'display:none'}">
                      ${discountType === 'fixed_amount' ? `Bundle ${this.formatMoney(discountValue * 100)} off each` : `Bundle ${discountValue}% off`}
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
          ${badgeText ? `<div class="${badgeStyleList[index] ? badgeStyleList[index] : badgeStyle} ${badgePositionList[index] ? badgePositionList[index] : badgePosition}">${badgeText}</div>` : ''}`;

      this.tierContainer.appendChild(label);
      this.attachTierSelectListeners(label);
    });

    // 默认选中第一个选项
    const firstRadio = this.tierContainer.querySelector('.yx-option__radio:first-child');
    if (firstRadio) {
      // firstRadio.checked = true;
    }
    // 确保初次渲染后价格/折扣与当前变体保持一致
    this.updateAllTierPrices();
    this.updateAllAvailability();
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
      this.updatePriceToProductDetail();
    }
  }

  boundVariantSelectChange() {
    // 当 master select 改变时，把所有 tier-select 同步到相同变体（若该 option 存在）
    const newVal = this.variantSelect.value;
    Array.from(this.container.querySelectorAll('.bundle-tier-select')).forEach((select) => {
      if (select.querySelector(`option[value="${newVal}"]`)) {
        select.value = newVal;
        // 触发 tier-select 的 change 事件，确保其内部监听器（如 availability）生效
        try {
          select.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {
          // ignore
        }
      }
    });

    this.updateSinglePrice();
    this.updateAllTierPrices();
    this.updateAvailability(this.variantSelect);
    this.updateAllAvailability();
    this.updatePriceToProductDetail();
  }

  handleBundleOptionChange(event) {
    const target = event.target;
  
    if (!target || target.name !== 'bundle-qty') return;

    const selectedRadio = this.container.querySelector('input[name="bundle-qty"]:checked');
    const selectedLabel = selectedRadio?.closest('.bundle-option');
    const discountRate = selectedLabel?.dataset.discountValue || '';
    const discountType = selectedLabel?.dataset.discountType || '';
    this.boundChangeEvent({discountRate, discountType});
    this.updatePriceToProductDetail();
  }

/**
 * 获取选中的捆绑商品变体信息
 * 该方法用于处理捆绑商品的选中状态，并根据不同的数量返回相应的变体信息
 * @returns {Array} 返回包含变体信息的数组，每个元素是一个对象，包含id、quantity和properties属性
 */
  getBundleSelectedVariants() {
    if (this.tiers.length === 0) return [];
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
    document.dispatchEvent(new CustomEvent('bundle:change', { detail }));
  }

  // 订阅变化事件
  handleSubscriptionChange(e) {
    this.subscriptionDiscount = e.detail.discountRate;
    this.toggleSubscribeItems();
    this.updateSinglePrice();
    this.updateAllTierPrices();
    this.updatePriceToProductDetail();
  }
  
  // 更新商品详情中的价格
  updatePriceToProductDetail() {
    const selectedRadio = this.container.querySelector('input[name="bundle-qty"]:checked');
    if (!selectedRadio) return null;

    const selectedLabel = selectedRadio.closest('.bundle-option');
    if (!selectedLabel) return null;
    const priceEl = selectedLabel.querySelector('.bundle-price');
    const originalPriceEl = selectedLabel.querySelector('.bundle-original-price');

    const bundlePrice = priceEl ? priceEl.textContent : '';
    const originalPrice = originalPriceEl ? originalPriceEl.textContent : '';

    // 根据 bundlePrice / originalPrice 计算总折扣百分比
    const bp = parseFloat(bundlePrice.replace(/[^0-9.]/g, ''));
    const op = parseFloat(originalPrice.replace(/[^0-9.]/g, ''));
    const totalDiscountPercent = op > 0 ? Math.round((1 - bp / op) * 100) : 0;
    const totalDiscount = op - bp;
    const detail = { bundlePrice, originalPrice, totalDiscountPercent, totalDiscount: this.formatMoney(totalDiscount * 100) };

    // 售价更新
    const mainPriceEls = Array.from(
      document.querySelectorAll('.price__sale .main-price, .price__regular .main-price')
    );
    const salePriceItemEls = Array.from(
      document.querySelectorAll('.price__sale .price-item--sale')
    );
    const regularPriceItemEls = Array.from(
      document.querySelectorAll('.price__regular .price-item--regular')
    );
    const priceElsToUpdate = Array.from(
      new Set([...mainPriceEls, ...salePriceItemEls, ...regularPriceItemEls])
    );
    priceElsToUpdate.forEach((el) => {
      el.textContent = bundlePrice;
    })
    // 更新原价
    const comparePriceItemEls = Array.from(
      document.querySelectorAll('.price__compare-price .price-item')
    );

    comparePriceItemEls.forEach((el) => {
      el.textContent = originalPrice
    });
    // 折扣标签更新
    const badgeNowraps = document.querySelectorAll('.price__badge-sale .nowrap');
    badgeNowraps.forEach((el) => {
      el.innerHTML = `SAVE ${totalDiscountPercent}% OFF`;
    });

    // 派发事件，供外部监听更新商品详情价格
    document.dispatchEvent(new CustomEvent('bundle:priceUpdate', {
      detail
    }));
    console.log('updatePriceToProductDetail', detail);

    return detail;
  }
}

if (!customElements.get('bundle-selector-widget')) {
  customElements.define('bundle-selector-widget', BundleSelectorWidget);
}
