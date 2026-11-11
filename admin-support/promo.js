// Tab "Mã giảm giá" của /admin-support: tạo mã tự đặt / sinh hàng loạt (kèm vé xem trước), bật-tắt,
// cộng lượt, xoá. Đi qua supRequest (index.js) bằng phiên Google của nhân viên — quyền kiểm ở
// wedding-admin (resource=promo-codes, cùng chốt SUPPORT_EMAILS). Nạp SAU index.js.

let promoCodes = [];
let promoBatch = [];
let promoMode = "single";

const promoEl = (id) => document.getElementById(id);
const promoReq = (method, opts) => supRequest("promo-codes", method, opts);
const promoVnd = (n) => `${Number(n || 0).toLocaleString("vi-VN")}đ`;
const promoOff = (type, value) => (type === "percent" ? `${value}%` : promoVnd(value));

// Dải segmented (.cx-seg): con trượt theo --i, nút đang chọn .is-on.
function promoSeg(seg, attr, value, aria) {
  const btns = [...seg.querySelectorAll(`[${attr}]`)];
  btns.forEach((b, i) => {
    const on = b.getAttribute(attr) === value;
    b.classList.toggle("is-on", on);
    b.setAttribute(aria, String(on));
    if (on) seg.style.setProperty("--i", String(i));
  });
}

function promoSetType(type) {
  promoEl("promo-type").value = type;
  promoSeg(promoEl("promo-type-seg"), "data-type", type, "aria-checked");
  promoEl("promo-value-unit").textContent = type === "percent" ? "%" : "đ";
  const v = promoEl("promo-value");
  v.step = type === "percent" ? "1" : "1000";
  // Đổi kiểu mà giữ con số cũ thì "20" thành giảm 20đ — đặt lại một mức hợp lý.
  v.value = type === "percent" ? "20" : "50000";
  promoPreview();
}

function promoSetMode(mode) {
  promoMode = mode;
  promoSeg(promoEl("promo-mode-seg"), "data-mode", mode, "aria-selected");
  promoEl("promo-mode-single").classList.toggle("hidden", mode !== "single");
  promoEl("promo-mode-batch").classList.toggle("hidden", mode !== "batch");
  promoPreview();
}

// Vé: mức giảm ở cuống, mã + điều kiện ở thân. `sm` = vé nhỏ của lô vừa sinh (bấm để chép).
function promoTicket(c, sm) {
  const off = promoOff(c.discount_type, c.discount_value);
  const code = c.code
    ? `<span class="sup-ticket-code">${escapeHtml(c.code)}</span>`
    : `<span class="sup-ticket-code is-empty">${escapeHtml(c.placeholder || "········")}</span>`;
  if (sm) {
    return `<button type="button" class="sup-ticket is-sm" data-copy="${escapeHtml(c.code)}" title="Bấm để chép ${escapeHtml(c.code)}">
        <span class="sup-ticket-stub"><b>${escapeHtml(off)}</b></span>
        <span class="sup-ticket-body">${code}</span>
      </button>`;
  }
  const terms = [
    c.expires_at ? `Dùng tới hết ngày ${new Date(c.expires_at).toLocaleDateString("vi-VN")}` : "Không hết hạn",
    c.max_uses == null ? "Không giới hạn lượt" : `${c.max_uses} lượt dùng${c.count > 1 ? " mỗi mã" : ""}`,
    c.min_order_amount > 0 ? `Đơn từ ${promoVnd(c.min_order_amount)}` : "",
    c.count > 1 ? `Sinh ${c.count} mã cùng điều kiện` : "",
  ].filter(Boolean);
  return `<div class="sup-ticket">
      <div class="sup-ticket-stub"><b>${escapeHtml(off)}</b><span>giảm</span></div>
      <div class="sup-ticket-body">
        ${code}
        <ul class="sup-ticket-terms">${terms.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
      </div>
    </div>`;
}

// Đọc form (không báo lỗi) để vẽ vé xem trước.
function promoDraft() {
  const maxUses = promoEl("promo-max-uses").value.trim();
  const expires = promoEl("promo-expires").value;
  const batch = promoMode === "batch";
  const len = Math.min(12, Math.max(4, Number(promoEl("promo-length").value) || 6));
  const prefix = promoEl("promo-prefix").value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return {
    discount_type: promoEl("promo-type").value,
    discount_value: Number(promoEl("promo-value").value) || 0,
    expires_at: expires ? new Date(expires + "T23:59:59").toISOString() : null,
    min_order_amount: Number(promoEl("promo-min-order").value) || 0,
    max_uses: maxUses === "" ? null : Number(maxUses),
    note: promoEl("promo-note").value.trim() || null,
    code: batch ? "" : promoEl("promo-manual-code").value.trim().toUpperCase(),
    placeholder: batch ? prefix + "•".repeat(len) : "Mã của bạn",
    count: batch ? Math.min(200, Math.max(1, Number(promoEl("promo-count").value) || 1)) : 1,
  };
}

function promoPreview() {
  promoEl("promo-preview").innerHTML = promoTicket(promoDraft());
}

// Thiết lập giảm giá gửi server; null = sai, đã báo.
function promoSettings() {
  const d = promoDraft();
  if (!d.discount_value || d.discount_value <= 0) return showAlert("Thiếu giá trị giảm", "Nhập mức giảm lớn hơn 0."), null;
  if (d.discount_type === "percent" && d.discount_value > 100) return showAlert("Mức giảm quá 100%", "Giảm theo % chỉ từ 1 đến 100."), null;
  if (d.max_uses != null && !(Number.isInteger(d.max_uses) && d.max_uses >= 1)) return showAlert("Số lượt không hợp lệ", "Nhập số nguyên từ 1, hoặc để trống."), null;
  const { discount_type, discount_value, expires_at, min_order_amount, max_uses, note } = d;
  return { discount_type, discount_value, expires_at, min_order_amount, max_uses, note };
}

async function promoCreate(payload, btn) {
  btn.disabled = true;
  try {
    const data = await promoReq("POST", { payload });
    promoBatch = data.codes || [];
    promoRenderBatch(data.batch_id);
    showToast(promoBatch.length === 1 ? `Đã tạo mã ${promoBatch[0].code}` : `Đã tạo ${promoBatch.length} mã`, "success");
    loadPromoCodes();
    return true;
  } catch (e) {
    showAlert("Chưa tạo được mã", e.message);
    return false;
  } finally {
    btn.disabled = false;
  }
}

function promoGenerate() {
  const s = promoSettings();
  if (!s) return;
  promoCreate(
    {
      mode: "generate",
      prefix: promoEl("promo-prefix").value.trim(),
      count: Number(promoEl("promo-count").value) || 1,
      length: Number(promoEl("promo-length").value) || 6,
      ...s,
    },
    promoEl("promo-generate-btn"),
  );
}

async function promoCreateSingle() {
  const input = promoEl("promo-manual-code");
  const code = input.value.trim().toUpperCase();
  if (!code) return showAlert("Chưa có mã", "Gõ mã muốn tạo vào ô phía trên.");
  const s = promoSettings();
  if (!s) return;
  if (await promoCreate({ mode: "single", code, ...s }, promoEl("promo-single-btn"))) {
    input.value = "";
    promoPreview();
  }
}

function promoRenderBatch(batchId) {
  const box = promoEl("promo-batch");
  box.classList.toggle("hidden", !promoBatch.length);
  if (!promoBatch.length) return;
  promoEl("promo-batch-title").textContent =
    promoBatch.length === 1 ? `Vừa tạo mã ${promoBatch[0].code}. Bấm vé để chép.` : `Vừa tạo ${promoBatch.length} mã (lô ${batchId}). Bấm vé để chép.`;
  promoEl("promo-batch-codes").innerHTML = promoBatch.map((c) => promoTicket(c, true)).join("");
}

function promoCopy(text, msg) {
  navigator.clipboard
    .writeText(text)
    .then(() => showToast(msg, "success"))
    .catch(() => showToast("Trình duyệt chặn chép tự động", "error"));
}
const promoCopyBatch = () => promoBatch.length && promoCopy(promoBatch.map((c) => c.code).join("\n"), `Đã chép ${promoBatch.length} mã`);

function promoExportCsv() {
  if (!promoBatch.length) return;
  const rows = [
    ["code", "discount_type", "discount_value", "max_uses", "expires_at"],
    ...promoBatch.map((c) => [c.code, c.discount_type, c.discount_value, c.max_uses ?? "", c.expires_at ?? ""]),
  ];
  const url = URL.createObjectURL(new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `ma-giam-gia-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function loadPromoCodes() {
  const tbody = promoEl("promo-list");
  try {
    const q = promoEl("promo-search").value.trim();
    promoCodes = await promoReq("GET", { query: q ? { q } : {} });
    promoRenderList();
  } catch (e) {
    promoEl("promo-count-label").textContent = "";
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-red-500">${escapeHtml(e.message)}</td></tr>`;
  }
}

const PROMO_BADGE = {
  on: ["bg-emerald-100 text-emerald-700", "Đang chạy"],
  off: ["bg-gray-100 text-gray-500", "Đã tắt"],
  expired: ["bg-amber-100 text-amber-700", "Hết hạn"],
  used: ["bg-rose-100 text-rose-600", "Hết lượt"],
};

function promoRenderList() {
  const tbody = promoEl("promo-list");
  promoEl("promo-count-label").textContent = promoCodes.length ? `(${promoCodes.length})` : "";
  if (!promoCodes.length) {
    const q = promoEl("promo-search").value.trim();
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-400">${q ? `Không có mã nào chứa "${escapeHtml(q)}".` : "Chưa có mã nào. Tạo mã đầu tiên ở khung phía trên."}</td></tr>`;
    return;
  }
  const now = Date.now();
  tbody.innerHTML = promoCodes
    .map((c) => {
      const used = c.used_count || 0;
      const st = !c.is_active
        ? "off"
        : c.expires_at && new Date(c.expires_at).getTime() < now
          ? "expired"
          : c.max_uses != null && used >= c.max_uses
            ? "used"
            : "on";
      // Lượt đã trừ: đã thanh toán · đang chờ trả tiền · bỏ ngang (vẫn tính là đã tiêu, không hoàn).
      const rd = c.redemptions || [];
      const redeemed = rd.filter((r) => r.status === "redeemed").length;
      const holding = rd.filter((r) => r.status === "reserved" && new Date(r.expires_at).getTime() > now).length;
      const abandoned = rd.filter((r) => r.status === "reserved" && new Date(r.expires_at).getTime() <= now).length;
      const id = escapeHtml(c.id);
      return `
    <tr class="border-b border-gray-100${c.is_active ? "" : " opacity-60"}">
      <td class="py-3 px-4">
        <button type="button" class="sup-code" data-copy="${escapeHtml(c.code)}" title="Bấm để chép">${escapeHtml(c.code)}</button>
        ${c.note ? `<div class="text-[11px] text-gray-400 mt-1">${escapeHtml(c.note)}</div>` : ""}
      </td>
      <td class="py-3 px-4 text-sm font-semibold text-gray-800">
        ${promoOff(c.discount_type, c.discount_value)}
        ${c.min_order_amount ? `<div class="text-[11px] font-normal text-gray-400">đơn từ ${promoVnd(c.min_order_amount)}</div>` : ""}
      </td>
      <td class="py-3 px-4 text-sm text-gray-700">
        ${used}/${c.max_uses == null ? "∞" : c.max_uses}
        ${redeemed ? `<div class="text-[11px] text-emerald-600">${redeemed} đã thanh toán</div>` : ""}
        ${holding ? `<div class="text-[11px] text-amber-500">${holding} đang chờ trả tiền</div>` : ""}
        ${abandoned ? `<div class="text-[11px] text-gray-400">${abandoned} bỏ ngang (mất lượt)</div>` : ""}
      </td>
      <td class="py-3 px-4 text-sm text-gray-600">${c.expires_at ? new Date(c.expires_at).toLocaleDateString("vi-VN") : "Không hết hạn"}</td>
      <td class="py-3 px-4"><span class="px-2 py-1 rounded-full text-xs ${PROMO_BADGE[st][0]}">${PROMO_BADGE[st][1]}</span></td>
      <td class="py-3 px-4 text-right whitespace-nowrap">
        ${c.max_uses == null ? "" : `<x-button variant="ghost" tone="neutral" size="sm" icon-only icon="plus" data-id="${id}" onclick="promoAddUses(this.dataset.id)" title="Cộng thêm lượt" aria-label="Cộng thêm lượt"></x-button>`}
        <x-button variant="ghost" tone="neutral" size="sm" data-id="${id}" onclick="promoToggle(this.dataset.id)">${c.is_active ? "Tắt" : "Bật"}</x-button>
        <x-button variant="ghost" tone="danger" size="sm" icon-only icon="trash-2" data-id="${id}" onclick="promoDelete(this.dataset.id)" title="Xoá mã" aria-label="Xoá mã"></x-button>
      </td>
    </tr>`;
    })
    .join("");
  window.lucide?.createIcons({ root: tbody });
}

async function promoPatch(payload, okMsg) {
  try {
    await promoReq("PATCH", { payload });
    showToast(okMsg, "success");
    loadPromoCodes();
  } catch (e) {
    showAlert("Chưa sửa được mã", e.message);
  }
}

function promoToggle(id) {
  const c = promoCodes.find((x) => x.id === id);
  if (c) promoPatch({ id, is_active: !c.is_active }, c.is_active ? `Đã tắt ${c.code}` : `Đã bật ${c.code}`);
}

// Lượt đã trừ thì không hoàn: mã bị khách bỏ ngang đốt mất lượt thì đây là đường cấp bù.
async function promoAddUses(id) {
  const c = promoCodes.find((x) => x.id === id);
  if (!c) return;
  const input = await showPrompt("Cộng thêm lượt", {
    message: `Mã ${c.code} đang dùng ${c.used_count || 0}/${c.max_uses} lượt.`,
    value: "5",
    okText: "Cộng lượt",
  });
  if (input === null) return;
  const extra = Number(input);
  if (!Number.isInteger(extra) || extra <= 0) return showAlert("Số lượt không hợp lệ", "Nhập một số nguyên lớn hơn 0.");
  promoPatch({ id, max_uses: Number(c.max_uses) + extra }, `Đã cộng ${extra} lượt cho ${c.code}`);
}

async function promoDelete(id) {
  const c = promoCodes.find((x) => x.id === id);
  if (!c) return;
  if (!(await showConfirm("Xoá mã?", `Xoá vĩnh viễn mã ${c.code}. Mã đã có đơn thanh toán thì chỉ tắt được.`, { confirmText: "Xoá mã" }))) return;
  try {
    await promoReq("DELETE", { query: { id } });
    showToast(`Đã xoá mã ${c.code}`, "success");
    loadPromoCodes();
  } catch (e) {
    showAlert("Chưa xoá được mã", e.message);
  }
}

promoEl("promo-type-seg").addEventListener("click", (e) => {
  const b = e.target.closest("[data-type]");
  if (b && b.dataset.type !== promoEl("promo-type").value) promoSetType(b.dataset.type);
});
promoEl("promo-mode-seg").addEventListener("click", (e) => {
  const b = e.target.closest("[data-mode]");
  if (b) promoSetMode(b.dataset.mode);
});
// Mọi ô của khung tạo mã vẽ lại vé xem trước.
promoEl("sup-tab-promo").addEventListener("input", (e) => {
  if (e.target.id === "promo-search") return;
  if (e.target.id === "promo-expires") promoExpiresSync();
  promoPreview();
});
// Nút x trong ô Hạn dùng: chỉ hiện khi đã chọn ngày; xoá = không hết hạn.
function promoExpiresSync() {
  promoEl("promo-expires-clear").classList.toggle("hidden", !promoEl("promo-expires").value);
}
promoEl("promo-expires-clear").addEventListener("click", () => {
  const input = promoEl("promo-expires");
  input.value = "";
  promoExpiresSync();
  promoPreview();
  input.focus();
});
// Bấm vé nhỏ / chip mã ở danh sách là chép mã.
promoEl("sup-tab-promo").addEventListener("click", (e) => {
  const b = e.target.closest("[data-copy]");
  if (b?.dataset.copy) promoCopy(b.dataset.copy, `Đã chép ${b.dataset.copy}`);
});
promoPreview();
