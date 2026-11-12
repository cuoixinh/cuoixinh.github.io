// Phần "Thống kê theo tháng" của tab Mã giảm giá (/admin-support): bảng kê đơn đã thanh toán có dùng mã
// trong tháng, gom theo NGƯỜI NHẬN mã = ô Ghi chú của mã (gộp không phân biệt hoa/thường, khoảng trắng) —
// căn cứ trả hoa hồng giới thiệu. Dữ liệu: wedding-admin?resource=promo-codes&view=report. Nạp SAU promo.js.

let prData = null;
let prSeq = 0;
let prLoaded = false;
let prMonth = ""; // YYYY-MM đang xem

const prEl = (id) => document.getElementById(id);
const prNum = (n) => Number(n || 0).toLocaleString("vi-VN");
const prVnd = (n) => `${prNum(n)}đ`;
// Giờ Việt Nam (UTC+7) — tháng ở đây là kỳ trả tiền, phải khớp với ranh giới server dùng.
const prVn = (t) => new Date(new Date(t).getTime() + 7 * 3600 * 1000);
const prNowMonth = () => prVn(Date.now()).toISOString().slice(0, 7);
const prDay = (t) => {
  const d = prVn(t).toISOString();
  return { date: `${d.slice(8, 10)}/${d.slice(5, 7)}`, time: d.slice(11, 16), full: `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)} ${d.slice(11, 16)}` };
};
const prPersonKey = (note) => String(note || "").trim().replace(/\s+/g, " ").toLowerCase();
// Chữ cái đầu của TÊN (từ cuối, kiểu tên người Việt): "Nguyễn Hà Linh" → "L".
const prInitial = (name) => (name.split(" ").pop() || "?").charAt(0).toUpperCase();

function prSetView(view) {
  promoSeg(prEl("promo-view-seg"), "data-view", view, "aria-selected");
  prEl("promo-view-manage").classList.toggle("hidden", view !== "manage");
  prEl("promo-view-report").classList.toggle("hidden", view !== "report");
  if (view === "report" && !prLoaded) {
    prLoaded = true;
    prMonth = prNowMonth();
    prLoad();
  }
}

function prShift(d) {
  const [y, m] = (prMonth || prNowMonth()).split("-").map(Number);
  prPick(new Date(Date.UTC(y, m - 1 + d, 1)).toISOString().slice(0, 7));
}

function prPick(month) {
  if (!month || month > prNowMonth() || month === prMonth) return;
  prMonth = month;
  prEl("pr-month").value = month;
  prLoad();
}

// Khoá nút "Tháng sau" khi đang ở tháng hiện tại (nhãn tháng do <x-date> tự vẽ).
function prSyncHead(month) {
  const next = prEl("pr-next");
  if (next) next.disabled = month >= prNowMonth();
}

async function prLoad() {
  const month = prMonth || (prMonth = prNowMonth());
  const seq = ++prSeq;
  prSyncHead(month);
  prEl("pr-summary").textContent = "Đang tải…";
  prEl("pr-people").innerHTML = `<div class="sup-ledger-wait" aria-hidden="true"><i></i><i></i><i></i></div>`;
  try {
    const data = await supRequest("promo-codes", "GET", { query: { view: "report", month } });
    if (seq !== prSeq) return; // đã đổi sang tháng khác trong lúc chờ
    prData = data;
    prRender();
  } catch (e) {
    if (seq !== prSeq) return;
    prData = null;
    prEl("pr-summary").textContent = "";
    prEl("pr-people").innerHTML = `<div class="p-6 space-y-3"><p class="text-sm text-red-500">${escapeHtml(e.message)}</p><x-button variant="outline" size="sm" onclick="prLoad()">Tải lại</x-button></div>`;
  }
}

// Gom đơn theo người nhận, rồi theo mã trong từng người.
function prGroups() {
  const map = new Map();
  for (const o of prData.orders) {
    const key = prPersonKey(o.note);
    let g = map.get(key);
    if (!g) {
      g = { key, name: key ? String(o.note).trim().replace(/\s+/g, " ") : "", orders: [], codes: new Map(), final: 0, discount: 0 };
      map.set(key, g);
    }
    g.orders.push(o);
    g.codes.set(o.code, (g.codes.get(o.code) || 0) + 1);
    g.final += Number(o.final_amount) || 0;
    g.discount += Number(o.discount_amount) || 0;
  }
  // Nhiều tiền nhất lên đầu; nhóm "chưa ghi người nhận" luôn cuối.
  return [...map.values()].sort((a, b) => (a.key ? 0 : 1) - (b.key ? 0 : 1) || b.final - a.final || b.orders.length - a.orders.length);
}

function prRender() {
  const orders = prData.orders;
  const groups = prGroups();
  const final = orders.reduce((n, o) => n + (Number(o.final_amount) || 0), 0);
  const discount = orders.reduce((n, o) => n + (Number(o.discount_amount) || 0), 0);
  const named = groups.filter((g) => g.key);
  const loose = groups.find((g) => !g.key);
  const box = prEl("pr-people");

  if (!orders.length) {
    prEl("pr-summary").textContent = "Chưa có đơn nào dùng mã giảm giá trong tháng này.";
    box.innerHTML = `<div class="sup-ledger-empty">
        <i data-lucide="ticket" style="width:24px;height:24px"></i>
        <p>Khi khách thanh toán bằng mã của người giới thiệu, đơn sẽ hiện ở đây theo từng người.</p>
        <x-button variant="outline" size="sm" icon="plus" onclick="prSetView('manage')">Tạo mã cho người giới thiệu</x-button>
      </div>`;
    window.lucide?.createIcons({ root: box });
    return;
  }

  prEl("pr-summary").innerHTML =
    `<strong>${prNum(orders.length)} đơn</strong> dùng mã` +
    (named.length ? ` từ <strong>${prNum(named.length)} người giới thiệu</strong>` : "") +
    `. Khách đã trả <strong>${prVnd(final)}</strong> sau khi được giảm ${prVnd(discount)}.` +
    (loose ? ` <span class="sup-statement-warn">${prNum(loose.orders.length)} đơn đến từ mã chưa ghi người nhận.</span>` : "");

  // Thanh tỉ phần: phần thực thu của người đó trên cả tháng; tháng toàn đơn 0đ (mã 100%) thì theo số đơn.
  const share = (g) => (final > 0 ? g.final / final : g.orders.length / orders.length);
  box.innerHTML = groups
    .map((g) => {
      const pct = Math.round(share(g) * 100);
      const codes = [...g.codes].map(([code, n]) => `<span class="sup-code">${escapeHtml(code)}${n > 1 ? `<small>×${n}</small>` : ""}</span>`).join("");
      return `<details class="sup-row${g.key ? "" : " is-loose"}">
        <summary>
          <span class="sup-row-av" aria-hidden="true">${g.key ? escapeHtml(prInitial(g.name)) : "?"}</span>
          <span class="sup-row-who">
            <span class="sup-row-name">${g.key ? escapeHtml(g.name) : "Chưa ghi người nhận"}</span>
            <span class="sup-row-codes">${codes}</span>
            <span class="sup-row-share" style="--p:${pct}%" aria-hidden="true"></span>
            <span class="sup-row-meta">${prNum(g.orders.length)} đơn, khách được giảm ${prVnd(g.discount)}, chiếm ${pct}% thực thu tháng</span>
            ${g.key ? "" : `<span class="sup-row-hint">Mở mã ở phần Tạo &amp; quản lý, ghi tên người nhận vào Ghi chú để tính cho đúng người.</span>`}
          </span>
          <span class="sup-row-amt"><b>${prVnd(g.final)}</b><small>thực thu</small></span>
          <i data-lucide="chevron-down" class="sup-row-chev" style="width:16px;height:16px" aria-hidden="true"></i>
        </summary>
        <ol class="sup-orders">${g.orders
          .map((o) => {
            const d = prDay(o.redeemed_at);
            return `<li>
              <span class="sup-orders-day"><b>${d.date}</b><small>${d.time}</small></span>
              <span class="sup-orders-who">
                <span>${escapeHtml(o.couple || "Thiệp chưa có tên")}</span>
                <small>${o.slug ? `/${escapeHtml(o.slug)}, ` : ""}mã ${escapeHtml(o.code)}, đơn ${escapeHtml(o.order_id)}</small>
              </span>
              <span class="sup-orders-off">−${prVnd(o.discount_amount)}<small>trên ${prVnd(o.base_amount)}</small></span>
              <span class="sup-orders-amt">${prVnd(o.final_amount)}</span>
            </li>`;
          })
          .join("")}</ol>
      </details>`;
    })
    .join("");
  window.lucide?.createIcons({ root: box });
}

// CSV từng đơn (mở được bằng Excel: có BOM UTF-8, mọi ô đều bọc nháy kép).
function prExportCsv() {
  if (!prData?.orders.length) return showToast("Tháng này chưa có đơn nào để tải", "info");
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["nguoi_nhan", "ma", "thoi_gian", "thiep", "slug", "gia_goc", "giam", "thuc_thu", "ma_don"]];
  for (const g of prGroups()) {
    for (const o of g.orders) {
      rows.push([g.name || "(chưa ghi)", o.code, prDay(o.redeemed_at).full, o.couple || "", o.slug || "", o.base_amount, o.discount_amount, o.final_amount, o.order_id]);
    }
  }
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `ma-giam-gia-thang-${prData.month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

prEl("promo-view-seg").addEventListener("click", (e) => {
  const b = e.target.closest("[data-view]");
  if (b) prSetView(b.dataset.view);
});
// <x-date level="month"> phát "change" khi chọn tháng ở bảng.
prEl("pr-month").addEventListener("change", (e) => prPick(e.currentTarget.value));
