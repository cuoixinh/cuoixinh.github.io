const _XLSX = (typeof XLSXStyle !== "undefined") ? XLSXStyle : XLSX;

class GuestBL {
  constructor(guestDAL) {
    this.dal = guestDAL;
  }

  downloadTemplate() {
    const ws = _XLSX.utils.aoa_to_sheet([
      ["Họ và tên", "Tên hiển thị (Trên thiệp)", "Xưng hô"],
      ["Nguyễn Văn A", "Anh Minh", "Anh"],
      ["Trần Thị B", "Chị Lan", "Chị"],
    ]);
    ws["!cols"] = [{ wch: 25 }, { wch: 28 }, { wch: 20 }];

    const headerStyle = {
      font: { bold: true, color: { rgb: "374151" } },
      fill: { fgColor: { rgb: "E5E7EB" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top:    { style: "thin", color: { rgb: "D1D5DB" } },
        bottom: { style: "thin", color: { rgb: "D1D5DB" } },
        left:   { style: "thin", color: { rgb: "D1D5DB" } },
        right:  { style: "thin", color: { rgb: "D1D5DB" } },
      },
    };
    ["A1", "B1", "C1"].forEach(ref => {
      if (ws[ref]) ws[ref].s = headerStyle;
    });
    ws["!rows"] = [{ hpt: 22 }];

    const wb = _XLSX.utils.book_new();
    _XLSX.utils.book_append_sheet(wb, ws, "Khách mời");
    _XLSX.writeFile(wb, "mau-danh-sach-khach-moi.xlsx", { cellStyles: true });
  }

  parseExcel(file) {
    const maxBytes = CONFIG.guestImport.maxFileSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      return Promise.reject(new Error(`File vượt quá ${CONFIG.guestImport.maxFileSizeMB}MB cho phép`));
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = _XLSX.read(e.target.result, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = _XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
          const headers = (rows[0] || []).map(h => String(h).trim());
          const data = rows.slice(1).filter(r => r.some(c => String(c).trim() !== ""));

          if (headers.length === 0) throw new Error("File không có dữ liệu hợp lệ");
          if (data.length > CONFIG.guestImport.maxRows) {
            throw new Error(`File có ${data.length} dòng, vượt quá giới hạn ${CONFIG.guestImport.maxRows} khách mỗi lần nhập`);
          }

          resolve({ headers, data });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Không thể đọc file"));
      reader.readAsArrayBuffer(file);
    });
  }

  autoDetectMapping(headers) {
    const norm = s => s.toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ").trim();

    const mapping = { full_name: 0, display_name: 1, relationship: 2 };
    headers.forEach((h, i) => {
      const n = norm(h);
      if (n.includes("ho") && n.includes("ten") && !n.includes("hien")) mapping.full_name = i;
      else if (n.includes("hien thi") || n.includes("tren thiep")) mapping.display_name = i;
      else if (n.includes("quan he") || n.includes("xung ho")) mapping.relationship = i;
    });
    return mapping;
  }

  async importGuests(weddingId, side, data, colMapping, overwrite) {
    const guests = data
      .map(row => ({
        full_name:    String(row[colMapping.full_name]    ?? "").trim(),
        display_name: String(row[colMapping.display_name] ?? "").trim(),
        relationship: String(row[colMapping.relationship] ?? "").trim(),
      }))
      .filter(g => g.full_name);

    if (guests.length === 0) throw new Error("Không có dữ liệu hợp lệ để nhập khẩu");

    // Sanitize + validate + count enforcement đều do Edge Function xử lý
    return this.dal.importGuestsViaEdge(weddingId, side, guests, overwrite);
  }
}
