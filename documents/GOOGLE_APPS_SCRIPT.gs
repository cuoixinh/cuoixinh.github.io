/**
 * Thêm menu "Thiệp cưới" vào thanh menu khi mở sheet
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Thiệp cưới")
    .addItem("Thiết lập & khóa cột hệ thống", "setupSheet")
    .addToUi();
}

/**
 * Thiết lập sheet lần đầu:
 * - Khóa cột D–H (hệ thống tự điền, người dùng không được sửa)
 * - Chỉ để A, B, C cho người dùng nhập
 */
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets()[0];

  // Xóa các protection cũ (nếu chạy lại)
  const existingProtections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  existingProtections.forEach(p => p.remove());

  // Khóa cột D đến H
  const lockedRange = sheet.getRange("D:H");
  const protection = lockedRange.protect();
  protection.setDescription("Cột hệ thống — không chỉnh sửa");

  // Chỉ owner (người deploy script) được sửa, xóa hết editor khác
  const me = Session.getEffectiveUser();
  protection.addEditor(me);
  protection.removeEditors(
    protection.getEditors().filter(e => e.getEmail() !== me.getEmail())
  );

  SpreadsheetApp.getUi().alert(
    "✅ Đã thiết lập xong!\n\nCột D–H đã bị khóa, chỉ hệ thống mới ghi được.\nNgười dùng chỉ nhập được cột A (Họ và tên), B (Tên hiển thị), C (Quan hệ)."
  );
}

/**
 * Xử lý GET request
 * Endpoints:
 *   ?action=getAllGuests   — trả guests + headers dòng 1
 *   ?action=getGuest&row=2
 */
function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const params = e.parameter;
  const cb = params.callback; // JSONP callback name (optional)

  // Lấy tất cả khách mời + headers dòng 1 (client tự validate)
  if (params.action === "getAllGuests") {
    try {
      const lastRow = sheet.getLastRow();
      const headers = sheet.getRange(1, 1, 1, 8).getValues()[0];

      if (lastRow < 2) {
        return respond({ success: true, guests: [], headers }, cb);
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

      return respond({ success: true, guests, headers }, cb);
    } catch (error) {
      return respond({ success: false, message: error.toString() }, cb);
    }
  }

  // Lấy thông tin 1 khách theo row
  if (params.action === "getGuest" && params.row) {
    try {
      const row = parseInt(params.row);
      if (row < 2 || row > sheet.getLastRow()) {
        return respond({ success: false, message: "Invalid row number" }, cb);
      }
      const data = sheet.getRange(row, 1, 1, 8).getValues()[0];
      return respond({
        success: true,
        data: {
          fullName: data[0], displayName: data[1], relationship: data[2],
          link: data[3], viewed: data[4], confirmed: data[5],
          message: data[6], confirmedAt: data[7]
        }
      }, cb);
    } catch (error) {
      return respond({ success: false, message: error.toString() }, cb);
    }
  }

  return respond({ success: false, message: "Invalid action" }, cb);
}

/**
 * Xử lý POST request
 * Actions:
 *   batchUpdateLinks — Cập nhật hàng loạt link thiệp
 *   markViewed       — Đánh dấu đã xem thiệp
 *   confirm          — Xác nhận tham dự
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
        message: `Updated ${count} links` + (errors.length > 0 ? `, ${errors.length} errors` : ""),
        count,
        errors: errors.length > 0 ? errors : undefined
      });
    }

    // Đánh dấu đã xem - tìm theo link thay vì row
    if (params.action === "markViewed") {
      const link = params.link;
      if (!link) return respond({ success: false, message: "Missing link" });

      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return respond({ success: false, message: "No data" });

      function normalizeLink(url) {
        try { return decodeURIComponent(url); } catch(e) { return url; }
      }

      const normalizedIncoming = normalizeLink(link);
      const links = sheet.getRange(2, 4, lastRow - 1, 1).getValues();

      const rowIndex = links.findIndex(r => {
        if (!r[0]) return false;
        return normalizeLink(r[0]) === normalizedIncoming;
      });

      if (rowIndex === -1) {
        return respond({ success: false, message: "Link not found" });
      }

      sheet.getRange(rowIndex + 2, 5).setValue(true); // Cột E: Đã xem thiệp
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

      sheet.getRange(row, 6).setValue(confirmed);  // Cột F: Xác nhận tham dự
      sheet.getRange(row, 7).setValue(message);     // Cột G: Lời chúc
      sheet.getRange(row, 8).setValue(timestamp);   // Cột H: Thời gian xác nhận

      return respond({ success: true, message: "Confirmation saved" });
    }

    return respond({ success: false, message: "Invalid action" });
  } catch (error) {
    return respond({ success: false, message: error.toString() });
  }
}

function respond(data, callback) {
  const json = JSON.stringify(data);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
