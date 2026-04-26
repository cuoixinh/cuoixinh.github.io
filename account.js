// ===== SUPABASE AUTH =====
const SUPABASE_URL = 'https://lcobawmkywtxhpezndsh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxjb2Jhd21reXd0eGhwZXpuZHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4OTA5ODMsImV4cCI6MjA5MTQ2Njk4M30.4BNmxnfixXdHOq0ovtaF_4wQZ9sap3IWbJNJK9H4Mg4';

const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

async function initAccount() {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    updateAuthBlock();
    loadOrders();
  });

  const { data: { session } } = await supabaseClient.auth.getSession();
  currentUser = session?.user ?? null;
  updateAuthBlock();
  loadOrders();
  loadProfile();
}

async function loginWithFacebook() {
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'facebook',
    options: { redirectTo: window.location.href }
  });
  if (error) showToast('Lỗi đăng nhập Facebook: ' + error.message, 'error');
}

async function loginWithGoogle() {
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href }
  });
  if (error) showToast('Lỗi đăng nhập Google: ' + error.message, 'error');
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.replace(window.location.pathname);
}

function updateAuthBlock() {
  const loggedout = document.getElementById('auth-loggedout');
  const loggedin = document.getElementById('auth-loggedin');

  if (currentUser) {
    loggedout.classList.add('hidden');
    loggedin.classList.remove('hidden');
    const name = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || 'Người dùng';
    const avatar = currentUser.user_metadata?.avatar_url;
    document.getElementById('user-name').textContent = name;
    document.getElementById('user-email').textContent = currentUser.email || '';
    const avatarEl = document.getElementById('user-avatar');
    if (avatarEl && avatar) {
      avatarEl.innerHTML = '<img src="' + avatar + '" class="w-full h-full object-cover rounded-full" />';
    }
    mergeGuestOrders();
  } else {
    loggedout.classList.remove('hidden');
    loggedin.classList.add('hidden');
  }
}

function loadOrders() {
  const listEl = document.getElementById('orders-list');
  const emptyEl = document.getElementById('empty-orders');
  let orders = [];
  const key = currentUser ? ('orders_' + currentUser.email) : 'guestOrders';
  const str = localStorage.getItem(key);
  if (str) { try { orders = JSON.parse(str); } catch (e) {} }

  if (orders.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
  } else {
    emptyEl.classList.add('hidden');
    listEl.innerHTML = orders.map(function(order, i) {
      return '<div class="border border-gray-200 rounded-xl p-4 mb-4">' +
        '<div class="flex items-start justify-between mb-3">' +
          '<div><p class="font-medium">Đơn hàng #' + (order.id || (i + 1)) + '</p>' +
          '<p class="text-xs text-gray-500 mt-0.5">' + formatDate(order.date) + '</p></div>' +
          '<span class="px-3 py-1 rounded-full text-xs font-medium ' + getStatusClass(order.status) + '">' + getStatusText(order.status) + '</span>' +
        '</div>' +
        '<div class="space-y-1 text-sm">' +
          '<div class="flex justify-between"><span class="text-gray-500">Mẫu thiệp</span><span class="font-medium">' + (order.templateName || '-') + '</span></div>' +
          (order.brideName ? '<div class="flex justify-between"><span class="text-gray-500">Cô dâu</span><span>' + order.brideName + '</span></div>' : '') +
          (order.groomName ? '<div class="flex justify-between"><span class="text-gray-500">Chú rể</span><span>' + order.groomName + '</span></div>' : '') +
        '</div></div>';
    }).join('');
  }
}

function mergeGuestOrders() {
  if (!currentUser) return;
  const guestStr = localStorage.getItem('guestOrders');
  if (!guestStr) return;
  try {
    const guestOrders = JSON.parse(guestStr);
    if (!guestOrders.length) return;
    const key = 'orders_' + currentUser.email;
    let userOrders = [];
    const userStr = localStorage.getItem(key);
    if (userStr) userOrders = JSON.parse(userStr);
    localStorage.setItem(key, JSON.stringify(userOrders.concat(guestOrders)));
    localStorage.removeItem('guestOrders');
    loadOrders();
  } catch (e) {}
}

function loadProfile() {
  if (!currentUser) return;
  const meta = currentUser.user_metadata || {};
  document.getElementById('profile-name').value = meta.full_name || meta.name || '';
  document.getElementById('profile-email-input').value = currentUser.email || '';
  document.getElementById('profile-phone').value = meta.phone || '';
}

document.getElementById('profile-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  if (!currentUser) { showToast('Vui lòng đăng nhập', 'error'); return; }
  const { error } = await supabaseClient.auth.updateUser({
    data: {
      full_name: document.getElementById('profile-name').value,
      phone: document.getElementById('profile-phone').value,
    }
  });
  if (error) showToast('Lỗi cập nhật: ' + error.message, 'error');
  else showToast('Đã lưu thông tin cá nhân', 'success');
});

function getStatusClass(status) {
  var map = { pending: 'bg-yellow-100 text-yellow-800', processing: 'bg-blue-100 text-blue-800', completed: 'bg-green-100 text-green-800', cancelled: 'bg-red-100 text-red-800' };
  return map[status] || 'bg-gray-100 text-gray-800';
}

function getStatusText(status) {
  var map = { pending: 'Chờ xử lý', processing: 'Đang xử lý', completed: 'Hoàn thành', cancelled: 'Đã hủy' };
  return map[status] || 'Không xác định';
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.classList.remove('tab-active');
    btn.classList.add('text-gray-500');
  });
  document.getElementById('tab-' + tabName).classList.add('tab-active');
  document.getElementById('tab-' + tabName).classList.remove('text-gray-500');
  document.getElementById('content-orders').classList.add('hidden');
  document.getElementById('content-profile').classList.add('hidden');
  document.getElementById('content-' + tabName).classList.remove('hidden');
}

function showToast(message, type) {
  var colors = { success: 'rgb(212,165,165)', error: '#ef4444', info: '#9ca3af' };
  var toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;top:20px;right:20px;background:' + (colors[type] || colors.info) + ';color:white;padding:12px 20px;border-radius:8px;font-size:14px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 3000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAccount);
} else {
  initAccount();
}
