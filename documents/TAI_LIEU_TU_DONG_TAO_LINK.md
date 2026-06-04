# Tài Liệu Tính Năng: Tự Động Tạo Link Thiệp Cá Nhân Hóa

## 📋 Tổng Quan

Tính năng này cho phép tự động tạo link thiệp mời cá nhân hóa cho từng khách mời trong hệ thống quản lý thiệp cưới. Hệ thống sẽ mã hóa thông tin khách mời (tên và quan hệ) và tạo URL riêng biệt cho mỗi người, sau đó cập nhật các link này vào Google Sheets.

## 🎯 Mục Đích

- Tạo link thiệp cá nhân hóa cho từng khách mời
- Phân biệt rõ ràng giữa khách nhà trai và nhà gái
- Hiển thị lời chào cá nhân hóa khi khách mở thiệp
- Tự động cập nhật link vào Google Sheets để dễ quản lý

## 🔑 Thuật Ngữ

- **Trang Quản Trị**: Trang invitation-setup/index.html nơi quản lý thông tin chi tiết của đám cưới
- **Trang Thiệp**: Trang public/themes/basic-gold/index.html hiển thị thiệp cưới cá nhân hóa cho khách mời
- **Google Sheet**: Bảng tính chứa thông tin khách mời với các cột: họ tên, tên hiển thị, quan hệ, link thiệp, đã xem thiệp, xác nhận tham dự, lời chúc, và thời gian xác nhận
- **Khóa Mã Hóa**: "dqvinh" - khóa được sử dụng để mã hóa/giải mã thông tin khách

## 📊 Cấu Trúc Google Sheet

| Cột | Tên Cột            | Mô Tả                                                |
| --- | ------------------ | ---------------------------------------------------- |
| A   | Họ và tên          | Tên đầy đủ của khách mời                             |
| B   | Tên hiển thị       | Tên sẽ hiển thị trên thiệp (VD: Anh Văn A)           |
| C   | Quan hệ            | Mối quan hệ với gia đình (VD: Bạn thân, Đồng nghiệp) |
| D   | Link thiệp         | Link thiệp cá nhân hóa (sẽ được tự động tạo)         |
| E   | Đã xem thiệp       | TRUE/FALSE                                           |
| F   | Xác nhận tham dự   | Có tham dự / Không tham dự / Chưa xác nhận           |
| G   | Lời chúc           | Lời chúc của khách                                   |
| H   | Thời gian xác nhận | Timestamp                                            |

## 🔗 Định Dạng Link

### Link Nhà Trai

```
http://domain.com/index.html?id=WEDDING_ID&isGroom=true&name=ENCRYPTED_NAME&relationship=ENCRYPTED_RELATIONSHIP
```

### Link Nhà Gái

```
http://domain.com/index.html?id=WEDDING_ID&isGroom=false&name=ENCRYPTED_NAME&relationship=ENCRYPTED_RELATIONSHIP
```

### Ví Dụ Thực Tế

```
http://127.0.0.1:5500/index.html?id=d4004d06-6b6f-4bc1-8953-0ae63388e508&isGroom=true&name=U2FsdGVkX1...&relationship=U2FsdGVkX1...
```

## 🎨 Giao Diện Người Dùng

### 1. Nút Tự Động Tạo Link

**Vị trí**:

- Nút nhà trai: Trong phần "Nhà Trai", gần ô "URL Google Apps Script (DS khách mời nhà trai)"
- Nút nhà gái: Trong phần "Nhà Gái", gần ô "URL Google Apps Script (DS khách mời nhà gái)"

**Thiết kế**:

- Icon: 🔗
- Text: "Tự động tạo link"
- Màu sắc: Gradient xanh cho nhà trai, gradient hồng cho nhà gái
- Trạng thái disabled khi đang xử lý

**Hành vi**:

- Click → Hiển thị loading "Đang tạo link..."
- Thành công → Toast "✅ Đã tạo link thành công cho [N] khách mời nhà [trai/gái]"
- Lỗi → Toast với thông báo lỗi cụ thể

## 🔐 Mã Hóa

### Thư Viện

- **CryptoJS**: Thư viện mã hóa JavaScript
- **Thuật toán**: AES (Advanced Encryption Standard)
- **Khóa**: "dqvinh"
- **Encoding**: Base64 (để an toàn cho URL)

### Quy Trình Mã Hóa

1. Lấy tên hiển thị (cột B) và quan hệ (cột C)
2. Mã hóa từng giá trị bằng AES với khóa "dqvinh"
3. Encode kết quả sang Base64
4. Thêm vào URL parameters

### Quy Trình Giải Mã

1. Lấy tham số `name` và `relationship` từ URL
2. Decode từ Base64
3. Giải mã bằng AES với khóa "dqvinh"
4. Hiển thị lời chào cá nhân hóa

## 📝 Quy Trình Hoạt Động

### Bước 1: Người Dùng Click Nút

```
Quản trị viên → Click "Tự động tạo link" (nhà trai hoặc nhà gái)
```

### Bước 2: Lấy Dữ Liệu

```
1. Lấy URL Google Sheet tương ứng (groom_google_sheet_url hoặc bride_google_sheet_url)
2. Kiểm tra URL có hợp lệ không
3. Gọi API Google Apps Script để lấy tất cả khách (từ dòng 2 trở đi)
4. Lưu: row number, tên hiển thị (cột B), quan hệ (cột C)
```

### Bước 3: Tạo Link

```
Với mỗi khách:
1. Mã hóa tên hiển thị → encrypted_name
2. Mã hóa quan hệ → encrypted_relationship
3. Tạo URL:
   - Nhà trai: domain/index.html?id=xxx&isGroom=true&name=xxx&relationship=xxx
   - Nhà gái: domain/index.html?id=xxx&isGroom=false&name=xxx&relationship=xxx
4. Lưu vào mảng updates: {row: X, link: "..."}
```

### Bước 4: Cập Nhật Google Sheet

```
1. Gọi API batch update với mảng updates
2. API cập nhật cột D (Link thiệp) cho từng dòng
3. Trả về kết quả thành công/thất bại
```

### Bước 5: Hiển Thị Kết Quả

```
- Thành công: "✅ Đã tạo link thành công cho [N] khách mời nhà [trai/gái]"
- Thất bại: "❌ Lỗi: [chi tiết lỗi]"
```

## 🌐 Hiển Thị Trên Trang Thiệp

### Khi Khách Mở Link

1. **Đọc URL Parameters**

   ```javascript
   const params = new URLSearchParams(window.location.search);
   const id = params.get("id");
   const isGroom = params.get("isGroom") === "true";
   const encryptedName = params.get("name");
   const encryptedRelationship = params.get("relationship");
   ```

2. **Giải Mã**

   ```javascript
   const name = decryptAES(encryptedName, "dqvinh");
   const relationship = decryptAES(encryptedRelationship, "dqvinh");
   ```

3. **Hiển Thị Lời Chào**

   ```
   "Kính mời [relationship] [name] tới dự lễ thành hôn..."

   Ví dụ: "Kính mời Anh Văn A tới dự lễ thành hôn..."
   ```

4. **Vị Trí Hiển Thị**
   - Element: `#cover-guest-name`
   - Màn hình: Cover screen (trước khi mở thiệp)
   - Vẫn hiển thị trong suốt quá trình xem thiệp

## 🔧 Google Apps Script API

### Endpoint Mới: Batch Update Links

**URL**: `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec`

**Method**: POST

**Request Body**:

```json
{
  "action": "batchUpdateLinks",
  "updates": [
    {
      "row": 2,
      "link": "http://domain.com/index.html?id=xxx&isGroom=true&name=xxx&relationship=xxx"
    },
    {
      "row": 3,
      "link": "http://domain.com/index.html?id=xxx&isGroom=true&name=yyy&relationship=yyy"
    },
    {
      "row": 4,
      "link": "http://domain.com/index.html?id=xxx&isGroom=true&name=zzz&relationship=zzz"
    }
  ]
}
```

**Response Success**:

```json
{
  "success": true,
  "message": "Updated 3 links successfully",
  "count": 3
}
```

**Response Error**:

```json
{
  "success": false,
  "message": "Error updating links",
  "details": "Row 5 is out of range"
}
```

### Code Google Apps Script

```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

  try {
    const params = JSON.parse(e.postData.contents);

    if (params.action === "batchUpdateLinks") {
      const updates = params.updates;
      let count = 0;

      for (const update of updates) {
        const row = parseInt(update.row);
        const link = update.link;

        // Validate row number
        if (row < 2 || row > sheet.getLastRow()) {
          throw new Error(`Row ${row} is out of range`);
        }

        // Update column D (Link thiệp)
        sheet.getRange(row, 4).setValue(link);
        count++;
      }

      return ContentService.createTextOutput(
        JSON.stringify({
          success: true,
          message: `Updated ${count} links successfully`,
          count: count,
        }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // ... existing code for other actions ...
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({
        success: false,
        message: "Error updating links",
        details: error.toString(),
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
```

## ⚠️ Xử Lý Lỗi

### Lỗi Kết Nối Google Sheets

```
Thông báo: "❌ Không thể kết nối đến Google Sheets"
Nguyên nhân: URL không hợp lệ hoặc API không phản hồi
Giải pháp: Kiểm tra lại URL Google Apps Script
```

### Lỗi Mã Hóa

```
Thông báo: "❌ Lỗi mã hóa dữ liệu khách mời"
Nguyên nhân: Dữ liệu không hợp lệ hoặc thư viện CryptoJS chưa load
Giải pháp: Kiểm tra dữ liệu và đảm bảo CryptoJS đã được import
```

### Lỗi Cập Nhật

```
Thông báo: "❌ Lỗi cập nhật link vào Google Sheets"
Nguyên nhân: Quyền truy cập hoặc dữ liệu không hợp lệ
Giải pháp: Kiểm tra quyền truy cập Google Sheet và dữ liệu gửi đi
```

### URL Google Sheet Trống

```
Thông báo: "⚠️ Vui lòng cấu hình URL Google Sheet trước"
Nguyên nhân: Chưa nhập URL Google Apps Script
Giải pháp: Nhập URL vào ô tương ứng trong form quản lý
```

## 📦 Dependencies

### Frontend (manage-customer.js)

```html
<!-- CryptoJS for encryption -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>
```

### Backend

- Google Apps Script (đã có sẵn)
- Supabase (đã có sẵn)

## 🧪 Test Cases

### Test 1: Tạo Link Nhà Trai

```
Input: Click nút "Tự động tạo link" nhà trai
Expected:
- Hiển thị loading
- Lấy dữ liệu từ groom_google_sheet_url
- Tạo link với isGroom=true
- Cập nhật vào Google Sheet
- Hiển thị "✅ Đã tạo link thành công cho [N] khách mời nhà trai"
```

### Test 2: Tạo Link Nhà Gái

```
Input: Click nút "Tự động tạo link" nhà gái
Expected:
- Hiển thị loading
- Lấy dữ liệu từ bride_google_sheet_url
- Tạo link với isGroom=false
- Cập nhật vào Google Sheet
- Hiển thị "✅ Đã tạo link thành công cho [N] khách mời nhà gái"
```

### Test 3: URL Trống

```
Input: Click nút khi URL Google Sheet trống
Expected: Hiển thị "⚠️ Vui lòng cấu hình URL Google Sheet trước"
```

### Test 4: Giải Mã Trên Trang Thiệp

```
Input: Mở link http://domain/index.html?id=xxx&isGroom=true&name=encrypted&relationship=encrypted
Expected:
- Giải mã thành công
- Hiển thị "Kính mời [relationship] [name] tới dự lễ thành hôn..."
```

### Test 5: Link Không Có Tham Số Cá Nhân Hóa

```
Input: Mở link http://domain/index.html?id=xxx&isGroom=true
Expected: Hiển thị lời chào mặc định (không cá nhân hóa)
```

## 📌 Lưu Ý Quan Trọng

1. **Khóa Mã Hóa**: Phải sử dụng đúng khóa "dqvinh" ở cả frontend và backend
2. **URL Safety**: Dữ liệu mã hóa phải được encode Base64 để an toàn cho URL
3. **Độc Lập**: Hai nút nhà trai và nhà gái hoạt động hoàn toàn độc lập
4. **Batch Update**: Sử dụng batch update để tối ưu hiệu suất khi có nhiều khách
5. **Error Handling**: Luôn hiển thị thông báo lỗi rõ ràng bằng tiếng Việt
6. **Sheet Auto-detect**: Google Apps Script tự động phát hiện sheet đầu tiên (không hardcode tên)

## 🚀 Triển Khai

### Bước 1: Cập Nhật Google Apps Script

1. Mở Google Apps Script editor
2. Thêm code xử lý `batchUpdateLinks` vào function `doPost`
3. Deploy lại Web App
4. Copy URL mới (nếu có)

### Bước 2: Thêm CryptoJS

1. Thêm script tag vào `invitation-setup/index.html`
2. Thêm script tag vào `public/themes/basic-gold/index.html`

### Bước 3: Tạo UI

1. Thêm 2 nút "Tự động tạo link" vào form
2. Styling theo thiết kế hiện có
3. Thêm event handlers

### Bước 4: Implement Logic

1. Tạo functions mã hóa/giải mã
2. Tạo function lấy dữ liệu từ Google Sheet
3. Tạo function tạo link
4. Tạo function batch update
5. Tạo function hiển thị lời chào cá nhân hóa

### Bước 5: Testing

1. Test với dữ liệu mẫu
2. Test cả nhà trai và nhà gái
3. Test các trường hợp lỗi
4. Test hiển thị trên trang thiệp

## 📞 Hỗ Trợ

Nếu gặp vấn đề, kiểm tra:

1. URL Google Apps Script có đúng không
2. Quyền truy cập Google Sheet
3. CryptoJS đã được load chưa
4. Console log để debug
5. Network tab để xem API calls

---

**Lưu ý**: Tính năng này chỉ được triển khai khi có yêu cầu rõ ràng từ người dùng.
