// ============= PAYMENT =============

// Trạng thái đăng nhập hỏi CXAuth (core/auth.js) — không giữ bản sao ở đây nữa.

function openPayment(templateId) {
  const template = templates.find((t) => t.id === templateId);
  if (!template) return;
  // Giá chỉ đến từ `template_pricing`; mẫu chưa khai giá thì dừng ở đây thay vì
  // đẩy khách sang trang thanh toán với một con số dự phòng nào đó.
  if (!Number.isFinite(template.price)) {
    alert("Mẫu này chưa có giá bán, vui lòng liên hệ để được hỗ trợ.");
    return;
  }
  window.location.href = cxCheckoutUrl({
    theme: template.theme,
    name: template.name,
    price: template.price,
    original: template.originalPrice,
  });
}
