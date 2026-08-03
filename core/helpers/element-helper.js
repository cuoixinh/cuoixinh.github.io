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
//   variants  [{ id, name, desc, w, minW, maxW, fs }] — w/minW/maxW là % bề ngang
//             thiệp; fs = hệ số cỡ chữ (font-size = bề ngang thật × fs), CHỈ đặt
//             cho mẫu viết bằng `em`, mẫu dùng utility cỡ cố định thì bỏ trống
//   build(variant) → HTMLElement, đã gắn sẵn các vai trò data-cx-music
//
// Nạp file này SAU core/components/music-player.js.

(function () {
  const ICON = {
    music:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  };

  window.CX_ELEMENTS = {
    music: {
      id: "music",
      name: "Trình phát nhạc",
      desc: "Nhạc nền của thiệp",
      icon: ICON.music,
      single: true,
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
        },
        {
          id: "mini",
          name: "Nút tròn",
          desc: "Một nút nhỏ, ảnh bìa xoay khi đang phát",
          w: 16,
          minW: 8,
          maxW: 34,
          fs: 0.2,
        },
        {
          id: "card",
          name: "Thẻ nhạc",
          desc: "Bìa lớn, tên bài và thanh tiến trình",
          w: 56,
          minW: 32,
          maxW: 100,
          fs: 0.055,
        },
      ],
      build: (variant) =>
        window.CXMusicPlayer.build({ variant, chrome: "inline" }),
    },
  };
})();
