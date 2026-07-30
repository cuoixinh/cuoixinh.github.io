// ============= PAYMENT =============

// Trạng thái đăng nhập hỏi CXAuth (core/auth.js) — không giữ bản sao ở đây nữa.

function openPayment(templateId) {
  const template = templates.find((t) => t.id === templateId);
  if (!template) return;
  PaymentModal.open(template.name, template.theme, {
    price: template.price,
    originalPrice: template.originalPrice,
  });
}

