// ============= PAYMENT =============

// Trạng thái đăng nhập hỏi CXAuth (core/auth.js) — không giữ bản sao ở đây nữa.

function openPayment(templateId) {
  const template = templates.find((t) => t.id === templateId);
  if (!template) return;
  window.location.href = cxCheckoutUrl({
    theme: template.theme,
    name: template.name,
    price: template.price,
    original: template.originalPrice,
  });
}

