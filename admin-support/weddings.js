// Tab "Thiệp của khách" của /admin-support: số liệu phân tích (con số chính, phân bố theo trạng thái,
// theo tháng, theo mẫu) + danh sách thiệp lọc/tìm/sắp xếp ở client. Server tính sẵn trạng thái từng
// thiệp (support-weddings.ts) — trang chỉ gom và vẽ, đừng tự suy trạng thái từ cột thô. Nạp SAU index.js.

let stData = null;
let stFilter = "all";
let stPage = 1;
const ST_PAGE = 50;

// Nhóm hiển thị: màu gắn với NHÓM (không theo thứ hạng), đã qua validate_palette (light, adjacent).
const ST_GROUPS = [
  { key: "lifetime", label: "Vĩnh viễn", color: "#2a78d6", statuses: ["lifetime"] },
  { key: "6m", label: "Gói 6 tháng", color: "#eb6834", statuses: ["6m", "6m_expired"] },
  { key: "free", label: "Miễn phí", color: "#1baf7a", statuses: ["free", "free_expired"] },
  { key: "trial", label: "Dùng thử", color: "#eda100", statuses: ["trial", "trial_expired"] },
  { key: "draft", label: "Nháp", color: "#e87ba4", statuses: ["draft"] },
];
const ST_LABEL = {
  lifetime: "Vĩnh viễn",
  "6m": "Gói 6 tháng",
  "6m_expired": "Gói 6 tháng, hết hạn",
  free: "Miễn phí",
  free_expired: "Miễn phí, hết hạn",
  trial: "Dùng thử",
  trial_expired: "Dùng thử, hết hạn",
  draft: "Nháp, chưa xuất bản",
};
const ST_GROUP_OF = Object.fromEntries(ST_GROUPS.flatMap((g) => g.statuses.map((s) => [s, g])));
const ST_PAID = new Set(["lifetime", "6m", "6m_expired"]);
const ST_EXPIRED = new Set(["6m_expired", "free_expired", "trial_expired"]);

// Bộ lọc danh sách: nhóm + vài lát cắt hay dùng để phân tích.
const ST_FILTERS = [
  { key: "all", label: "Tất cả", test: () => true },
  { key: "paid", label: "Đã thanh toán", test: (w) => ST_PAID.has(w.status) },
  { key: "unpaid_pub", label: "Xuất bản, chưa thanh toán", test: (w) => w.status.startsWith("free") || w.status.startsWith("trial") },
  ...ST_GROUPS.map((g) => ({ key: g.key, label: g.label, test: (w) => g.statuses.includes(w.status) })),
  { key: "expired", label: "Đã hết hạn", test: (w) => ST_EXPIRED.has(w.status) },
  { key: "nearcap", label: "Sắp chạm trần lượt xem", test: (w) => !ST_PAID.has(w.status) && w.published && w.views >= stCap() * 0.8 },
  { key: "hidden", label: "Khách đã ẩn", test: (w) => w.hidden },
];

const stEl = (id) => document.getElementById(id);
const stNum = (n) => Number(n || 0).toLocaleString("vi-VN");
const stVnd = (n) => `${stNum(n)}đ`;
const stPct = (a, b) => (b ? `${Math.round((a / b) * 1000) / 10}%`.replace(".", ",") : "0%");
const stDate = (t) => (t ? new Date(t).toLocaleDateString("vi-VN") : "");
const stCap = () => stData?.view_cap || 200;

async function stLoad() {
  stEl("st-updated").textContent = "Đang tải số liệu…";
  try {
    stData = await supRequest("support-weddings", "GET");
  } catch (e) {
    stEl("st-updated").textContent = "";
    stEl("st-kpis").innerHTML = `<p class="p-6 text-sm text-red-500">${escapeHtml(e.message)}</p>`;
    return;
  }
  const t = new Date(stData.generated_at);
  stEl("st-updated").textContent =
    `Số liệu lúc ${t.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} ngày ${t.toLocaleDateString("vi-VN")}` +
    (stData.truncated ? ". Quá nhiều thiệp, số liệu chỉ tính trên phần đã đọc." : "");
  stRenderKpis();
  stRenderStack();
  stRenderMonths();
  stRenderThemes();
  stRenderChips();
  stRenderList();
}

function stRenderKpis() {
  const s = stData.summary;
  const unpaidViews = s.views.free + s.views.free_expired + s.views.trial + s.views.trial_expired;
  const tiles = [
    ["Tổng số thiệp", stNum(s.total), s.hidden ? `${stNum(s.hidden)} thiệp khách đã ẩn` : "Kể cả nháp chưa xuất bản"],
    ["Khách có thiệp", stNum(s.owners), `${stNum(s.paid_owners)} khách đã trả tiền, ${stNum(s.multi_owners)} khách có từ 2 thiệp`],
    ["Đã thanh toán", stNum(s.paid), `Tỉ lệ chuyển đổi ${stPct(s.paid, s.paid + s.published_unpaid)} trên thiệp đã xuất bản`],
    ["Doanh thu", stVnd(s.revenue), s.paid ? `Trung bình ${stVnd(Math.round(s.revenue / s.paid))} mỗi thiệp` : "Chưa có thiệp trả tiền"],
    ["Lượt xem thiệp", stNum(s.total_views), `${stNum(unpaidViews)} lượt trên thiệp chưa thanh toán`],
  ];
  stEl("st-kpis").innerHTML = tiles
    .map(
      ([label, value, sub]) => `<div class="sup-kpi">
        <p class="text-xs font-medium text-gray-500">${label}</p>
        <p class="sup-kpi-v">${value}</p>
        <p class="text-[11px] text-gray-400">${escapeHtml(sub)}</p>
      </div>`,
    )
    .join("");
}

const stGroupCount = (g) => g.statuses.reduce((n, s) => n + stData.summary.counts[s], 0);
const stGroupViews = (g) => g.statuses.reduce((n, s) => n + stData.summary.views[s], 0);
const stGroupExpired = (g) => g.statuses.filter((s) => ST_EXPIRED.has(s)).reduce((n, s) => n + stData.summary.counts[s], 0);

function stRenderStack() {
  const s = stData.summary;
  const total = s.total || 1;
  const groups = ST_GROUPS.map((g) => ({ g, n: stGroupCount(g) }));
  stEl("st-stack").setAttribute(
    "aria-label",
    `Phân bố ${stNum(s.total)} thiệp: ` + groups.map(({ g, n }) => `${g.label} ${stNum(n)}`).join(", "),
  );
  stEl("st-stack").innerHTML = groups
    .filter(({ n }) => n > 0)
    .map(
      ({ g, n }) =>
        `<button type="button" class="sup-seg-part" data-filter="${g.key}" style="flex-grow:${n};background:${g.color}"
          data-tip="${escapeHtml(`${g.label}: ${stNum(n)} thiệp (${stPct(n, total)})`)}" aria-label="${escapeHtml(g.label)}"></button>`,
    )
    .join("");
  stEl("st-legend").innerHTML = groups
    .map(({ g, n }) => {
      const exp = stGroupExpired(g);
      return `<button type="button" class="sup-leg${stFilter === g.key ? " is-on" : ""}" data-filter="${g.key}">
          <i style="background:${g.color}"></i>
          <span class="sup-leg-name">${g.label}</span>
          <span class="sup-leg-n">${stNum(n)} <small>${stPct(n, total)}</small></span>
          <span class="sup-leg-sub">${stNum(stGroupViews(g))} lượt xem${exp ? `, ${stNum(exp)} đã hết hạn` : ""}</span>
        </button>`;
    })
    .join("");
  const notes = [
    ["unpaid_pub", `${stNum(s.published_unpaid)} thiệp đã xuất bản nhưng chưa thanh toán`],
    ["nearcap", `${stNum(s.near_view_cap)} thiệp chưa thanh toán đã dùng từ 80% trần ${stNum(stCap())} lượt xem`],
  ];
  stEl("st-notes").innerHTML = notes
    .map(([f, text]) => `<button type="button" class="sup-note" data-filter="${f}">${escapeHtml(text)}</button>`)
    .join("");
}

function stRenderMonths() {
  const box = stEl("st-months");
  const rows = stData.months;
  if (!rows.length) {
    box.innerHTML = `<p class="text-sm text-gray-400">Chưa có thiệp nào.</p>`;
    return;
  }
  const max = Math.max(1, ...rows.map((m) => Math.max(m.created, m.paid)));
  box.innerHTML = rows
    .map((m) => {
      const [y, mo] = m.month.split("-");
      const tip = `Tháng ${Number(mo)}/${y}: ${stNum(m.created)} thiệp tạo mới, ${stNum(m.paid)} thiệp thanh toán (${stVnd(m.revenue)})`;
      return `<div class="sup-col" data-tip="${escapeHtml(tip)}" tabindex="0" aria-label="${escapeHtml(tip)}">
          <div class="sup-col-bars">
            <i style="height:${(m.created / max) * 100}%;background:#6250d6"></i>
            <i style="height:${(m.paid / max) * 100}%;background:#008300"></i>
          </div>
          <span>T${Number(mo)}</span>
        </div>`;
    })
    .join("");
}

function stRenderThemes() {
  const box = stEl("st-themes");
  const all = stData.themes;
  if (!all.length) {
    box.innerHTML = `<p class="text-sm text-gray-400">Chưa có thiệp nào.</p>`;
    return;
  }
  const top = all.slice(0, 8);
  const rest = all.slice(8);
  if (rest.length) {
    top.push(
      rest.reduce((a, t) => ({ theme: `${rest.length} mẫu khác`, total: a.total + t.total, paid: a.paid + t.paid, revenue: a.revenue + t.revenue }), {
        total: 0,
        paid: 0,
        revenue: 0,
      }),
    );
  }
  const max = Math.max(...top.map((t) => t.total));
  box.innerHTML = top
    .map(
      (t) => `<div class="sup-meter" data-tip="${escapeHtml(`${t.theme}: ${stNum(t.total)} thiệp, ${stNum(t.paid)} đã thanh toán, ${stVnd(t.revenue)}`)}">
        <div class="flex items-baseline justify-between gap-3 text-sm">
          <span class="truncate text-gray-700">${escapeHtml(t.theme)}</span>
          <span class="shrink-0 text-gray-500"><strong class="text-gray-800">${stNum(t.total)}</strong> thiệp, ${stNum(t.paid)} đã trả</span>
        </div>
        <div class="sup-meter-track"><i style="width:${(t.total / max) * 100}%"></i><b style="width:${(t.paid / max) * 100}%"></b></div>
      </div>`,
    )
    .join("");
}

function stRenderChips() {
  const all = stData.weddings;
  stEl("st-chips").innerHTML = ST_FILTERS.map((f) => {
    const n = all.filter(f.test).length;
    return `<button type="button" role="tab" aria-selected="${stFilter === f.key}" class="sup-chip${stFilter === f.key ? " is-on" : ""}" data-filter="${f.key}">${f.label} <small>${stNum(n)}</small></button>`;
  }).join("");
}

function stRows() {
  const f = ST_FILTERS.find((x) => x.key === stFilter) || ST_FILTERS[0];
  const q = stEl("st-search").value.trim().toLowerCase();
  const rows = stData.weddings.filter(
    (w) => f.test(w) && (!q || `${w.couple} ${w.slug} ${w.owner || ""} ${w.theme || ""}`.toLowerCase().includes(q)),
  );
  const sort = stEl("st-sort").value;
  const time = (t, none) => (t ? new Date(t).getTime() : none);
  const by = {
    created: (a, b) => time(b.created_at, 0) - time(a.created_at, 0),
    views: (a, b) => b.views - a.views,
    amount: (a, b) => b.amount - a.amount,
    expires: (a, b) => time(a.expires_at, Infinity) - time(b.expires_at, Infinity),
  }[sort];
  return rows.sort(by);
}

function stRenderList() {
  const rows = stRows();
  const pages = Math.max(1, Math.ceil(rows.length / ST_PAGE));
  stPage = Math.min(stPage, pages);
  stEl("st-list-count").textContent = `(${stNum(rows.length)})`;
  const tbody = stEl("st-list");
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-400">Không có thiệp nào khớp bộ lọc này. Chọn "Tất cả" hoặc xoá ô tìm kiếm.</td></tr>`;
    stEl("st-pager").innerHTML = "";
    return;
  }
  const now = Date.now();
  tbody.innerHTML = rows
    .slice((stPage - 1) * ST_PAGE, stPage * ST_PAGE)
    .map((w) => {
      const g = ST_GROUP_OF[w.status];
      const expired = ST_EXPIRED.has(w.status);
      const cap = !ST_PAID.has(w.status) && w.published;
      const site = typeof ACC_SITE === "string" ? ACC_SITE : "";
      const exp = w.expires_at ? new Date(w.expires_at).getTime() : null;
      const days = exp ? Math.ceil((exp - now) / 86400000) : null;
      return `<tr class="border-b border-gray-100${w.hidden ? " opacity-60" : ""}">
        <td class="py-3 px-4 text-sm">
          <div class="font-medium text-gray-800">${escapeHtml(w.couple || "(chưa có tên)")}</div>
          <div class="text-[11px] text-gray-400">
            ${w.slug && w.published ? `<a href="${escapeHtml(site)}/${escapeHtml(w.slug)}" target="_blank" rel="noopener" class="text-rose-600 hover:underline">/${escapeHtml(w.slug)}</a>` : escapeHtml(w.slug ? `/${w.slug}` : "")}
            ${w.theme ? ` <span>${escapeHtml(w.theme)}</span>` : ""}${w.hidden ? " <span>(khách đã ẩn)</span>" : ""}
          </div>
        </td>
        <td class="py-3 px-4 text-sm">
          <span class="sup-badge${expired ? " is-expired" : ""}"><i style="background:${g.color}"></i>${ST_LABEL[w.status]}</span>
          ${w.free_side ? `<div class="text-[11px] text-gray-400 mt-1">Mở bên ${w.free_side === "groom" ? "nhà trai" : "nhà gái"}</div>` : ""}
        </td>
        <td class="py-3 px-4 text-sm text-right tabular-nums text-gray-700">
          ${stNum(w.views)}${cap ? `<span class="text-[11px] text-gray-400">/${stNum(stCap())}</span>` : ""}
        </td>
        <td class="py-3 px-4 text-sm text-right tabular-nums text-gray-700">${w.amount ? stVnd(w.amount) : "—"}</td>
        <td class="py-3 px-4 text-sm text-gray-600">
          ${w.status === "lifetime" ? "Không hết hạn" : exp ? `${stDate(w.expires_at)}<div class="text-[11px] ${days < 0 ? "text-gray-400" : days <= 7 ? "text-amber-600" : "text-gray-400"}">${days < 0 ? `quá ${-days} ngày` : `còn ${days} ngày`}</div>` : "—"}
        </td>
        <td class="py-3 px-4 text-sm text-gray-600 max-w-[200px] truncate" title="${escapeHtml(w.owner || "")}">${escapeHtml(w.owner || "—")}</td>
        <td class="py-3 px-4 text-sm text-gray-500">${stDate(w.created_at)}</td>
      </tr>`;
    })
    .join("");
  stEl("st-pager").innerHTML =
    pages > 1
      ? `<span>Trang ${stPage}/${pages}</span>
         <div class="flex gap-2">
           <x-button variant="outline" tone="neutral" size="sm" icon="chevron-left" ${stPage <= 1 ? "disabled" : ""} onclick="stGo(-1)">Trước</x-button>
           <x-button variant="outline" tone="neutral" size="sm" ${stPage >= pages ? "disabled" : ""} onclick="stGo(1)">Sau</x-button>
         </div>`
      : "";
  window.lucide?.createIcons({ root: stEl("st-pager") });
}

function stGo(d) {
  stPage += d;
  stRenderList();
  stEl("st-list").closest("section").scrollIntoView({ behavior: "smooth", block: "start" });
}

function stSetFilter(key, scroll) {
  stFilter = key;
  stPage = 1;
  stRenderStack();
  stRenderChips();
  stRenderList();
  if (scroll) stEl("st-list").closest("section").scrollIntoView({ behavior: "smooth", block: "start" });
}

// Bấm thanh chồng / chú thích / ghi chú / chip đều là lọc danh sách.
stEl("sup-tab-stats").addEventListener("click", (e) => {
  const b = e.target.closest("[data-filter]");
  if (!b || !stData) return;
  const inChips = !!b.closest("#st-chips");
  stSetFilter(stFilter === b.dataset.filter && !inChips ? "all" : b.dataset.filter, !inChips);
});
let stSearchT = 0;
stEl("st-search").addEventListener("input", () => {
  clearTimeout(stSearchT);
  stSearchT = setTimeout(() => {
    stPage = 1;
    if (stData) stRenderList();
  }, 200);
});
stEl("st-sort").addEventListener("change", () => {
  stPage = 1;
  if (stData) stRenderList();
});

// Chú giải nổi khi rê / chạm vào phần tử có data-tip (thanh chồng, cột tháng, mẫu).
(() => {
  const tip = stEl("st-tip");
  const panel = stEl("sup-tab-stats");
  const show = (el, x, y) => {
    tip.textContent = el.dataset.tip;
    tip.classList.remove("hidden");
    const r = tip.getBoundingClientRect();
    tip.style.left = `${Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2))}px`;
    tip.style.top = `${Math.max(8, y - r.height - 12)}px`;
  };
  panel.addEventListener("pointermove", (e) => {
    const el = e.target.closest("[data-tip]");
    if (el) show(el, e.clientX, e.clientY);
    else tip.classList.add("hidden");
  });
  panel.addEventListener("pointerleave", () => tip.classList.add("hidden"));
  panel.addEventListener("focusin", (e) => {
    const el = e.target.closest("[data-tip]");
    if (!el) return;
    const r = el.getBoundingClientRect();
    show(el, r.left + r.width / 2, r.top);
  });
  panel.addEventListener("focusout", () => tip.classList.add("hidden"));
})();
