# Implementation Plan — Làm Giống Đối Thủ

> 4 tính năng: Free Draft · Promo Code · Step Indicator · Preview với data thật

---

## Tổng Quan Flow Mới

```
TRƯỚC:
Landing → Chọn template → PaymentModal (tên/SĐT) → Trả tiền → Nhận link → Điền chi tiết

SAU:
Landing → Chọn template → [Tạo nháp miễn phí] → Điền chi tiết → [Xem trước] → [Thanh toán] → Chia sẻ
              ↓
       redirect tự động đến /invitation-setup/?id=xxx
```

---

## Feature 1: Free Draft Flow

### Mô tả
Người dùng tạo thiệp **miễn phí**, điền thông tin đầy đủ, xem thử, rồi mới thanh toán.
Wedding record được tạo ngay từ đầu với `is_published = false`.
Sau khi thanh toán → `is_published = true` → thiệp mới chia sẻ được.

### Các file thay đổi

#### `index.js`
- **Xóa:** `openPayment(templateId)` gọi `PaymentModal.open()`
- **Thêm:** `createDraft(templateId)` — tạo draft record, redirect sang invitation-setup

```javascript
// Mới
async function createDraft(templateId) {
  const template = templates.find(t => t.id === templateId);
  const manage_id = generateUUID();
  
  // POST tạo wedding với is_published = false
  await fetch(EDGE_URL, {
    method: 'POST',
    body: JSON.stringify({ manage_id, theme: template.theme, is_published: false })
  });
  
  // Lưu theme vào sessionStorage để invitation-setup dùng
  sessionStorage.setItem('draft_theme', template.theme);
  sessionStorage.setItem('draft_template_name', template.name);
  
  window.location.href = `/invitation-setup/?id=${manage_id}`;
}
```

#### `index.html`
- **Đổi** nút "Chọn mẫu này" từ `onclick="openPayment()"` → `onclick="createDraft()"`
- **Đổi** text nút: "Tạo thiệp miễn phí" (thay vì "Mua ngay")

---

#### `invitation-setup/index.js`
**Thêm logic:**
1. Fetch wedding data → kiểm tra `is_published`
2. Nếu `is_published = false` → hiện **draft banner** + nút **"Thanh toán để chia sẻ"**
3. Nếu `is_published = true` → hiện giao diện bình thường như hiện tại

**Draft banner** (hiện trên đầu trang khi chưa thanh toán):
```
┌─────────────────────────────────────────────┐
│ 📝 Bản nháp — Thiệp chưa được chia sẻ       │
│ Hoàn tất thông tin rồi thanh toán để kích   │
│ hoạt.                    [Thanh toán ngay →] │
└─────────────────────────────────────────────┘
```

**Nút "Thanh toán ngay"** → gọi `PaymentModal.open()` với `manage_id` đã có sẵn.

---

#### `core/payment.js`
**Thay đổi logic `process()`:**

Hiện tại: tạo `manage_id` mới → POST tạo wedding record → tạo payment

Mới:
- Nếu `window._existingManageId` tồn tại (từ draft flow):
  - Không tạo wedding record nữa
  - Chỉ tạo payment với `manage_id` đã có
- Sau khi payment thành công: gọi PATCH `{ id: manage_id, is_published: true }`

```javascript
// Trong PaymentModal.open(), thêm tham số
open(templateName, theme, pricing = {}, existingManageId = null) {
  window._existingManageId = existingManageId;
  // ...
}

// Trong process():
const manage_id = window._existingManageId || generateUUID();
if (!window._existingManageId) {
  // Tạo wedding record mới (flow cũ - từ account page)
  await createWeddingRecord(manage_id, theme);
}
// Tạo payment với manage_id
await createPayment({ manage_id, ... });
```

---

#### `router.html`
Thêm check `is_published` sau khi fetch wedding data:

```javascript
.then(data => {
  if (!data) { window.location.replace('/'); return; }
  if (!data.is_published) {
    window.location.replace('/'); // hoặc show trang "Thiệp chưa kích hoạt"
    return;
  }
  // redirect sang template như hiện tại
})
```

---

#### `core/dal/wedding-dal.js`
- **Thêm** method `createDraftWedding(manage_id, theme)` — POST với `is_published: false`
- **Thêm** method `publishWedding(id)` — PATCH với `is_published: true`

---

## Feature 2: Promo Code

### Mô tả
Ô nhập mã giảm giá trong payment modal. Validate real-time, hiển thị giá sau giảm.

### Các file thay đổi

#### `core/payment.js`

**Thêm vào HTML của payment modal (step 1):**

```html
<!-- Sau phần hiển thị giá -->
<div id="promo-section">
  <div class="flex gap-2">
    <input id="promo-input" type="text" placeholder="Mã giảm giá"
      class="flex-1 border rounded-lg px-3 py-2 text-sm uppercase" />
    <button onclick="applyPromo()" 
      class="px-4 py-2 bg-rose-100 text-rose-600 rounded-lg text-sm font-medium">
      Áp dụng
    </button>
  </div>
  <div id="promo-result" class="mt-1 text-xs hidden"></div>
</div>
```

**Thêm function `applyPromo()`:**
```javascript
async function applyPromo() {
  const code = document.getElementById('promo-input').value.trim().toUpperCase();
  if (!code) return;

  const res = await supabaseClient
    .from('promo_codes')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .single();

  if (!res.data) {
    // Hiện lỗi: "Mã không hợp lệ hoặc đã hết hạn"
    return;
  }

  const promo = res.data;
  // Kiểm tra max_uses, expires_at
  // Tính giá mới
  // Cập nhật display
  window._appliedPromo = promo;
}
```

**Trong `process()`: áp dụng discount vào `paymentData`:**
```javascript
if (window._appliedPromo) {
  paymentData.promo_code = window._appliedPromo.code;
  paymentData.discount = calculatedDiscount;
}
```

---

## Feature 3: Step Indicator

### Mô tả
Thanh hiển thị 4 bước ở đầu trang invitation-setup. Step hiện tại được highlight.

```
[✓ Chọn mẫu] → [● Thông tin] → [○ Xem trước] → [○ Thanh toán]
```

### Các file thay đổi

#### `invitation-setup/index.html`
Thêm component ở trên cùng body (sau header, trước form):

```html
<div id="step-indicator" class="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
  <div class="max-w-2xl mx-auto flex items-center justify-between">
    <div class="step done">
      <span class="step-dot">✓</span>
      <span class="step-label">Chọn mẫu</span>
    </div>
    <div class="step-line"></div>
    <div class="step active">
      <span class="step-dot">2</span>
      <span class="step-label">Thông tin</span>
    </div>
    <div class="step-line"></div>
    <div class="step">
      <span class="step-dot">3</span>
      <span class="step-label">Xem trước</span>
    </div>
    <div class="step-line"></div>
    <div class="step">
      <span class="step-dot">4</span>
      <span class="step-label">Thanh toán</span>
    </div>
  </div>
</div>
```

Step 3 → click "Xem trước" chuyển active sang step 3.
Step 4 → click "Thanh toán" chuyển active sang step 4.

Không cần DB thay đổi.

---

## Feature 4: Preview với Data Thật

### Mô tả
Nút "Xem trước thiệp" trong invitation-setup. Lưu form data vào `sessionStorage`, mở tab mới với template ở chế độ preview dùng data thật.

### Các file thay đổi

#### `invitation-setup/index.js`
**Thêm function `previewWithRealData()`:**
```javascript
function previewWithRealData() {
  // Thu thập data từ form hiện tại
  const formData = collectFormData(); // đã có sẵn trong saveAll()
  
  // Lưu vào sessionStorage
  sessionStorage.setItem('preview_data', JSON.stringify(formData));
  sessionStorage.setItem('preview_theme', WEDDING_THEME);
  
  // Mở tab mới
  window.open(`/public/themes/${WEDDING_THEME}/?preview=true&source=live`, '_blank');
}
```

**Thêm nút "Xem trước" vào header invitation-setup:**
```html
<button onclick="previewWithRealData()" 
  class="flex items-center gap-2 px-4 py-2 border border-rose-300 text-rose-500 rounded-full text-sm">
  <i class="fas fa-eye"></i> Xem trước
</button>
```

---

#### `public/themes/basic-gold/index.js` (và romantic-gold, vintage-forest)
**Trong hàm load data đầu file:**

```javascript
// Ưu tiên sessionStorage nếu preview=true&source=live
const params = new URLSearchParams(window.location.search);
if (params.get('preview') === 'true' && params.get('source') === 'live') {
  const raw = sessionStorage.getItem('preview_data');
  if (raw) {
    const data = JSON.parse(raw);
    renderWedding(data); // dùng data thật
    return;
  }
}
// Fallback: load từ DB như bình thường
```

---

## Thứ Tự Implement

```
1. Step Indicator           — độc lập, không ảnh hưởng flow, làm trước để test
2. Preview với data thật    — độc lập, chỉ cần sessionStorage
3. Promo Code               — độc lập trong payment modal
4. Free Draft Flow          — làm cuối vì ảnh hưởng nhiều file nhất
```

---

## File Summary

| File | Feature | Loại thay đổi |
|---|---|---|
| `index.js` | Free Draft | Đổi `openPayment` → `createDraft` |
| `index.html` | Free Draft | Đổi text + onclick nút |
| `invitation-setup/index.html` | Step Indicator, Draft Banner | Thêm UI |
| `invitation-setup/index.js` | Free Draft, Preview | Thêm logic draft + preview |
| `core/payment.js` | Free Draft, Promo Code | Sửa process(), thêm promo UI |
| `core/dal/wedding-dal.js` | Free Draft | Thêm 2 method mới |
| `router.html` | Free Draft | Thêm check is_published |
| `public/themes/*/index.js` (×3) | Preview | Thêm sessionStorage read |
