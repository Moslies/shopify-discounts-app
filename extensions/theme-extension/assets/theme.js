// ✅ shopUrl 作为参数，不依赖 this
let themeDataPromise = null;

const getThemes = async (shopUrl) => {
  if (!themeDataPromise) {
    themeDataPromise = fetch(`${shopUrl}/apps/theme`, {
      headers: { "ngrok-skip-browser-warning": "true" }
    })
    .then(res => res.json())
    .then(data => data.current)
    .catch(err => {
      themeDataPromise = null;
      throw err;
    });
  }
  return themeDataPromise;
};

const YX_OPTION_RADIO_STYLE = `
    .yx-option__radio {
        width: 18px;
        height: 18px;
        border: 2px solid var(--selected_variant_border_color, #6b7280);
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        accent-color: var(--selected_variant_border_color, #2563eb);
    }
    .yx-option__radio:checked {
        border-color: var(--selected_variant_border_color, #2563eb) !important;
        accent-color: var(--selected_variant_border_color, #2563eb) !important;
    }
    .yx-option__radio:checked::after,
    .yx-option__radio:checked::before {
        background-color: var(--selected_variant_border_color, #2563eb) !important;
        border-color: var(--selected_variant_border_color, #2563eb) !important;
    }
    .yx-option__radio:not(:disabled):hover:checked {
        border-color: var(--selected_variant_border_color, #2563eb) !important;
        background-color: rgba(59,130,246,0.18) !important;
    }
`;
let yxOptionRadioStyleInjected = false;
function injectYxOptionRadioStyle() {
    if (yxOptionRadioStyleInjected) return;
    const style = document.createElement('style');
    style.setAttribute('data-yx-option-radio', 'true');
    style.textContent = YX_OPTION_RADIO_STYLE;
    document.head.appendChild(style);
    yxOptionRadioStyleInjected = true;
}

class themeContainer extends HTMLElement {
    async connectedCallback() {
        injectYxOptionRadioStyle();
        const current = await getThemes(this.dataset.shopUrl);
        this.setThemes(current);
    }
    async setThemes(current) {
        
        let colors = {};
        // 新主题：color_schemes 结构
        if (current.color_schemes) {
            const schemeKey = Object.keys(current.color_schemes)[0];
            const scheme = current.color_schemes[schemeKey]?.settings ?? {};
            colors = Object.fromEntries(
                Object.entries(scheme).filter(([, v]) =>
                typeof v === "string" && (v.startsWith("#") || v.startsWith("rgb"))
                )
            );
            console.log(colors);
            colors.selected_variant_background_color = colors.variant_background_color || '#fff';
            colors.selected_variant_text_color = colors.variant_text_color || '#121212';
            colors.selected_variant_hover_background_color = colors.variant_hover_background_color || '#f4f7fa';
            colors.selected_variant_hover_text_color = colors.variant_hover_text_color || '#121212';
            colors.badge_text_color = colors.primary_button_text || '#fff';
            colors.variant_border_color = colors.input_border_color || '#387cc9';
            colors.variant_hover_border_color = colors.variant_hover_border_color || '#387cc9';
            colors.selected_subscription_text_color = colors.primary_button_text || '#fff';
        }

        // 老主题：colors_ 前缀平铺字段（Dawn）
        if (Object.keys(colors).length === 0) {
            const dawnColors = Object.fromEntries(
                Object.entries(current).filter(([k, v]) =>
                k.startsWith("colors_") && typeof v === "string"
                )
            );
            colors = {
                ...dawnColors,
                selected_variant_background_color: dawnColors.colors_background_1 || '#ffffff',
                selected_variant_border_color: dawnColors.colors_outline_button_labels || '#387cc9',
                selected_variant_hover_background_color: dawnColors.colors_background_1 || '#ffffff',
                selected_variant_hover_border_color: dawnColors.colors_outline_button_labels || '#387cc9',
                selected_variant_hover_text_color: dawnColors.colors_text || '#121212',
                selected_variant_text_color: dawnColors.colors_outline_button_labels || '#387cc9',
                badge_text_color: dawnColors.colors_outline_button_labels || '#387cc9',
                variant_border_color: dawnColors.colors_outline_button_labels || '#387cc9',
                variant_hover_border_color: dawnColors.colors_outline_button_labels || '#387cc9',
                selected_subscription_text_color: dawnColors.colors_outline_button_labels || '#fff',
            }
        }

        Object.keys(colors).forEach((key) => {
            this.style.setProperty(`--${key}`, colors[key]);
        });
    }
    
}

if (!customElements.get('theme-container')) {
  customElements.define('theme-container', themeContainer);
}
