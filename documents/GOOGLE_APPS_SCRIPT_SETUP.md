# Hướng dẫn Setup Google Apps Script cho Thiệp Cưới

## Mục đích
Tạo API endpoint để tracking và quản lý danh sách khách mời qua Google Sheets, bao gồm tự động tạo link cá nhân hóa.

---

## Cấu trúc Google Sheet

### Header (Dòng 1):
```
A: Họ và tên
B: Tên hiển thị (Trên thiệp)
C: Quan hệ (Bạn gọi là gì)
D: Link thiệp
E: Đã xem thiệp
F: Xác nhận tham dự
G: Lời chúc
H: Thời gian xác nhận
```

### Dữ liệu mẫu (Dòng 2+):
```
Nguyễn Văn A | Anh Văn A | Bạn thân | https://domain.com/index.html?id=xxx&guest=2 | FALSE | Chưa xác nhận | | 
Trần Thị B | Chị Thị B | Đồng nghiệp | https://domain.com/index.html?id=xxx&guest=3 | TRUE | Có tham dự | Chúc hạnh phúc! | 2026-04-10 14:30:00
```

---

## Bước 1: Mở Apps Script Editor

1. Mở file Google Sheet của bạn
2. Click menu **Extensions** (Tiện ích mở rộng) → **Apps Script**
3. Tab mới sẽ mở ra với editor

---

## Bước 2: Dán Code vào Editor

Xóa code mặc định và dán code sau:

```javascript
// ============================================
// WEDDING GUEST TRACKING API
// ============================================

/**
 * Xử lý GET request
 * Endpoints:
 * - ?action=getGuest&row=2
 * - ?action=getAllGuests
 */
function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const params = e.parameter;

  // Lấy tất cả khách mời (cho tính năng tạo link hàng loạt)
  if (params.action === "getAllGuests") {
    try {
      const lastRow = sheet.getLastRow();

      if (lastRow < 2) {
        return respond({ success: true, guests: [] });
      }

      const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();

      const guests = data
        .map((row, index) => ({
          row: index + 2,
          fullName: row[0],
          displayName: row[1],
          relationship: row[2],
          link: row[3],
          viewed: row[4],
          confirmed: row[5],
          message: row[6],
          confirmedAt: row[7]
        }))
        .filter(guest => guest.fullName || guest.displayName);

      return respond({ success: true, guests });

    } catch (error) {
      return respond({ success: false, message: error.toString() });
    }
  }

  // Lấy thông tin 1 khách theo row
  if (params.action === "getGuest" && params.row) {
    const row = parseInt(params.row);

    if (row < 2 || row > sheet.getLastRow()) {
      return respond({ success: false, message: "Invalid row number" });
    }

    const data = sheet.getRange(row, 1, 1, 8).getValues()[0];
    
    return respond({
      success: true,
      data: {
        fullName: data[0],
        displayName: data[1],
        relationship: data[2],
        link: data[3],
        viewed: data[4],
        confirmed: data[5],
        message: data[6],
        confirmedAt: data[7]
      }
    });
  }

  return respond({ success: false, message: "Invalid action" });
}

/**
 * Xử lý POST request
 * Actions:
 * - batchUpdateLinks: Cập nhật hàng loạt link thiệp
 * - markViewed: Đánh dấu đã xem thiệp
 * - confirm: Xác nhận tham dự
 */
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

  try {
    const params = JSON.parse(e.postData.contents);

    // Cập nhật hàng loạt link
    if (params.action === "batchUpdateLinks") {
      const updates = params.updates;

      if (!updates || !Array.isArray(updates) || updates.length === 0) {
        return respond({ success: false, message: "Invalid or empty updates array" });
      }

      let count = 0;
      const lastRow = sheet.getLastRow();
      const errors = [];

      for (const update of updates) {
        const row = parseInt(update.row);

        if (isNaN(row) || row < 2 || row > lastRow) {
          errors.push(`Row ${update.row} is out of range`);
          continue;
        }

        if (!update.link) {
          errors.push(`Row ${row} has empty link`);
          continue;
        }

        sheet.getRange(row, 4).setValue(update.link);
        count++;
      }

      return respond({
        success: count > 0,
        message: `Updated ${count} links` + (errors.length > 0 ? `, ${errors.length} errors` : ''),
        count,
        errors: errors.length > 0 ? errors : undefined
      });
    }

    // Đánh dấu đã xem
    // Đánh dấu đã xem - tìm theo link thay vì row
    if (params.action === "markViewed") {
      const link = params.link;
      if (!link) return respond({ success: false, message: "Missing link" });

      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return respond({ success: false, message: "No data" });

      // Normalize link để so sánh: decode hết rồi encode lại thống nhất
      function normalizeLink(url) {
        try { return decodeURIComponent(url); } catch(e) { return url; }
      }

      const normalizedIncoming = normalizeLink(link);
      const links = sheet.getRange(2, 4, lastRow - 1, 1).getValues();
      
      Logger.log('Incoming (normalized): ' + normalizedIncoming);

      const rowIndex = links.findIndex(r => {
        if (!r[0]) return false;
        return normalizeLink(r[0]) === normalizedIncoming;
      });

      if (rowIndex === -1) {
        Logger.log('Link not found. Sheet links: ' + JSON.stringify(links.map(r => normalizeLink(r[0]))));
        return respond({ success: false, message: "Link not found" });
      }

      sheet.getRange(rowIndex + 2, 5).setValue(true); // Cột E: Đã xem thiệp
      Logger.log('Marked row ' + (rowIndex + 2) + ' as viewed');
      return respond({ success: true, message: "Marked as viewed" });
    }

    // Xác nhận tham dự
    if (params.action === "confirm") {
      const row = parseInt(params.row);
      if (isNaN(row) || row < 2 || row > sheet.getLastRow()) {
        return respond({ success: false, message: "Invalid row number" });
      }

      const confirmed = params.confirmed || "Có tham dự";
      const message = params.message || "";
      const timestamp = new Date().toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh"
      });

      sheet.getRange(row, 7).setValue(confirmed);  // Cột G: Xác nhận tham dự
      sheet.getRange(row, 8).setValue(message);     // Cột H: Lời chúc
      sheet.getRange(row, 9).setValue(timestamp);   // Cột I: Thời gian xác nhận

      return respond({ success: true, message: "Confirmation saved" });
    }

    return respond({ success: false, message: "Invalid action" });

  } catch (error) {
    return respond({ success: false, message: error.toString() });
  }
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

---

## Bước 3: Lưu Project

1. Click icon **Save** (đĩa mềm) hoặc `Ctrl+S`
2. Đặt tên project: **"Wedding Guest API"**
3. Click **OK**

---

## Bước 4: Deploy Web App

1. Click **Deploy** → **New deployment**
2. Click icon ⚙️ bên cạnh "Select type"
3. Chọn **Web app**
4. Điền thông tin:
   - **Description**: `Wedding Guest Tracking API v1.0`
   - **Execute as**: **Me** (email của bạn)
   - **Who has access**: **Anyone** ⚠️ (Quan trọng!)
5. Click **Deploy**

---

## Bước 5: Authorize (Cấp quyền)

1. Popup yêu cầu quyền sẽ hiện ra
2. Click **Authorize access**
3. Chọn tài khoản Google của bạn
4. Màn hình cảnh báo xuất hiện → Click **Advanced**
5. Click **Go to [Project name] (unsafe)**
6. Click **Allow** để cấp quyền

---

## Bước 6: Copy Web App URL

1. Sau khi deploy thành công, bạn sẽ thấy **Web app URL**
2. Copy URL này (dạng: `https://script.google.com/macros/s/AKfycby.../exec`)
3. **Lưu URL này** để dán vào form quản lý thiệp cưới

---

## Bước 7: Test API

### Test GET Request (Lấy thông tin khách):
Mở trình duyệt và truy cập:
```
https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?action=getGuest&row=2
```

**Kết quả mong đợi:**
```json
{
  "success": true,
  "data": {
    "fullName": "Nguyễn Văn A",
    "displayName": "Anh Văn A",
    "relationship": "Bạn thân",
    "link": "https://...",
    "viewed": false,
    "confirmed": "Chưa xác nhận",
    "message": "",
    "confirmedAt": ""
  }
}
```

### Test POST Request (Đánh dấu đã xem):
Dùng Postman hoặc curl:
```bash
curl -X POST https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec \
  -H "Content-Type: application/json" \
  -d '{"action":"markViewed","row":2}'
```

### Test POST Request (Xác nhận tham dự):
```bash
curl -X POST https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec \
  -H "Content-Type: application/json" \
  -d '{
    "action":"confirm",
    "row":2,
    "confirmed":"Có tham dự",
    "message":"Chúc hai bạn hạnh phúc!"
  }'
```

---

## Cách sử dụng trong Thiệp Cưới

### 1. Tạo link cá nhân hóa cho từng khách (tự động):
Dùng nút "🔗 Tự động tạo link" trong trang quản lý. Hệ thống sẽ tự động:
- Lấy danh sách khách từ Google Sheet
- Mã hóa tên + quan hệ
- Tạo link: `domain/index.html?id=xxx&isGroom=true/false&name=ENC&relationship=ENC`
- Cập nhật vào cột D (Link thiệp)

### 2. Khi khách mở thiệp:
Trang thiệp tự động giải mã URL params và hiển thị lời chào cá nhân hóa:
```
"Kính mời [quan hệ] [tên] tới dự lễ thành hôn..."
```

### 3. Tracking xem thiệp (markViewed):
```javascript
fetch(GOOGLE_SHEET_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify({ action: 'markViewed', row: 2 })
});
```

### 4. Xác nhận tham dự (confirm):
```javascript
fetch(GOOGLE_SHEET_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify({
    action: 'confirm',
    row: 2,
    confirmed: 'Có tham dự',
    message: 'Chúc hai bạn hạnh phúc!'
  })
});
```

> ⚠️ **Lưu ý CORS**: Dùng `Content-Type: text/plain` thay vì `application/json` để tránh CORS preflight request khi gọi từ browser.

---

## Lưu ý quan trọng

### ⚠️ Bảo mật:
- API này public, ai có link đều gọi được
- Chỉ cho phép cập nhật dữ liệu, không cho phép xóa
- Nên thêm validation ở phía client

### 📝 Cấu trúc dữ liệu:
- **Dòng 1**: Header (không được xóa)
- **Dòng 2+**: Dữ liệu khách mời
- **Row number**: Bắt đầu từ 2 (dòng 2 = guest=2)

### 🔄 Update deployment:
Nếu sửa code, cần deploy lại:
1. Click **Deploy** → **Manage deployments**
2. Click icon ✏️ (Edit)
3. Chọn **New version**
4. Click **Deploy**

### 🐛 Debug:
- Xem log: Click **Executions** ở sidebar
- Test trong editor: Click **Run** → chọn function `doGet` hoặc `doPost`

---

## Troubleshooting

### Lỗi "Authorization required":
→ Chưa authorize, làm lại Bước 5

### Lỗi "Invalid row number":
→ Kiểm tra row có tồn tại trong sheet không

### Lỗi "Cannot read property":
→ Kiểm tra tên sheet có đúng không (dòng 2 của code)

### API không trả về dữ liệu:
→ Kiểm tra "Who has access" phải là **Anyone**

---

## Tích hợp vào Form Quản lý

Sau khi có Web App URL, dán vào:
- **Nhà trai**: Field "URL Google Apps Script (DS khách mời nhà trai)"
- **Nhà gái**: Field "URL Google Apps Script (DS khách mời nhà gái)"

Mỗi bên sẽ có 1 Google Sheet riêng để quản lý khách mời của mình.

---

**Hoàn thành!** 🎉

Bây giờ bạn có thể tracking khách mời xem thiệp và xác nhận tham dự tự động qua Google Sheets.
