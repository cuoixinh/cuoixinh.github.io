// Đọc tệp người dùng đính kèm để gửi AI (window.CXAiFiles): ảnh nén JPEG + PDF gửi thẳng
// dạng base64, Word/Excel/.txt đọc ra chữ ngay ở trình duyệt. Dùng chung cho "Nhập bằng AI"
// (trang Khách mời) và khung chat XuXi; luật ở CONFIG.aiFiles, server kiểm lại ở
// supabase/functions/_shared/ai-files.ts. Dải thẻ tệp + menu đính kèm dùng style .gs-ai-* /
// .gs-pop-ico (styles/_setup.css).
(function () {
  if (window.CXAiFiles) return;

  // Chỉ nạp khi người dùng chọn đúng loại tệp cần tới.
  const MAMMOTH = {
    src: "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js",
    sri: "sha512-wuWo/cLB9W5BsZeyTYLuiTwr+FDlvjQC7C6atr+To7Jk92XHWI7WsImJZiruw7C9bnc8Zg7N0ncQI2Q/B4PQYw==",
  };
  const XLSX_LIB = {
    src: "https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js",
    sri: "sha384-OUW9euuUyxyHcAhTqbhI+Iyb8LMssXt/cpz0yXhs9UWG2/R/uaWdakx/4cfww7Vb",
  };
  const MB = 1048576;
  const lim = () => CONFIG.aiFiles;

  const ext = (name) => (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || "";
  const size = (b) => (b >= MB ? `${(b / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
  const label = (f) => (f.kind === "doc" ? f.fmt : f.kind === "image" ? "Ảnh" : "PDF");
  const binSize = (list) => list.reduce((n, f) => n + (f.kind === "doc" ? 0 : f.size), 0);
  const docChars = (list) => list.reduce((n, f) => n + (f.kind === "doc" ? f.text.length : 0), 0);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ico = (name, px) => `<i data-lucide="${name}" style="width:${px}px;height:${px}px"></i>`;

  const scripts = {};
  function loadScript({ src, sri }, what) {
    scripts[src] ??= new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.integrity = sri;
      s.crossOrigin = "anonymous";
      s.onload = resolve;
      s.onerror = () => {
        delete scripts[src];
        reject(new Error(`Chưa tải được bộ đọc ${what}, kiểm tra mạng rồi thử lại.`));
      };
      document.head.appendChild(s);
    });
    return scripts[src];
  }

  async function xlsxLib() {
    if (typeof XLSXStyle !== "undefined") return XLSXStyle;
    if (typeof XLSX === "undefined") await loadScript(XLSX_LIB, "file Excel");
    return typeof XLSXStyle !== "undefined" ? XLSXStyle : XLSX;
  }

  function base64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1] || "");
      r.onerror = () => reject(new Error("Không đọc được tệp"));
      r.readAsDataURL(blob);
    });
  }

  // Còn chỗ cho thêm một tệp nặng `bytes` byte không (số tệp + tổng dung lượng)?
  function checkRoom(list, bytes) {
    const { maxFiles, filesMaxMB } = lim();
    if (list.length >= maxFiles) throw new Error(`Mỗi lượt tối đa ${maxFiles} tệp. Bỏ bớt tệp hoặc gửi phần còn lại ở lượt sau.`);
    if (binSize(list) + bytes > filesMaxMB * MB) throw new Error(`Tổng dung lượng tệp vượt ${filesMaxMB}MB. Bỏ bớt tệp rồi thử lại.`);
  }

  function checkFile(bytes, name) {
    const max = lim().fileMaxMB;
    if (bytes > max * MB) throw new Error(`Tệp “${name}” lớn hơn ${max}MB. Với PDF, hãy tách bớt trang rồi thử lại.`);
  }

  // Ảnh → JPEG cạnh dài ≤ imageMaxSide: ảnh điện thoại 3–8MB còn vài trăm KB.
  async function imageToJpeg(file) {
    let bmp;
    try {
      bmp = await createImageBitmap(file);
    } catch {
      throw new Error("Không mở được ảnh này (ảnh HEIC?). Hãy chụp lại hoặc lưu dạng JPG rồi thử lại.");
    }
    const k = Math.min(1, lim().imageMaxSide / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas");
    cv.width = Math.round(bmp.width * k);
    cv.height = Math.round(bmp.height * k);
    const g = cv.getContext("2d");
    g.fillStyle = "#fff"; // ảnh PNG nền trong suốt → nền trắng cho chữ dễ đọc
    g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(bmp, 0, 0, cv.width, cv.height);
    bmp.close?.();
    const blob = await new Promise((res) => cv.toBlob(res, "image/jpeg", 0.85));
    if (!blob) throw new Error("Không nén được ảnh, hãy thử ảnh khác.");
    return { kind: "image", mime: "image/jpeg", data: await base64(blob), size: blob.size, url: URL.createObjectURL(blob) };
  }

  // Đúng chữ ký "%PDF-", tổng số trang ≤ pdfMaxPages; không đếm được trang (PDF nén
  // object stream) thì chỉ nhận file nhỏ.
  async function pdfPages(file, list) {
    const { pdfMaxPages, pdfUnknownMaxMB } = lim();
    const bin = new TextDecoder("latin1").decode(await file.arrayBuffer());
    if (!bin.startsWith("%PDF-")) throw new Error(`Tệp “${file.name}” không phải PDF hợp lệ.`);
    const n = (bin.match(/\/Type\s*\/Page(?![A-Za-z])/g) || []).length;
    if (!n && file.size > pdfUnknownMaxMB * MB) {
      throw new Error(`Không đếm được số trang của “${file.name}”. Hãy xuất lại PDF hoặc chụp ảnh nội dung.`);
    }
    const used = list.reduce((s, f) => s + (f.pages || 0), 0);
    if (used + (n || 1) > pdfMaxPages) {
      throw new Error(`PDF tối đa ${pdfMaxPages} trang mỗi lượt. Hãy tách bớt trang hoặc gửi ở lượt sau.`);
    }
    return n || 1;
  }

  // Bảng tính → chữ: mỗi hàng một dòng, ô ngăn bằng " | " (dấu phẩy hay lẫn với dấu phẩy
  // trong nội dung). Bỏ hàng/cột trống hẳn; nhiều sheet thì ghi tên sheet làm tiêu đề nhóm.
  function sheetsToText(X, wb) {
    const parts = [];
    wb.SheetNames.forEach((name) => {
      const rows = X.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: "", blankrows: false })
        .map((r) => r.map((c) => String(c).replace(/\s+/g, " ").trim()))
        .filter((r) => r.some(Boolean));
      if (!rows.length) return;
      const width = Math.max(...rows.map((r) => r.length));
      const keep = [...Array(width).keys()].filter((i) => rows.some((r) => r[i]));
      const lines = rows.map((r) => keep.map((i) => r[i] || "").join(" | ").replace(/( \| )+$/, ""));
      parts.push((wb.SheetNames.length > 1 ? `${name}:\n` : "") + lines.join("\n"));
    });
    return parts.join("\n\n");
  }

  function asDoc(text, fmt, file, list) {
    const t = String(text || "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!t) throw new Error(`Không thấy chữ nào trong “${file.name}”.`);
    checkRoom(list, 0);
    const max = lim().docsMaxChars;
    if (docChars(list) + t.length > max) {
      throw new Error(`Nội dung các tệp Word/Excel/.txt dài quá ${max.toLocaleString("vi-VN")} ký tự. Hãy chia làm nhiều lượt.`);
    }
    return { kind: "doc", fmt, text: t, size: file.size, lines: t.split("\n").filter((l) => l.trim()).length };
  }

  // Một tệp → tệp đính kèm, kiểm theo các tệp đã có trong `list`. Ném Error (câu báo cho
  // người dùng) khi không nhận được. Ảnh: {kind:"image", mime, data, size, url} · PDF:
  // {kind:"pdf", mime, data, size, pages} · Word/Excel/.txt: {kind:"doc", fmt, text, size, lines}.
  async function read(file, list = []) {
    const e = ext(file.name);
    const type = file.type || "";
    const src = lim().sourceMaxMB;
    if (file.size > src * MB) throw new Error(`Tệp “${file.name}” lớn hơn ${src}MB, hãy chọn tệp nhỏ hơn.`);
    let att;
    if (type.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(e)) {
      checkRoom(list, 0);
      att = await imageToJpeg(file);
      // Kích thước thật chỉ biết sau khi nén — kiểm lại cả trần từng tệp lẫn tổng.
      try {
        checkFile(att.size, file.name);
        checkRoom(list, att.size);
      } catch (err) {
        URL.revokeObjectURL(att.url);
        throw err;
      }
    } else if (type === "application/pdf" || e === "pdf") {
      checkFile(file.size, file.name);
      checkRoom(list, file.size);
      const pages = await pdfPages(file, list);
      att = { kind: "pdf", mime: "application/pdf", data: await base64(file), size: file.size, pages };
    } else if (e === "docx") {
      await loadScript(MAMMOTH, "file Word");
      const { value } = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      att = asDoc(value, "Word", file, list);
    } else if (e === "doc") {
      throw new Error("File Word đời cũ (.doc) chưa đọc được. Hãy lưu lại dạng .docx hoặc PDF rồi chọn lại.");
    } else if (e === "xlsx" || e === "xls") {
      const X = await xlsxLib();
      att = asDoc(sheetsToText(X, X.read(await file.arrayBuffer(), { type: "array" })), "Excel", file, list);
    } else if (type.startsWith("text/") || e === "txt" || e === "csv") {
      att = asDoc(await file.text(), e === "csv" ? "CSV" : ".txt", file, list);
    } else {
      throw new Error("Chưa đọc được loại tệp này. Hãy chọn ảnh, PDF, Word (.docx), Excel hoặc .txt.");
    }
    return { ...att, name: file.name };
  }

  // Kiểm lại cả bộ ngay trước khi gửi (phòng trạng thái lệch) — cùng luật với server.
  function checkSend(list) {
    const { maxFiles, filesMaxMB } = lim();
    if (list.length > maxFiles) throw new Error(`Mỗi lượt tối đa ${maxFiles} tệp.`);
    if (binSize(list) > filesMaxMB * MB) throw new Error(`Tổng dung lượng tệp vượt ${filesMaxMB}MB. Bỏ bớt tệp rồi thử lại.`);
  }

  // Phần thân request: `files` (ảnh/PDF base64) + `docs` (chữ đã đọc) — khớp _shared/ai-files.ts.
  function payload(list) {
    return {
      files: list.filter((f) => f.kind !== "doc").map((f) => ({ mime: f.mime, data: f.data, name: f.name })),
      docs: list.filter((f) => f.kind === "doc").map((f) => ({ name: f.name, type: f.fmt, text: f.text })),
    };
  }

  // Thu hồi ảnh thu nhỏ; thẻ vẽ lại sau đó hiện icon thay ảnh.
  function release(list) {
    list.forEach((f) => {
      if (!f.url) return;
      URL.revokeObjectURL(f.url);
      delete f.url;
    });
  }

  // Dải thẻ tệp (ảnh thu nhỏ / icon loại · tên · cỡ) vào `box`; nút × gọi onRemove(i).
  // Không truyền onRemove thì thẻ chỉ để nhìn (bong bóng chat đã gửi).
  function renderStrip(box, list, onRemove) {
    const chips = list.map((f, i) => {
      const kind = label(f);
      const [tone, icon] = f.kind === "image" ? ["gs-ai-file-thumb--img", "image"]
        : f.kind === "pdf" ? ["gs-ai-file-thumb--pdf", "file-text"]
          : f.fmt === "Excel" ? ["gs-ai-file-thumb--xls", "file-spreadsheet"]
            : ["gs-ai-file-thumb--doc", "file-text"];
      const thumb = f.kind === "image" && f.url
        ? `<img class="gs-ai-file-thumb" src="${f.url}" alt="" />`
        : `<span class="gs-ai-file-thumb ${tone}">${ico(icon, 20)}</span>`;
      const name = esc(f.name || (f.kind === "image" ? "Ảnh chụp" : `Tệp ${kind}`));
      const meta = f.kind === "doc" ? `${kind} · ${f.lines} dòng` : f.size ? `${kind} · ${size(f.size)}` : kind;
      const x = onRemove
        ? `<x-button variant="bare" type="button" class="gs-ai-file-x" data-ai-file-x="${i}"
            title="Bỏ tệp" aria-label="Bỏ tệp ${name}">${ico("x", 12)}</x-button>`
        : "";
      return `
        <div class="gs-ai-file" title="${name}">
          ${thumb}
          <span class="gs-ai-file-txt">
            <span class="gs-ai-file-name">${name}</span>
            <span class="gs-ai-file-meta">${meta}</span>
          </span>
          ${x}
        </div>`;
    }).join("");
    box.innerHTML = list.length ? `<div class="gs-ai-strip">${chips}</div>` : "";
    box.onclick = onRemove
      ? (ev) => {
        const b = ev.target.closest("[data-ai-file-x]");
        if (b && !b.disabled) onRemove(Number(b.dataset.aiFileX));
      }
      : null;
    window.lucide?.createIcons({ root: box });
  }

  // Menu nút đính kèm: Camera chỉ có trên máy cảm ứng (điện thoại, iPad) — ở máy tính
  // capture không mở được camera mà chỉ ra hộp chọn tệp, trùng với "Ảnh".
  // iOS: ô tệp nhận ảnh LUÔN bật bảng của hệ thống (Chụp ảnh / Thư viện / Chọn tệp),
  // web không tắt được — mở thẳng ô "Tệp" để bảng đó làm menu, khỏi chồng hai lớp.
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const popIco = (name, tone) => `<span class="gs-pop-ico ${tone}">${ico(name, 16)}</span>`;

  // `pop` là <x-popover>; cam/photo/file là ba <input type=file> (camera có
  // capture="environment", ảnh accept="image/*", tệp accept = CXAiFiles.accept).
  function togglePicker(pop, anchor, { cam, photo, file }) {
    if (isIOS) return void file.click();
    if (!pop.isOpen) {
      pop.setItems([
        ...(matchMedia("(pointer: coarse)").matches
          ? [{ icon: popIco("camera", "gs-tone-pink"), label: "Camera", onClick: () => cam.click() }] : []),
        { icon: popIco("image", "gs-tone-green"), label: "Ảnh", onClick: () => photo.click() },
        { icon: popIco("paperclip", "gs-tone-blue"), label: "Tệp", onClick: () => file.click() },
      ]);
      window.lucide?.createIcons({ root: pop });
    }
    pop.toggle(anchor);
  }

  window.CXAiFiles = {
    accept: "image/*,.pdf,.docx,.doc,.xlsx,.xls,.csv,.txt",
    togglePicker,
    read,
    checkSend,
    payload,
    release,
    renderStrip,
    label,
    size,
  };
})();
