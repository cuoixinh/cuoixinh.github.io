// ============= THEME: MOODY CINEMATIC =============
// Hiện đại, nền SÁNG: chữ xám trầm, nhấn xanh than. Chất điện ảnh dồn vào ẢNH —
// mọi ảnh lớn bọc trong .mc-cine (hai thanh đen giả tỉ lệ màn ảnh rộng).
// Đủ mọi mục như mẫu nền; nét riêng là album dựng thành DẢI PHIM cuộn ngang.
//
// File này chỉ KHAI BÁO: window.CX_THEME + renderWedding + phần đặc thù của mẫu
// (ở đây là dải phim). Phần "chạy" nằm ở core/helpers/theme-boot.js, nạp sau.
//
// Bọc trong IIFE, chỉ lộ CX_THEME + renderWedding: `const` cấp cao nhất của
// script cổ điển là biến toàn cục, trùng tên với trang khác là vỡ trang đó.

(function () {
  window.CX_THEME = {
    // Trùng TÊN THƯ MỤC và cột `templates.template_name`.
    id: "moody-cinematic",

    // Font/màu GỐC: giá trị mặc định trên thanh chỉnh ở tab Giao diện, cũng là
    // điểm "Khôi phục mặc định". Trang Thiết lập đọc qua iframe xem trước.
    preset: {
      heading_font: "Prata",
      body_font: "Montserrat",
      heading_color: "#1e252e", // xám trầm
      body_color: "#6a7380",
      accent_color: "#2a3d58", // xanh than sâu
      background_color: "#ffffff",
      // Màu gợi ý — lấy từ chính bảng màu của mẫu: các nấc xám trung tính và
      // xanh than, không có màu rực để giữ tông trầm.
      swatches: [
        "#1e252e",
        "#3a434f",
        "#6a7380",
        "#9aa3ad",
        "#2a3d58",
        "#3f5273",
        "#7c8ca3",
        "#dbdfe6",
        "#f2f4f7",
        "#f8f9fb",
        "#ffffff",
      ],
    },

    // Class mà thanh chỉnh font/màu nhắm tới. Mẫu gom về ba lớp ngữ nghĩa
    // (.cx-h tiêu đề · .cx-t nội dung · .cx-a nhấn, khai trong theme.css).
    // .cx-hd/.cx-bd/.cx-ac là markup do helper dùng chung sinh ra (dòng thời
    // gian, chuyện tình yêu) — GIỮ NGUYÊN.
    // .mc-eyebrow cố ý ĐỨNG NGOÀI: nhãn chữ hoa giãn rộng là nét nhận dạng của
    // mẫu, đổi màu theo nhấn thì vẫn hợp, nhưng đổi font thì mất chất.
    selectors: {
      headingFont: ".cx-h",
      bodyFont: "body, .cx-t",
      headingColor: ".cx-h, .cx-hd",
      bodyColor: ".cx-t, .cx-bd",
      accentColor: ".cx-a, .cx-ac, .mc-eyebrow",
      background: "body, #main-card",
    },

    // Thiệp là dải trang lật NGANG, mỗi trang hiện trọn vẹn một lần → không
    // dùng hiệu ứng trượt-khi-cuộn. Selector cố tình không khớp gì (theme-boot
    // vẫn cần một danh sách khác rỗng để querySelectorAll).
    reveal: ["#cx-no-reveal"],

    // Thư mời và Gia đình không còn là mục riêng — cả hai nằm trong trang
    // #section-hero, nên phải chỉ lại cho khung xem trực tiếp biết cuộn tới đâu.
    focus: {
      ceremony: ["#section-hero"],
      family: ["#section-family", "#section-hero"],
    },

    // Dựng quyển sách SAU khi #main-card hiện: trước đó thẻ còn display:none
    // nên mọi phép đo chiều cao đều ra 0.
    onOpen: () => {
      setupBook();
      refreshBook();
    },
  };

  const _isGroom = isGroomSide();

  // ============= ĐỔ DỮ LIỆU LÊN THIỆP =============
  // Gọi theo đúng thứ tự các mục trong index.html.

  function renderWedding(w) {
    if (!w || !w.is_active) return;

    const side = _isGroom ? "groom" : "bride";

    // --- Màn bìa ---
    // Khối dựng ảnh chạy TRƯỚC setupMusic: đây là chỗ ảnh của màn ĐẦU TIÊN nhận
    // src, mà setupMusic kéo YouTube iframe API (script bên thứ ba) về ngay khi
    // chạy — để nó đi trước là ảnh phải xếp hàng sau.
    renderCover(w);

    // --- Mở đầu ---
    renderHero(w, false);
    renderStoryQuote(w.story_quote);

    // Ảnh NỀN của dải gia đình: lấy tấm ĐẦU trong album. Không dùng lại ảnh bìa
    // vì tấm đó đã chiếm trọn bề ngang ngay trên đầu cùng trang. Không có ảnh thì
    // khỏi làm gì: lớp phủ đen của dải giữ nguyên nền tối, bố cục không đổi.
    const firstPhoto = w.gallery_images?.[0];
    if (firstPhoto) {
      setAttr("family-photo", "src", getImageUrl(firstPhoto));
      applyFocalPoint("family-photo", w.image_focal_points?.gallery_images?.[firstPhoto]);
    }

    // --- Nhạc nền ---
    setupMusic(w.music_url, w.enable_music);

    // --- Gia đình ---
    renderCoupleInfo(w);
    // Địa chỉ hai nhà là dòng phụ, không bắt buộc: chưa nhập thì ẩn hẳn ô,
    // nếu không setText để lại một dãy gạch ngang giữa dải gia đình.
    cxToggle("groom-address", !!w.groom_address);
    cxToggle("bride-address", !!w.bride_address);
    cxToggle("section-family", cxEnabled(w.enable_family));

    // --- Thư mời: nhà gái bật Vu Quy thì thay toàn bộ phần lễ ---
    const isVuQuy = !_isGroom && cxEnabled(w.vu_quy_enabled);
    const ceremonyName = isVuQuy ? "Lễ Vu Quy" : w.ceremony_name || "Lễ Thành Hôn";
    const ceremonyTime = isVuQuy ? w.vu_quy_time : w.ceremony_time;
    const ceremonyLoc = isVuQuy ? w.vu_quy_location : w.ceremony_location || "";

    setText("invite-groom", w.groom_name, "----------");
    setText("invite-bride", w.bride_name, "----------");
    setText("ceremony-event-name", ceremonyName);
    renderCeremonyDate(w.ceremony_date, ceremonyTime, w.ceremony_lunar);
    if (ceremonyLoc) {
      setText("ceremony-location-text", ceremonyLoc);
      cxToggle("ceremony-location-wrap", true);
    }

    // Khối tóm tắt trong trình phát nhạc (kéo tay nắm xuống mới thấy) — dùng
    // CHÍNH phần lễ đang hiển thị để nhà gái bật Vu Quy thì tóm tắt cũng đổi.
    renderMusicSummary(w, {
      ceremonyName,
      ceremonyTime,
      ceremonyLocation: ceremonyLoc,
    });

    // --- Tiệc cưới (mỗi nhà một ngày/giờ/nơi riêng) ---
    const partyDate = w[`${side}_party_date`];
    const partyLocation = w[`${side}_party_location`];
    setText("party-section-label", "Tiệc Mừng " + ceremonyName);
    renderPartyDate(
      partyDate,
      w[`${side}_party_time`],
      w[`${side}_party_lunar`],
      partyLocation,
      "full",
    );
    cxToggle("section-party", cxEnabled(w.enable_party));

    // Ảnh của tờ lịch: lấy tấm THỨ HAI trong album (tấm đầu đã dùng ở dải gia
    // đình) để hai chỗ không lặp cùng một ảnh; hết ảnh thì lùi dần về tấm đầu
    // rồi về ảnh bìa, luôn có gì đó để hiện. Trích dẫn trên ảnh là chữ TRANG
    // TRÍ fix cứng trong index.html, không phải dữ liệu thiệp.
    const calPhoto = w.gallery_images?.[1] || w.gallery_images?.[0];
    if (calPhoto) {
      setAttr("calendar-photo", "src", getImageUrl(calPhoto));
      applyFocalPoint("calendar-photo", w.image_focal_points?.gallery_images?.[calPhoto]);
    } else if (w.cover_image_url) {
      setAttr("calendar-photo", "src", getImageUrl(w.cover_image_url));
      applyFocalPoint("calendar-photo", w.image_focal_points?.cover_image_url);
    }

    // Lịch nhỏ đánh dấu ngày lễ + ngày tiệc
    setupMiniCalendar(w.ceremony_date, partyDate);

    // --- Xác nhận tham dự ---
    const rsvp = document.getElementById("rsvp-section");
    if (rsvp) rsvp.style.display = cxEnabled(w.rsvp_enabled) ? "flex" : "none";
    if (w.rsvp_message) {
      const msg = document.getElementById("rsvp-custom-message");
      if (msg) {
        msg.textContent = w.rsvp_message;
        msg.classList.remove("hidden");
      }
    }

    // --- Lịch trình ngày cưới ---
    if (cxEnabled(w.enable_timeline)) {
      renderTimeline(w.timeline, side, partyDate, w.ceremony_date, ceremonyName);
      cxToggle("section-timeline", true);
    }

    // --- Chuyện tình yêu (trang báo — hàm riêng của mẫu) ---
    if (cxEnabled(w.enable_love_story)) {
      renderStoryPost(w.love_story);
    } else {
      cxToggle("love-story", false);
    }

    // --- Album ảnh ---
    if (cxEnabled(w.enable_photos)) {
      renderGallery(w.gallery_images, w.image_focal_points?.gallery_images);
    } else {
      cxToggle("section-photos", false);
    }

    // --- Hộp mừng cưới ---
    renderQRCodes(w);
    cxToggle("section-gift", cxEnabled(w.enable_gift));

    // --- Bản đồ tới nơi đãi tiệc ---
    // Chưa có URL thì hiện minh hoạ thay cho iframe trắng và khoá luôn nút.
    const mapUrl = w[`${side}_party_map_embed_url`];
    renderMap(mapUrl, partyLocation);
    const hasMap = !!extractMapEmbedUrl(mapUrl);
    cxToggle("map-thumbnail-iframe", hasMap);
    cxToggle("map-placeholder", !hasMap);
    document
      .getElementById("map-link")
      ?.classList.toggle("pointer-events-none", !hasMap);

    // --- Lời cảm ơn ---
    if (w.footer_text) setText("footer-text", w.footer_text);
    cxToggle("section-footer", cxEnabled(w.enable_footer));

    // Các mục vừa bật/tắt và các trang vừa sinh thêm → dựng lại dải trang.
    // Khách bấm mở bìa trước khi dữ liệu về thì onOpen đã chạy rồi, nên phép
    // đo phải chạy lại ở đây chứ không chỉ ở onOpen.
    refreshBook();
  }

  window.renderWedding = renderWedding;

  // ============= QUYỂN SÁCH — DẢI TRANG LẬT NGANG (nét riêng của mẫu) =============
  // Cả thiệp là MỘT khung cuộn ngang (#cx-pages): mỗi <section> con thành một
  // trang rộng và cao đúng khổ thiệp. Ba việc:
  //   1. Bọc nội dung từng trang vào .mc-page-in rồi THU NHỎ nếu nó cao hơn
  //      trang — bảo đảm không trang nào dài quá màn hình.
  //   2. Đổi cú vuốt/lăn DỌC thành lật trang: xuống → sang phải, lên → trái.
  //   3. Cập nhật chỉ báo trang + hai nút lật.
  // Chạy trong CX_THEME.onOpen (sau khi #main-card hiện) vì mọi phép đo cần
  // thẻ đã có kích thước thật.

  const FLIP_MS = 420; // khoá lật trang: một cú lăn = một trang
  const SWIPE_PX = 40; // ngưỡng vuốt dọc mới tính là lật trang

  // setupBook() gán vào đây để refreshBook() dùng lại đúng phép đo đó.
  let _syncPager = () => {};

  function setupBook() {
    const pages = document.getElementById("cx-pages");
    if (!pages || pages.dataset.book === "1") return;
    pages.dataset.book = "1";

    Array.from(pages.children).forEach(_toPage);

    const dots = document.getElementById("cx-dots");
    const pageNo = document.getElementById("cx-page-no");
    const prev = document.getElementById("cx-prev");
    const next = document.getElementById("cx-next");

    // Mục bị tắt (cxToggle) không chiếm chỗ trong dải → không tính là trang.
    const shown = () =>
      Array.from(pages.children).filter((el) => el.offsetParent !== null);
    const index = () =>
      pages.clientWidth ? Math.round(pages.scrollLeft / pages.clientWidth) : 0;

    function goTo(i) {
      const max = shown().length - 1;
      const t = Math.max(0, Math.min(max, i));
      pages.scrollTo({ left: t * pages.clientWidth, behavior: "smooth" });
    }

    _syncPager = syncPager;
    function syncPager() {
      const total = shown().length;
      const i = Math.min(index(), total - 1);
      if (dots && dots.children.length !== total) {
        dots.innerHTML = Array(total)
          .fill('<span class="mc-book-dot"></span>')
          .join("");
      }
      if (dots) {
        Array.from(dots.children).forEach((d, k) =>
          d.classList.toggle("is-on", k === i),
        );
      }
      if (pageNo) {
        pageNo.textContent =
          String(i + 1).padStart(2, "0") + " / " + String(total).padStart(2, "0");
      }
      if (prev) prev.disabled = i <= 0;
      if (next) next.disabled = i >= total - 1;
    }

    // --- Lăn chuột / trackpad: dọc thành ngang ---
    let lockUntil = 0;
    pages.addEventListener(
      "wheel",
      (e) => {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // cuộn ngang thật
        e.preventDefault();
        if (Math.abs(e.deltaY) < 4 || Date.now() < lockUntil) return;
        lockUntil = Date.now() + FLIP_MS;
        goTo(index() + (e.deltaY > 0 ? 1 : -1));
      },
      { passive: false },
    );

    // --- Chạm: kéo ngón LÊN (tức cuộn xuống) là sang phải, kéo XUỐNG là sang
    // trái. Vuốt ngang vẫn để trình duyệt tự cuộn theo scroll-snap.
    let sx = 0;
    let sy = 0;
    pages.addEventListener(
      "touchstart",
      (e) => {
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
      },
      { passive: true },
    );
    pages.addEventListener("touchend", (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dy) < SWIPE_PX || Math.abs(dy) <= Math.abs(dx)) return;
      goTo(index() + (dy < 0 ? 1 : -1));
    });

    // --- Bàn phím + hai nút lật ---
    document.addEventListener("keydown", (e) => {
      const lb = document.getElementById("lightbox");
      if (lb && !lb.classList.contains("hidden")) return; // đang phóng to ảnh
      if (["ArrowRight", "ArrowDown", "PageDown"].includes(e.key)) goTo(index() + 1);
      else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) goTo(index() - 1);
    });
    prev?.addEventListener("click", () => goTo(index() - 1));
    next?.addEventListener("click", () => goTo(index() + 1));

    let ticking = false;
    pages.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          syncPager();
        });
      },
      { passive: true },
    );
    // Xoay máy / đổi khổ cửa sổ: chia lại trang chứ không chỉ đo lại, chiều
    // cao khả dụng đổi thì số mục vừa một trang cũng đổi.
    let rz;
    window.addEventListener("resize", () => {
      clearTimeout(rz);
      rz = setTimeout(refreshBook, 150);
    });

    refreshBook();
  }

  // Chạy lại được: dữ liệu về sau khi khách đã mở thiệp thì các trang do
  // renderStoryPost()/renderGallery() sinh thêm mới xuất hiện, phải biến
  // chúng thành trang và đo lại. Gọi cuối renderWedding và trong onOpen.
  function refreshBook() {
    const pages = document.getElementById("cx-pages");
    if (!pages) return;
    Array.from(pages.children).forEach(_toPage);
    _syncGroupPages();
    _reflowFlows();
    Array.from(pages.children).forEach(_fitPage);
    _syncPager();
  }

  // Trang gộp nhiều mục ([data-cx-group]): cả hai mục bên trong cùng bị tắt
  // thì trang phải biến mất, nếu không khách vuốt trúng một trang trắng.
  function _syncGroupPages() {
    document.querySelectorAll("#cx-pages [data-cx-group]").forEach((page) => {
      const live = Array.from(page.querySelectorAll("section")).some(
        (sec) =>
          !sec.classList.contains("hidden") && sec.style.display !== "none",
      );
      page.classList.toggle("hidden", !live);
    });
  }

  // ── Dồn trang ───────────────────────────────────────────────────────────
  // Mục có danh sách dài (chuyện tình yêu, album) khai [data-cx-flow] trên thẻ
  // chứa danh sách: nhét đầy trang rồi mới đẩy phần dư sang trang kế, thay vì
  // chia cứng mỗi mục/ảnh một trang (chia cứng thì trang nào cũng thừa chỗ).
  // Đo bằng DOM thật nên chỉ chạy được khi #main-card đã hiện.

  function _reflowFlows() {
    document.querySelectorAll("#cx-pages [data-cx-flow]").forEach((host) => {
      const page = host.closest("section.mc-page");
      if (page && !page.dataset.cxSpill) _flowPaginate(host, page);
    });
  }

  function _flowPaginate(host, page) {
    const inner = page.querySelector(":scope > .mc-page-in");
    if (!inner || !page.clientHeight) return;

    // Gom mọi thứ về trang gốc trước đã: lần chạy trước có thể đã chia theo
    // một chiều cao khác (xoay máy, ảnh về muộn).
    let n = page.nextElementSibling;
    while (n && n.dataset.cxSpill === host.id) {
      const nx = n.nextElementSibling;
      n.querySelectorAll("[data-cx-flow]").forEach((h) => {
        while (h.firstChild) host.appendChild(h.firstChild);
      });
      n.remove();
      n = nx;
    }

    const cs = getComputedStyle(page);
    const avail =
      page.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (!avail) return;

    let curInner = inner;
    let curHost = host;
    let after = page;
    let guard = 0;

    while (
      curInner.scrollHeight > avail &&
      curHost.children.length > 1 &&
      guard++ < 50
    ) {
      const sec = document.createElement("section");
      sec.className = "mc-page";
      sec.dataset.cxSpill = host.id;
      const si = document.createElement("div");
      si.className = inner.className;
      const sh = document.createElement("div");
      sh.className = host.className;
      sh.dataset.cxFlow = "";
      si.appendChild(sh);
      sec.appendChild(si);
      after.after(sec);

      // Đẩy dần phần tử cuối sang trang mới cho tới khi trang này vừa khít.
      while (curInner.scrollHeight > avail && curHost.children.length > 1) {
        sh.prepend(curHost.lastElementChild);
      }

      curInner = si;
      curHost = sh;
      after = sec;
    }
  }

  // Biến một <section> thành trang: class bố cục của section chuyển xuống thẻ
  // TRONG (thứ được thu nhỏ), section chỉ còn vai trò khung trang. Giữ lại cờ
  // .hidden để cxToggle() vẫn ẩn/hiện được mục.
  function _toPage(sec) {
    if (sec.classList.contains("mc-page")) return;
    const hidden = sec.classList.contains("hidden");
    const inner = document.createElement("div");
    inner.className =
      "mc-page-in " +
      Array.from(sec.classList)
        .filter((c) => c !== "hidden")
        .join(" ");
    while (sec.firstChild) inner.appendChild(sec.firstChild);
    sec.className = "mc-page" + (hidden ? " hidden" : "");
    sec.appendChild(inner);

    // Ảnh về sau làm nội dung cao lên → đo lại. ResizeObserver an toàn ở đây
    // vì phép thu nhỏ dùng transform, không đổi layout nên không tự kích lại.
    if (window.ResizeObserver) {
      new ResizeObserver(() => _fitPage(sec)).observe(inner);
    }
  }

  // Thu nhỏ nội dung cho vừa chiều cao trang. Sàn 0.5: dưới mức đó chữ không
  // còn đọc nổi, thà để tràn (khách còn phóng to được) hơn là thành vệt mờ.
  function _fitPage(sec) {
    const inner = sec.querySelector(":scope > .mc-page-in");
    if (!inner || !sec.clientHeight) return;
    const cs = getComputedStyle(sec);
    const avail =
      sec.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const need = inner.scrollHeight;
    if (!need || !avail) return;
    const k = Math.max(0.5, Math.min(1, avail / need));
    inner.style.transform = k < 0.999 ? "scale(" + k + ")" : "";
  }

  // ============= CHUYỆN TÌNH YÊU — TRANG BÁO (phần đặc thù của mẫu) =============
  // Thay renderLoveStory() chung: mỗi mốc thành một "bài báo" — dateline, tít,
  // chữ chia hai cột căn đều, ảnh kèm chú thích. Class .mc-* khai trong
  // theme.css. Bài lẻ nhận .mc-post-item--lead để ảnh nhảy lên trên tít.

  function renderStoryPost(events) {
    const section = document.getElementById("love-story");
    const list = document.getElementById("love-story-list");
    if (!section || !list) return;

    if (!Array.isArray(events) || events.length === 0) {
      section.style.display = "none";
      return;
    }
    section.style.display = "";

    // Đổ hết vào một dòng chảy; _flowPaginate() nhét đầy trang rồi mới sang
    // trang kế, nên số mốc mỗi trang tuỳ vào chúng dài ngắn thế nào.
    list.innerHTML = events.map(_storyArticle).join("");
  }

  function _storyArticle(ev, i) {
    const img = ev.image_url ? getImageUrl(ev.image_url) : null;
    const fp = ev.focal_point;
    const pos = fp ? ` style="object-position:${fp.x}% ${fp.y}%"` : "";
    // Ảnh nằm trong #main-card (display:none lúc chưa mở bìa) nên KHÔNG lazy.
    const figure = img
      ? `<figure class="mc-post-figure">
           <div class="mc-cine mc-cine-sm w-full aspect-[16/9]">
             <img src="${img}" alt=""${pos} class="w-full h-full object-cover" />
           </div>
         </figure>`
      : "";

    return `
    <article class="mc-story-page${i === 0 ? " mc-story-page--first" : ""}">
      <div class="mc-post-dateline">${escapeHtml(ev.date || "Chuyện của chúng mình")}</div>
      ${ev.title ? `<h3 class="cx-h mc-post-title">${escapeHtml(ev.title)}</h3>` : ""}
      ${figure}
      ${ev.content ? `<div class="cx-t mc-post-body">${escapeHtml(ev.content)}</div>` : ""}
    </article>`;
  }

  // ============= ALBUM ẢNH — LƯỚI KHUÔN HÌNH (phần đặc thù của mẫu) =============
  // Lưới 2 cột, mỗi khung đánh số như số khuôn hình. Lưới khai [data-cx-flow]
  // nên ảnh dư tự sang trang sau, vừa đúng chỗ trống của trang.
  // Bấm một khung thì mở lightbox dùng chung — điều kiện duy nhất là đổ đúng
  // thứ tự ảnh vào lightboxImages rồi gọi openLightbox(i).

  function renderGallery(images, focalPoints) {
    const strip = document.getElementById("gallery-grid");
    if (!strip) return;

    // Chưa có ảnh → 4 khung minh hoạ, để khách hình dung bố cục lúc đang soạn.
    const urls = images?.length
      ? images.map(getImageUrl)
      : Array(4)
          .fill(null)
          .map(() => createPlaceholderSVG("Chưa có ảnh"));

    // Kho ảnh của lightbox dùng chung — phải khớp thứ tự với dải phim.
    lightboxImages.length = 0;
    lightboxImages.push(...urls);

    // Ảnh nằm trong #main-card (đang display:none lúc chưa mở bìa) nên KHÔNG
    // đặt loading="lazy": ảnh lazy sẽ chỉ bắt đầu tải khi bìa mở ra.
    const frame = (url, i) => {
      const fp = focalPoints?.[images?.[i]];
      const el = document.createElement("div");
      el.className = "mc-frame mc-cine aspect-[16/9]";
      el.innerHTML = `<img src="${url}" alt=""
        class="w-full h-full object-cover"
        style="object-position:${fp?.x ?? 50}% ${fp?.y ?? 50}%">
        <div class="mc-frame-no">${String(i + 1).padStart(2, "0")}</div>`;
      el.addEventListener("click", () => openLightbox(i));
      return el;
    };

    strip.innerHTML = "";
    urls.forEach((url, i) => strip.appendChild(frame(url, i)));
  }

  // ============= TỜ LỊCH: tháng lớn (trái) + lưới ngày (phải) =============
  // Ghi đè window.renderMiniCalendar của calendar-helper.js (nạp TRƯỚC file
  // này) thay vì sửa file dùng chung — helper vẫn giữ nguyên cho theme khác,
  // setupMiniCalendar() ở render-helper.js gọi renderMiniCalendar() qua biến
  // toàn cục nên tự nhặt đúng bản ghi đè này. Ngày đánh dấu vẫn lấy từ
  // window.weddingDates (updateWeddingDates() của helper gốc set trước).
  function renderCalendarCard() {
    const container = document.getElementById("mini-calendar");
    if (!container || !window.weddingDates?.length) return;

    const { year, month } = window.weddingDates[0];
    const markedDays = window.weddingDates.map((d) => d.day);
    const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    const dow = dayNames.map((d) => `<div class="mc-cal-dow">${d}</div>`).join("");
    const blanks = Array(firstDay).fill("<div></div>").join("");
    const cells = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const marked = markedDays.includes(day) ? " is-marked" : "";
      return `<div class="mc-cal-day${marked}">${day}</div>`;
    }).join("");

    container.innerHTML = `
      <div class="mc-cal-grid-wrap">
        <div class="mc-cal-month">
          <div class="cx-h">Tháng ${month}</div>
          <div class="cx-t mc-cal-year">${year}</div>
        </div>
        <div class="mc-cal-table">${dow}${blanks}${cells}</div>
      </div>`;
  }

  window.renderMiniCalendar = renderCalendarCard;
})();
