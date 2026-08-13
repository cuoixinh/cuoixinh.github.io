// Romantic Gold — thiệp đọc bằng cách LẬT NGANG như trang sách.
// Mỗi mục là một trang trong #cx-pages (flex row + scroll-snap của trình duyệt);
// trang dài thì tự cuộn dọc bên trong. Không dùng transform cho dải trang:
// tổ tiên có transform sẽ làm mọi thứ position:fixed (bong bóng nhạc, thành
// phần ghim, lightbox) neo sai chỗ.

const _weddingSlug = getSlugFromUrl();
const _isGroom = isGroomSide();
// Xem trực tiếp trong trình soạn thiệp tải lại iframe liên tục → bỏ hiệu ứng mở.
const _isLiveSource =
  new URLSearchParams(window.location.search).get("source") === "live";

// ============= TIỆN ÍCH =============

function _isEnabled(flag) {
  return flag !== false && flag !== "false";
}

// Chữ cái đầu của TÊN (từ cuối trong tên đầy đủ) — dùng cho monogram.
function _initial(name, fallback) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/);
  const last = parts[parts.length - 1] || "";
  return (last.charAt(0) || fallback).toUpperCase();
}

function _toggleEl(id, show) {
  const el = document.getElementById(id);
  if (!el) return;
  if (show) {
    el.classList.remove("hidden");
    if (el.style.display === "none") el.style.display = "";
  } else {
    el.classList.add("hidden");
  }
}

// ============= LẬT TRANG =============

// Danh sách trang đang HIỆN (mục tắt trong Thiết lập bị ẩn nên không tính).
function _cxPageList() {
  const track = document.getElementById("cx-pages");
  if (!track) return [];
  return Array.from(track.children).filter(
    (el) => getComputedStyle(el).display !== "none",
  );
}

function _cxPageIndex() {
  const track = document.getElementById("cx-pages");
  if (!track || !track.clientWidth) return 0;
  return Math.round(track.scrollLeft / track.clientWidth);
}

function cxPagerGoTo(i) {
  const track = document.getElementById("cx-pages");
  if (!track) return;
  const max = _cxPageList().length - 1;
  const idx = Math.max(0, Math.min(max, i));
  track.scrollTo({ left: idx * track.clientWidth, behavior: "smooth" });
}

function cxPagerStep(delta) {
  cxPagerGoTo(_cxPageIndex() + delta);
}

// Vẽ lại chấm trang + số trang + nút mũi tên. Gọi lại mỗi khi số trang đổi
// (bật/tắt mục ở Thiết lập, thêm khối văn bản).
function cxPagerRefresh() {
  const pages = _cxPageList();
  const dots = document.getElementById("cx-dots");
  const num = document.getElementById("cx-page-num");
  if (!pages.length || !dots) return;

  const cur = Math.min(_cxPageIndex(), pages.length - 1);

  if (dots.children.length !== pages.length) {
    dots.innerHTML = "";
    pages.forEach((_, i) => {
      const d = document.createElement("div");
      d.className =
        "h-1.5 rounded-full bg-gold-200 cursor-pointer transition-all duration-300";
      d.addEventListener("click", () => cxPagerGoTo(i));
      dots.appendChild(d);
    });
  }
  Array.from(dots.children).forEach((d, i) => {
    d.classList.toggle("w-5", i === cur);
    d.classList.toggle("bg-gold-400", i === cur);
    d.classList.toggle("w-1.5", i !== cur);
    d.classList.toggle("bg-gold-200", i !== cur);
  });

  if (num) num.textContent = `${cur + 1} / ${pages.length}`;

  const prev = document.getElementById("cx-nav-prev");
  const next = document.getElementById("cx-nav-next");
  if (prev) prev.disabled = cur === 0;
  if (next) next.disabled = cur >= pages.length - 1;

  _cxReveal(pages[cur]);
}

// Nội dung trang hiện dần so le khi trang được lật tới (chỉ chạy một lần/trang).
const _RV_HIDE = ["opacity-0", "translate-y-4"];
const _RV_MOVE = ["transition-all", "duration-500", "ease-out"];

function _cxReveal(page) {
  if (!page || page.dataset.cxRv === "1") return;
  // Thiệp còn ẩn sau màn bìa thì chưa ai thấy — để dành cho lúc mở.
  const card = document.getElementById("main-card");
  if (!card || card.style.display === "none") return;
  page.dataset.cxRv = "1";
  const inner = page.firstElementChild;
  if (!inner) return;
  Array.from(inner.children).forEach((el, i) => {
    el.classList.add(..._RV_MOVE, ..._RV_HIDE);
    setTimeout(() => el.classList.remove(..._RV_HIDE), 60 + i * 70);
  });
}

let _cxPagerReady = false;

function cxPagerInit() {
  if (_cxPagerReady) return;
  const track = document.getElementById("cx-pages");
  if (!track) return;
  _cxPagerReady = true;

  // Trang xem thử mẫu có thanh "Dùng mẫu này" neo đáy (core/utils.js) đè lên
  // chấm trang — đẩy cụm điều hướng lên trên nó.
  if (isPreviewMode() && !_isLiveSource) {
    const ui = document.getElementById("cx-pager-ui");
    if (ui) {
      ui.classList.remove("pb-4");
      ui.classList.add("pb-16");
    }
  }

  let tick = null;
  track.addEventListener(
    "scroll",
    () => {
      clearTimeout(tick);
      tick = setTimeout(cxPagerRefresh, 60);
    },
    { passive: true },
  );

  // Khối văn bản khách tự thêm được chèn vào dải sau khi render → đếm lại trang.
  new MutationObserver(() => cxPagerRefresh()).observe(track, {
    childList: true,
  });

  window.addEventListener("resize", () => cxPagerRefresh());

  document.addEventListener("keydown", (e) => {
    const lb = document.getElementById("lightbox");
    if (lb && !lb.classList.contains("hidden")) return;
    if (e.key === "ArrowRight") cxPagerStep(1);
    else if (e.key === "ArrowLeft") cxPagerStep(-1);
  });

  cxPagerRefresh();
}

// ============= MỞ THIỆP (RÈM HAI CÁNH) =============

// Thay hẳn openInvitation của wedding-helper thay vì bọc: helper đó fade màn bìa,
// chồng lên hiệu ứng rèm sẽ thành hai nhịp giật.
function cxOpenInvitation() {
  const cover = document.getElementById("cover-screen");
  const main = document.getElementById("main-card");
  if (!cover || !main) return;

  // Hiện thiệp TRƯỚC để nó lộ dần ra sau hai cánh rèm đang tách.
  main.style.display = "";
  main.style.opacity = "1";

  const finish = () => {
    cover.style.display = "none";
    cxPagerInit();
    cxPagerRefresh();
  };

  if (_isLiveSource) {
    finish();
    return;
  }

  const left = document.getElementById("cover-door-l");
  const right = document.getElementById("cover-door-r");
  const content = document.getElementById("cover-content");
  const seam = document.getElementById("cover-seam");
  if (!left || !right) {
    finish();
    return;
  }

  if (content) content.classList.add("opacity-0");
  if (seam) seam.classList.add("opacity-0");
  requestAnimationFrame(() => {
    left.classList.add("-translate-x-full");
    right.classList.add("translate-x-full");
  });
  setTimeout(finish, 1150);
}

window.openInvitation = cxOpenInvitation;

// ============= LỊCH TRÌNH =============

function renderTimeline(items, side, partyDate, ceremonyDate, ceremonyName) {
  const list = document.getElementById("timeline-list-render");
  if (!list) return;
  if (!Array.isArray(items) || items.length === 0) {
    list.innerHTML = "";
    return;
  }

  const relevant = items.filter((item) => {
    const t = item.type || "ceremony";
    if (t === "ceremony") return true;
    if (side === "groom" && t === "party") return true;
    if (side === "bride" && t === "bride-party") return true;
    return false;
  });
  if (relevant.length === 0) {
    list.innerHTML = "";
    return;
  }

  const _sort = (arr) =>
    [...arr].sort((a, b) =>
      !a.time ? 1 : !b.time ? -1 : a.time.localeCompare(b.time),
    );
  const partyItems = _sort(
    relevant.filter((i) => (i.type || "ceremony") !== "ceremony"),
  );
  const ceremonyItems = _sort(
    relevant.filter((i) => (i.type || "ceremony") === "ceremony"),
  );

  const _fmtDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr + "T00:00:00").toLocaleDateString("vi-VN", {
        weekday: "short",
        day: "numeric",
        month: "numeric",
        year: "numeric",
      });
    } catch (e) {
      return dateStr;
    }
  };

  const _group = (label, dateStr, groupItems) => {
    if (!groupItems.length) return "";
    const dateLabel = _fmtDate(dateStr);
    const rows = groupItems
      .map(
        (item, i) => `
        <div class="relative pl-4 ${i === groupItems.length - 1 ? "pb-1" : "pb-5"} text-left">
          <div class="absolute left-[-4px] top-1.5 w-[7px] h-[7px] rounded-full bg-[rgb(var(--timeline-dot-rgb))]"></div>
          <div class="font-inter text-[10px] tracking-[0.18em] text-gold-400 mb-1">${escapeHtml(item.time || "")}</div>
          <div class="font-cormorant text-[16px] text-charcoal leading-snug">${escapeHtml(item.title || "")}</div>
        </div>`,
      )
      .join("");
    return `
      <div class="mb-6 last:mb-0">
        <div class="flex items-baseline gap-2 mb-3">
          <span class="font-cinzel text-[10px] tracking-[0.25em] uppercase text-charcoal">${escapeHtml(label)}</span>
          ${dateLabel ? `<span class="font-inter text-[10px] text-stone-custom-400">· ${escapeHtml(dateLabel)}</span>` : ""}
        </div>
        <div class="flex flex-col border-l border-gold-200 ml-1">${rows}</div>
      </div>`;
  };

  list.innerHTML =
    _group("Tiệc cưới", partyDate, partyItems) +
    _group(ceremonyName || "Lễ Thành Hôn", ceremonyDate, ceremonyItems);
}

// ============= ALBUM (lưới kiểu trang sách ảnh) =============

function renderGallery(galleryImages, focalPoints) {
  const grid = document.getElementById("gallery-grid");
  if (!grid) return;

  const srcs = galleryImages?.length
    ? galleryImages.map(getImageUrl)
    : Array(4)
        .fill(null)
        .map(() => createPlaceholderSVG("Chưa có ảnh"));

  lightboxImages.length = 0;
  lightboxImages.push(...srcs);

  grid.innerHTML = srcs
    .map((src, i) => {
      const fp = focalPoints?.[galleryImages?.[i]];
      const pos = `${fp?.x ?? 50}% ${fp?.y ?? 50}%`;
      // Cứ 5 ô lại có một ô rộng cả hàng cho nhịp điệu đỡ đều đều.
      const shape =
        i % 5 === 0 ? "col-span-2 aspect-[16/10]" : "col-span-1 aspect-[3/4]";
      return `
        <div data-i="${i}" class="${shape} w-full overflow-hidden rounded-xl border border-gold-200 cursor-pointer">
          <img src="${src}" alt="" loading="lazy" class="w-full h-full object-cover"
               style="object-position:${pos}"${i === 0 ? ' id="gallery-first-image"' : ""} />
        </div>`;
    })
    .join("");

  grid.querySelectorAll("[data-i]").forEach((cell) => {
    cell.addEventListener("click", () => openLightbox(+cell.dataset.i));
  });
}

// ============= ĐẾM NGƯỢC =============

let _countdownTimer = null;

function startCountdown(ceremonyDate, ceremonyTime) {
  if (!ceremonyDate) return;
  const target = new Date(`${ceremonyDate}T${ceremonyTime || "00:00"}:00`);
  if (isNaN(target)) return;

  const tick = () => {
    const diff = target - new Date();
    const clamp = Math.max(0, diff);
    const days = Math.floor(clamp / 86400000);
    const hours = Math.floor((clamp % 86400000) / 3600000);
    const mins = Math.floor((clamp % 3600000) / 60000);
    setText("countdown-days", String(days).padStart(2, "0"));
    setText("countdown-hours", String(hours).padStart(2, "0"));
    setText("countdown-minutes", String(mins).padStart(2, "0"));
  };

  tick();
  clearInterval(_countdownTimer);
  _countdownTimer = setInterval(tick, 30000);
}

// ============= RENDER =============

function renderWedding(w) {
  if (!w || !w.is_active) return;

  const side = _isGroom ? "groom" : "bride";

  // --- NHẠC ---
  setupMusic(w.music_url, w.enable_music);

  // --- BÌA --- (cánh phải dùng chung ảnh với cánh trái)
  renderCover(w);
  const coverL = document.getElementById("cover-bg-img");
  const coverR = document.getElementById("cover-bg-img-r");
  if (coverL && coverR) {
    coverR.src = coverL.src;
    coverR.style.objectPosition = coverL.style.objectPosition;
  }

  // --- MỞ ĐẦU ---
  renderHero(w, false);
  setText("monogram-groom", _initial(w.groom_name, "A"));
  setText("monogram-bride", _initial(w.bride_name, "B"));
  if (w.ceremony_date) {
    const d = new Date(w.ceremony_date);
    setText(
      "hero-date",
      `${String(d.getDate()).padStart(2, "0")} · ${String(d.getMonth() + 1).padStart(2, "0")} · ${d.getFullYear()}`,
    );
  }

  // --- THÔNG TIN ĐÔI BÊN ---
  setText("invite-groom", w.groom_name, "----------");
  setText("invite-bride", w.bride_name, "----------");
  renderCoupleInfo(w);
  _toggleEl("section-family", _isEnabled(w.enable_family));

  // --- LỄ / VU QUY --- nhà gái bật vu_quy thì thay hẳn phần lễ
  const isVuQuy = !_isGroom && _isEnabled(w.vu_quy_enabled);
  const ceremonyName = isVuQuy
    ? "Lễ Vu Quy"
    : w.ceremony_name || "Lễ Thành Hôn";
  const displayTime = isVuQuy ? w.vu_quy_time : w.ceremony_time;
  const displayLoc = isVuQuy ? w.vu_quy_location : w.ceremony_location || "";

  renderMusicSummary(w, {
    ceremonyName,
    ceremonyTime: displayTime,
    ceremonyLocation: displayLoc,
  });

  setText("ceremony-event-name", ceremonyName);
  setText("party-section-label", "Tiệc mừng " + ceremonyName);
  renderCeremonyDate(w.ceremony_date, displayTime, w.ceremony_lunar);
  if (displayLoc) {
    setText("ceremony-location-text", displayLoc);
    _toggleEl("ceremony-location-wrap", true);
  }
  startCountdown(w.ceremony_date, displayTime);

  // --- TIỆC ---
  const partyDate = w[`${side}_party_date`];
  const partyLocation = w[`${side}_party_location`];
  renderPartyDate(
    partyDate,
    w[`${side}_party_time`],
    w[`${side}_party_lunar`],
    partyLocation,
    "full",
  );
  _toggleEl("section-party", _isEnabled(w.enable_party));

  // --- LỊCH NHỎ ---
  setupMiniCalendar(w.ceremony_date, partyDate);

  // --- XÁC NHẬN THAM DỰ ---
  const rsvpSection = document.getElementById("rsvp-section");
  if (rsvpSection)
    rsvpSection.style.display = _isEnabled(w.rsvp_enabled) ? "flex" : "none";
  if (w.rsvp_message) {
    const msgEl = document.getElementById("rsvp-custom-message");
    if (msgEl) {
      msgEl.textContent = w.rsvp_message;
      msgEl.classList.remove("hidden");
    }
  }

  // --- LỊCH TRÌNH ---
  if (_isEnabled(w.enable_timeline)) {
    renderTimeline(w.timeline, side, partyDate, w.ceremony_date, ceremonyName);
    _toggleEl("section-timeline", true);
  }

  // --- CHUYỆN TÌNH YÊU ---
  renderStoryQuote(w.story_quote);
  if (_isEnabled(w.enable_love_story)) {
    renderLoveStory(w.love_story);
  } else {
    _toggleEl("love-story", false);
  }

  // --- ALBUM ---
  if (_isEnabled(w.enable_photos)) {
    renderGallery(w.gallery_images, w.image_focal_points?.gallery_images);
  } else {
    _toggleEl("section-photos", false);
  }

  // --- MỪNG CƯỚI ---
  renderQRCodes(w);
  _toggleEl("section-gift", _isEnabled(w.enable_gift));

  // --- BẢN ĐỒ (địa điểm tiệc) ---
  const partyMapUrl = w[`${side}_party_map_embed_url`];
  const showMap = _isEnabled(w[`${side}_party_show_location`]);
  if (showMap) {
    renderMap(partyMapUrl, partyLocation);
    // Chưa có URL bản đồ → hiện minh hoạ dữ liệu trống thay cho iframe
    const hasMap = !!extractMapEmbedUrl(partyMapUrl);
    _toggleEl("map-thumbnail-iframe", hasMap);
    _toggleEl("map-placeholder", !hasMap);
    const mapLink = document.getElementById("map-link");
    if (mapLink) mapLink.classList.toggle("pointer-events-none", !hasMap);
  }
  _toggleEl("section-map", showMap);

  // --- CẢM ƠN ---
  _toggleEl("section-footer", _isEnabled(w.enable_footer));
  if (w.footer_text) setText("footer-text", w.footer_text);

  // Số trang có thể vừa đổi (mục bị tắt) → đếm lại chấm trang.
  cxPagerRefresh();
}

// ============= KHỞI ĐỘNG =============

loadWeddingData(_weddingSlug, renderWedding);

function _boot() {
  setupPersonalizedGreeting(_weddingSlug, _isGroom, cxOpenInvitation);
  // Link mời có tên khách → thiệp chờ bấm "Mở thiệp", nút mới cần fix chạm iOS.
  const openBtn = document.querySelector(".open-btn");
  if (openBtn) {
    openBtn.addEventListener(
      "touchend",
      (e) => {
        e.preventDefault();
        cxOpenInvitation();
      },
      { passive: false },
    );
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", _boot);
} else {
  _boot();
}

initViewportFix();
