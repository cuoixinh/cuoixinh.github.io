// Icon RIÊNG — chỗ để những hình lucide không có (glyph ghép tay, logo nhỏ…).
// Icon thường thì dùng thẳng lucide: <i data-lucide="heart"></i>.
//
// ⚠️ Trang nào dùng <i data-icon> phải TỰ NẠP file này (index.html qua thẻ
// <script>, invitation-setup qua SCRIPTS trong loader.js), thiếu là thẻ <i> nằm
// im không báo lỗi gì.
//
//   HTML tĩnh:  <i data-icon="tên"></i>
//               <i data-icon="tên" data-size="20" class="text-rose-500"></i>
//   Trong JS:   cxIcon("tên", 16, "text-rose-500") ← trả về chuỗi <svg>
//   HTML chèn động: tự dựng, xem _cxWatchIcons ở cuối file.
//
// Thêm icon: dán phần bên trong <svg> vào CX_ICONS, khổ gốc 24×24 để khớp nét
// với lucide. Kích thước mặc định 16px, màu theo currentColor.

const CX_ICONS = {
  // Hai ngôi sao bốn cánh ĐẶC (một to một nhỏ). lucide chỉ có bản vẽ nét
  // (sparkles) nên hình này phải tự dựng; fill/stroke khai ngay trên <path> để
  // đè thuộc tính fill="none" stroke="currentColor" mà cxIcon() đặt ở thẻ <svg>.
  "sparkles-solid":
    '<path fill="currentColor" stroke="none" d="M9.5 5C9.5 12.2 11.3 14 18.5 14C11.3 14 9.5 15.8 9.5 23C9.5 15.8 7.7 14 .5 14C7.7 14 9.5 12.2 9.5 5Z"/>' +
    '<path fill="currentColor" stroke="none" d="M18 1C18 5 19 6 23 6C19 6 18 7 18 11C18 7 17 6 13 6C17 6 18 5 18 1Z"/>',
};

// Icon là ẢNH thay vì glyph — dùng cho logo. KHÔNG ăn `currentColor` nên chỉ đặt
// ở chỗ muốn giữ nguyên nhận diện. Đường dẫn TUYỆT ĐỐI vì cùng một icon được gọi
// từ nhiều mức thư mục (trang chủ, invitation-setup/, admin/).
//   xuxi — logo trợ lý XuXi, nhãn hình của MỌI chức năng AI trong sản phẩm.
const CX_ICON_IMAGES = {
  xuxi: "/assets/icons/XuXi.webp",
};

const _CX_ICON_DEFAULT_SIZE = 16;

/** Chuỗi <svg> (hoặc <img> với icon ảnh) của một icon. Tên lạ → chuỗi rỗng. */
function cxIcon(name, size, cls) {
  const src = CX_ICON_IMAGES[name];
  if (src) {
    const s = size || _CX_ICON_DEFAULT_SIZE;
    // Khổ đặt bằng inline style: quy tắc CSS thắng thuộc tính width/height, mà
    // nhiều trang có sẵn luật cỡ icon — chỉ inline style mới giữ đúng cỡ.
    return (
      `<img src="${src}" alt="" aria-hidden="true" ` +
      `style="width:${s}px;height:${s}px;object-fit:contain;flex-shrink:0"` +
      `${cls ? ` class="${cls}"` : ""} />`
    );
  }
  const inner = CX_ICONS[name];
  if (!inner) return "";
  const s = size || _CX_ICON_DEFAULT_SIZE;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" ` +
    `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ` +
    `stroke-linejoin="round" aria-hidden="true"${cls ? ` class="${cls}"` : ""}>${inner}</svg>`
  );
}

/**
 * Thay mọi <i data-icon="..."> trong `root` bằng svg thật. MỌI attribute khác
 * (class, style, data-* mà JS khác đang bám vào…) được bê nguyên sang thẻ svg —
 * đừng đổi thành gán innerHTML, nhiều nơi nhắm thẳng vào phần tử icon.
 */
function cxRenderIcons(root) {
  (root || document).querySelectorAll("[data-icon]").forEach((el) => {
    const svg = cxIcon(
      el.dataset.icon,
      Number(el.dataset.size) || _CX_ICON_DEFAULT_SIZE,
    );
    if (!svg) return;
    const tmp = document.createElement("div");
    tmp.innerHTML = svg;
    const node = tmp.firstElementChild;
    for (const a of Array.from(el.attributes)) {
      if (a.name === "data-icon" || a.name === "data-size") continue;
      node.setAttribute(a.name, a.value);
    }
    el.replaceWith(node);
  });
}

window.cxIcon = cxIcon;
window.cxRenderIcons = cxRenderIcons;

// HTML chèn động (innerHTML của lưới thẻ, popup…) cũng phải có icon mà không
// phải nhớ gọi cxRenderIcons ở từng chỗ chèn. Bảng rỗng thì bỏ hẳn observer:
// theo dõi cả cây DOM để không dựng gì là phí — có icon đầu tiên là tự bật lại.
function _cxWatchIcons() {
  if (!Object.keys(CX_ICONS).length && !Object.keys(CX_ICON_IMAGES).length)
    return;
  cxRenderIcons();
  new MutationObserver((list) => {
    for (const m of list) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches?.("[data-icon]"))
          cxRenderIcons(node.parentNode || document);
        else if (node.querySelector?.("[data-icon]")) cxRenderIcons(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
}

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", _cxWatchIcons, { once: true });
else _cxWatchIcons();
