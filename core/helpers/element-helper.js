// Kho "Thành phần" thả được lên thiệp (tab Giao diện) — khối giao diện đặt theo
// TOẠ ĐỘ tự do như hoạ tiết. File này chỉ khai báo DANH MỤC (window.CX_ELEMENTS):
// markup do component trong core/components/ dựng, phần thả/kéo/lưu ở
// theme-setting-helper.js (mục ELEMENTS), bảng chọn ở 05-theme-panel.js — nên
// thêm thành phần mới chỉ cần thêm một mục ở đây.
//
// Khai báo một thành phần:
//   id        khoá lưu trong theme_setting.elements[].element
//   name/desc chữ hiện ở bảng chọn
//   icon      SVG (chuỗi), dự phòng khi không dựng được ảnh xem trước
//   single    true = mỗi thiệp chỉ một cái (thả lần nữa thì dời chỗ)
//   pin       true = GHIM theo màn hình: widget nổi ở một chỗ cố định trên khung
//             nhìn, cuộn thiệp không trôi mất (trình phát nhạc). Khác với thành
//             phần thường (hoa, chữ) trôi theo thiệp. Đổi ý nghĩa của toạ độ đã
//             lưu: x vẫn là % bề ngang THIỆP, còn y là % chiều cao KHUNG NHÌN.
//   variants  [{ id, name, desc, w, minW, maxW, fs, colors }] — w/minW/maxW là %
//             bề ngang thiệp; fs = hệ số cỡ chữ (font-size = bề ngang thật × fs),
//             CHỈ đặt cho mẫu viết bằng `em`, mẫu dùng utility cỡ cố định thì bỏ
//             trống; `colors` = mảng khoá CX_EL_COLOR mà MẪU ĐÓ dùng tới (thanh
//             ngang đủ 4, nút tròn chỉ có nút điều khiển + nền nút). Bỏ trống thì
//             hiện hết ô màu của thành phần.
//   build(variant) → HTMLElement, đã gắn sẵn các vai trò data-cx-music
//   options   khai báo control cho bảng "Điều chỉnh thành phần" (panel tự dựng):
//             { id, type:"choice"|"color", label, def, items:[{id,name}] }.
//             Giá trị lưu ở theme_setting.elements[].opts, tối đa EL_COLOR_SLOTS
//             ô màu (xem 05-theme-panel.js).
//             Ô màu nên có from(node) → "#rrggbb" đọc màu ĐANG hiện của widget:
//             chưa ai chỉnh thì ô chọn màu mở đúng màu đang thấy, không phải
//             `def` (mỗi theme một bộ màu khác nhau). Trả "" nếu không đọc được.
//   apply(node, opts) áp opts lên widget vừa dựng (cả lúc chỉnh lẫn trang công khai)
//
// Nạp file này SAU core/components/music-player.js và element-color-enum.js.

(function () {
  const C = window.CX_EL_COLOR;

  // Ô màu: nhãn lấy từ enum để danh mục và bảng chỉnh không lệch chữ nhau.
  const color = (id, def, from) => ({
    id,
    type: "color",
    label: window.CX_EL_COLOR_LABEL[id],
    def,
    from,
  });

  const ICON = {
    music:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  };

  // "rgb(…)"/"rgba(…)" (kể cả chuỗi gradient — lấy chặng màu đầu) → "#rrggbb".
  // Trong suốt hoàn toàn coi như không có màu để người gọi dò tiếp chỗ khác.
  function hexOf(color) {
    const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?/i
      .exec(color || "");
    if (!m || (m[4] != null && Number(m[4]) === 0)) return "";
    return (
      "#" +
      [m[1], m[2], m[3]]
        .map((n) => Math.round(Number(n)).toString(16).padStart(2, "0"))
        .join("")
    );
  }

  // Màu nền đang vẽ: nền đặc trước, trong suốt mà có gradient thì lấy chặng đầu.
  function paintOf(el) {
    if (!el) return "";
    const cs = getComputedStyle(el);
    return hexOf(cs.backgroundColor) || hexOf(cs.backgroundImage);
  }

  function inkOf(el) {
    return el ? hexOf(getComputedStyle(el).color) : "";
  }

  // Hai mẫu gọn (.cx-mw) đi màu qua biến CSS nên không có bề mặt nào để đo —
  // đọc thẳng biến; mẫu thanh ngang dựng bằng utility thì đo trên chính thanh.
  function varOf(node, name) {
    return hexOf(getComputedStyle(node).getPropertyValue(name));
  }

  // #rrggbb → "r, g, b" để pha alpha cho các sắc độ phái sinh.
  function rgbOf(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
    if (!m) return "";
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(", ");
  }

  // Ảnh bìa: mặc định là ảnh bài hát do music-player-helper đổ vào. Hai lựa chọn
  // kia phải KHOÁ ô ảnh (data-cx-art-lock) để helper đừng ghi đè khi bài đổi.
  function applyArt(node, art) {
    const thumbs = node.querySelectorAll('[data-cx-music="thumb"]');
    if (art !== "couple" && art !== "none") {
      thumbs.forEach((el) => el.removeAttribute("data-cx-art-lock"));
      return;
    }
    const w = (window.__cxMusicSummary || {}).wedding || {};
    const file =
      art === "couple"
        ? w.cover_image_url || w.groom_image_url || w.bride_image_url
        : "";
    const src = file && window.getImageUrl ? getImageUrl(file) : "";
    thumbs.forEach((el) => {
      el.setAttribute("data-cx-art-lock", "1");
      if (src) {
        el.src = src;
        el.hidden = false;
      } else {
        el.removeAttribute("src");
        el.hidden = true;
      }
    });
  }

  // Màu đi bằng CSS var (_music-player.css đọc sẵn cho nút tròn / thẻ nhạc);
  // class cx-tint-* để mẫu thanh ngang đè được utility Tailwind, và chỉ đè đúng
  // thứ người dùng đã chọn.
  function applyTint(node, o) {
    const set = (name, value, cls) => {
      node.classList.toggle(cls, !!value);
      if (value) node.style.setProperty(name, value);
      else node.style.removeProperty(name);
    };
    set("--cx-mw-bg", o[C.BG], "cx-tint-bg");
    set("--cx-mw-fg", o[C.TEXT], "cx-tint-fg");
    set("--cx-mw-ctrl", o[C.CTRL], "cx-tint-ctrl");
    set("--cx-mw-accent", o[C.CTRL_BG], "cx-tint-accent");

    const fg = rgbOf(o[C.TEXT]);
    const ac = rgbOf(o[C.CTRL_BG]);
    if (fg) node.style.setProperty("--cx-mw-dim", `rgba(${fg}, .7)`);
    else node.style.removeProperty("--cx-mw-dim");
    if (ac) {
      node.style.setProperty("--cx-mw-chip", `rgba(${ac}, .16)`);
      node.style.setProperty("--cx-mw-fill", `rgba(${ac}, .32)`);
    } else {
      node.style.removeProperty("--cx-mw-chip");
      node.style.removeProperty("--cx-mw-fill");
    }
  }

  window.CX_ELEMENTS = {
    music: {
      id: "music",
      name: "Trình phát nhạc",
      desc: "Nhạc nền của thiệp",
      icon: ICON.music,
      single: true,
      // Nhạc nền phải với tới được ở bất kỳ đoạn nào của thiệp → ghim theo màn hình.
      pin: true,
      // Cần link nhạc bên tab Thiết lập mới có gì để phát — bảng chọn đọc cờ này
      // để nhắc người dùng thay vì thả ra một widget câm.
      needs: "music",
      variants: [
        {
          id: "bar",
          name: "Thanh ngang",
          desc: "Bìa, tên bài và nút điều khiển trên một hàng",
          w: 88,
          minW: 45,
          maxW: 100,
          // Không có fs: mẫu này dựng bằng utility Tailwind (w-8, text-[13px]…)
          // nên kéo rộng hẹp chỉ đổi bề ngang thanh, giống hệt lúc nó nằm trên
          // đỉnh thiệp ở basic-gold.
          colors: [C.BG, C.TEXT, C.CTRL, C.CTRL_BG],
        },
        {
          id: "mini",
          name: "Nút tròn",
          desc: "Một nút nhỏ, ảnh bìa xoay khi đang phát",
          w: 16,
          minW: 8,
          maxW: 34,
          fs: 0.2,
          // Chỉ là một nút tròn phủ ảnh bìa: không có mặt nền riêng, cũng không
          // có chữ nào để đổi màu.
          colors: [C.CTRL, C.CTRL_BG],
        },
        {
          id: "card",
          name: "Thẻ nhạc",
          desc: "Bìa lớn, tên bài và thanh tiến trình",
          w: 56,
          minW: 32,
          maxW: 100,
          fs: 0.055,
          colors: [C.BG, C.TEXT, C.CTRL, C.CTRL_BG],
        },
      ],
      options: [
        {
          id: "art",
          type: "choice",
          label: "Ảnh bìa",
          def: "song",
          items: [
            { id: "song", name: "Ảnh bài hát" },
            { id: "couple", name: "Ảnh cặp đôi" },
            { id: "none", name: "Nốt nhạc" },
          ],
        },
        color(
          C.BG,
          "rgb(var(--white-rgb))",
          (node) =>
            paintOf(
              node.querySelector(".cx-mp-bar") ||
                node.querySelector(".cx-mw-card"),
            ) || varOf(node, "--cx-mw-bg"),
        ),
        color(
          C.TEXT,
          "rgb(var(--music-widget-fg-rgb))",
          (node) =>
            inkOf(node.querySelector('[data-cx-music="title"]')) ||
            varOf(node, "--cx-mw-fg"),
        ),
        // Nút tròn: mặt bấm là .cx-mw-mini-ic (nút bọc ngoài trong suốt) nên dò
        // nó trước, các mẫu khác mới rơi về nút phát.
        color(
          C.CTRL,
          "rgb(var(--white-rgb))",
          (node) =>
            inkOf(
              node.querySelector(".cx-mw-mini-ic") ||
                node.querySelector('[data-cx-music="icon"]') ||
                node.querySelector('[data-cx-music="toggle"]'),
            ) || varOf(node, "--cx-mw-ctrl"),
        ),
        color(
          C.CTRL_BG,
          "rgb(var(--music-widget-accent-rgb))",
          (node) =>
            paintOf(
              node.querySelector(".cx-mw-mini-ic") ||
                node.querySelector('[data-cx-music="toggle"]'),
            ) || varOf(node, "--cx-mw-accent"),
        ),
      ],
      build: (variant) =>
        window.CXMusicPlayer.build({ variant, chrome: "inline" }),
      apply: (node, opts) => {
        const o = opts || {};
        applyArt(node, o.art);
        applyTint(node, o);
      },
    },
  };
})();
