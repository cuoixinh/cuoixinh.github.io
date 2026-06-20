/\*\*

- Xử lý GET request
- Endpoints:
- - ?action=getGuest&row=2
- - ?action=getAllGuests
    \*/
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

/\*\*

- Xử lý POST request
- Actions:
- - batchUpdateLinks: Cập nhật hàng loạt link thiệp
- - markViewed: Đánh dấu đã xem thiệp
- - confirm: Xác nhận tham dự
    \*/
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
