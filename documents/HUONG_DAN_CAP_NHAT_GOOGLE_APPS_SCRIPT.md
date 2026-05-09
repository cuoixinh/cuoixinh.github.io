# Hướng Dẫn Cập Nhật Google Apps Script

## ⚠️ QUAN TRỌNG

Bạn cần cập nhật code Google Apps Script để thêm 2 endpoints mới:

1. `getAllGuests` - Lấy tất cả khách mời
2. `batchUpdateLinks` - Cập nhật hàng loạt link

## 📝 Các Bước Thực Hiện

### Bước 1: Mở Google Apps Script Editor

1. Mở file Google Sheet của bạn (nhà trai hoặc nhà gái)
2. Click menu **Extensions** (Tiện ích mở rộng) → **Apps Script**
3. Tab mới sẽ mở ra với editor

### Bước 2: Thay Thế Code Cũ

1. Xóa toàn bộ code hiện tại trong editor
2. Copy code mới từ file `GOOGLE_APPS_SCRIPT_SETUP.md` (phần "Bước 2: Dán Code vào Editor")
3. Paste vào editor

### Bước 3: Lưu Project

1. Click icon **Save** (đĩa mềm) hoặc `Ctrl+S`
2. Đợi lưu thành công

### Bước 4: Deploy Lại

1. Click **Deploy** → **Manage deployments**
2. Click icon ✏️ (Edit) ở deployment hiện tại
3. Chọn **New version** trong dropdown "Version"
4. Nhập description: "Added getAllGuests and batchUpdateLinks endpoints"
5. Click **Deploy**

### Bước 5: Test Endpoints Mới

#### Test getAllGuests:

Mở trình duyệt và truy cập:

```
https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?action=getAllGuests
```

**Kết quả mong đợi:**

```json
{
  "success": true,
  "guests": [
    {
      "row": 2,
      "fullName": "Nguyễn Văn A",
      "displayName": "Anh Văn A",
      "relationship": "Bạn thân",
      "link": "",
      "viewed": false,
      "confirmed": "Chưa xác nhận",
      "message": "",
      "confirmedAt": ""
    },
    ...
  ]
}
```

#### Test batchUpdateLinks:

Dùng Postman hoặc curl:

```bash
curl -X POST https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec \
  -H "Content-Type: application/json" \
  -d '{
    "action": "batchUpdateLinks",
    "updates": [
      {"row": 2, "link": "http://test.com/link1"},
      {"row": 3, "link": "http://test.com/link2"}
    ]
  }'
```

**Kết quả mong đợi:**

```json
{
  "success": true,
  "message": "Updated 2 links successfully",
  "count": 2
}
```

### Bước 6: Lặp Lại Cho Sheet Còn Lại

Nếu bạn có 2 Google Sheets (nhà trai và nhà gái), hãy lặp lại các bước trên cho sheet còn lại.

## ✅ Kiểm Tra Hoàn Tất

Sau khi cập nhật xong, bạn có thể:

1. Mở trang `customer/manage.html?id=YOUR_WEDDING_ID`
2. Nhập URL Google Apps Script vào ô tương ứng
3. Click nút "🔗 Tự động tạo link"
4. Hệ thống sẽ:
   - Lấy danh sách khách từ Google Sheet
   - Mã hóa tên + quan hệ
   - Tạo link cá nhân hóa
   - Cập nhật vào cột D (Link thiệp)

## 🐛 Troubleshooting

### Lỗi "Invalid request"

→ Kiểm tra lại code đã paste đúng chưa

### Lỗi "Row X is out of range"

→ Kiểm tra dữ liệu trong sheet, đảm bảo có dữ liệu từ dòng 2 trở đi

### Không thấy endpoint mới

→ Đảm bảo đã deploy lại với "New version"

### Link không được cập nhật

→ Kiểm tra quyền truy cập Google Sheet và xem log trong Apps Script (View → Executions)

## 📞 Lưu Ý

- Code mới tương thích ngược với code cũ (các endpoint cũ vẫn hoạt động)
- Không cần thay đổi URL Google Apps Script
- Chỉ cần deploy lại là xong
- Nếu có lỗi, có thể rollback về version cũ trong Manage deployments

---

**Hoàn thành!** Bây giờ bạn có thể sử dụng tính năng tự động tạo link cá nhân hóa. 🎉
