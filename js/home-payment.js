// ============= PAYMENT =============

function getCurrentUser() {
  // Ưu tiên user lấy từ Supabase SDK (đã giải mã đúng session)
  if (_authUser) return _authUser;
  try {
    const keys = Object.keys(localStorage);
    const sessionKey = keys.find(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
    );
    if (!sessionKey) return null;
    let raw = localStorage.getItem(sessionKey);
    if (!raw) return null;
    // supabase-js v2 mới lưu giá trị có tiền tố "base64-" → cần decode trước khi parse
    if (raw.startsWith("base64-")) {
      raw = atob(raw.slice(7));
    }
    const session = JSON.parse(raw);
    return session?.user ?? null;
  } catch (e) {
    return null;
  }
}

function openPayment(templateId) {
  const template = templates.find((t) => t.id === templateId);
  if (!template) return;
  PaymentModal.open(template.name, template.theme, {
    price: template.price,
    originalPrice: template.originalPrice,
  });
}

