// ============= TAB: Mã giảm giá =============
// Sinh mã hàng loạt / bật-tắt / xoá. Việc TIÊU lượt của mã nằm ở payment-handler
// (hàm cx_promo_reserve, xem changelogs/RC1.8) — màn này chỉ quản lý danh mục.

let promoCodes = [];
let lastPromoBatch = [];
let promoLoaded = false;

function initPromoPanel() {
  if (!promoLoaded) {
    promoLoaded = true;
    document
      .getElementById("promo-type")
      .addEventListener("change", updatePromoValueHint);
    updatePromoValueHint();
  }
  loadPromoCodes();
}

function updatePromoValueHint() {
  const type = document.getElementById("promo-type").value;
  document.getElementById("promo-value-hint").textContent =
    type === "percent" ? "20 = giảm 20%" : "20000 = giảm 20.000đ";
}

// Đọc phần thiết lập giảm giá dùng chung cho cả sinh hàng loạt lẫn tạo mã tay.
function readPromoSettings() {
  const maxUsesRaw = document.getElementById("promo-max-uses").value.trim();
  const expires = document.getElementById("promo-expires").value;
  return {
    discount_type: document.getElementById("promo-type").value,
    discount_value: Number(document.getElementById("promo-value").value),
    // Ngày nhập là hạn CUỐI → lấy hết ngày đó (23:59:59 giờ máy admin).
    expires_at: expires ? new Date(expires + "T23:59:59").toISOString() : null,
    min_order_amount: Number(document.getElementById("promo-min-order").value) || 0,
    max_uses: maxUsesRaw === "" ? null : Number(maxUsesRaw),
    note: document.getElementById("promo-note").value.trim() || null,
  };
}

async function promoPost(payload, btnId) {
  const btn = btnId ? document.getElementById(btnId) : null;
  const originalHTML = btn?.innerHTML;
  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang sinh...';
    }

    const res = await fetch(`${EDGE_URL}?resource=promo-codes`, {
      method: "POST",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Không sinh được mã");

    lastPromoBatch = data.codes || [];
    renderPromoBatch(data.batch_id);
    showToast(`Đã tạo ${lastPromoBatch.length} mã`, "success");
    await loadPromoCodes();
  } catch (e) {
    showAlert("Lỗi", e.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }
}

async function promoGenerate() {
  const settings = readPromoSettings();
  if (!settings.discount_value || settings.discount_value <= 0) {
    showAlert("Thiếu thông tin", "Nhập giá trị giảm lớn hơn 0");
    return;
  }
  if (settings.discount_type === "percent" && settings.discount_value > 100) {
    showAlert("Sai giá trị", "Giảm theo % không vượt quá 100");
    return;
  }

  await promoPost(
    {
      mode: "generate",
      prefix: document.getElementById("promo-prefix").value.trim(),
      count: Number(document.getElementById("promo-count").value) || 1,
      length: Number(document.getElementById("promo-length").value) || 6,
      ...settings,
    },
    "promo-generate-btn",
  );
}

async function promoCreateSingle() {
  const code = document.getElementById("promo-manual-code").value.trim().toUpperCase();
  if (!code) {
    showAlert("Thiếu mã", "Nhập mã bạn muốn tạo");
    return;
  }
  await promoPost({ mode: "single", code, ...readPromoSettings() });
  document.getElementById("promo-manual-code").value = "";
}

function renderPromoBatch(batchId) {
  const box = document.getElementById("promo-batch-result");
  if (!lastPromoBatch.length) {
    box.classList.add("hidden");
    return;
  }
  box.classList.remove("hidden");
  document.getElementById("promo-batch-title").textContent =
    `Vừa tạo ${lastPromoBatch.length} mã (lô ${batchId})`;
  document.getElementById("promo-batch-codes").innerHTML = lastPromoBatch
    .map(
      (c) =>
        `<span class="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-mono font-semibold">${escapeHtml(c.code)}</span>`,
    )
    .join("");
}

function promoCopyBatch() {
  if (!lastPromoBatch.length) return;
  const text = lastPromoBatch.map((c) => c.code).join("\n");
  navigator.clipboard
    .writeText(text)
    .then(() => showToast(`Đã chép ${lastPromoBatch.length} mã`, "success"))
    .catch(() => showToast("Trình duyệt chặn chép tự động", "error"));
}

function promoExportCsv() {
  if (!lastPromoBatch.length) return;
  const rows = [
    ["code", "discount_type", "discount_value", "max_uses", "expires_at"],
    ...lastPromoBatch.map((c) => [
      c.code,
      c.discount_type,
      c.discount_value,
      c.max_uses ?? "",
      c.expires_at ?? "",
    ]),
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `promo-codes-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function promoOnSearchKey(e) {
  if (e.key === "Enter") loadPromoCodes();
}

async function loadPromoCodes() {
  const tbody = document.getElementById("promo-list");
  try {
    const q = document.getElementById("promo-search").value.trim();
    const res = await fetch(
      `${EDGE_URL}?resource=promo-codes${q ? `&q=${encodeURIComponent(q)}` : ""}`,
      { headers: adminHeaders() },
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Lỗi tải danh sách mã");
    }
    promoCodes = await res.json();
    renderPromoCodes();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-red-500">${escapeHtml(e.message)}</td></tr>`;
  }
}

function renderPromoCodes() {
  const tbody = document.getElementById("promo-list");
  if (!promoCodes.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-400">Chưa có mã nào</td></tr>`;
    return;
  }

  const now = Date.now();
  tbody.innerHTML = promoCodes
    .map((c) => {
      const used = c.used_count || 0;
      const quota = c.max_uses == null ? "∞" : c.max_uses;
      const usedUp = c.max_uses != null && used >= c.max_uses;
      const expired = c.expires_at && new Date(c.expires_at).getTime() < now;

      let status = `<span class="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">Đang chạy</span>`;
      if (!c.is_active) {
        status = `<span class="px-2 py-1 rounded text-xs bg-gray-100 text-gray-500">Đã tắt</span>`;
      } else if (expired) {
        status = `<span class="px-2 py-1 rounded text-xs bg-amber-100 text-amber-700">Hết hạn</span>`;
      } else if (usedUp) {
        status = `<span class="px-2 py-1 rounded text-xs bg-rose-100 text-rose-600">Hết lượt</span>`;
      }

      const discount =
        c.discount_type === "percent"
          ? `${c.discount_value}%`
          : `${Number(c.discount_value).toLocaleString("vi-VN")}đ`;

      // Lượt đã trừ chia làm 3 nhóm: đã thanh toán, đang chờ trả tiền (còn trong
      // 5 phút), và bỏ ngang — nhóm cuối vẫn tính là đã tiêu lượt, không hoàn.
      const rd = c.redemptions || [];
      const redeemed = rd.filter((r) => r.status === "redeemed").length;
      const holding = rd.filter(
        (r) => r.status === "reserved" && new Date(r.expires_at) > new Date(),
      ).length;
      const abandoned = rd.filter(
        (r) => r.status === "reserved" && new Date(r.expires_at) <= new Date(),
      ).length;

      return `
    <tr class="border-b border-gray-100 hover:bg-gray-50">
      <td class="py-3 px-4">
        <button onclick="promoCopyOne('${escapeHtml(c.code)}')"
          class="font-mono text-sm font-semibold text-gray-800 hover:text-emerald-600" title="Bấm để chép">
          ${escapeHtml(c.code)}
        </button>
        ${c.note ? `<div class="text-[11px] text-gray-400 mt-0.5">${escapeHtml(c.note)}</div>` : ""}
      </td>
      <td class="py-3 px-4 text-sm text-gray-700">
        ${discount}
        ${c.min_order_amount ? `<div class="text-[11px] text-gray-400">đơn từ ${Number(c.min_order_amount).toLocaleString("vi-VN")}đ</div>` : ""}
      </td>
      <td class="py-3 px-4 text-sm text-gray-700">
        ${used}/${quota}
        ${redeemed ? `<div class="text-[11px] text-emerald-600">${redeemed} đã thanh toán</div>` : ""}
        ${holding ? `<div class="text-[11px] text-amber-500">${holding} đang chờ trả tiền</div>` : ""}
        ${abandoned ? `<div class="text-[11px] text-gray-400">${abandoned} bỏ ngang (mất lượt)</div>` : ""}
      </td>
      <td class="py-3 px-4 text-sm text-gray-600">
        ${c.expires_at ? new Date(c.expires_at).toLocaleDateString("vi-VN") : "Không hết hạn"}
      </td>
      <td class="py-3 px-4">${status}</td>
      <td class="py-3 px-4 text-right whitespace-nowrap">
        ${
          c.max_uses == null
            ? ""
            : `<x-button variant="ghost" tone="neutral" size="sm" icon-only icon="fas fa-plus"
                 onclick="promoAddUses('${c.id}')" label="Cộng thêm lượt"></x-button>`
        }
        <x-button variant="ghost" tone="neutral" size="sm" onclick="promoToggle('${c.id}', ${!c.is_active})">
          ${c.is_active ? "Tắt" : "Bật"}
        </x-button>
        <x-button variant="ghost" tone="danger" size="sm" icon-only icon="fas fa-trash"
          onclick="promoDelete('${c.id}', '${escapeHtml(c.code)}')" label="Xoá mã"></x-button>
      </td>
    </tr>`;
    })
    .join("");
}

function promoCopyOne(code) {
  navigator.clipboard
    .writeText(code)
    .then(() => showToast(`Đã chép ${code}`, "success"))
    .catch(() => showToast("Trình duyệt chặn chép tự động", "error"));
}

// Nâng trần lượt dùng. Cần thiết vì lượt đã trừ thì không hoàn: mã bị khách bỏ
// ngang đốt mất vài lượt thì đây là đường duy nhất để cấp bù.
async function promoAddUses(id) {
  const code = promoCodes.find((c) => c.id === id);
  if (!code) return;

  const input = prompt(
    `Mã ${code.code} đang là ${code.used_count || 0}/${code.max_uses} lượt.\nCộng thêm bao nhiêu lượt?`,
    "5",
  );
  if (input === null) return;

  const extra = Number(input);
  if (!Number.isFinite(extra) || extra <= 0) {
    showAlert("Sai giá trị", "Nhập một số lớn hơn 0");
    return;
  }

  try {
    const res = await fetch(`${EDGE_URL}?resource=promo-codes`, {
      method: "PATCH",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ id, max_uses: Number(code.max_uses) + extra }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Không cộng được lượt");
    showToast(`Đã cộng ${extra} lượt cho ${code.code}`, "success");
    await loadPromoCodes();
  } catch (e) {
    showAlert("Lỗi", e.message);
  }
}

async function promoToggle(id, isActive) {
  try {
    const res = await fetch(`${EDGE_URL}?resource=promo-codes`, {
      method: "PATCH",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ id, is_active: isActive }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Không đổi được trạng thái");
    showToast(isActive ? "Đã bật mã" : "Đã tắt mã", "success");
    await loadPromoCodes();
  } catch (e) {
    showAlert("Lỗi", e.message);
  }
}

async function promoDelete(id, code) {
  const ok = await showConfirm("Xoá mã?", `Xoá vĩnh viễn mã ${code}.`, {
    confirmText: "Xoá",
  });
  if (!ok) return;

  try {
    const res = await fetch(`${EDGE_URL}?resource=promo-codes&id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: adminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Không xoá được mã");
    showToast("Đã xoá mã", "success");
    await loadPromoCodes();
  } catch (e) {
    showAlert("Không xoá được", e.message);
  }
}
