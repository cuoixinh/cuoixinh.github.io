// Mục "Thiệp của khách" ở trang chủ: thiệp đã thanh toán, ai trả sau đứng đầu
// (Edge Function wedding-admin?resource=public-showcase sắp sẵn). Danh sách rỗng
// hoặc tải hỏng thì mục giữ nguyên `hidden`. Cần CONFIG + core/dal/storage-dal.js.
(function () {
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
    );

  // "2026-12-20" → "20 · 12 · 2026" như dòng ngày in trên thiệp giấy; chuỗi lạ thì bỏ trống.
  function fmtDate(d) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || "");
    return m ? `${m[3]} · ${m[2]} · ${m[1]}` : "";
  }

  // Tên mẫu lấy từ danh sách mẫu đã tải cho dải bên trên; chưa có thì bỏ nhãn.
  function themeName(theme) {
    const list = typeof templates !== "undefined" && Array.isArray(templates) ? templates : [];
    return list.find((t) => t.theme === theme)?.name || "";
  }

  // Một thẻ = ảnh bìa của khách + phần chữ canh giữa như mặt thiệp in: tên, ngày, mẫu.
  // Link trần /<slug> = bản nhà trai (isGroomSide mặc định).
  function cardHTML(w, storage) {
    // Hai tên nối bằng trái tim thay cho "&"; alt/aria dùng chữ "và".
    const parts = [w.groom_name, w.bride_name].filter(Boolean).map(esc);
    const names = parts.join(` <i data-lucide="heart" class="cx-show-heart" aria-hidden="true"></i> `);
    const plain = parts.join(" và ");
    const date = fmtDate(w.ceremony_date);
    const tpl = esc(themeName(w.theme));
    const pos =
      w.focal && typeof w.focal.x === "number" && typeof w.focal.y === "number"
        ? ` style="object-position:${w.focal.x}% ${w.focal.y}%"`
        : "";
    return `
      <a class="cx-show-card" href="/${encodeURIComponent(w.slug)}" target="_blank" rel="noopener nofollow">
        <div class="cx-show-photo">
          <img src="${esc(storage.getPublicUrl(w.cover))}" alt="Thiệp cưới ${plain}" loading="lazy"${pos} />
        </div>
        <div class="cx-show-body">
          <p class="cx-show-names">${names || "Thiệp cưới"}</p>
          ${date ? `<p class="cx-show-date"><span>${date}</span></p>` : ""}
          ${tpl ? `<p class="cx-show-tpl">Mẫu ${tpl}</p>` : ""}
        </div>
      </a>`;
  }

  async function load(section) {
    const row = document.getElementById("showcaseRow");
    if (!row) return;
    let rows;
    try {
      const res = await fetch(CONFIG.supabase.edgeUrl + "?resource=public-showcase", {
        headers: { Authorization: "Bearer " + CONFIG.supabase.anonKey },
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      rows = await res.json();
    } catch (err) {
      console.warn("Không tải được thiệp của khách:", err);
      return;
    }
    if (!Array.isArray(rows) || !rows.length) return;

    const storage = new StorageDAL(null, CONFIG);
    row.innerHTML = rows.map((w) => cardHTML(w, storage)).join("");
    window.lucide?.createIcons({ root: row });
    section.hidden = false;
    window.updateScrollFade?.(row);
    row.addEventListener("scroll", () => window.updateScrollFade?.(row), { passive: true });
  }

  function init() {
    const section = document.getElementById("showcase");
    if (section) load(section);
  }

  // Hỏi SAU `load`: ảnh màn đầu (tường mẫu, dải mẫu thiệp) không phải tranh băng thông.
  if (document.readyState === "complete") init();
  else window.addEventListener("load", init, { once: true });
})();
