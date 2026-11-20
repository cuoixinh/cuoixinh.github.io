// Trang /admin-support — ba tab: "Tạo thiệp hộ" (tra thiệp + thanh toán hộ, tạo / đặt lại mật khẩu
// tài khoản Cưới Xinh cho khách), "Mã giảm giá" (promo.js), "Thiệp của khách" (weddings.js). Quyền KHÔNG xét ở đây: wedding-admin
// trả 401/403 với ai ngoài SUPPORT_EMAILS hoặc phiên không phải Google, trang chỉ đọc mã đó để vẽ màn chặn.

let accLastResult = "";

const ACC_SITE = CONFIG.env === "staging" ? "https://staging.cuoixinh.com" : "https://cuoixinh.com";
// "20/11/2026 21:29" — bỏ giây cho vừa cột ở bảng máy tính.
const accFmtTime = (t) => {
  if (!t) return "—";
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

class AccError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// `query`: tham số thêm vào URL (GET); `payload`: thân JSON.
async function supRequest(resource, method, { query, payload } = {}) {
  const token = await CXAuth.accessToken();
  if (!token) throw new AccError("Chưa đăng nhập", 401);
  const qs = new URLSearchParams({ resource, ...(query || {}) });
  const res = await fetch(`${CONFIG.supabase.edgeUrl}?${qs}`, {
    method,
    headers: {
      apikey: CONFIG.supabase.anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AccError(data.error || `Lỗi ${res.status}`, res.status);
  return data;
}

const accRequest = (method, payload) => supRequest("accounts", method, { payload });

function supShow(id) {
  ["sup-loading", "sup-gate", "sup-app"].forEach((x) =>
    document.getElementById(x).classList.toggle("hidden", x !== id),
  );
}

function supGate(msg) {
  document.getElementById("sup-gate-msg").textContent = msg;
  supShow("sup-gate");
}

function supGoogle() {
  AuthUI.oauth("google", location.origin + location.pathname);
}

async function supSignOut() {
  await CXAuth.client()?.auth.signOut();
  location.reload();
}

// Ba tab: Tạo thiệp hộ · Mã giảm giá · Thiệp của khách. Tab đang mở ghi vào #hash (mở link là vào thẳng tab đó);
// dữ liệu của tab chỉ tải lần đầu mở tab, và chỉ sau khi đã qua chốt quyền.
const SUP_TABS = { wedding: "#tao-thiep-ho", promo: "#ma-giam-gia", stats: "#thiep-cua-khach" };
let supGateOk = false;
const supLoaded = new Set();
function supTab(id) {
  if (!SUP_TABS[id]) id = "wedding";
  const ids = Object.keys(SUP_TABS);
  const seg = document.getElementById("sup-tabs");
  seg.style.setProperty("--i", String(ids.indexOf(id)));
  seg.querySelectorAll("[data-tab]").forEach((b) => {
    const on = b.dataset.tab === id;
    b.classList.toggle("is-on", on);
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
  });
  ids.forEach((t) => {
    const panel = document.getElementById(`sup-tab-${t}`);
    const was = panel.classList.contains("hidden");
    panel.classList.toggle("hidden", t !== id);
    if (t === id && was) {
      panel.classList.remove("sup-panel-in");
      void panel.offsetWidth;
      panel.classList.add("sup-panel-in");
    }
  });
  if (location.hash !== SUP_TABS[id]) history.replaceState(null, "", SUP_TABS[id]);
  if (supGateOk && !supLoaded.has(id)) {
    supLoaded.add(id);
    if (id === "promo") loadPromoCodes();
    if (id === "stats") stLoad();
  }
}
const supTabFromHash = () => Object.keys(SUP_TABS).find((k) => SUP_TABS[k] === location.hash) || "wedding";
window.addEventListener("hashchange", () => supTab(supTabFromHash()));
// Mũi tên trái/phải chuyển tab khi đang đứng ở dải tab.
document.getElementById("sup-tabs").addEventListener("keydown", (e) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const ids = Object.keys(SUP_TABS);
  const cur = ids.indexOf(document.querySelector("#sup-tabs .is-on")?.dataset.tab);
  const next = ids[(cur + (e.key === "ArrowRight" ? 1 : ids.length - 1)) % ids.length];
  supTab(next);
  document.getElementById(`sup-tab-btn-${next}`).focus();
});

// Đã qua chốt quyền lần đầu: mở tab theo #hash.
function supAfterGate() {
  if (supGateOk) return;
  supGateOk = true;
  supTab(supTabFromHash());
}

// Vẽ danh sách; cũng là phép thử quyền lúc mở trang (401/403 → màn chặn).
async function loadAccounts() {
  const tbody = document.getElementById("acc-list");
  let list;
  try {
    list = await accRequest("GET");
  } catch (e) {
    if (e.status === 401 || e.status === 403) {
      supGate(
        e.status === 403
          ? "Tài khoản này chưa được cấp quyền. Hãy đăng nhập bằng đúng Google đã được cấp quyền."
          : "Đăng nhập bằng tài khoản Google đã được cấp quyền.",
      );
      return;
    }
    supShow("sup-app");
    tbody.innerHTML = `<li class="text-center py-8 text-sm text-red-500">${escapeHtml(e.message)}</li>`;
    return;
  }
  supShow("sup-app");
  supAfterGate();
  if (!list.length) {
    tbody.innerHTML = `<li class="text-center py-8 text-sm text-gray-400">Chưa có tài khoản nào</li>`;
    return;
  }
  tbody.innerHTML = list.map(accRowHtml).join("");
  window.lucide?.createIcons({ root: tbody });
}

// Một tài khoản. Điện thoại: tên → lưới 2 cột thông tin phụ → hai nút chia đôi. Từ lg: hàng
// cùng lưới với tiêu đề ở index.html (`lg:contents` thả ba ô phụ vào lưới của hàng).
function accRowHtml(a) {
  const meta = (label, value, sub) => `
    <div class="min-w-0">
      <p class="lg:hidden text-[11px] text-gray-400">${label}</p>
      <p class="text-sm text-gray-600 truncate">${value}</p>
      ${sub ? `<p class="text-[11px] text-gray-400 truncate">${sub}</p>` : ""}
    </div>`;
  const btn = (act, icon, text) =>
    `<x-button variant="outline" size="sm" icon="${icon}" class="flex-1 lg:flex-none" data-id="${escapeHtml(a.id)}" data-name="${escapeHtml(a.username)}"
      onclick="${act}(this.dataset.id, this.dataset.name)">${text}</x-button>`;
  return `
    <li class="py-4 lg:py-3 grid gap-3 lg:gap-4 lg:items-center lg:grid-cols-[minmax(0,1.4fr)_64px_minmax(0,1.3fr)_minmax(0,1fr)_312px]">
      <div class="min-w-0">
        <p class="text-sm font-medium text-gray-800 truncate">${escapeHtml(a.username)}</p>
        ${
          a.admin_made
            ? `<p class="text-xs text-gray-500 truncate">${escapeHtml(a.full_name || "Chưa có tên hiển thị")}</p>`
            : '<p class="text-xs text-amber-600">Tự đăng ký, giữ chỗ</p>'
        }
      </div>
      <div class="grid grid-cols-2 gap-x-4 gap-y-2 lg:contents">
        ${meta("Số thiệp", a.weddings)}
        <div class="order-last col-span-2 min-w-0 lg:order-none lg:col-span-1">${meta("Người tạo", escapeHtml(a.created_by || "—"), accFmtTime(a.created_at))}</div>
        ${meta("Đăng nhập gần nhất", accFmtTime(a.last_sign_in_at))}
      </div>
      ${a.admin_made ? `<div class="flex gap-2 lg:justify-end">${btn("accSignin", "log-in", "Đăng nhập thay")}${btn("accReset", "key-round", "Đặt lại mật khẩu")}</div>` : "<div></div>"}
    </li>`;
}

// Lời nhắn chép sẵn để gửi khách qua Zalo/Messenger — xưng "em", gọi khách "anh/chị".
function accShowResult({ username, password }) {
  accLastResult =
    `Dạ em gửi anh/chị tài khoản Cưới Xinh ạ:\n` +
    `• Tên đăng nhập: ${username}\n` +
    `• Mật khẩu: ${password}\n\n` +
    `Cách đăng nhập: anh/chị vào ${ACC_SITE}, bấm "Đăng nhập" rồi chọn "Đăng nhập bằng tài khoản Cưới Xinh" và nhập hai thông tin trên.`;
  document.getElementById("acc-result-text").textContent = accLastResult;
  document.getElementById("acc-result").classList.remove("hidden");
}

function accCopyResult() {
  navigator.clipboard
    .writeText(accLastResult)
    .then(() => showToast("Đã chép lời nhắn", "success"))
    .catch(() => showToast("Trình duyệt chặn chép tự động", "error"));
}

async function accCreate() {
  const btn = document.getElementById("acc-create-btn");
  const userEl = document.getElementById("acc-username");
  const username = userEl.value.trim().toLowerCase();
  if (!username) return showToast("Nhập tên đăng nhập", "error");
  btn.disabled = true;
  try {
    const data = await accRequest("POST", {
      username,
      full_name: document.getElementById("acc-fullname").value.trim(),
      password: document.getElementById("acc-password").value.trim(),
    });
    accShowResult(data);
    userEl.value = "";
    document.getElementById("acc-fullname").value = "";
    document.getElementById("acc-password").value = "";
    showToast("Đã tạo tài khoản", "success");
    loadAccounts();
  } catch (e) {
    showAlert("Không tạo được", e.message);
  } finally {
    btn.disabled = false;
  }
}

async function accReset(id, username) {
  const ok = await showConfirm(
    "Đặt lại mật khẩu?",
    `Mật khẩu cũ của ${username} sẽ hết dùng được ngay.`,
    { confirmText: "Đặt lại" },
  );
  if (!ok) return;
  try {
    accShowResult(await accRequest("PATCH", { id }));
    document.getElementById("acc-result").scrollIntoView({ behavior: "smooth", block: "center" });
    showToast("Đã đặt lại mật khẩu", "success");
  } catch (e) {
    showAlert("Không đặt lại được", e.message);
  }
}

// "Đăng nhập thay": server (accounts.ts) kiểm quyền nhân viên + tài khoản do nhân viên tạo rồi
// trả vé dùng một lần; trang chỉ dựng link (core/auth-ui.js đọc #cx_signin). Không tự mở tab:
// cùng trình duyệt là phiên khách đè phiên nhân viên — nhân viên mở bằng cửa sổ ẩn danh.
async function accSignin(id, username) {
  const ok = await showConfirm(
    "Đăng nhập thay?",
    `Tạo link đăng nhập vào tài khoản ${username} mà không cần mật khẩu. Lượt này được ghi lại kèm email của bạn.`,
    { confirmText: "Tạo link" },
  );
  if (!ok) return;
  try {
    const data = await accRequest("POST", { action: "signin", id });
    const link = `${location.origin}/my-invitations/#cx_signin=${encodeURIComponent(data.token_hash)}`;
    document.getElementById("acc-signin-name").textContent = data.username || username;
    document.getElementById("acc-signin-link").value = link;
    const box = document.getElementById("acc-signin");
    box.classList.remove("hidden");
    box.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (e) {
    showAlert("Không tạo được link", e.message);
  }
}

function accCopySignin() {
  navigator.clipboard
    .writeText(document.getElementById("acc-signin-link").value)
    .then(() => showToast("Đã chép link — mở bằng cửa sổ ẩn danh", "success"))
    .catch(() => showToast("Trình duyệt chặn chép tự động", "error"));
}

// Nút ⓘ + thẻ giải thích (x-popover ngay sau nút) cho đoạn giải thích dài — chữ trên màn
// chỉ giữ phần phải thấy lúc thao tác. Bản viết tay trong index.html dùng đúng markup này.
function supInfoHtml(html, label = "Giải thích") {
  return `<x-button variant="ghost" tone="neutral" size="xs" icon-only aria-label="${label}" title="${label}"
      onclick="this.nextElementSibling.toggle(this)"><i data-lucide="info" style="width:16px;height:16px"></i></x-button><x-popover
      placement="bottom" align="start" arrow width="288" keep-open role="dialog"><div class="p-3 text-xs leading-relaxed text-gray-600 space-y-2">${html}</div></x-popover>`;
}

// ── Thanh toán hộ (wedding-admin?resource=support-pay) ──────────────────────
// Server tự tính gói được phép + giá; trang chỉ hiện báo giá và gửi gói + số tiền thực nhận.

let payWedding = null;
const payMoney = (n) => `${Number(n || 0).toLocaleString("vi-VN")}đ`;
const payDate = (t) => (t ? new Date(t).toLocaleDateString("vi-VN") : "");

function payStatusText(w) {
  if (!w.current_plan) return w.payment_status === "pending" ? "Chưa thanh toán (có đơn PayOS đang chờ)" : "Chưa thanh toán";
  const label = w.current_plan === "lifetime" ? "Forever" : "Premium";
  if (!w.plan_expires_at) return `Đã thanh toán — gói ${label}`;
  const over = new Date(w.plan_expires_at).getTime() < Date.now();
  return `Đã thanh toán — gói ${label}, ${over ? "đã hết hạn" : "hạn tới"} ${payDate(w.plan_expires_at)}`;
}

async function payLookup() {
  const input = document.getElementById("pay-slug");
  const box = document.getElementById("pay-result");
  const btn = document.getElementById("pay-lookup-btn");
  if (!input.value.trim()) return showToast("Dán link thiệp hoặc slug", "error");
  btn.disabled = true;
  try {
    payWedding = await supRequest("support-pay", "GET", { query: { slug: input.value.trim() } });
    payRender();
  } catch (e) {
    payWedding = null;
    box.classList.remove("hidden");
    box.innerHTML = `<p class="text-sm text-red-500">${escapeHtml(e.message)}</p>`;
  } finally {
    btn.disabled = false;
  }
}

function payRender() {
  const w = payWedding;
  const box = document.getElementById("pay-result");
  box.classList.remove("hidden");
  const plans = w.plans.filter((p) => p.available);
  const first = plans[0];
  const planRows = plans
    .map(
      (p, i) => `
      <label class="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer hover:border-rose-300">
        <input type="radio" name="pay-plan" value="${escapeHtml(p.id)}" data-amount="${p.amount}" ${i === 0 ? "checked" : ""}
          onchange="document.getElementById('pay-amount').value = this.dataset.amount" class="accent-rose-500" />
        <span class="flex-1 text-sm text-gray-800">
          <strong>${escapeHtml(p.label)}</strong>${p.expires_at ? ` · tới ${payDate(p.expires_at)}` : " · vĩnh viễn"}
          ${w.current_plan ? '<span class="text-[11px] text-gray-400">(nâng gói, phần chênh)</span>' : ""}
        </span>
        <span class="text-sm font-semibold text-gray-800">${payMoney(p.amount)}</span>
      </label>`,
    )
    .join("");

  box.innerHTML = `
    <div class="rounded-xl border border-gray-200 p-4 space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <p><span class="text-gray-500">Thiệp:</span> <strong>${escapeHtml(w.couple || "(chưa có tên)")}</strong></p>
        <p><span class="text-gray-500">Link:</span> <a href="${escapeHtml(ACC_SITE)}/${escapeHtml(w.slug)}" target="_blank" rel="noopener" class="text-rose-600 underline">/${escapeHtml(w.slug)}</a>${w.is_published ? "" : ' <span class="text-[11px] text-amber-600">(chưa xuất bản)</span>'}</p>
        <div class="sm:col-span-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <p class="min-w-0 break-all"><span class="text-gray-500">Chủ thiệp:</span> ${escapeHtml(w.owner || "—")}</p>
          ${
            w.owner_account_id
              ? `<x-button variant="outline" size="xs" icon="log-in" data-id="${escapeHtml(w.owner_account_id)}" data-name="${escapeHtml(String(w.owner).split("@")[0])}" onclick="accSignin(this.dataset.id, this.dataset.name)">Đăng nhập thay</x-button>`
              : ""
          }
        </div>
        <p><span class="text-gray-500">Mẫu:</span> ${escapeHtml(w.theme || "—")}</p>
        <p class="sm:col-span-2"><span class="text-gray-500">Trạng thái:</span> ${escapeHtml(payStatusText(w))}</p>
      </div>
      <div class="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2">
        <span class="flex items-center gap-1 text-sm text-gray-800">
          <label for="pay-showcase-switch" class="cursor-pointer">Hiện ở mục "Thiệp của khách" trang chủ</label>
          ${supInfoHtml("<p>Người xem trang chủ mở được cả thiệp (bản nhà trai).</p><p>Khách chọn lúc thanh toán; chỉ đổi khi khách yêu cầu. Thiệp chưa thanh toán thì chưa hiện dù bật.</p>")}
        </span>
        <input id="pay-showcase-switch" type="checkbox" role="switch" class="cx-switch shrink-0" ${w.showcase_consent ? "checked" : ""}
          onchange="payShowcase(this)" />
      </div>
      ${
        w.pending_payos
          ? `<p class="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
              Thiệp đang có một đơn PayOS chờ thanh toán. Xác nhận ở đây là đơn đó bị bỏ — dặn khách KHÔNG quét mã QR cũ nữa,
              quét rồi thì tiền vào mà thiệp không ghi nhận.
            </p>`
          : ""
      }
      ${
        plans.length
          ? `<div class="space-y-2">
              <p class="text-xs font-medium text-gray-600">Gói đã thu tiền</p>
              ${planRows}
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div class="flex items-center gap-1 h-7 mb-1">
                  <label for="pay-amount" class="text-xs font-medium text-gray-600">Số tiền thực nhận (đ)</label>
                  ${supInfoHtml("<p>Chỉ để ghi sổ đối soát. Giảm tay cho khách thì sửa số ở đây.</p>")}
                </div>
                <input id="pay-amount" type="number" min="0" step="1000" value="${first.amount}"
                  class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-rose-400" />
              </div>
              <div>
                <div class="flex items-center h-7 mb-1">
                  <label for="pay-note" class="text-xs font-medium text-gray-600">Ghi chú</label>
                </div>
                <input id="pay-note" type="text" maxlength="300" placeholder="vd. CK Vietcombank lúc 14:20"
                  class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-rose-400" />
              </div>
            </div>
            ${
              w.current_plan
                ? ""
                : `<div class="flex items-center gap-1">
                    <label class="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                      <input id="pay-showcase" type="checkbox" class="accent-rose-500" />
                      Khách cho phép hiện thiệp ở trang chủ
                    </label>
                    ${supInfoHtml("<p>Hỏi khách trước khi xác nhận: người xem trang chủ mở được cả thiệp (bản nhà trai).</p>")}
                  </div>`
            }
            <x-button id="pay-confirm-btn" icon="badge-check" onclick="payConfirm()">Xác nhận đã nhận tiền</x-button>`
          : `<p class="text-sm text-gray-500">${
              w.plans.length ? "Thiệp đã ở gói cao nhất, không còn gói nào để nâng." : "Mẫu này chưa có giá nên không xác nhận được."
            }</p>`
      }
    </div>`;
  window.lucide?.createIcons({ root: box });
}

// Bật/tắt hiện thiệp ở trang chủ; ghi hỏng thì trả công tắc về như cũ.
async function payShowcase(input) {
  const w = payWedding;
  if (!w) return;
  const value = input.checked;
  input.disabled = true;
  try {
    await supRequest("support-pay", "PATCH", { payload: { id: w.id, showcase_consent: value } });
    w.showcase_consent = value;
    showToast(value ? "Đã cho hiện thiệp ở trang chủ" : "Đã gỡ thiệp khỏi trang chủ", "success");
  } catch (e) {
    input.checked = !value;
    showAlert("Không đổi được", e.message);
  } finally {
    input.disabled = false;
  }
}

async function payConfirm() {
  const w = payWedding;
  const picked = document.querySelector('input[name="pay-plan"]:checked');
  if (!w || !picked) return;
  const amount = Number(document.getElementById("pay-amount").value);
  if (!Number.isInteger(amount) || amount < 0) return showToast("Số tiền không hợp lệ", "error");
  const plan = w.plans.find((p) => p.id === picked.value);
  const ok = await showConfirm(
    "Xác nhận đã nhận tiền?",
    `Thiệp ${w.couple || w.slug} lên gói ${plan.label}, đã nhận ${payMoney(amount)}` +
      (amount !== plan.amount ? ` (giá gói ${payMoney(plan.amount)})` : "") +
      ". Thao tác này không hoàn tác được ở đây.",
    { confirmText: "Xác nhận" },
  );
  if (!ok) return;
  const btn = document.getElementById("pay-confirm-btn");
  btn.disabled = true;
  try {
    await supRequest("support-pay", "POST", {
      payload: {
        id: w.id,
        plan: plan.id,
        amount,
        note: document.getElementById("pay-note").value.trim(),
        showcase_consent: !!document.getElementById("pay-showcase")?.checked,
      },
    });
    showToast(`Đã chuyển thiệp sang gói ${plan.label}`, "success");
    payLookup();
  } catch (e) {
    showAlert("Không xác nhận được", e.message);
    btn.disabled = false;
  }
}

(function boot() {
  document.getElementById("sup-google-icon").innerHTML = AuthUI.googleIcon;
  window.lucide?.createIcons();
  const sync = (user) => {
    document.getElementById("sup-who").classList.toggle("hidden", !user);
    document.getElementById("sup-email").textContent = user ? CXAuth.accountName(user) : "";
    if (user) loadAccounts();
    else supGate("Đăng nhập bằng tài khoản Google đã được cấp quyền.");
  };
  CXAuth.onChange(sync);
  CXAuth.getUser().then(sync);
})();
