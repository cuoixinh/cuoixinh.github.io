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

async function accRequest(method, payload) {
  const token = await CXAuth.accessToken();
  if (!token) throw new AccError("Chưa đăng nhập", 401);
  const res = await fetch(`${CONFIG.supabase.edgeUrl}?resource=accounts`, {
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
    `• Mật khẩu: ${password}`;
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
