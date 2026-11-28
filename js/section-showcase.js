// Mục "Thiệp của khách" ở trang chủ: thiệp đã thanh toán, ai trả sau đứng đầu
// (Edge Function wedding-admin?resource=public-showcase&offset= sắp sẵn, theo trang) —
// cuộn gần mép phải thì tải trang sau. Trang ĐẦU đọc qua worker cache (CONFIG.cloudflare.cacheProxy,
// KV 10 phút), trang sau đi thẳng Edge Function. Trang đầu rỗng hoặc hỏng thì mục giữ `hidden`.
// Cần CONFIG + core/dal/storage-dal.js.
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

  // Còn cách mép phải dưới khoảng này (px) thì tải trang sau — đủ sớm để thẻ mới kịp vào.
  const PREFETCH_PX = 600;
  let next = 0; // offset trang sau; null = hết
  let busy = false;
  // Trang đầu là bản cache (trễ tới 10 phút) còn trang sau là bản sống: có thiệp mới thanh
  // toán xen giữa thì hàng bị đẩy lùi, trang sau lặp lại thẻ cuối trang đầu → lọc theo slug.
  const seen = new Set();

  async function getJSON(base, offset) {
    const res = await fetch(base + "?resource=public-showcase&offset=" + offset, {
      headers: { Authorization: "Bearer " + CONFIG.supabase.anonKey },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  async function fetchPage(offset) {
    const cache = offset === 0 ? CONFIG.cloudflare?.cacheProxy : null;
    let body;
    if (cache) {
      try {
        body = await getJSON(cache, offset);
      } catch (err) {
        console.warn("Worker cache thiệp của khách hỏng, đọc thẳng:", err);
      }
    }
    if (body === undefined) body = await getJSON(CONFIG.supabase.edgeUrl, offset);
    // Edge Function bản cũ bỏ qua `offset`, trả mảng một lần — coi như trang duy nhất.
    if (Array.isArray(body)) return { items: body, next: null };
    return { items: Array.isArray(body?.items) ? body.items : [], next: body?.next ?? null };
  }

  // Đọc tiếp tới khi có thẻ để chèn (trang có thể rỗng vì lọc thiệp không ảnh) hoặc hết.
  async function loadMore(row, storage) {
    if (busy || next === null) return 0;
    busy = true;
    let added = 0;
    try {
      while (next !== null && !added) {
        const page = await fetchPage(next);
        next = page.next;
        const fresh = page.items.filter((w) => w?.slug && !seen.has(w.slug));
        fresh.forEach((w) => seen.add(w.slug));
        if (fresh.length) {
          row.insertAdjacentHTML("beforeend", fresh.map((w) => cardHTML(w, storage)).join(""));
          added = fresh.length;
        }
      }
    } catch (err) {
      console.warn("Không tải được thiệp của khách:", err);
      next = null; // hỏng thì dừng cuộn tiếp, giữ thẻ đã có
    } finally {
      busy = false;
    }
    if (added) {
      window.lucide?.createIcons({ root: row });
      window.updateScrollFade?.(row);
    }
    return added;
  }

  function nearEnd(row) {
    return row.scrollWidth - row.clientWidth - row.scrollLeft < PREFETCH_PX;
  }

  async function load(section) {
    const row = document.getElementById("showcaseRow");
    if (!row) return;
    const storage = new StorageDAL(null, CONFIG);
    if (!(await loadMore(row, storage))) return;

    section.hidden = false;
    window.updateScrollFade?.(row);
    row.addEventListener(
      "scroll",
      () => {
        window.updateScrollFade?.(row);
        if (nearEnd(row)) loadMore(row, storage);
      },
      { passive: true },
    );
    // Dải rộng (máy tính) có thể chưa đủ thẻ để cuộn: tải thêm cho tới khi cuộn được.
    while (next !== null && nearEnd(row) && (await loadMore(row, storage)));
  }

  function init() {
    const section = document.getElementById("showcase");
    if (section) load(section);
  }

  // Hỏi SAU `load`: ảnh màn đầu (tường mẫu, dải mẫu thiệp) không phải tranh băng thông.
  if (document.readyState === "complete") init();
  else window.addEventListener("load", init, { once: true });
})();
