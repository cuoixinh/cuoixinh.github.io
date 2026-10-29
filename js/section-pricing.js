// Bảng giá trang chủ (#pricing): ba thẻ gói + bảng so sánh y như màn thanh toán (cùng
// lớp .cx-ord-*, bảng do cxPlanCompareHTML của core/payment.js dựng — nạp SAU file đó).
// Giá đọc từ assets/data/pricing.json, CHỈ để hiện: số tiền thật vẫn do payment-handler
// báo giá lúc thanh toán, nên đổi giá trong DB thì sửa luôn file này.

let _prcData = null;
let _prcPick = null;

const _prcVnd = (v) => `${v.toLocaleString("vi-VN")}đ`;
const _prcFreeTerm = () =>
  CONFIG.freePlanDays % 30 ? `${CONFIG.freePlanDays} ngày` : `${CONFIG.freePlanDays / 30} tháng`;

async function initPricing() {
  const section = document.getElementById("pricing");
  if (!section) return;
  try {
    const res = await fetch(`/assets/data/pricing.json?v=${CONFIG.version}`);
    if (!res.ok) throw new Error("HTTP " + res.status);
    _prcData = await res.json();
  } catch (err) {
    console.warn("Không tải được bảng giá:", err);
    section.hidden = true;
    return;
  }
  if (!_prcData?.plans?.length) {
    section.hidden = true;
    return;
  }
  _prcPick = _prcData.recommended || _prcData.plans[0].id;
  const rec = _prcData.plans.find((p) => p.id === _prcPick);
  const art = document.getElementById("pricingArtAmount");
  if (art && rec) art.textContent = _prcVnd(rec.price);
  const cmp = document.getElementById("pricingCompare");
  if (cmp && window.cxPlanCompareHTML) {
    const cols = [{ id: "free", label: "Free", available: true }].concat(
      _prcData.plans.map((p) => ({ ...p, available: true })),
    );
    cmp.innerHTML = window.cxPlanCompareHTML(cols, "cxPricingPick");
    cmp.classList.remove("hidden");
    window.lucide?.createIcons({ root: cmp });
  }
  _renderPricing();
}

function _renderPricing() {
  const box = document.getElementById("pricingPlans");
  if (!box || !_prcData) return;
  const freeOn = _prcPick === "free";
  const free =
    `<button type="button" role="radio" aria-checked="${freeOn}" class="cx-ord-plan${freeOn ? " is-on" : ""}"` +
    ` onclick="cxPricingPick('free')"><span class="cx-ord-plan-dot" aria-hidden="true"></span>` +
    `<i data-lucide="gift" class="cx-ord-plan-gift" style="width:18px;height:18px"></i>` +
    `<span class="cx-ord-plan-name">Free</span><span class="cx-ord-plan-tag">1 lần / tài khoản</span></button>`;
  box.innerHTML =
    free +
    _prcData.plans
      .map((p) => {
        const on = p.id === _prcPick;
        const badge = p.id === _prcData.recommended ? '<span class="cx-ord-plan-badge">Khuyên dùng</span>' : "";
        const name = p.months ? p.label : `<i data-lucide="infinity" style="width:14px;height:14px"></i>${p.label}`;
        const was = p.original_price > p.price ? `<s class="cx-ord-plan-was">${_prcVnd(p.original_price)}</s>` : "";
        return (
          `<button type="button" role="radio" aria-checked="${on}" class="cx-ord-plan${on ? " is-on" : ""}"` +
          ` onclick="cxPricingPick('${p.id}')">${badge}<span class="cx-ord-plan-dot" aria-hidden="true"></span>` +
          `<span class="cx-ord-plan-name">${name}</span>` +
          `<span class="cx-ord-plan-price">${_prcVnd(p.price)}</span>${was}</button>`
        );
      })
      .join("");
  window.lucide?.createIcons({ root: box });

  // Nút cuối thẻ đọc lại gói đang chọn, giống nút "Quét QR để thanh toán".
  const p = _prcData.plans.find((x) => x.id === _prcPick);
  const sub = document.getElementById("pricingSub");
  const total = document.getElementById("pricingTotal");
  if (sub) sub.textContent = p ? `Gói ${p.label} · ${p.months ? `${p.months} tháng` : "trọn đời"}` : `Gói Free · ${_prcFreeTerm()}`;
  if (total) total.textContent = p ? _prcVnd(p.price) : "0đ";
}

function cxPricingPick(id) {
  if (id !== "free" && !_prcData?.plans.some((p) => p.id === id)) return;
  _prcPick = id;
  _renderPricing();
}

initPricing();
