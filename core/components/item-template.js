// Thẻ MỘT mẫu thiệp (.tt-card) — dùng ở dải "Mẫu thiệp" của trang chủ
// (js/section-templates.js) và lưới của /theme-template. Style ở
// styles/tailwind-src.css (mục "THẺ MẪU THIỆP"). Thẻ chỉ có ảnh, tên và cặp nút
// — không hiện giá/mô tả.
// Hành vi KHÔNG viết vào onclick: trang gọi CXItemTemplate.bind(khung, {…}) một
// lần rồi mọi thẻ chèn về sau tự chạy (uỷ quyền sự kiện).
(function () {
  // Không khai cỡ ở đây: `.tt-cardbtns svg.lucide` cho icon ăn theo font-size của
  // nút, nhờ vậy icon và chữ cùng lớn/nhỏ theo khổ thẻ và luôn thẳng hàng.
  const ICON_EYE = `<i data-lucide="eye"></i>`;
  const ICON_USE = `<i data-lucide="play"></i>`;
  const ICON_TAG = `<i data-lucide="tag"></i>`;
  const ICON_STAR = `<i data-lucide="star"></i>`;

  function esc(s) {
    return String(s ?? "").replace(
      /[&<>"']/g,
      (ch) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[ch],
    );
  }

  /**
   * t: { id, theme, name }
   * opts.cardClass  class thêm cho vỏ thẻ (dải trang chủ dùng .cx-tplcard).
   * opts.tagLabel   nhãn danh mục — không truyền thì thẻ không có hàng nhãn.
   * opts.fav        true/false = hiện sao yêu thích và trạng thái của nó;
   *                 bỏ qua (undefined) = trang không có chức năng này.
   */
  function cardHTML(t, opts = {}) {
    const name = esc(t.name);
    const tag = opts.tagLabel
      ? `<span class="tt-chip">${ICON_TAG}${esc(opts.tagLabel)}</span>`
      : "";
    const fav =
      opts.fav === undefined
        ? ""
        : `<button type="button" class="tt-fav${opts.fav ? " is-on" : ""}" aria-pressed="${!!opts.fav}"
                   aria-label="Lưu vào yêu thích" data-tpl-act="fav">${ICON_STAR}</button>`;
    // Hàng nhãn ĐÈ lên ảnh (ảnh tràn hết bề ngang thẻ nên không còn dải trống ở
    // trên); rỗng thì bỏ hẳn, không để một hàng trong suốt ăn cú bấm xem trước.
    const tagrow =
      tag || fav ? `<div class="tt-tagrow">${tag}${fav}</div>` : "";

    return `
    <article class="tt-card${opts.cardClass ? " " + opts.cardClass : ""}" data-id="${esc(t.id)}" data-theme="${esc(t.theme)}">
      <div class="tt-media" role="button" tabindex="0" aria-label="Xem trước ${name}" data-tpl-act="preview">
        <img src="/assets/images/templates/${esc(t.theme)}.jpg" alt="${name}" loading="lazy" />
        <div class="tt-hover"></div>
        ${tagrow}
      </div>

      <div class="tt-cardbody">
        <h3 class="tt-name">${name}</h3>
        <div class="tt-cardbtns mt-3">
          <x-button size="xs" variant="bare" class="tt-btn-preview" data-tpl-act="preview">${ICON_EYE}Xem trước</x-button>
          <x-button size="xs" variant="bare" class="tt-btn-use" data-tpl-act="use">${ICON_USE}Dùng ngay</x-button>
        </div>
      </div>
    </article>`;
  }

  /**
   * Gắn hành vi cho MỌI thẻ trong `root` (kể cả thẻ chèn sau) — gọi một lần cho
   * mỗi khung chứa. Mỗi handler nhận (id, theme, article).
   * handlers: { onPreview, onUse, onFav }
   */
  function bind(root, handlers = {}) {
    if (!root || root.dataset.tplBound) return;
    root.dataset.tplBound = "1";

    const run = (ev, el) => {
      const card = el.closest(".tt-card");
      if (!card) return;
      const act = el.dataset.tplAct;
      const fn = { preview: "onPreview", use: "onUse", fav: "onFav" }[act];
      if (!handlers[fn]) return;
      // Sao yêu thích và cặp nút nằm trong .tt-media / thân thẻ → chặn để cú bấm
      // không chạy tiếp thành "xem trước".
      ev.stopPropagation();
      handlers[fn](card.dataset.id, card.dataset.theme, card, ev);
    };

    root.addEventListener("click", (ev) => {
      const el = ev.target.closest("[data-tpl-act]");
      if (el) run(ev, el);
    });

    // Ảnh là vùng bấm (role="button") nên phải nhận cả Enter/Space.
    root.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      const el = ev.target.closest?.('.tt-media[data-tpl-act="preview"]');
      if (!el) return;
      ev.preventDefault();
      run(ev, el);
    });
  }

  window.CXItemTemplate = { cardHTML, bind };
})();
