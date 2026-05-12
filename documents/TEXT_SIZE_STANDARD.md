# Quy Tắc Size Text Cho Templates

## Mục đích

Document này định nghĩa các quy tắc về font size cho tất cả templates để đảm bảo tính nhất quán trong thiết kế.

## Nguyên tắc chung

- Sử dụng Tailwind CSS classes hoặc inline style với `clamp()` cho responsive
- Mobile-first: định nghĩa size cho mobile trước, sau đó dùng `md:` cho tablet/desktop
- Đảm bảo text không bị xuống dòng không mong muốn

---

## 1. COVER SCREEN (Màn hình mở đầu)

### Title chính

- **"Wedding Invitation"**: `text-[52px]`
- **Tên cô dâu chú rể**: `text-[36px]` (font-nautigal hoặc font-vibes)

### Labels và text phụ

- **"Trân trọng kính mời bạn"**: `text-[18px]` italic
- **Tên khách mời**: `text-[44px]` (font-nautigal)
- **"đến tham dự lễ thành hôn của"**: `text-[16px]` italic
- **Nút "Mở Thiệp"**: `text-[18px]` italic

---

## 2. HERO SECTION (Phần đầu sau khi mở thiệp)

### Title và tên

- **"Save The Date"**: `text-[28px]` (font-playfair)
- **Tên cô dâu chú rể**: `clamp(24px, 5vw, 36px)` (font-nautigal)
  - Sử dụng clamp để responsive tự động
  - Min: 24px (mobile nhỏ)
  - Preferred: 5vw (theo viewport)
  - Max: 36px (desktop)

### Quote

- **Quote chính**: `text-[14px]` italic (font-cormorant)

---

## 3. COUPLE INFO (Thông tin cô dâu chú rể)

### Labels

- **"Nhà Trai" / "Nhà Gái"**: `text-[10px]` uppercase, `tracking-[3px]`
- **"Chú Rể" / "Cô Dâu"**: `text-[10px]` uppercase, `tracking-[3px]`
- **"Ông bà"**: `text-[12px]`

### Tên người

- **Tên cha mẹ**: `text-[12px]` font-semibold (font-playfair)
- **Tên chú rể/cô dâu**: `text-[12px]` font-semibold, `tracking-wider` (font-cinzel)

### Địa chỉ

- **Địa chỉ**: `text-[11px]`

---

## 4. EVENT INFO (Thông tin sự kiện)

### Section title

- **"Thư Mời"**: `text-[16px]` uppercase, `tracking-[3px]`
- **"Tham dự lễ cưới"**: `text-[11px]` uppercase, `tracking-widest`

### Tên trong lời mời

- **Tên cô dâu chú rể**: `text-[20px]` `tracking-widest` (font-cinzel)
- **Dấu "&"**: `text-[24px]` italic (font-cormorant)

### Ngày giờ

- **Số ngày (lớn)**: `text-[52px]` font-bold (font-playfair)
- **Tháng năm**: `text-[10px]` uppercase, `tracking-[2px]`
- **Thứ trong tuần**: `text-[10px]` uppercase, `tracking-[2px]`
- **Giờ**: `text-[28px]` (font-playfair)
- **Ngày âm lịch**: `text-[13px]` italic (font-cormorant)

### Tiệc cưới

- **"Tiệc Mừng Lễ Thành Hôn"**: `text-[10px]` uppercase, `tracking-[3px]`
- **Ngày giờ tiệc**: `text-[28px]` font-medium (font-playfair)
- **Ngày âm lịch**: `text-base` italic (font-cormorant)
- **Địa điểm**: `text-sm` (font-inter)

### RSVP

- **"Xác nhận tham dự"**: `text-[14px]` uppercase, `tracking-[3px]`
- **Button text**: `text-[16px]` italic (font-cormorant)
- **Message**: `text-[15px]` italic (font-cormorant)

---

## 5. GALLERY (Album ảnh)

### Title

- **"Album Hình Cưới"**: `text-[28px]` hoặc `text-2xl` uppercase, `tracking-[3px]`

### Quote

- **Quote**: `text-[18px]` italic (font-cormorant)

---

## 6. QR CODE SECTION (Hộp mừng cưới)

### Title

- **"Hộp Mừng Cưới"**: `text-[28px]` (font-playfair)

### Labels và thông tin

- **"Chú Rể" / "Cô Dâu"**: `text-[11px]`
- **Tên ngân hàng**: `text-[11px]`
- **Số tài khoản**: `text-[13px]` font-medium
- **Tên chủ tài khoản**: `text-[12px]` font-semibold
- **Button "Lưu QR"**: `text-[12px]`

---

## 7. MAP SECTION (Bản đồ)

### Title và text

- **"Địa Điểm"**: `text-[10px]` hoặc `text-2xl` uppercase, `tracking-[3px]`
- **"Tiệc cưới sẽ tổ chức tại"**: `text-[18px]` italic (font-cormorant)
- **Tên địa điểm**: `text-[16px]` (font-playfair)
- **Link "Chỉ đường"**: `text-sm`

---

## 8. FOOTER

### Text

- **Quote cảm ơn**: `text-[17px]` italic (font-cormorant)
- **Copyright**: `text-xs`

---

## Responsive Guidelines

### Mobile (< 768px)

- Sử dụng size nhỏ hơn, ưu tiên `text-[Xpx]` format
- Đảm bảo text không bị xuống dòng
- Sử dụng `clamp()` cho tên cô dâu chú rể

### Tablet/Desktop (>= 768px)

- Thêm `md:text-[Xpx]` để tăng size
- Tối đa tăng 1.2-1.5x so với mobile
- Ví dụ: `text-[20px] md:text-[28px]`

---

## Font Pairing

### Template 1 & 3 (Romantic/Vintage)

- **Heading**: font-playfair
- **Names**: font-nautigal (handwriting)
- **Labels**: font-cinzel (elegant serif)
- **Body**: font-inter (clean sans-serif)
- **Italic/Quote**: font-cormorant (italic serif)

### Template 2 (Modern)

- Có thể điều chỉnh nhưng giữ nguyên size hierarchy

---

## Tracking (Letter Spacing)

- **Uppercase labels**: `tracking-[3px]` hoặc `tracking-widest`
- **Names với font-cinzel**: `tracking-wider`
- **Normal text**: không cần tracking
- **Decorative text**: `tracking-[8px]` (cho ornaments như "✦ ✦ ✦")

---

## Notes

1. **Consistency**: Tất cả templates phải tuân theo size hierarchy này
2. **Testing**: Test trên iPhone (375px), iPad (768px), Desktop (1024px+)
3. **Accessibility**: Đảm bảo text size tối thiểu 10px cho readability
4. **Performance**: Ưu tiên Tailwind classes hơn inline styles khi có thể
