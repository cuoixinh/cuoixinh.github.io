// Danh sách bài của THƯ VIỆN NHẠC — dùng chung cho tab Cấu hình của trang Thiết lập
// (invitation-setup/js/11-youtube.js) và bảng thư viện của Slide cưới (slide-cuoi/index.js).
// Mỗi hàng: [đĩa than + tên/ca sĩ] = nút CHỌN · [▶ / vạch sóng] = nút NGHE THỬ; trang tự quyết
// hai cú bấm làm gì (CXMusicLib.bind). Style .cx-mlib-* / .cx-disc ở styles/_music-lib.css.
(function () {
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
    );

  // Bỏ dấu + chữ thường để gõ "vay cuoi" vẫn ra "Váy Cưới".
  const fold = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/gi, "d")
      .toLowerCase()
      .trim();

  function filter(tracks, query) {
    const words = fold(query).split(/\s+/).filter(Boolean);
    return (tracks || []).filter((t) => {
      const hay = fold(`${t.title} ${t.artist || ""}`);
      return words.every((w) => hay.includes(w));
    });
  }

  // Nút nghe thử: dựng sẵn CẢ ▶ lẫn vạch sóng, CSS chọn theo cờ .is-playing của hàng —
  // đổi trạng thái phát (setPlaying) khỏi vẽ lại cả danh sách hay quét lại icon.
  function rowHTML(t, key, on, playing) {
    const title = esc(t.title);
    return (
      `<div class="cx-mlib-row${on ? " is-on" : ""}${playing ? " is-playing" : ""}" data-mlib-key="${esc(key)}">` +
      `<button type="button" class="cx-mlib-pick" data-mlib-pick role="radio" aria-checked="${on}">` +
      '<span class="cx-disc" aria-hidden="true"></span>' +
      '<span class="min-w-0 flex-1">' +
      `<span class="cx-mlib-title">${title}</span>` +
      (t.artist ? `<span class="cx-mlib-artist">${esc(t.artist)}</span>` : "") +
      "</span></button>" +
      `<button type="button" class="cx-mlib-end" data-mlib-prev aria-label="${playing ? "Dừng nghe thử" : "Nghe thử"} ${title}">` +
      '<i data-lucide="play" class="cx-mlib-ico" style="width:14px;height:14px"></i>' +
      '<span class="cx-mlib-eq" aria-hidden="true"><i></i><i></i><i></i></span>' +
      "</button></div>"
    );
  }

  /**
   * Vẽ danh sách vào `box` (đã gắn class .cx-mlib). tracks = null → đang tải.
   * opts: { query, current (khoá bài đang chọn), playing (khoá bài đang nghe thử),
   *         keyOf(t) (mặc định t.id) }
   */
  function render(box, tracks, opts = {}) {
    if (!box) return;
    const msg = (s) => (box.innerHTML = `<p class="cx-mlib-msg">${s}</p>`);
    if (tracks == null) return msg("Đang tải thư viện nhạc…");
    if (!tracks.length) return msg("Thư viện nhạc hiện chưa có bài nào.");
    const shown = filter(tracks, opts.query);
    if (!shown.length) return msg(`Không có bài nào khớp với “${esc(String(opts.query || "").trim())}”.`);
    const keyOf = opts.keyOf || ((t) => t.id);
    box.innerHTML = shown
      .map((t) => {
        const k = keyOf(t);
        return rowHTML(t, k, k === opts.current, k === opts.playing);
      })
      .join("");
    window.lucide?.createIcons({ root: box });
  }

  // Đổi bài đang nghe thử (null = không bài nào) mà không vẽ lại.
  function setPlaying(box, key) {
    box?.querySelectorAll("[data-mlib-key]").forEach((row) => {
      const on = !!key && row.dataset.mlibKey === key;
      row.classList.toggle("is-playing", on);
      const btn = row.querySelector("[data-mlib-prev]");
      const title = row.querySelector(".cx-mlib-title")?.textContent || "";
      btn?.setAttribute("aria-label", `${on ? "Dừng nghe thử" : "Nghe thử"} ${title}`);
    });
  }

  // Gắn MỘT lần cho khung (uỷ quyền sự kiện): onPick(key) · onPreview(key).
  function bind(box, { onPick, onPreview } = {}) {
    box?.addEventListener("click", (e) => {
      const row = e.target.closest("[data-mlib-key]");
      if (!row) return;
      const key = row.dataset.mlibKey;
      if (e.target.closest("[data-mlib-prev]")) onPreview?.(key);
      else if (e.target.closest("[data-mlib-pick]")) onPick?.(key);
    });
  }

  window.CXMusicLib = { render, setPlaying, bind, filter, fold };
})();
