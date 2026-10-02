// ============= TAB: Dọn dữ liệu =============
// Quét → chọn → xoá cho thiệp quá hạn, sổ giữ slug hết hạn, ảnh rác, tham chiếu ảnh
// hỏng; bảng tiền chỉ báo cáo. Server (wedding-admin/cleanup.ts) quét lại trước mọi lần ghi nên danh sách
// ở đây chỉ là lựa chọn của admin, không phải chứng cứ.

let clWeddings = [];
let clHolds = [];
let clImages = [];
let clBroken = [];
let clInited = false;

// Server nhận tối đa ngần này thiệp mỗi lượt (MAX_DELETE_WEDDINGS ở cleanup.ts).
const CL_WEDDING_BATCH = 30;
// Server nhận tối đa ngần này slug mỗi lượt (MAX_DELETE_SLUG_HOLDS ở cleanup.ts).
const CL_HOLD_BATCH = 100;

const CL_REASON = { unpaid: "Chưa thanh toán", draft: "Nháp" };
const CL_IMG_KIND = {
  orphan_folder: "Thư mục của thiệp đã xoá",
  unused: "Ảnh thừa trong thiệp còn sống",
  legacy: "File cũ ngoài thư mục w/",
};

function initCleanupPanel() {
  if (clInited) return;
  clInited = true;
  document.getElementById("cl-env").textContent = CONFIG.env;
  document.getElementById("cl-days").value = CONFIG.retention?.unpaidDays || 30;
}

async function clFetch(kind, { method = "GET", params = {}, body } = {}) {
  const qs = new URLSearchParams({ resource: "cleanup", kind, ...params });
  const res = await fetch(`${EDGE_URL}?${qs}`, {
    method,
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// Nút đang chạy thì khoá + quay vòng; trả hàm khôi phục.
function clBusy(id, text) {
  const btn = document.getElementById(id);
  if (!btn) return () => {};
  const html = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader-circle" class="animate-spin" style="width:16px;height:16px"></i> ${escapeHtml(text)}`;
  window.lucide?.createIcons({ root: btn });
  return () => {
    btn.disabled = false;
    btn.innerHTML = html;
    window.lucide?.createIcons({ root: btn });
  };
}

// Production phải gõ lại tên môi trường — bấm nhầm một nút là mất dữ liệu khách thật.
async function clConfirmDanger(title, message) {
  if (CONFIG.env !== "production") {
    return showConfirm(title, message, { type: "error", confirmText: "Xoá" });
  }
  const typed = await showPrompt(title, {
    message: `${message}\n\nGõ "production" để xác nhận.`,
    placeholder: "production",
    okText: "Xoá",
    type: "error",
  });
  return typed?.trim() === "production";
}

function clSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

function clDate(v) {
  return v ? new Date(v).toLocaleString("vi-VN") : "—";
}

// Dãy checkbox trong một khung: [data-cl-item] từng mục + [data-cl-all] chọn tất cả.
function clChecked(rootId) {
  return [...document.querySelectorAll(`#${rootId} [data-cl-item]:checked`)].map(
    (el) => el.value,
  );
}

function clBindChecks(rootId, btnId) {
  const root = document.getElementById(rootId);
  const sync = () => {
    document.getElementById(btnId).disabled = clChecked(rootId).length === 0;
  };
  root.onchange = (e) => {
    const all = e.target.closest("[data-cl-all]");
    if (all) {
      const scope = all.dataset.clAll
        ? root.querySelectorAll(`[data-cl-group="${all.dataset.clAll}"] [data-cl-item]`)
        : root.querySelectorAll("[data-cl-item]");
      scope.forEach((el) => (el.checked = all.checked));
    }
    sync();
  };
  sync();
}

/* ─────────────────────────── thiệp quá hạn ─────────────────────────── */

async function clScanWeddings() {
  const days = Number(document.getElementById("cl-days").value);
  if (!days || days < 1) return showAlert("Sai số ngày", "Số ngày phải từ 1 trở lên");
  const done = clBusy("cl-wed-scan", "Đang quét...");
  try {
    const data = await clFetch("weddings", { params: { days } });
    clWeddings = data.items || [];
    clRenderWeddings(data);
  } catch (e) {
    showAlert("Không quét được", e.message);
  } finally {
    done();
  }
}

function clRenderWeddings(data) {
  const unpaid = clWeddings.filter((w) => w.reason === "unpaid").length;
  document.getElementById("cl-wed-summary").textContent =
    `${clWeddings.length} thiệp (${unpaid} chưa thanh toán, ${clWeddings.length - unpaid} nháp) · mốc ${clDate(data.cutoff)}`;
  const list = document.getElementById("cl-wed-list");
  if (!clWeddings.length) {
    list.innerHTML = '<p class="text-sm text-gray-400">Không có thiệp nào quá hạn.</p>';
    clBindChecks("cl-wed-list", "cl-wed-delete");
    return;
  }
  list.innerHTML = `
    <table class="w-full text-sm">
      <thead class="text-left text-xs text-gray-500 border-b border-gray-100">
        <tr>
          <th class="py-2 pr-2"><input type="checkbox" data-cl-all /></th>
          <th class="py-2 pr-2">Thiệp</th>
          <th class="py-2 pr-2">Loại</th>
          <th class="py-2 pr-2">Hết hạn dùng thử</th>
          <th class="py-2 pr-2">Lưu lần cuối</th>
          <th class="py-2 pr-2">Ảnh</th>
          <th class="py-2">Khách</th>
        </tr>
      </thead>
      <tbody>
        ${clWeddings
          .map(
            (w) => `
          <tr class="border-b border-gray-50">
            <td class="py-2 pr-2"><input type="checkbox" data-cl-item value="${escapeHtml(w.id)}" /></td>
            <td class="py-2 pr-2">
              <div class="font-medium text-gray-800">${escapeHtml(w.name || "(chưa có tên)")}</div>
              <div class="text-xs text-gray-400">${escapeHtml(w.slug)}</div>
            </td>
            <td class="py-2 pr-2">${CL_REASON[w.reason] || escapeHtml(w.reason)}</td>
            <td class="py-2 pr-2 text-xs">${clDate(w.expires_at)}</td>
            <td class="py-2 pr-2 text-xs">${clDate(w.updated_at)}</td>
            <td class="py-2 pr-2">${w.files}</td>
            <td class="py-2">${w.guests ?? "?"}</td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
  clBindChecks("cl-wed-list", "cl-wed-delete");
}

async function clDeleteWeddings() {
  const ids = clChecked("cl-wed-list");
  if (!ids.length) return;
  const ok = await clConfirmDanger(
    "Xoá thiệp vĩnh viễn",
    `Xoá ${ids.length} thiệp kèm toàn bộ ảnh, khách mời và lời chúc.`,
  );
  if (!ok) return;

  const days = Number(document.getElementById("cl-days").value);
  let deleted = 0;
  let skipped = 0;
  const errors = [];
  try {
    for (let i = 0; i < ids.length; i += CL_WEDDING_BATCH) {
      showLoading(true, `Đang xoá thiệp ${i + 1}–${Math.min(i + CL_WEDDING_BATCH, ids.length)} / ${ids.length}...`);
      const r = await clFetch("weddings", {
        method: "POST",
        body: { days, ids: ids.slice(i, i + CL_WEDDING_BATCH) },
      });
      deleted += r.deleted.length;
      skipped += r.skipped.length;
      errors.push(...r.errors);
    }
  } catch (e) {
    errors.push({ id: "-", error: e.message });
  } finally {
    showLoading(false);
  }
  clReport("Xoá thiệp", [
    `Đã xoá ${deleted} thiệp.`,
    skipped ? `Bỏ qua ${skipped} thiệp không còn quá hạn (vừa lưu/thanh toán).` : "",
    errors.length ? `Lỗi ${errors.length}: ${errors.map((e) => e.error).join("; ")}` : "",
  ], errors.length);
  clScanWeddings();
}

/* ─────────────────────── sổ giữ slug hết hạn ─────────────────────── */

async function clScanSlugHolds() {
  const done = clBusy("cl-hold-scan", "Đang quét...");
  try {
    const data = await clFetch("slug-holds");
    clHolds = data.items || [];
    clRenderSlugHolds(data);
  } catch (e) {
    showAlert("Không quét được", e.message);
  } finally {
    done();
  }
}

function clRenderSlugHolds(data) {
  document.getElementById("cl-hold-days").textContent = data.hold_days;
  const active = data.active == null ? "?" : data.active;
  document.getElementById("cl-hold-summary").textContent =
    `${clHolds.length} hàng hết hạn giữ · ${active} hàng còn đang giữ · mốc ${clDate(data.cutoff)}`;
  const list = document.getElementById("cl-hold-list");
  if (!clHolds.length) {
    list.innerHTML = '<p class="text-sm text-gray-400">Không có hàng nào hết hạn giữ.</p>';
    clBindChecks("cl-hold-list", "cl-hold-delete");
    return;
  }
  list.innerHTML = `
    <table class="w-full text-sm">
      <thead class="text-left text-xs text-gray-500 border-b border-gray-100">
        <tr>
          <th class="py-2 pr-2"><input type="checkbox" data-cl-all /></th>
          <th class="py-2 pr-2">Slug</th>
          <th class="py-2 pr-2">Hạn dùng thử cũ</th>
          <th class="py-2 pr-2">Xoá thiệp lúc</th>
          <th class="py-2">Chủ cũ (user_id)</th>
        </tr>
      </thead>
      <tbody>
        ${clHolds
          .map(
            (h) => `
          <tr class="border-b border-gray-50">
            <td class="py-2 pr-2"><input type="checkbox" data-cl-item value="${escapeHtml(h.slug)}" /></td>
            <td class="py-2 pr-2 font-medium text-gray-800">${escapeHtml(h.slug)}</td>
            <td class="py-2 pr-2 text-xs">${clDate(h.expires_at)}</td>
            <td class="py-2 pr-2 text-xs">${clDate(h.deleted_at)}</td>
            <td class="py-2 text-xs text-gray-400">${escapeHtml(h.user_id || "—")}</td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
  clBindChecks("cl-hold-list", "cl-hold-delete");
}

async function clDeleteSlugHolds() {
  const slugs = clChecked("cl-hold-list");
  if (!slugs.length) return;
  const ok = await clConfirmDanger(
    "Xoá hàng sổ giữ slug",
    `Xoá ${slugs.length} hàng đã hết hạn giữ. Slug tương ứng vốn đã tự do, xoá chỉ để dọn bảng.`,
  );
  if (!ok) return;

  let deleted = 0;
  let skipped = 0;
  const errors = [];
  try {
    for (let i = 0; i < slugs.length; i += CL_HOLD_BATCH) {
      showLoading(true, `Đang xoá ${i + 1}–${Math.min(i + CL_HOLD_BATCH, slugs.length)} / ${slugs.length}...`);
      const r = await clFetch("slug-holds", {
        method: "POST",
        body: { slugs: slugs.slice(i, i + CL_HOLD_BATCH) },
      });
      deleted += r.deleted.length;
      skipped += r.skipped.length;
    }
  } catch (e) {
    errors.push({ error: e.message });
  } finally {
    showLoading(false);
  }
  clReport("Xoá sổ giữ slug", [
    `Đã xoá ${deleted} hàng.`,
    skipped ? `Bỏ qua ${skipped} hàng còn đang giữ (slug vừa bị xoá lại) hoặc không còn trong bảng.` : "",
    errors.length ? `Lỗi: ${errors.map((e) => e.error).join("; ")}` : "",
  ], errors.length);
  clScanSlugHolds();
}

/* ─────────────────────────── ảnh rác ─────────────────────────── */

async function clScanImages() {
  const grace = Number(document.getElementById("cl-grace").value);
  if (!grace || grace < 1) return showAlert("Sai ân hạn", "Ân hạn phải từ 1 giờ trở lên");
  const done = clBusy("cl-img-scan", "Đang quét...");
  try {
    const data = await clFetch("images", { params: { grace_h: grace } });
    clImages = data.items || [];
    clRenderImages(data);
  } catch (e) {
    showAlert("Không quét được", e.message);
  } finally {
    done();
  }
}

function clRenderImages(data) {
  document.getElementById("cl-img-summary").textContent =
    `Quét ${data.scanned} file · ${clImages.length} file rác (${clSize(data.total_size)}) · ` +
    `${data.too_new} file chưa qua ${data.grace_h} giờ ân hạn nên để yên`;
  const list = document.getElementById("cl-img-list");
  if (!clImages.length) {
    list.innerHTML = '<p class="text-sm text-gray-400">Không có ảnh rác.</p>';
    clBindChecks("cl-img-list", "cl-img-delete");
    return;
  }
  const base = CONFIG.supabase.storageUrl;
  list.innerHTML = Object.keys(CL_IMG_KIND)
    .map((kind) => {
      const items = clImages.filter((it) => it.kind === kind);
      if (!items.length) return "";
      const size = items.reduce((s, it) => s + it.size, 0);
      return `
      <div data-cl-group="${kind}">
        <label class="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <input type="checkbox" data-cl-all="${kind}" />
          ${CL_IMG_KIND[kind]} · ${items.length} file · ${clSize(size)}
        </label>
        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          ${items
            .map(
              (it) => `
            <label class="block rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:border-rose-300">
              <img src="${escapeHtml(`${base}/${it.name}`)}" loading="lazy" alt="" class="w-full h-24 object-cover bg-gray-100" />
              <div class="p-2 text-[11px] text-gray-500 space-y-1">
                <div class="flex items-center gap-1">
                  <input type="checkbox" data-cl-item value="${escapeHtml(it.name)}" />
                  <span class="truncate" title="${escapeHtml(it.name)}">${escapeHtml(it.name.split("/").pop())}</span>
                </div>
                <div>${clSize(it.size)} · ${clDate(it.created_at)}</div>
                ${it.slug ? `<div class="truncate">Thiệp: ${escapeHtml(it.slug)}</div>` : ""}
              </div>
            </label>`,
            )
            .join("")}
        </div>
      </div>`;
    })
    .join("");
  clBindChecks("cl-img-list", "cl-img-delete");
}

async function clDeleteImages() {
  const names = clChecked("cl-img-list");
  if (!names.length) return;
  const ok = await clConfirmDanger("Xoá ảnh rác", `Xoá ${names.length} file khỏi Storage.`);
  if (!ok) return;
  showLoading(true, `Đang xoá ${names.length} file...`);
  try {
    const r = await clFetch("images", {
      method: "POST",
      body: { grace_h: Number(document.getElementById("cl-grace").value), names },
    });
    clReport("Xoá ảnh rác", [
      `Đã xoá ${r.removed} file.`,
      r.skipped ? `Bỏ qua ${r.skipped} file vừa được thiệp trỏ tới lại hoặc chưa đủ tuổi.` : "",
    ]);
  } catch (e) {
    showAlert("Xoá ảnh lỗi", e.message);
  } finally {
    showLoading(false);
  }
  clScanImages();
}

/* ─────────────────────── tham chiếu ảnh hỏng ─────────────────────── */

async function clScanBroken() {
  const done = clBusy("cl-brk-scan", "Đang quét...");
  try {
    const data = await clFetch("broken");
    clBroken = data.items || [];
    clRenderBroken();
  } catch (e) {
    showAlert("Không quét được", e.message);
  } finally {
    done();
  }
}

function clRenderBroken() {
  const refs = clBroken.reduce((s, w) => s + w.refs.length, 0);
  document.getElementById("cl-brk-summary").textContent =
    `${clBroken.length} thiệp có ảnh hỏng · ${refs} tham chiếu`;
  const list = document.getElementById("cl-brk-list");
  if (!clBroken.length) {
    list.innerHTML = '<p class="text-sm text-gray-400">Không có tham chiếu hỏng.</p>';
    clBindChecks("cl-brk-list", "cl-brk-fix");
    return;
  }
  list.innerHTML = `
    <table class="w-full text-sm">
      <thead class="text-left text-xs text-gray-500 border-b border-gray-100">
        <tr>
          <th class="py-2 pr-2"><input type="checkbox" data-cl-all /></th>
          <th class="py-2 pr-2">Thiệp</th>
          <th class="py-2">Ô ảnh hỏng</th>
        </tr>
      </thead>
      <tbody>
        ${clBroken
          .map(
            (w) => `
          <tr class="border-b border-gray-50 align-top">
            <td class="py-2 pr-2"><input type="checkbox" data-cl-item value="${escapeHtml(w.id)}" /></td>
            <td class="py-2 pr-2">
              <div class="font-medium text-gray-800">${escapeHtml(w.name || "(chưa có tên)")}</div>
              <div class="text-xs text-gray-400">${escapeHtml(w.slug)}</div>
            </td>
            <td class="py-2 text-xs text-gray-600">
              ${w.refs
                .map((r) => `<div><strong>${escapeHtml(r.field)}</strong>: <span class="break-all">${escapeHtml(r.ref)}</span></div>`)
                .join("")}
            </td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
  clBindChecks("cl-brk-list", "cl-brk-fix");
}

async function clFixBroken() {
  const ids = clChecked("cl-brk-list");
  if (!ids.length) return;
  const ok = await clConfirmDanger(
    "Gỡ tham chiếu ảnh hỏng",
    `Sửa ${ids.length} thiệp: bỏ các ô ảnh đang trỏ tới file không còn tồn tại.`,
  );
  if (!ok) return;
  showLoading(true, `Đang sửa ${ids.length} thiệp...`);
  try {
    const r = await clFetch("broken", { method: "POST", body: { ids } });
    clReport("Gỡ tham chiếu hỏng", [
      `Đã sửa ${r.fixed.length} thiệp.`,
      r.errors.length ? `Lỗi ${r.errors.length}: ${r.errors.map((e) => e.error).join("; ")}` : "",
    ], r.errors.length);
  } catch (e) {
    showAlert("Gỡ lỗi", e.message);
  } finally {
    showLoading(false);
  }
  clScanBroken();
}

/* ─────────────────────── bảng tiền (chỉ báo cáo) ─────────────────────── */

async function clScanTables() {
  const done = clBusy("cl-tbl-scan", "Đang quét...");
  try {
    const d = await clFetch("tables");
    const row = (label, total, orphan, extra = "") => `
      <div class="flex flex-wrap gap-x-2 py-1 border-b border-gray-50">
        <code class="w-40">${label}</code>
        <span>${total} hàng</span>
        <span class="${orphan ? "text-amber-600 font-medium" : "text-gray-400"}">· ${orphan} trỏ tới thiệp không còn</span>
        ${extra}
      </div>`;
    document.getElementById("cl-tbl-result").innerHTML = `
      <p class="text-xs text-gray-500 mb-2">Đang có ${d.weddings} thiệp.</p>
      ${row("payment_logs", d.payment_logs.total, d.payment_logs.orphan)}
      ${row(
        "promo_redemptions",
        d.promo_redemptions.total,
        d.promo_redemptions.orphan,
        `<span class="text-gray-500">· ${d.promo_redemptions.stale_reserved} lượt giữ chỗ đã hết hạn</span>`,
      )}
      ${row("orders", d.orders.total, d.orders.orphan)}`;
  } catch (e) {
    showAlert("Không quét được", e.message);
  } finally {
    done();
  }
}

function clReport(title, lines, failed = 0) {
  showAlert(title, lines.filter(Boolean).join("\n"), failed ? "warning" : "success");
}
