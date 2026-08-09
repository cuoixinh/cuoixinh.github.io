# Plan: Redesign Trang Chủ (index.html)

> Trạng thái: **Chưa implement** — chờ xác nhận

---

## Cấu trúc trang mới (6 sections)

```
[1] NAV (fixed top)
[2] HERO
[3] TEMPLATE GALLERY
[4] HOW IT WORKS (4 bước)
[5] WHY CHOOSE US — tính năng thực tế
[6] CTA BOTTOM
[FOOTER]
```

---

## Chi tiết từng section

### [1] NAV

**Thay đổi:**
- Bỏ "Đơn hàng" → đổi thành **"Quản lý thiệp"** → `/public/account/` (label rõ hơn, đúng với nội dung trang)
- Đổi "Bắt đầu" → **"Tạo thiệp miễn phí"** → link thẳng đến `/invitation-setup/`
- Nav links: "Mẫu thiệp" | "Tính năng" | "Cách dùng"

---

### [2] HERO

**Thay đổi:**
- Headline: **"Thiệp cưới online đẹp — tạo trong vài phút"**
- Subline: "Dùng thử miễn phí, chỉ thanh toán khi ưng ý."
- Dual CTA: `[Tạo thiệp miễn phí]` (primary, → `/invitation-setup/`) + `[Xem mẫu thiệp ↓]` (ghost, scroll xuống)
- Trust badges (3 badge nhỏ bên dưới CTA):
  - `✓ Thanh toán một lần`
  - `✓ Đổi mẫu miễn phí`
  - `✓ Hỗ trợ tận tình`
- Background: giữ grid ảnh mờ hiện tại

---

### [3] TEMPLATE GALLERY

**Thay đổi:**
- Giữ horizontal scroll carousel, dữ liệu lấy từ DB như hiện tại
- Cập nhật section header: **"Bộ sưu tập mẫu thiệp"** + subtext "Chọn thoải mái — đổi miễn phí"
- Mỗi card: tên + mô tả (đã có từ DB), 2 nút `[Xem demo]` + `[Dùng mẫu này]`
- Nút "Dùng mẫu này" → `createDraft(t.id)` (đã có sẵn trong `index.js`)
- Bỏ badge hardcode "PHỔ BIẾN / MỚI" theo index → dùng `t.category` từ DB nếu có, hoặc bỏ hẳn

---

### [4] HOW IT WORKS — 4 bước

Đổi thứ tự: thanh toán là bước cuối, khớp với flow thực tế trong `invitation-setup`:

| # | Tiêu đề | Ghi chú |
|---|---|---|
| 1 | Chọn mẫu thiệp | Dùng thử miễn phí — đổi mẫu thoải mái |
| 2 | Nhập thông tin | Tên, ảnh, ngày cưới, địa điểm, câu chuyện tình yêu... |
| 3 | Xem trước & chia sẻ | Xem thiệp thật, gửi link thử cho người thân |
| 4 | Thanh toán một lần | Ưng ý mới cần thanh toán — dùng trọn đời |

> Bỏ "Quản lý khách mời" — tính năng đó dùng Google Apps Script, không phải flow đơn giản.

---

### [5] WHY CHOOSE US

Thay 8 feature card generic hiện tại bằng tính năng thực tế của app:

| Icon | Tiêu đề | Mô tả | Highlight |
|---|---|---|---|
| 👤 | Thiệp riêng từng khách | Mỗi người nhận link với tên cá nhân hóa | NỔI BẬT |
| 💳 | Thanh toán một lần | Không phí hàng tháng, dùng trọn đời | NỔI BẬT |
| 💑 | Câu chuyện tình yêu | Kể lại hành trình từ lần đầu gặp đến cầu hôn | |
| 📸 | Album ảnh cưới | Tối đa 10 ảnh, trình bày đẹp trong thiệp | |
| 📅 | Lịch trình ngày cưới | Tiệc cưới + lễ chính, chi tiết từng sự kiện | |
| ✅ | Xác nhận tham dự | Khách RSVP trực tiếp trên thiệp | |
| 💝 | QR mừng cưới | Nhận lì xì qua QR ngân hàng trong thiệp | |
| 🎵 | Nhạc nền lãng mạn | Chọn bài nhạc YouTube yêu thích | |

Layout: grid 2 cột mobile, 4 cột desktop. 2 card "NỔI BẬT" có border hồng đậm hơn.

---

### [6] CTA BOTTOM

- Primary CTA: **"Bắt đầu tạo thiệp — Miễn phí hoàn toàn"**
- Button: `[Tạo thiệp ngay →]` → `/invitation-setup/`
- 3 điểm nhỏ: "Dùng thử miễn phí · Đổi mẫu mọi lúc · Thanh toán một lần dùng trọn đời"
- Contact info (email/phone) vẫn giữ nhưng nhỏ hơn, xuống dưới

---

### [FOOTER]

- Đổi background từ `bg-gray-800` → light (`bg-white` + `border-t border-rose-pastel-200`)
- Layout 3 cột: Brand | Điều hướng | Liên hệ

```
Cưới Xinh             Điều hướng        Liên hệ
[logo]                Mẫu thiệp         admin@cuoixinh.com
Thiệp cưới online     Tạo thiệp         034.884.0032
cho các cặp đôi VN    Quản lý thiệp
© 2026 Cưới Xinh
```

> Chỉ link đến trang đang tồn tại: `/` · `/invitation-setup/` · `/public/account/`

---

## Những gì KHÔNG thay đổi

- Logic fetch template từ Supabase trong `index.js` (giữ nguyên)
- Tailwind CDN + font imports
- `styles/landing.css` + `styles/common.css`
- `core/payment.js` modal

---

## Files cần sửa

| File | Thay đổi |
|---|---|
| `index.html` | Viết lại `<body>`: nav, hero, sections, footer |
| `index.js` | Sửa `renderTemplateCards()`: cập nhật nút + bỏ badge hardcode |

---

*Plan tạo 2026-06-11. Chưa implement — chờ xác nhận.*
