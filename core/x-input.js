// Inject display:block so Tailwind flex/grid utilities work on <x-input>
;(function () {
  const s = document.createElement('style');
  s.textContent = 'x-input{display:block}';
  document.head.appendChild(s);
})();

const _X_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

const _INPUT_CLS =
  'w-full h-10 pl-3 pr-9 border border-gray-200 rounded-lg text-sm text-gray-800 ' +
  'bg-white outline-none focus:ring-2 focus:ring-rose-500/30 ' +
  'placeholder:text-gray-400/50 transition-all';

const _TEXTAREA_CLS =
  'w-full pl-3 pr-9 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 ' +
  'bg-white outline-none focus:ring-2 focus:ring-rose-500/30 ' +
  'placeholder:text-gray-400/50 transition-all resize-none';

const _CLEAR_CLS =
  'x-clear hidden absolute right-2 top-1/2 -translate-y-1/2 ' +
  'flex items-center justify-center w-5 h-5 rounded transition-colors ' +
  'text-gray-400 hover:text-gray-600 hover:bg-gray-100';

class XInput extends HTMLElement {
  connectedCallback() {
    // ── Attributes ──────────────────────────────────────────────────────────
    const label        = this.getAttribute('label') || '';
    const labelIcon    = this.getAttribute('icon') || this.getAttribute('label-icon') || '';
    const name         = this.getAttribute('name') || '';
    // Move id from x-input element to inner control to avoid duplicate ids
    const ownId        = this.getAttribute('id');
    if (ownId) this.removeAttribute('id');
    const inputId      = ownId || name;
    const placeholder  = this.getAttribute('placeholder') || '';
    const type         = this.getAttribute('type') || 'text';
    const autocomplete = this.getAttribute('autocomplete') || 'off';
    const rows         = this.getAttribute('rows') || '3';
    const isMono       = this.hasAttribute('mono');
    const isRequired   = this.hasAttribute('required');
    const isReadonly   = this.hasAttribute('readonly');
    const isTextarea   = type === 'textarea';

    // Suffix action button (e.g. "Bản đồ" next to location inputs)
    const suffixLabel   = this.getAttribute('suffix-btn-label') || '';
    const suffixIcon    = this.getAttribute('suffix-btn-icon') || '';
    const suffixAction  = this.getAttribute('suffix-btn-action') || '';
    const suffixPrimary = this.hasAttribute('suffix-btn-primary');
    const hasSuffix     = !!(suffixLabel || suffixAction);

    // Inline event handlers to pass through to inner control
    const oninputAttr = this.getAttribute('oninput') || '';

    // Pass-through data-* attributes to inner control
    const dataAttrs = Array.from(this.attributes)
      .filter(a => a.name.startsWith('data-'))
      .map(a => `${a.name}="${a.value}"`)
      .join(' ');

    // ── HTML ────────────────────────────────────────────────────────────────
    const extraCls = isMono ? ' font-mono' : '';

    const labelHtml = label
      ? `<label for="${inputId}" class="block text-sm text-gray-700 mb-1.5 flex items-center gap-1.5">
           ${labelIcon ? `<i data-lucide="${labelIcon}" class="w-3.5 h-3.5 text-color-secondary flex-shrink-0"></i>` : ''}
           <span>${label}${isRequired ? ' <span class="text-rose-500">*</span>' : ''}</span>
         </label>`
      : '';

    const controlHtml = isTextarea
      ? `<textarea name="${name}" id="${inputId}" rows="${rows}"
           placeholder="${placeholder}" ${isRequired ? 'required' : ''} ${dataAttrs}
           class="${_TEXTAREA_CLS}${extraCls}"></textarea>`
      : `<input type="${type}" name="${name}" id="${inputId}"
           placeholder="${placeholder}" autocomplete="${autocomplete}"
           ${isRequired ? 'required' : ''} ${isReadonly ? 'readonly' : ''} ${dataAttrs}
           ${oninputAttr ? `oninput="${oninputAttr}"` : ''}
           class="${_INPUT_CLS}${extraCls}" />`;

    const inputWrap = `<div class="relative${hasSuffix ? ' flex-1 min-w-0' : ''}">
      ${controlHtml}
      <button type="button" class="${_CLEAR_CLS}" aria-label="Xoá">${_X_SVG}</button>
    </div>`;

    const _suffixCls = suffixPrimary
      ? 'h-10 px-4 rounded-lg text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 transition-colors flex-shrink-0'
      : 'h-10 px-3 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-rose-50 hover:border-rose-200 hover:text-color-secondary transition-colors flex items-center justify-center gap-1.5 flex-shrink-0';

    const suffixBtnHtml = hasSuffix
      ? `<button type="button" onclick="${suffixAction}" class="${_suffixCls}">
           ${suffixIcon ? `<i data-lucide="${suffixIcon}" class="w-4 h-4"></i>` : ''}
           ${suffixLabel ? `<span>${suffixLabel}</span>` : ''}
         </button>`
      : '';

    this.innerHTML = labelHtml + (hasSuffix
      ? `<div class="flex gap-2">${inputWrap}${suffixBtnHtml}</div>`
      : inputWrap);

    // ── Behaviour ───────────────────────────────────────────────────────────
    const control  = this.querySelector('input, textarea');
    const clearBtn = this.querySelector('.x-clear');

    const sync = () => clearBtn.classList.toggle('hidden', !control.value);

    control.addEventListener('input', sync);
    control.addEventListener('change', sync);
    clearBtn.addEventListener('click', () => {
      control.value = '';
      control.focus();
      control.dispatchEvent(new Event('input', { bubbles: true }));
    });

    sync(); // set initial state

    // Public — call after programmatic value assignment
    this.syncClearBtn = sync;

    // Re-run lucide for label icon & suffix icon
    if ((labelIcon || suffixIcon) && window.lucide) {
      lucide.createIcons({ nodes: [this] });
    }
  }
}

customElements.define('x-input', XInput);
