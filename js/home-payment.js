// ============= PAYMENT =============

// User hiện tại lấy từ Supabase SDK. KHÔNG tự parse localStorage: token
// supabase-js v2 có thể ở dạng "base64-<...>" nên JSON.parse thẳng sẽ vỡ và âm
// thầm coi người đã đăng nhập là chưa đăng nhập.
let _sessionUser = null;
(function initSessionUser() {
  const sb = window.AuthUI && window.AuthUI.supabase;
  if (!sb) return;
  sb.auth
    .getSession()
    .then(({ data }) => {
      _sessionUser = data?.session?.user ?? null;
    })
    .catch(() => {});
  sb.auth.onAuthStateChange((_event, session) => {
    _sessionUser = session?.user ?? null;
  });
})();

function getCurrentUser() {
  // _authUser do auth-ui set khi đăng nhập trong phiên hiện tại
  return _authUser || _sessionUser;
}

function openPayment(templateId) {
  const template = templates.find((t) => t.id === templateId);
  if (!template) return;
  PaymentModal.open(template.name, template.theme, {
    price: template.price,
    originalPrice: template.originalPrice,
  });
}

