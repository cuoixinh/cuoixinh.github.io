// Trang /admin-support — nhân viên tạo / đặt lại mật khẩu tài khoản Cưới Xinh cho khách.
// Quyền KHÔNG xét ở đây: wedding-admin?resource=accounts trả 403 với ai ngoài SUPPORT_EMAILS
// hoặc phiên không phải Google, trang chỉ đọc mã đó để vẽ màn chặn.

let accLastResult = "";

const ACC_SITE = CONFIG.env === "staging" ? "https://staging.cuoixinh.com" : "https://cuoixinh.com";
const accFmtTime = (t) => (t ? new Date(t).toLocaleString("vi-VN") : "—");

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
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-red-500">${escapeHtml(e.message)}</td></tr>`;
    return;
  }
  supShow("sup-app");
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-400">Chưa có tài khoản nào</td></tr>`;
    return;
  }
  tbody.innerHTML = list
    .map(
      (a) => `
    <tr class="border-b border-gray-100">
      <td class="py-3 px-4 text-sm font-medium text-gray-800">
        ${escapeHtml(a.username)}
        ${a.admin_made ? "" : '<span class="ml-1 text-[11px] text-amber-600">(tự đăng ký, giữ chỗ)</span>'}
      </td>
      <td class="py-3 px-4 text-sm text-gray-600">${escapeHtml(a.full_name || "—")}</td>
      <td class="py-3 px-4 text-sm text-gray-600">${a.weddings}</td>
      <td class="py-3 px-4 text-sm text-gray-500">${escapeHtml(a.created_by || "—")}<br><span class="text-[11px] text-gray-400">${accFmtTime(a.created_at)}</span></td>
      <td class="py-3 px-4 text-sm text-gray-500">${accFmtTime(a.last_sign_in_at)}</td>
      <td class="py-3 px-4 text-right">
        ${a.admin_made ? `<x-button variant="outline" size="sm" icon="key-round" data-id="${escapeHtml(a.id)}" data-name="${escapeHtml(a.username)}" onclick="accReset(this.dataset.id, this.dataset.name)">Đặt lại mật khẩu</x-button>` : ""}
      </td>
    </tr>`,
    )
    .join("");
  window.lucide?.createIcons({ root: tbody });
}

// Lời nhắn chép sẵn để gửi khách qua Zalo/Messenger.
function accShowResult({ username, password }) {
  accLastResult =
    `Tài khoản Cưới Xinh của bạn:\n` +
    `• Vào ${ACC_SITE} → Đăng nhập → "Đăng nhập bằng tài khoản Cưới Xinh"\n` +
    `• Tên đăng nhập: ${username}\n` +
    `• Mật khẩu: ${password}\n` +
    `Đăng nhập xong, bạn nên đổi mật khẩu ở mục "Thông tin cá nhân".`;
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
        <p><span class="text-gray-500">Chủ thiệp:</span> ${escapeHtml(w.owner || "—")}</p>
        <p><span class="text-gray-500">Mẫu:</span> ${escapeHtml(w.theme || "—")}</p>
        <p class="sm:col-span-2"><span class="text-gray-500">Trạng thái:</span> ${escapeHtml(payStatusText(w))}</p>
      </div>
      <label class="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2">
        <span class="text-sm text-gray-800">
          Hiện ở mục "Thiệp của khách" trang chủ
          <span class="block text-[11px] text-gray-400">Người xem trang chủ mở được cả thiệp (bản nhà trai). Khách chọn lúc thanh toán; chỉ đổi khi khách yêu cầu, thiệp chưa thanh toán thì chưa hiện dù bật.</span>
        </span>
        <input type="checkbox" role="switch" class="cx-switch shrink-0" ${w.showcase_consent ? "checked" : ""}
          onchange="payShowcase(this)" />
      </label>
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
                <label class="block text-xs font-medium text-gray-600 mb-1">Số tiền thực nhận (đ)</label>
                <input id="pay-amount" type="number" min="0" step="1000" value="${first.amount}"
                  class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-rose-400" />
                <p class="text-[11px] text-gray-400 mt-1">Chỉ để ghi sổ; giảm tay cho khách thì sửa ở đây</p>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Ghi chú</label>
                <input id="pay-note" type="text" maxlength="300" placeholder="vd. CK Vietcombank 14:20, nội dung LAN MINH"
                  class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-rose-400" />
              </div>
            </div>
            ${
              w.current_plan
                ? ""
                : `<label class="flex items-start gap-2 text-sm text-gray-800 cursor-pointer">
                    <input id="pay-showcase" type="checkbox" checked class="mt-1 accent-rose-500" />
                    <span>Khách cho phép hiện thiệp ở trang chủ
                      <span class="block text-[11px] text-gray-400">Hỏi khách trước khi xác nhận — người xem trang chủ mở được cả thiệp (bản nhà trai)</span>
                    </span>
                  </label>`
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
