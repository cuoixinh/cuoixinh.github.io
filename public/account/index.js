// ===== SUPABASE AUTH =====
// Dùng chung client từ AuthUI để form đăng nhập (nhúng) và trang này cùng 1 phiên/listener.
const supabaseClient = AuthUI.supabase;

let currentUser = null;

const POST_LOGIN_REDIRECT_KEY = "post_login_redirect";

// Nút "Trở lại" và logo luôn đưa về trang chủ
function goBack() {
  window.location.href = "/";
}

// Nếu trang này được mở kèm ?urlRedirect=... (VD: từ invitation-setup), lưu lại
// đích cần quay về vào sessionStorage rồi dọn sạch query khỏi URL — để redirectTo
// gửi cho Supabase luôn là URL gốc (đã được whitelist), tránh bị OAuth chặn.
(function captureLoginRedirect() {
  const params = new URLSearchParams(window.location.search);
  const urlRedirect = params.get("urlRedirect");
  if (!urlRedirect) return;

  sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, urlRedirect);
  params.delete("urlRedirect");
  const cleanQuery = params.toString();
  const cleanUrl =
    window.location.pathname +
    (cleanQuery ? `?${cleanQuery}` : "") +
    window.location.hash;
  window.history.replaceState({}, "", cleanUrl);
})();

// Sau khi đăng nhập xong, nếu có đích lưu sẵn (từ urlRedirect) thì điều hướng tiếp về đó.
function _redirectAfterLogin() {
  if (!currentUser) return;
  const target = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
  if (!target) return;
  sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  window.location.replace(target);
}

async function initAccount() {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    updateAuthBlock();
    loadOrders();
    loadProfile();
    _redirectAfterLogin();
  });

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  currentUser = session?.user ?? null;
  updateAuthBlock();
  loadOrders();
  loadProfile();
  _redirectAfterLogin();
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.replace(window.location.pathname);
}

function updateAuthBlock() {
  const loggedout = document.getElementById("auth-loggedout");
  const loggedin = document.getElementById("auth-loggedin");

  if (currentUser) {
    loggedout.classList.add("hidden");
    loggedin.classList.remove("hidden");
    const name =
      currentUser.user_metadata?.full_name ||
      currentUser.user_metadata?.name ||
      "Người dùng";
    const avatar = currentUser.user_metadata?.avatar_url;
    document.getElementById("user-name").textContent = name;
    document.getElementById("user-email").textContent = currentUser.email || "";
    const avatarEl = document.getElementById("user-avatar");
    if (avatarEl && avatar) {
      avatarEl.innerHTML =
        '<img src="' +
        avatar +
        '" class="w-full h-full object-cover rounded-full" />';
    }
    mergeGuestOrders();
  } else {
    loggedout.classList.remove("hidden");
    loggedin.classList.add("hidden");
  }
}

function loadOrders() {
  const listEl = document.getElementById("orders-list");
  const emptyEl = document.getElementById("empty-orders");
  let orders = [];
  const key = currentUser ? "orders_" + currentUser.email : "guestOrders";
  const str = localStorage.getItem(key);
  if (str) {
    try {
      orders = JSON.parse(str);
    } catch (e) {}
  }

  if (orders.length === 0) {
    listEl.innerHTML = "";
    emptyEl.classList.remove("hidden");
  } else {
    emptyEl.classList.add("hidden");
    listEl.innerHTML = orders
      .map(function (order, i) {
        return (
          '<div class="border border-gray-200 rounded-xl p-4 mb-4 cursor-pointer hover:border-pink-200 hover:shadow-sm transition-all" onclick="openOrderModal(' +
          i +
          ')">' +
          '<div class="flex items-start justify-between mb-3">' +
          '<div><p class="font-medium text-sm">Đơn hàng #' +
          (order.id || i + 1) +
          "</p>" +
          '<p class="text-xs text-gray-400 mt-0.5">' +
          formatDate(order.date) +
          "</p></div>" +
          '<span class="px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 whitespace-nowrap ' +
          getStatusClass(order.status) +
          '">' +
          getStatusText(order.status) +
          "</span>" +
          "</div>" +
          '<div class="space-y-1 text-sm">' +
          '<div class="flex justify-between"><span class="text-gray-400">Mẫu thiệp</span><span class="font-medium">' +
          (order.templateName || "-") +
          "</span></div>" +
          (order.brideName
            ? '<div class="flex justify-between"><span class="text-gray-400">Cô dâu</span><span>' +
              order.brideName +
              "</span></div>"
            : "") +
          (order.groomName
            ? '<div class="flex justify-between"><span class="text-gray-400">Chú rể</span><span>' +
              order.groomName +
              "</span></div>"
            : "") +
          "</div>" +
          '<div class="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">' +
          '<span class="text-xs text-gray-400">' +
          getStatusHint(order.status) +
          "</span>" +
          '<i class="fas fa-chevron-right text-xs text-gray-300"></i>' +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }
}

// ===== ORDER MODAL =====

function openOrderModal(index) {
  const key = currentUser ? "orders_" + currentUser.email : "guestOrders";
  let orders = [];
  try {
    orders = JSON.parse(localStorage.getItem(key) || "[]");
  } catch (e) {}
  const order = orders[index];
  if (!order) return;

  document.getElementById("order-modal-body").innerHTML =
    renderOrderDetail(order);
  const modal = document.getElementById("order-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeOrderModal() {
  const modal = document.getElementById("order-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

// Close on backdrop click - defer until DOM ready
function setupOrderModal() {
  const modal = document.getElementById("order-modal");
  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === this) closeOrderModal();
    });
  }
}

function renderOrderDetail(order) {
  const statusConfig = {
    pending: {
      icon: "fa-clock",
      iconBg: "bg-yellow-50",
      iconColor: "text-yellow-400",
      title: "Chưa thanh toán",
      desc: "Đơn hàng này chưa được thanh toán. Vui lòng hoàn tất thanh toán để nhận thiệp.",
      action: `<button onclick="closeOrderModal(); PaymentModal.open('${order.templateName || ""}', '${order.theme || "basic-gold"}')" class="flex items-center justify-center gap-2 w-full py-3 rounded-full text-white text-sm font-medium mt-2" style="background-color:#f43f5e;border:none;cursor:pointer;"><i class="fas fa-credit-card"></i>Thanh toán ngay</button>`,
    },
    processing: {
      icon: "fa-paint-brush",
      iconBg: "bg-blue-50",
      iconColor: "text-blue-400",
      title: "Đang xử lý",
      desc: "Đơn hàng đang được xử lý.",
      action: null,
    },
    completed: {
      icon: "fa-check-circle",
      iconBg: "bg-green-50",
      iconColor: "text-green-400",
      title: "Thiệp đã sẵn sàng!",
      desc: "Thiệp cưới của bạn đã hoàn thành. Dùng link bên dưới để thiết lập và chia sẻ với khách mời.",
      action: order.manage_id
        ? `
        <div style="padding:0.75rem;border-radius:0.75rem;border:1px dashed rgb(255 183 202);background:rgb(255 245 248);margin-top:0.5rem;">
          <p style="font-size:0.7rem;color:#9ca3af;margin:0 0 0.5rem;">Link thiết lập thiệp cưới</p>
          <div style="display:flex;gap:0.5rem;align-items:center;">
            <input readonly value="${window.location.origin}/invitation-setup/?id=${order.manage_id}"
              style="flex:1;padding:0.4rem 0.6rem;border-radius:0.5rem;border:1px solid #e5e7eb;font-size:0.65rem;color:#6b7280;background:white;outline:none;min-width:0;" />
            <button onclick="navigator.clipboard.writeText('${window.location.origin}/invitation-setup/?id=${order.manage_id}').then(()=>{this.innerHTML='<i class=\\'fas fa-check\\'></i>';setTimeout(()=>{this.innerHTML='<i class=\\'fas fa-copy\\'></i>';},2000)})"
              style="padding:0.4rem 0.6rem;border-radius:0.5rem;background:#f43f5e;color:white;border:none;cursor:pointer;font-size:0.7rem;flex-shrink:0;">
              <i class="fas fa-copy"></i>
            </button>
          </div>
          <a href="${window.location.origin}/invitation-setup/?id=${order.manage_id}" target="_blank"
            style="display:flex;align-items:center;justify-content:center;gap:0.5rem;margin-top:0.5rem;padding:0.6rem;border-radius:9999px;background:#f43f5e;color:white;font-size:0.8rem;font-weight:600;text-decoration:none;">
            <i class="fas fa-edit"></i> Thiết lập thiệp ngay
          </a>
        </div>`
        : null,
    },
    cancelled: {
      icon: "fa-times-circle",
      iconBg: "bg-red-50",
      iconColor: "text-red-400",
      title: "Đơn hàng đã bị hủy",
      desc: "Đơn hàng này đã bị hủy. Nếu có thắc mắc, vui lòng liên hệ với chúng tôi.",
      action:
        '<a href="index.html#contact" class="flex items-center justify-center gap-2 w-full py-3 rounded-full text-sm font-medium mt-2 border-2" style="border-color: rgb(255 183 202); color: rgb(173 122 135);"><i class="fas fa-headset"></i>Liên hệ hỗ trợ</a>',
    },
  };

  const cfg = statusConfig[order.status] || statusConfig["pending"];

  return `
    <!-- Status Icon -->
    <div class="flex flex-col items-center text-center mb-6">
      <div class="w-16 h-16 rounded-full ${cfg.iconBg} flex items-center justify-center mb-3">
        <i class="fas ${cfg.icon} ${cfg.iconColor} text-2xl"></i>
      </div>
      <p class="font-semibold" style="color: rgb(173 122 135);">${cfg.title}</p>
      <p class="text-sm text-gray-400 mt-1 leading-relaxed">${cfg.desc}</p>
    </div>

    <!-- Order Info -->
    <div class="rounded-2xl p-4 mb-4 space-y-2.5" style="background-color: #f9fafb;">
      <div class="flex justify-between text-sm">
        <span class="text-gray-400">Mã đơn</span>
        <span class="font-mono font-medium text-xs text-gray-600">#${order.id || "-"}</span>
      </div>
      <div class="flex justify-between text-sm">
        <span class="text-gray-400">Ngày đặt</span>
        <span class="text-gray-600">${formatDate(order.date)}</span>
      </div>
      <div class="flex justify-between text-sm">
        <span class="text-gray-400">Mẫu thiệp</span>
        <span class="font-medium text-gray-600">${order.templateName || "-"}</span>
      </div>
      <div class="flex justify-between text-sm">
        <span class="text-gray-400">Trạng thái</span>
        <span class="px-2 py-0.5 rounded-full text-xs font-medium ${getStatusClass(order.status)}">${getStatusText(order.status)}</span>
      </div>
      ${
        order.groomName || order.brideName
          ? `
      <div class="border-t border-gray-200 pt-2.5 space-y-2">
        ${order.groomName ? `<div class="flex justify-between text-sm"><span class="text-gray-400">Chú rể</span><span class="text-gray-600">${order.groomName}</span></div>` : ""}
        ${order.brideName ? `<div class="flex justify-between text-sm"><span class="text-gray-400">Cô dâu</span><span class="text-gray-600">${order.brideName}</span></div>` : ""}
      </div>`
          : ""
      }
    </div>

    <!-- Action Button -->
    ${cfg.action || ""}

    <!-- Contact -->
    <p class="text-center text-xs text-gray-400 mt-4">
      Cần hỗ trợ? <a href="tel:0348840032" class="underline" style="color: rgb(255 183 202);">034.884.0032</a>
    </p>
  `;
}

function getStatusHint(status) {
  var map = {
    pending: "Nhấn để thanh toán",
    completed: "Nhấn để xem thiệp cưới",
    cancelled: "Nhấn để xem chi tiết",
  };
  return map[status] || "Nhấn để xem chi tiết";
}

function mergeGuestOrders() {
  if (!currentUser) return;
  const guestStr = localStorage.getItem("guestOrders");
  if (!guestStr) return;
  try {
    const guestOrders = JSON.parse(guestStr);
    if (!guestOrders.length) return;
    const key = "orders_" + currentUser.email;
    let userOrders = [];
    const userStr = localStorage.getItem(key);
    if (userStr) userOrders = JSON.parse(userStr);

    // Merge: chỉ thêm nếu chưa có cùng templateName
    const existingTemplates = new Set(userOrders.map((o) => o.templateName));
    const toMerge = guestOrders.filter(
      (o) => !existingTemplates.has(o.templateName),
    );

    if (toMerge.length > 0) {
      localStorage.setItem(key, JSON.stringify(userOrders.concat(toMerge)));
    }
    localStorage.removeItem("guestOrders");
    loadOrders();
  } catch (e) {}
}

function loadProfile() {
  if (!currentUser) return;
  const meta = currentUser.user_metadata || {};
  _setInputValue("profile-name", meta.full_name || meta.name || "");
  _setInputValue("profile-email-input", currentUser.email || "");
  _setInputValue("profile-phone", meta.phone || "");
}

// Gán value cho input bên trong <x-input> rồi báo cho x-input tự bật/tắt nút xoá nhanh.
function _setInputValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value;
  const host = el.closest("x-input");
  if (host && typeof host.syncClearBtn === "function") host.syncClearBtn();
}

document
  .getElementById("profile-form")
  .addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!currentUser) {
      showToast("Vui lòng đăng nhập", "error");
      return;
    }
    const { error } = await supabaseClient.auth.updateUser({
      data: {
        full_name: document.getElementById("profile-name").value,
        phone: document.getElementById("profile-phone").value,
      },
    });
    if (error) showToast("Lỗi cập nhật: " + error.message, "error");
    else showToast("Đã lưu thông tin cá nhân", "success");
  });

function getStatusClass(status) {
  var map = {
    pending: "bg-yellow-100 text-yellow-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };
  return map[status] || "bg-gray-100 text-gray-800";
}

function getStatusText(status) {
  var map = {
    pending: "Chưa thanh toán",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
  };
  return map[status] || "Không xác định";
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(function (btn) {
    btn.classList.remove("tab-active");
    btn.classList.add("text-gray-500");
  });
  document.getElementById("tab-" + tabName).classList.add("tab-active");
  document.getElementById("tab-" + tabName).classList.remove("text-gray-500");
  document.getElementById("content-orders").classList.add("hidden");
  document.getElementById("content-profile").classList.add("hidden");
  document.getElementById("content-" + tabName).classList.remove("hidden");
}


// Đăng nhập tách riêng khỏi màn đơn hàng: mở popup dùng chung (giống lúc Xuất bản thiệp).
// onAuth bỏ trống: onAuthStateChange (cùng client) sẽ tự cập nhật UI + gộp đơn khách.
function openLoginPopup() {
  if (!window.AuthUI) return;
  AuthUI.openModal({
    title: "Đăng nhập",
    subtitle: "Đồng bộ đơn hàng và quản lý thiệp cưới của bạn",
    oauthRedirect: window.location.origin + window.location.pathname,
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initAccount();
    setupOrderModal();
  });
} else {
  initAccount();
  setupOrderModal();
}
