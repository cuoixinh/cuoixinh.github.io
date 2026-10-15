const _XLSX = (typeof XLSXStyle !== "undefined") ? XLSXStyle : XLSX;

class GuestBL {
  constructor(guestDAL) {
    this.dal = guestDAL;
  }

  // relations: danh sách xưng hô cho ô chọn ở cột C (GUEST_RELATIONS của trang Khách mời).
  downloadTemplate(relations = []) {
    const ws = _XLSX.utils.aoa_to_sheet([
      ["Họ và tên", "Tên hiển thị (Trên thiệp)", "Xưng hô"],
      // Tên hiển thị chỉ là tên gọi — xưng hô nằm ở cột riêng, thiệp tự ghép hai cột.
      ["Nguyễn Văn Minh", "Minh", "Anh"],
      ["Trần Thị Lan", "Lan", "Chị"],
      ["Đỗ Văn Hùng", "Hùng", "Chú"],
      ["Lê Hoàng Nam", "Nam", "Bạn"],
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
    const name = "mau-danh-sach-khach-moi.xlsx";
    try {
      const buf = this._withRelationList(
        _XLSX.write(wb, { type: "array", bookType: "xlsx", cellStyles: true }), relations);
      const url = URL.createObjectURL(new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: name });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      // Không chèn được ô chọn thì vẫn tải file mẫu thường.
      console.warn("downloadTemplate:", e);
      _XLSX.writeFile(wb, name, { cellStyles: true });
    }
  }

  // Gắn ô chọn (data validation dạng list) cho cột Xưng hô — SheetJS bản cộng đồng không
  // ghi được validation nên mở zip bằng XLSX.CFB rồi chèn thẳng XML. Vẫn cho gõ giá trị
  // khác danh sách (showErrorMessage="0"). Danh sách nội tuyến Excel giới hạn 255 ký tự.
  _withRelationList(buf, relations) {
    const list = (relations || []).join(",");
    if (!list || list.length > 255 || !_XLSX.CFB) return buf;
    const cfb = _XLSX.CFB.read(new Uint8Array(buf), { type: "array" });
    const i = cfb.FullPaths.findIndex((p) => /\/xl\/worksheets\/sheet1\.xml$/.test(p));
    if (i < 0) return buf;
    const entry = cfb.FileIndex[i];
    const xml = new TextDecoder().decode(entry.content);
    if (!xml.includes("</sheetData>")) return buf;
    const esc = list.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const last = (CONFIG.guestImport.maxRows || 100) + 1;
    // Theo thứ tự schema, dataValidations đứng sau sheetData và trước ignoredErrors.
    entry.content = new TextEncoder().encode(xml.replace("</sheetData>",
      `</sheetData><dataValidations count="1"><dataValidation type="list" allowBlank="1" ` +
      `showErrorMessage="0" sqref="C2:C${last}"><formula1>"${esc}"</formula1>` +
      `</dataValidation></dataValidations>`));
    entry.size = entry.content.length;
    return _XLSX.CFB.write(cfb, { fileType: "zip", type: "array" });
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

  // ─── Nhập bằng AI ───────────────────────────────────────────────────────────

  /**
   * Kết quả AI → hàng soạn được, cắt độ dài như server. `group` = nhóm ghi trong văn
   * bản ("groom"/"bride", "" = không chia nhóm) — khác tab đang mở thì không nhập.
   */
  normalizeAiGuests(items) {
    const max = CONFIG.guestImport.maxFieldLength;
    return (items || []).map((g, i) => ({
      key: `ai${Date.now().toString(36)}${i}`,
      full_name: String(g.full_name ?? "").trim().slice(0, max),
      display_name: String(g.display_name ?? "").trim().slice(0, max),
      relationship: String(g.relationship ?? "").trim().slice(0, 100) || "Bạn",
      group: g.side === "groom" || g.side === "bride" ? g.side : "",
    }));
  }

  /**
   * Gắn trạng thái cho từng hàng sắp nhập vào MỘT bên, theo đúng luật của guest-handler khi
   * nhập kiểu "thêm vào" (khoá trùng = Họ tên + Tên trên thiệp + Xưng hô, cắt ở trần mỗi bên):
   * other (ghi dưới nhóm bên kia) · empty (thiếu họ tên) · dup (đã có / lặp trong
   * danh sách) · over (hết chỗ) · ok.
   */
  planAiImport(rows, existing, side, max = CONFIG.guestImport.maxPerSide) {
    // Khoá trùng = Họ tên + Tên trên thiệp + Xưng hô — khớp guestKey của guest-handler. Xưng hô
    // trống của hàng sắp nhập thành "Bạn" như lúc gửi đi (importAiGuests).
    const keyOf = (g, def = "") => [g.full_name, g.display_name, String(g.relationship || "").trim() || def]
      .map((v) => String(v || "").trim()).join("||");
    const seen = new Set((existing || []).map((g) => keyOf(g)));
    let free = Math.max(0, max - (existing || []).length);
    const status = {};
    let ok = 0, over = 0, other = 0;
    for (const r of rows) {
      if (r.group && r.group !== side) { status[r.key] = "other"; other++; continue; }
      if (!r.full_name.trim()) { status[r.key] = "empty"; continue; }
      const k = keyOf(r, "Bạn");
      if (seen.has(k)) { status[r.key] = "dup"; continue; }
      seen.add(k);
      if (free > 0) { status[r.key] = "ok"; free--; ok++; }
      else { status[r.key] = "over"; over++; }
    }
    return { status, ok, over, other, existing: (existing || []).length, max };
  }

  /** Ghi các hàng hợp lệ vào bên `side` — kiểu "thêm vào", server kiểm trần lần nữa. */
  async importAiGuests(weddingId, side, rows) {
    const guests = rows.map((r) => ({
      full_name: r.full_name.trim(),
      display_name: r.display_name.trim(),
      // Link mời cần xưng hô — người dùng xoá trắng ô thì về mặc định như popup thêm khách.
      relationship: r.relationship.trim() || "Bạn",
    }));
    if (!guests.length) return { inserted: 0, skipped: 0 };
    return this.dal.importGuestsViaEdge(weddingId, side, guests, false);
  }
}
