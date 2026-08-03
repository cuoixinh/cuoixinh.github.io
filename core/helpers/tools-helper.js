// ============================================================
// TOOLS-HELPER.JS — Kho "Công cụ" thả được lên thiệp
// ============================================================
//
// Công cụ = một tiện ích nhỏ người dùng thả vào thiệp ở tab Giao diện, đặt ở
// TOẠ ĐỘ tự do y như hoạ tiết (không chèn giữa các mục như khối văn bản).
// Trước mắt chỉ có Trình phát nhạc; file này là chỗ đăng ký công cụ mới.
//
// File chỉ khai báo DANH MỤC + dựng MARKUP. Phần thả/kéo/lưu nằm ở
// theme-setting-helper.js (mục TOOLS), phần bảng chọn ở invitation-setup/js/
// 05-theme-panel.js — cả hai đều đọc window.CX_TOOLS nên thêm công cụ mới thì
// chỉ cần thêm một mục ở đây.
//
// ── Khai báo một công cụ ───────────────────────────────────────────────────
//   id        Khoá lưu trong theme_setting.tools[].tool
//   name/desc Chữ hiện ở bảng chọn
//   icon      SVG (chuỗi) cho ô công cụ trong bảng chọn
//   single    true = mỗi thiệp chỉ được một cái (thả lần nữa thì dời chỗ)
//   variants  Danh sách MẪU: { id, name, desc, w, minW, maxW, fs }
//               w/minW/maxW  bề ngang tính theo % bề ngang thiệp
//               fs           hệ số cỡ chữ: font-size = bề ngang thật × fs.
//                            Mọi kích thước bên trong mẫu viết bằng `em` nên
//                            kéo to/nhỏ là cả widget phóng theo, không vỡ.
//   build(variant) → HTMLElement, đã gắn sẵn các vai trò data-cx-music.
//
// Markup ở đây dùng class TỰ VIẾT (.cx-tw-*, khai báo trong
// styles/_music-player.css) chứ không phải utility Tailwind: class sinh trong
// chuỗi JS thì purge quét được nhưng sửa lại rất khó đọc, mà widget còn cần
// phóng to thu nhỏ theo `em` — thứ Tailwind không diễn đạt gọn.

(function () {
  const ICON = {
    note: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M13 2 6 3.6v6.6a2.2 2.2 0 1 0 1.2 1.9V6l4.6-1v3.6a2.2 2.2 0 1 0 1.2 1.9z"/></svg>',
    play: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>',
    pause:
      '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z"/></svg>',
    back: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 8V3L1 8l7 5zm7 0V3L8 8l7 5z"/></svg>',
    forward:
      '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 8v5l7-5-7-5zm-7 0v5l7-5-7-5z"/></svg>',
    pin: '<svg viewBox="0 0 12 16" fill="currentColor" aria-hidden="true"><path d="M6 0a5 5 0 0 0-5 5c0 3.6 5 11 5 11s5-7.4 5-11a5 5 0 0 0-5-5m0 6.9A1.9 1.9 0 1 1 6 3a1.9 1.9 0 0 1 0 3.9"/></svg>',
    music:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  };

  // Ảnh bìa bài hát: nốt nhạc là nền dự phòng, có thumbnail thì ảnh đè lên và
  // quay tròn khi đang phát (.cx-mp-spin do music-player-helper bật/tắt).
  const art = (cls) =>
    '<span class="cx-tw-art ' +
    cls +
    '">' +
    '<span class="cx-tw-note cx-mp-note">' +
    ICON.note +
    "</span>" +
    '<img data-cx-music="thumb" alt="" hidden class="cx-mp-spin" />' +
    "</span>";

  // Nút phát: hai icon chồng nhau, CSS chọn cái nào hiện theo .is-playing trên
  // thẻ root. Cố ý KHÔNG dùng data-cx-play-icon/pause-icon (cách đổi class icon
  // của Font Awesome) — công cụ phải chạy được cả ở theme không nạp Font Awesome.
  const playBtn = (cls) =>
    '<button type="button" data-cx-music="toggle" aria-label="Phát hoặc tạm dừng nhạc nền" class="' +
    cls +
    '">' +
    '<span class="cx-tw-ic-play">' +
    ICON.play +
    "</span>" +
    '<span class="cx-tw-ic-pause">' +
    ICON.pause +
    "</span>" +
    "</button>";

  const seekBtns = (which) =>
    '<button type="button" data-cx-music="' +
    which +
    '" aria-label="' +
    (which === "back" ? "Lùi 10 giây" : "Tới 10 giây") +
    '" class="cx-tw-btn">' +
    ICON[which] +
    "</button>";

  // Khối tóm tắt thiệp (kéo tay nắm xuống mới hiện) — chỉ dựng khi theme có gọi
  // renderMusicSummary(), vì các ô dưới đây do hàm đó đổ dữ liệu vào. Theme nào
  // không cung cấp thì mẫu "thanh ngang" chỉ có mỗi thanh, không có tay nắm.
  function summaryPanel() {
    if (!window.__cxMusicSummary) return "";
    const profile = (role, label) =>
      '<span class="cx-tw-profile">' +
      '<img data-cx-summary="' +
      role +
      '-photo" alt="" class="cx-tw-avatar" />' +
      '<span class="cx-tw-role">' +
      label +
      "</span>" +
      '<span class="cx-tw-who" data-cx-summary="' +
      role +
      '-name"></span>' +
      "</span>";
    return (
      '<div class="cx-mp-panel cx-tw-panel" data-cx-music="panel"><div>' +
      '<div class="cx-tw-panel-in">' +
      '<div class="cx-tw-profiles">' +
      profile("groom", "Chú Rể") +
      '<span class="cx-tw-amp">&amp;</span>' +
      profile("bride", "Cô Dâu") +
      "</div>" +
      '<div class="cx-tw-event">' +
      '<span class="cx-tw-role" data-cx-summary="event-name"></span>' +
      '<span class="cx-tw-date" data-cx-summary="event-date"></span>' +
      '<span class="cx-tw-when">' +
      '<span data-cx-summary="event-weekday"></span>' +
      '<span data-cx-summary-row class="cx-tw-when-time">' +
      '<span class="cx-tw-dot">·</span><span data-cx-summary="event-time"></span>' +
      "</span></span>" +
      '<span data-cx-summary-row class="cx-tw-where">' +
      ICON.pin +
      '<span data-cx-summary="event-location"></span></span>' +
      "</div></div></div></div>" +
      '<button type="button" data-cx-music="handle" class="cx-tw-handle cx-mp-handle"' +
      ' aria-label="Vuốt xuống để xem tóm tắt thiệp"><span></span></button>'
    );
  }

  function buildMusic(variant) {
    const node = document.createElement("div");
    node.className = "cx-tw cx-tw-" + variant;
    node.setAttribute("data-cx-music", "root");
    node.setAttribute("data-cx-seek", "10");
    node.setAttribute("data-cx-empty-title", "Nhạc nền");

    if (variant === "mini") {
      // Cả widget là một nút tròn: bấm để phát/dừng, ảnh bìa quay khi đang phát.
      node.innerHTML =
        '<button type="button" data-cx-music="toggle" class="cx-tw-mini-btn" aria-label="Phát hoặc tạm dừng nhạc nền">' +
        art("cx-tw-art-round") +
        '<span class="cx-tw-mini-ic">' +
        '<span class="cx-tw-ic-play">' +
        ICON.play +
        "</span>" +
        '<span class="cx-tw-ic-pause">' +
        ICON.pause +
        "</span></span></button>";
      return node;
    }

    if (variant === "card") {
      node.innerHTML =
        '<span class="cx-tw-cover">' +
        art("cx-tw-art-cover") +
        "</span>" +
        '<span class="cx-tw-titlewrap"><span class="cx-tw-title cx-mp-title" data-cx-music="title">Nhạc nền</span></span>' +
        '<span class="cx-tw-artist" data-cx-music="artist"></span>' +
        '<span class="cx-tw-prog cx-mp-prog" data-cx-music="progress">' +
        '<span class="cx-tw-fill cx-mp-fill" data-cx-music="fill"></span></span>' +
        '<span class="cx-tw-times"><span data-cx-music="time">0:00</span>' +
        '<span data-cx-music="duration">0:00</span></span>' +
        '<span class="cx-tw-ctrls">' +
        seekBtns("back") +
        playBtn("cx-tw-btn cx-tw-btn-main") +
        seekBtns("forward") +
        "</span>";
      return node;
    }

    // "bar" — mặc định. Cả hàng là vùng tiến trình (bấm chỗ nào tua tới đó);
    // music-player-helper tự bỏ qua cú bấm rơi vào nút bên trong.
    node.innerHTML =
      '<div class="cx-tw-row cx-mp-prog" data-cx-music="progress">' +
      '<span class="cx-tw-fill cx-tw-fill-row cx-mp-fill" data-cx-music="fill"></span>' +
      art("cx-tw-art-sq") +
      '<span class="cx-tw-titlewrap"><span class="cx-tw-title cx-mp-title" data-cx-music="title">Nhạc nền</span></span>' +
      '<span class="cx-tw-ctrls">' +
      seekBtns("back") +
      playBtn("cx-tw-btn cx-tw-btn-main") +
      seekBtns("forward") +
      "</span></div>" +
      summaryPanel();
    return node;
  }

  window.CX_TOOLS = {
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
          fs: 0.035,
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
      build: buildMusic,
    },
  };
})();
