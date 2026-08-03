// ============================================================
// COMPONENT: TRÌNH PHÁT NHẠC NỀN
// ============================================================
//
// Một chỗ duy nhất giữ MARKUP của trình phát nhạc. Trước đây markup này nằm
// thẳng trong public/themes/basic-gold/index.html (hơn 200 dòng) nên panel
// "Thành phần" phải tự vẽ lại một bản khác — sửa một bên là hai bên lệch nhau.
// Giờ cả hai chỗ gọi chung CXMusicPlayer.build():
//
//   · Trang thiệp   basic-gold dựng bản `fixed-top` (thanh neo đỉnh màn hình,
//                   vuốt lên thu về bong bóng).
//   · Panel Thành phần  runtime dựng bản `inline` để thả tự do lên thiệp
//                   (core/helpers/element-helper.js).
//
// LOGIC không nằm ở đây: đổi icon phát/dừng, tên bài, tiến trình, tua, cử chỉ
// tay nắm… đều do core/helpers/music-player-helper.js lo, gắn vào qua các
// thuộc tính data-cx-music. File này chỉ dựng HTML rồi trả về thẻ gốc.
// Dữ liệu khối tóm tắt do renderMusicSummary() (render-helper.js) đổ vào các ô
// data-cx-summary.
//
// ── Vì sao class Tailwind viết trọn vẹn trong chuỗi ────────────────────────
// Purge quét văn bản thô. `core/**/*.js` đã nằm trong `content` của CẢ HAI
// config (tailwind.config.js và tailwind.themes.config.js) nên class ở đây
// được sinh ra ở cả build ứng dụng lẫn build thiệp — miễn là viết TRỌN tên
// class, không ghép từ mảnh chuỗi (xem CLAUDE.md).
//
// ── Lưu ý màu ở panel ──────────────────────────────────────────────────────
// `rose-pastel` là hai bảng màu khác nhau: hồng khói (#f5d5d8…) ở build thiệp,
// hồng phấn (#fef1f7…) ở build ứng dụng. Cùng tên class nên bản xem trước
// trong panel hơi khác tông so với lúc nằm trên thiệp. Đây là đánh đổi đã
// chọn khi giữ nguyên class Tailwind của basic-gold.

(function () {
  // ── Bản THANH NGANG (nguyên bản của basic-gold) ───────────────────────────
  // Toàn bộ trên một hàng cao 48px: bìa · tên bài · lùi/phát/tới.
  // CHÍNH hàng đó là thanh tiến trình (data-cx-music="progress"): phần đã phát
  // được tô sáng dần từ trái sang, bấm chỗ nào tua tới chỗ đó — không tốn thêm
  // một dải riêng. Helper tự bỏ qua cú bấm rơi vào nút bên trong. Các phần tử
  // nội dung phải là `relative` để nằm TRÊN lớp tô.
  const barRow = `
    <div
      data-cx-music="progress"
      class="cx-mp-prog relative flex items-center gap-2 px-3 py-2 overflow-hidden cursor-pointer"
    >
      <div
        data-cx-music="fill"
        class="cx-mp-fill absolute inset-y-0 left-0 w-0 bg-white/40 pointer-events-none"
      ></div>

      <!-- Ảnh bìa: nốt nhạc là nền dự phòng, có thumbnail thì ảnh đè lên -->
      <div
        class="relative shrink-0 w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-br from-rose-pastel-200 to-rose-pastel-300 ring-1 ring-inset ring-white/40 flex items-center justify-center"
      >
        <i class="cx-mp-note fas fa-music text-white text-[11px]"></i>
        <img
          data-cx-music="thumb"
          alt=""
          hidden
          class="absolute inset-0 w-full h-full object-cover"
        />
      </div>

      <div class="relative min-w-0 flex-1 overflow-hidden">
        <div
          data-cx-music="title"
          class="cx-mp-title font-inter italic text-[13px] text-stone-600 leading-tight"
        >
          Nhạc nền
        </div>
      </div>

      <!-- Lùi 10 giây · Phát/Tạm dừng · Tới 10 giây -->
      <div class="relative shrink-0 flex items-center gap-1">
        <button
          type="button"
          data-cx-music="back"
          aria-label="Lùi 10 giây"
          class="w-8 h-8 rounded-full bg-white/40 text-stone-600 flex items-center justify-center transition-transform active:scale-90"
        >
          <i class="fas fa-backward text-[10px]"></i>
        </button>
        <button
          type="button"
          data-cx-music="toggle"
          aria-label="Phát hoặc tạm dừng nhạc nền"
          class="w-8 h-8 rounded-full bg-white/80 text-stone-600 flex items-center justify-center shadow-sm transition-transform active:scale-90"
        >
          <!-- Class ở đây là phần của theme (cỡ chữ); helper ghép thêm
               fa-play / fa-pause vào tuỳ trạng thái — và lọc bỏ bộ icon mặc
               định bên dưới để không chồng hai glyph. Đặt sẵn fa-play để lúc
               CHƯA gắn logic (ô xem trước ở panel, widget đang chỉnh) nút vẫn
               có hình chứ không rỗng trơ. -->
          <i data-cx-music="icon" class="fas fa-play ml-px text-[11px]"></i>
        </button>
        <button
          type="button"
          data-cx-music="forward"
          aria-label="Tới 10 giây"
          class="w-8 h-8 rounded-full bg-white/40 text-stone-600 flex items-center justify-center transition-transform active:scale-90"
        >
          <i class="fas fa-forward text-[10px]"></i>
        </button>
      </div>
    </div>`;

  // Khối mở rộng: kéo XUỐNG ở tay nắm mới hiện. Tóm tắt thiệp: hai "profile"
  // chú rể / cô dâu, rồi ngày và nơi làm LỄ (ngày chính, không phải ngày tiệc).
  // .cx-mp-panel phải có ĐÚNG MỘT thẻ con bọc tất cả: CSS cắt chiều cao ở thẻ
  // con đó, để nội dung thành nhiều thẻ anh em thì phần ngoài thẻ đầu không bị
  // cắt và lòi ra lúc đang đóng.
  // Chữ dùng stone của Tailwind (không phải stone-custom) để cài đặt màu của
  // người dùng không làm chữ trên thẻ mất hút.
  const profile = (role, label, photo, name) => `
    <div
      class="flex-1 min-w-0 flex flex-col items-center gap-1 rounded-xl bg-white/45 px-2 py-2"
    >
      <div
        class="w-12 h-12 rounded-full overflow-hidden shrink-0 ring-2 ring-white/80 shadow-sm bg-gradient-to-br from-rose-pastel-200 to-rose-pastel-300"
      >
        <img data-cx-summary="${photo}" alt="" class="w-full h-full object-cover" />
      </div>
      <div class="text-[9px] uppercase tracking-[2px] text-stone-500 font-inter">
        ${label}
      </div>
      <div
        data-cx-summary="${name}"
        class="w-full truncate text-center font-cinzel text-[12px] font-semibold tracking-wide text-stone-700"
      ></div>
    </div>`;

  const summaryPanel = `
    <div data-cx-music="panel" class="cx-mp-panel">
      <div>
        <!-- max-w: trên md thanh rộng tới 768px, để khối tóm tắt giãn hết cỡ thì
             hai profile loãng ra mà ảnh vẫn bé — giữ nó ở khổ thiệp. -->
        <div class="flex flex-col gap-2 px-3 pt-1 pb-2 w-full max-w-[430px] mx-auto">
          <div class="flex items-stretch gap-2">
            ${profile("groom", "Chú Rể", "groom-photo", "groom-name")}
            <div class="self-center font-cormorant italic text-[18px] text-stone-500">
              &amp;
            </div>
            ${profile("bride", "Cô Dâu", "bride-photo", "bride-name")}
          </div>

          <!-- Ngày & nơi làm lễ -->
          <div
            class="flex flex-col items-center gap-0.5 rounded-xl bg-white/45 px-3 py-2 text-center"
          >
            <div
              data-cx-summary="event-name"
              class="text-[9px] uppercase tracking-[2px] text-stone-500 font-inter"
            ></div>
            <div
              data-cx-summary="event-date"
              class="font-playfair text-[15px] font-semibold leading-tight text-stone-700"
            ></div>
            <div
              class="flex items-center justify-center gap-1.5 text-[11px] text-stone-600 font-inter"
            >
              <span data-cx-summary="event-weekday"></span>
              <!-- Không có giờ thì cả dấu · lẫn giờ cùng ẩn (data-cx-summary-row) -->
              <span data-cx-summary-row class="hidden flex items-center gap-1.5">
                <span class="text-stone-400">·</span>
                <span data-cx-summary="event-time"></span>
              </span>
            </div>
            <div
              data-cx-summary-row
              class="hidden flex items-center justify-center gap-1 text-[11px] text-stone-600 font-inter"
            >
              <i class="fas fa-map-marker-alt text-rose-pastel-300 text-[9px]"></i>
              <span data-cx-summary="event-location" class="line-clamp-2"></span>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  // Tay nắm: vuốt lên thu thanh về bong bóng, vuốt xuống mở khối tóm tắt bên
  // trên. Rộng hết khối cho dễ vuốt; helper lo cử chỉ. Bản `inline` không có
  // bong bóng — helper tự tắt việc thu gọn khi thiếu bong bóng (canCollapse),
  // nên tay nắm ở đó chỉ còn nhiệm vụ mở khối tóm tắt.
  const handle = `
    <button
      type="button"
      data-cx-music="handle"
      aria-label="Vuốt xuống để xem tóm tắt thiệp, vuốt lên để thu gọn trình phát nhạc"
      class="cx-mp-handle w-full h-4 flex items-center justify-center cursor-grab active:cursor-grabbing"
    >
      <span class="w-8 h-1 rounded-full bg-white/70"></span>
    </button>`;

  // Bong bóng: chỉ hiện khi đã thu gọn. Kéo đi khắp màn hình, thả tay thì tự
  // bay về bám lề; CHẠM (không kéo) = mở lại thanh. Neo sẵn bên phải, helper
  // ghi đè left/top khi bị kéo. Bên trong chỉ có ảnh bìa bài hát, nốt nhạc là
  // nền dự phòng khi chưa có ảnh.
  const bubble = `
    <button
      type="button"
      data-cx-music="bubble"
      aria-label="Mở lại thanh nhạc"
      class="cx-mp-bubble fixed right-3 top-24 w-9 h-9 rounded-full shadow-[0_8px_24px_rgba(120,70,80,0.4)] ring-2 ring-white/70 bg-gradient-to-br from-rose-pastel-200 to-rose-pastel-300 items-center justify-center cursor-grab active:cursor-grabbing"
    >
      <i class="cx-mp-note fas fa-music text-white text-[10px]"></i>
      <!-- cx-mp-spin: quay tròn khi đang phát -->
      <img
        data-cx-music="thumb"
        alt=""
        hidden
        class="cx-mp-spin absolute inset-0 w-full h-full rounded-full object-cover"
      />
    </button>`;

  // ── Hai mẫu gọn: NÚT TRÒN và THẺ NHẠC ─────────────────────────────────────
  // Khác bản thanh ngang ở chỗ dùng class TỰ VIẾT .cx-mw-* (styles/_music-player.css)
  // với mọi kích thước bên trong tính bằng `em`: runtime đặt font-size theo bề
  // ngang thật nên kéo to nhỏ là cả widget phóng theo tỉ lệ. Icon là SVG inline
  // để không phụ thuộc Font Awesome.
  const SVG = {
    note: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M13 2 6 3.6v6.6a2.2 2.2 0 1 0 1.2 1.9V6l4.6-1v3.6a2.2 2.2 0 1 0 1.2 1.9z"/></svg>',
    play: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>',
    pause:
      '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z"/></svg>',
    back: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 8V3L1 8l7 5zm7 0V3L8 8l7 5z"/></svg>',
    forward:
      '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 8v5l7-5-7-5zm-7 0v5l7-5-7-5z"/></svg>',
  };

  const artNote = (cls) =>
    '<span class="cx-mw-art ' +
    cls +
    '"><span class="cx-mw-note cx-mp-note">' +
    SVG.note +
    '</span><img data-cx-music="thumb" alt="" hidden class="cx-mp-spin" /></span>';

  // Nút phát của hai mẫu gọn: hai icon chồng nhau, CSS chọn cái nào hiện theo
  // .is-playing trên thẻ root. Cố ý KHÔNG dùng data-cx-play-icon/pause-icon
  // (cách đổi class icon của Font Awesome) — hai mẫu này phải chạy được cả ở
  // theme không nạp Font Awesome.
  const playBtn = (cls) =>
    '<button type="button" data-cx-music="toggle" aria-label="Phát hoặc tạm dừng nhạc nền" class="' +
    cls +
    '"><span class="cx-mw-ic-play">' +
    SVG.play +
    '</span><span class="cx-mw-ic-pause">' +
    SVG.pause +
    "</span></button>";

  const seekBtn = (which) =>
    '<button type="button" data-cx-music="' +
    which +
    '" aria-label="' +
    (which === "back" ? "Lùi 10 giây" : "Tới 10 giây") +
    '" class="cx-mw-btn">' +
    SVG[which] +
    "</button>";

  const miniBody = `
    <button type="button" data-cx-music="toggle" class="cx-mw-mini-btn" aria-label="Phát hoặc tạm dừng nhạc nền">
      ${artNote("cx-mw-art-round")}
      <span class="cx-mw-mini-ic">
        <span class="cx-mw-ic-play">${SVG.play}</span>
        <span class="cx-mw-ic-pause">${SVG.pause}</span>
      </span>
    </button>`;

  const cardBody = `
    <span class="cx-mw-cover">${artNote("cx-mw-art-cover")}</span>
    <span class="cx-mw-titlewrap"><span class="cx-mw-title cx-mp-title" data-cx-music="title">Nhạc nền</span></span>
    <span class="cx-mw-artist" data-cx-music="artist"></span>
    <span class="cx-mw-prog cx-mp-prog" data-cx-music="progress">
      <span class="cx-mw-fill cx-mp-fill" data-cx-music="fill"></span>
    </span>
    <span class="cx-mw-times"><span data-cx-music="time">0:00</span><span data-cx-music="duration">0:00</span></span>
    <span class="cx-mw-ctrls">
      ${seekBtn("back")}
      ${playBtn("cx-mw-btn cx-mw-btn-main")}
      ${seekBtn("forward")}
    </span>`;

  /**
   * Dựng trình phát nhạc.
   * @param {Object} [opts]
   * @param {"bar"|"mini"|"card"} [opts.variant="bar"] Mẫu hiển thị.
   * @param {"fixed-top"|"inline"} [opts.chrome="inline"]
   *        fixed-top = thanh neo đỉnh màn hình + bong bóng thu gọn (trang thiệp);
   *        inline    = khối trần, người dùng tự đặt chỗ (panel Thành phần).
   * @param {boolean} [opts.summary]
   *        Có khối tóm tắt thiệp (kéo tay nắm xuống) hay không. Mặc định:
   *        fixed-top luôn có; inline chỉ có khi theme thật sự cung cấp dữ liệu
   *        tóm tắt (window.__cxMusicSummary do renderMusicSummary đặt) — không
   *        thì bày ra một khối rỗng.
   * @param {number} [opts.revealOnScroll=64] Chỉ dùng cho fixed-top: hiện khi
   *        đã cuộn quá N px. Truyền 0 để luôn hiện.
   * @returns {HTMLElement} thẻ gốc, đã gắn sẵn các vai trò data-cx-music.
   */
  function build(opts) {
    const o = opts || {};
    const variant = o.variant || "bar";
    const fixed = o.chrome === "fixed-top";

    const node = document.createElement("div");
    node.setAttribute("data-cx-music", "root");
    node.setAttribute("data-cx-seek", "10");
    node.setAttribute("data-cx-empty-title", "Nhạc nền");

    if (variant === "mini" || variant === "card") {
      // Hai mẫu gọn không có bản fixed-top: chúng sinh ra để thả lên thiệp.
      node.className = variant === "mini" ? "cx-mw cx-mw-mini" : "cx-mw cx-mw-card";
      node.innerHTML = variant === "mini" ? miniBody : cardBody;
      return node;
    }

    // ── Mẫu thanh ngang ──
    // Giữ id="music-toggle" vì setupMusic() (render-helper.js) ẩn/hiện theo id
    // này (display:none / flex) — nên thẻ phải là flex-col.
    // Cố ý KHÔNG đặt id="music-icon" (icon của nút tròn kiểu cũ) để
    // updateMusicIcon() dùng chung không ghi đè icon của thẻ này.
    // .cx-no-edit để runtime chỉnh-tay của tab Giao diện bỏ qua thẻ này.
    // Canh giữa bằng inset-x-0 + mx-auto chứ KHÔNG dùng -translate-x-1/2: tổ
    // tiên có transform sẽ thành containing block, bong bóng `fixed` bên trong
    // sẽ neo theo thẻ này thay vì theo màn hình → kéo thả sai chỗ.
    node.setAttribute("data-cx-play-icon", "fas fa-play ml-px");
    node.setAttribute("data-cx-pause-icon", "fas fa-pause");

    const withSummary = o.summary != null ? o.summary : fixed || !!window.__cxMusicSummary;

    if (fixed) {
      node.id = "music-toggle";
      node.className =
        "cx-mp cx-mp-fixed-top cx-no-edit fixed top-0 inset-x-0 mx-auto z-[60] w-full max-w-[430px] md:max-w-[768px] flex-col px-2 md:px-3";
      node.style.display = "none"; // setupMusic() bật lên khi thiệp có nhạc
      const reveal = o.revealOnScroll == null ? 64 : o.revealOnScroll;
      if (reveal) node.setAttribute("data-cx-reveal-on-scroll", String(reveal));
    } else {
      node.className = "cx-mp w-full flex flex-col";
    }

    // .cx-mp-bar = thanh trên đỉnh. LUÔN đứng yên ở đó, không kéo được; vuốt
    // lên tay nắm thì nó ẩn đi và bong bóng bên dưới hiện ra.
    const barCls = fixed
      ? "cx-mp-bar mt-2 rounded-2xl overflow-hidden shadow-lg backdrop-blur-md bg-gradient-to-r from-rose-pastel-100/95 to-rose-pastel-200/95"
      : "cx-mp-bar rounded-2xl overflow-hidden shadow-lg backdrop-blur-md bg-gradient-to-r from-rose-pastel-100/95 to-rose-pastel-200/95";

    node.innerHTML =
      '<div class="' +
      barCls +
      '">' +
      barRow +
      (withSummary ? summaryPanel + handle : "") +
      "</div>" +
      (fixed ? bubble : "");

    return node;
  }

  window.CXMusicPlayer = { build };
})();
