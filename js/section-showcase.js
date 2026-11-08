// Mục "Thiệp của khách" ở trang chủ: thiệp đã thanh toán, ai trả sau đứng đầu
// (Edge Function wedding-admin?resource=public-showcase sắp sẵn). Danh sách rỗng
// hoặc tải hỏng thì mục giữ nguyên `hidden`. Cần CONFIG + core/dal/storage-dal.js.
(function () {
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
    );

  // "2026-12-20" → "20.12.2026"; chuỗi lạ thì bỏ trống chứ không hiện rác.
  function fmtDate(d) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || "");
    return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
  }

  // Tên mẫu lấy từ danh sách mẫu đã tải cho dải bên trên; chưa có thì bỏ dòng đó.
  function themeName(theme) {
    const list = typeof templates !== "undefined" && Array.isArray(templates) ? templates : [];
    return list.find((t) => t.theme === theme)?.name || "";
  }

  function cardHTML(w, storage) {
    const names = [w.groom_name, w.bride_name].filter(Boolean).map(esc).join(" &amp; ");
    const date = fmtDate(w.ceremony_date);
    const tpl = esc(themeName(w.theme));
    const pos =
      w.focal && typeof w.focal.x === "number" && typeof w.focal.y === "number"
        ? ` style="object-position:${w.focal.x}% ${w.focal.y}%"`
        : "";
    const meta = [date && `<span>${date}</span>`, tpl && `<span>Mẫu ${tpl}</span>`]
      .filter(Boolean)
      .join(`<span aria-hidden="true">·</span>`);
    return `
      <a class="tt-card cx-tplcard cx-showcard" href="/${encodeURIComponent(w.slug)}"
         target="_blank" rel="noopener nofollow">
        <div class="tt-media">
          <img src="${esc(storage.getPublicUrl(w.cover))}" alt="Thiệp cưới ${names}" loading="lazy"${pos} />
          <div class="tt-hover"></div>
        </div>
        <div class="tt-cardbody">
          <p class="tt-name font-playfair">${names || "Thiệp cưới"}</p>
          ${meta ? `<p class="cx-showmeta">${meta}</p>` : ""}
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
