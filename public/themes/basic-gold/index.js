// ============= THEME: BASIC GOLD =============
// Thiệp tông hồng khói, mở bằng màn bìa; thân thiệp dàn kiểu tạp chí (ảnh lệch
// trái/phải, chữ giãn rộng, nhãn Cinzel).
//
// File này chỉ KHAI BÁO: bản khai CX_THEME + renderWedding + phần đặc thù
// (album tạp chí, đếm ngược). Phần "chạy" (nạp dữ liệu, mở thiệp, hiệu ứng cuộn, viewport)
// nằm ở core/helpers/theme-boot.js, nạp sau file này. Nhờ vậy trang Thiết lập
// nạp lại file này chỉ để đọc CX_THEME mà không gây tác dụng phụ.
//
// Cả file bọc trong IIFE và chỉ lộ ra window.CX_THEME + window.renderWedding:
// `const` ở cấp cao nhất của một script cổ điển là biến toàn cục, trùng tên với
// biến của trang Thiết lập là vỡ cả trang đó.

(function () {
// Bản khai của theme — nguồn sự thật DUY NHẤT về font/màu gốc và về việc thiệp
// dùng class nào, để helper dùng chung không phải biết tên theme.
window.CX_THEME = {
  id: "basic-gold",

  // Dạng hiện lời chúc khi chủ thiệp chưa chọn (theme_setting.wishes_mode).
  wishesMode: "card",

  // Hộp mừng cưới khi chủ thiệp chưa chọn (theme_setting.gift_box): id trong
  // CX_GIFT_BOXES (core/helpers/gift-box-helper.js) hoặc "none". Mẫu KHÔNG tự vẽ hộp.
  giftBox: "none",

  // Dạng trình phát nhạc — theme-boot.js dựng vào #cx-music-mount.
  music: { variant: "bar", chrome: "fixed-top", art: "couple" },

  // Font/màu GỐC: giá trị mặc định trên thanh chỉnh ở tab Giao diện và là điểm
  // "Khôi phục mặc định".
    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#2f3e4c",
      body: "#5d6670",
      accent: "#5b7d96",
      accent_soft: "#a9c0d0",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#ffffff",
      page_bg: "#ffffff",
      surface: "#fbf9f5",
      band: "#eef3f6",
      panel: "#ffffff",
      panel_warm: "#ffffff",
      cover: "#fbf9f5",
      cover_mid: "#ede6da",
      cover_veil: "#eef2f4",
      lightbox_bg: "#000000",
      line: "#dfe7ed",
      shadow: "#000000",
      scrim: "#000000",
      deco: "#c8b28a",
      deco_soft: "#ece2cf",
      deco_2: "#a9c0d0",
      deco_2_soft: "#dfe7ed",
      shine_from: "#c8b28a",
      shine_mid: "#d6c6a8",
      shine_to: "#ece2cf",
    },

  // Màu GỢI Ý trong bộ chọn màu (khách bấm vào một phần tử trên thiệp rồi
  // chỉnh riêng) — lấy từ chính bảng màu của mẫu.
  swatches: [
    "#2f3e4c", // xanh than
    "#5d6670",
    "#5b7d96", // xanh biển dịu
    "#a9c0d0",
    "#dfe7ed",
    "#eef3f6",
    "#c8b28a", // vàng champagne
    "#d6c6a8",
    "#ece2cf",
    "#ede6da", // be cát
    "#fbf9f5", // trắng ngà
    "#ffffff",
  ],

  // Mục được gán hiệu ứng hiện dần khi cuộn tới — bó trong #main-card để không
  // dính nút "Mở thiệp" ở màn bìa.
  reveal: ["#main-card .cg-sec"],

  // Mốc bung bảng đề xuất mẫu khác ở bản xem thử (?preview=true): cuộn tới mục
  // này là bảng trượt lên. Mặc định của core/utils.js cũng là hộp mừng cưới,
  // khai ra đây để mỗi mẫu tự chọn được chỗ hợp với bố cục của mình.
  suggest: "#section-gift",

  // Không khai `focus`: id các mục trùng bảng mặc định của preview-focus-helper.
};

const _isGroom = isGroomSide();

// ============= RENDER WEDDING DATA =============

function renderWedding(w) {
  if (!w || !w.is_active) return;

  const side = _isGroom ? "groom" : "bride";

  // --- COVER ---
  // Khối dựng ảnh chạy TRƯỚC setupMusic: đây là chỗ ảnh của màn ĐẦU TIÊN nhận
  // src, mà setupMusic kéo YouTube iframe API (script bên thứ ba) về ngay khi
  // chạy — để nó đi trước là ảnh phải xếp hàng sau.
  renderCover(w);

  // --- HERO ---
  // useRing=false: ảnh hero tràn viền, không có khung để vẽ viền trắng.
  renderHero(w, false);

  // --- MUSIC ---
  setupMusic(w.music_url, w.enable_music);

  // --- COUPLE INFO ---
  setText("invite-groom", w.groom_name, "----------");
  setText("invite-bride", w.bride_name, "----------");
  renderCoupleInfo(w);

  // --- SECTION: family ---
  cxToggle("section-family", cxEnabled(w.enable_family));

  // --- CEREMONY / VU QUY ---
  // Bride + vu_quy_enabled → thay toàn bộ ceremony bằng vu quy
  const isVuQuy = !_isGroom && cxEnabled(w.vu_quy_enabled);
  const ceremonyName = isVuQuy
    ? "Lễ Vu Quy"
    : w.ceremony_name || "Lễ Thành Hôn";
  const displayTime = isVuQuy ? w.vu_quy_time : w.ceremony_time;
  const displayLoc = isVuQuy ? w.vu_quy_location : w.ceremony_location || "";

  // Khối tóm tắt trong trình phát nhạc (kéo xuống mới thấy) — dùng CHÍNH phần lễ
  // đang hiển thị, để nhà gái bật Vu Quy thì tóm tắt cũng là Vu Quy.
  renderMusicSummary(w, {
    ceremonyName,
    ceremonyTime: displayTime,
    ceremonyLocation: displayLoc,
  });

  // Đỉnh hero: TÊN LỄ · NĂM (năm lấy từ ngày lễ, chưa có ngày thì chỉ tên lễ)
  const cYear = (w.ceremony_date || "").slice(0, 4);
  setText("hero-eyebrow", ceremonyName + (cYear ? " · " + cYear : ""));

  // Thẻ giấy ở màn bìa: "Chủ Nhật · 06 · 12 · 2026". Tách chuỗi ngày thay vì
  // new Date("yyyy-mm-dd") — dạng đó đọc theo UTC, lệch thứ ở múi giờ âm.
  const [cy, cm, cd] = (w.ceremony_date || "").split("-");
  if (cy && cm && cd) {
    const wd = WEEKDAYS[new Date(+cy, +cm - 1, +cd).getDay()];
    setText("cover-date", `${wd} · ${cd} · ${cm} · ${cy}`);
    cxToggle("cover-date", true);
    setText("footer-date", `${cd}.${cm}.${cy}`);
  }
  _countdown(w.ceremony_date, displayTime);

  setText("ceremony-event-name", ceremonyName);
  setText("party-section-label", "Tiệc Mừng " + ceremonyName);
  renderCeremonyDate(w.ceremony_date, displayTime, w.ceremony_lunar);
  if (displayLoc) {
    setText("ceremony-location-text", displayLoc);
    cxToggle("ceremony-location-wrap", true);
  }

  // --- PARTY DATE ---
  const partyDate = w[`${side}_party_date`];
  const partyTime = w[`${side}_party_time`];
  const partyLunar = w[`${side}_party_lunar`];
  const partyLocation = w[`${side}_party_location`];
  renderPartyDate(partyDate, partyTime, partyLunar, partyLocation, "full");
  cxToggle("section-party", cxEnabled(w.enable_party));

  // --- MINI CALENDAR --- phủ trên ảnh album cuối (ít lặp với ảnh gần đó), chưa
  // có album thì dùng ảnh bìa.
  setupMiniCalendar(w.ceremony_date, partyDate);
  const gal = Array.isArray(w.gallery_images) ? w.gallery_images : [];
  const calImg = gal.length ? gal[gal.length - 1] : w.cover_image_url;
  const calFocal = gal.length
    ? w.image_focal_points?.gallery_images?.[calImg]
    : w.image_focal_points?.cover_image_url;
  if (calImg) {
    setAttr("cal-bg", "src", getImageUrl(calImg));
    applyFocalPoint("cal-bg", calFocal);
  }


  // --- RSVP ---
  const rsvpSection = document.getElementById("rsvp-section");
  if (rsvpSection)
    rsvpSection.style.display = cxEnabled(w.rsvp_enabled) ? "flex" : "none";
  if (w.rsvp_message) {
    const msgEl = document.getElementById("rsvp-custom-message");
    if (msgEl) {
      msgEl.textContent = w.rsvp_message;
      msgEl.classList.remove("hidden");
    }
  }

  // --- TIMELINE ---
  cxToggle(
    "section-timeline",
    cxEnabled(w.enable_timeline) &&
      _renderSchedule(w.timeline, side, partyDate, w.ceremony_date, ceremonyName),
  );

  // --- STORY QUOTE ---
  renderStoryQuote(w.story_quote);

  // --- LOVE STORY ---
  cxToggle(
    "love-story",
    cxEnabled(w.enable_love_story) && _renderStory(w.love_story),
  );

  // --- GALLERY ---
  if (cxEnabled(w.enable_photos)) {
    renderMarquee(gal, w.image_focal_points?.gallery_images);
  } else {
    cxToggle("section-photos", false);
  }

  // --- QR CODES ---
  renderQRCodes(w);
  cxToggle("section-gift", cxEnabled(w.enable_gift));

  // --- MAP: tiệc, thêm bản đồ lễ khi hai nơi khác nhau ---
  const showMap = cxEnabled(w[`${side}_party_show_location`]);
  if (showMap) renderVenueMaps(w, side);
  cxToggle("section-map", showMap);

  // --- FOOTER ---
  cxToggle("section-footer", cxEnabled(w.enable_footer));
  if (w.footer_text) setText("footer-text", w.footer_text);

  _fxScan();
}

window.renderWedding = renderWedding;

// Album băng chuyền (riêng mẫu này): ảnh chia lần lượt vào các dải, dải lẻ chạy
// trái → phải, dải chẵn phải → trái, lặp vô tận. Mỗi dải chép nối ảnh cho đủ dài
// rồi NHÂN ĐÔI: chạy đúng -50% là về khớp điểm đầu nên vòng lặp không đứt.
const MARQ_MIN = 5; // số ảnh tối thiểu của một nửa dải để phủ kín bề ngang thẻ
const MARQ_SEC = 5; // giây cho mỗi ảnh đi qua

function renderMarquee(images, focalPoints) {
  const box = document.getElementById("gallery-grid");
  if (!box) return;
  const urls = images.length
    ? images.map(getImageUrl)
    : Array(4).fill(null).map(() => createPlaceholderSVG("Chưa có ảnh"));

  lightboxImages.length = 0;
  lightboxImages.push(...urls);

  const nRows = urls.length >= 6 ? 3 : urls.length > 1 ? 2 : 1;
  const rows = Array.from({ length: nRows }, () => []);
  urls.forEach((_, i) => rows[i % nRows].push(i));

  box.innerHTML = rows
    .map((idxs, r) => {
      const half = [];
      while (half.length < MARQ_MIN) half.push(...idxs);
      const cells = half
        .concat(half)
        .map((i) => {
          const pos = escapeHtml(cxFocal(focalPoints?.[images[i]]));
          return `<div class="cg-marq-item" data-lb="${i}"><img src="${cxImgSrc(urls[i])}" style="object-position:${pos}" alt=""></div>`;
        })
        .join("");
      const dir = r % 2 ? "b" : "a";
      return `<div class="cg-marq" data-dir="${dir}"><div class="cg-marq-track" style="--marq-dur:${half.length * MARQ_SEC}s">${cells}</div></div>`;
    })
    .join("");

  box.querySelectorAll("[data-lb]").forEach((el) =>
    el.addEventListener("click", () => openLightbox(Number(el.dataset.lb))),
  );
}

// Lịch trình (riêng mẫu này) — kiểu thực đơn gọn: các nhóm chung một khung, mỗi
// mốc một dòng giờ | việc.
// Cùng luật lọc/sắp của renderTimeline dùng chung —
// "party" chỉ nhà trai, "bride-party" chỉ nhà gái. Trả false khi không có mốc nào.
function _renderSchedule(items, side, partyDate, ceremonyDate, ceremonyName) {
  const list = document.getElementById("timeline-list-render");
  if (!list) return false;
  list.innerHTML = "";
  if (!Array.isArray(items)) return false;
  const type = (it) => it.type || "ceremony";
  const mine = items.filter(
    (it) =>
      type(it) === "ceremony" ||
      (side === "groom" ? type(it) === "party" : type(it) === "bride-party"),
  );
  const groups = cxSortTimelineGroups([
    { label: ceremonyName || "Lễ Thành Hôn", date: ceremonyDate, items: mine.filter((it) => type(it) === "ceremony") },
    { label: "Tiệc Cưới", date: partyDate, items: mine.filter((it) => type(it) !== "ceremony") },
  ]);
  if (!groups.length) return false;

  list.innerHTML = groups
    .map((g) => {
      const [y, m, d] = (g.date || "").split("-");
      const date = y && m && d ? `${WEEKDAYS[new Date(+y, +m - 1, +d).getDay()]} · ${d}.${m}.${y}` : "";
      const rows = g.items
        .map(
          (it) => `
          <li class="cg-sched-item">
            <span class="cg-sched-time cx-a">${escapeHtml(it.time || "")}</span>
            <span class="cg-sched-what cx-h">${escapeHtml(it.title || "")}</span>
          </li>`,
        )
        .join("");
      return `
      <div class="cg-sched-group">
        <div class="cg-sched-head">
          <div class="cg-sched-name cx-a">${escapeHtml(g.label)}</div>
          ${date ? `<div class="cg-sched-date">${escapeHtml(date)}</div>` : ""}
        </div>
        <ol class="cg-sched-list">${rows}</ol>
      </div>`;
    })
    .join("");
  return true;
}

// Chuyện tình yêu (riêng mẫu này): mỗi mốc một chương, chương chẵn/lẻ đổi bên để
// ảnh và chữ so le như trang tạp chí. Trả false khi không có mốc nào.
function _renderStory(events) {
  const list = document.getElementById("love-story-list");
  if (!list) return false;
  list.innerHTML = "";
  if (!Array.isArray(events) || !events.length) return false;

  list.innerHTML = events
    .map((ev, i) => {
      const side = i % 2 ? "cg-ch-right" : "cg-ch-left";
      const pos = ev.focal_point ? ` style="object-position:${escapeHtml(cxFocal(ev.focal_point))}"` : "";
      return `
      <article class="cg-ch ${side}">
        <div class="cg-ch-no cx-a">${String(i + 1).padStart(2, "0")}</div>
        ${ev.image_url ? `<div class="cg-shot cg-ch-img"><img src="${cxImgSrc(ev.image_url)}" alt=""${pos}></div>` : ""}
        <div class="cg-ch-body">
          ${ev.date ? `<div class="cg-ch-date">${escapeHtml(ev.date)}</div>` : ""}
          ${ev.title ? `<div class="cg-ch-title cx-a">${escapeHtml(ev.title)}</div>` : ""}
          ${ev.content ? `<div class="cg-ch-text cx-t">${escapeHtml(ev.content)}</div>` : ""}
        </div>
      </article>`;
    })
    .join('<div class="cg-ch-link" aria-hidden="true"></div>');
  return true;
}

// Ảnh chuyển động (riêng mẫu này), chỉ chạy khi đang trong khung nhìn (.is-on):
// · Ảnh ngoài album (gia đình, chuyện tình): zoom nhẹ, khung xen kẽ phóng vào /
//   thu ra (data-kb) để hai ảnh cạnh nhau không cùng nhịp.
// · Album: các dải băng chuyền .cg-marq (renderMarquee).
const KB_KINDS = ["in", "out"];
let _kbIO = null;

function _fxScan() {
  const card = document.getElementById("main-card");
  if (!card) return;
  if (!_kbIO && "IntersectionObserver" in window) {
    _kbIO = new IntersectionObserver((entries) =>
      entries.forEach((e) => e.target.classList.toggle("is-on", e.isIntersecting)),
    );
  }
  const watch = (el) => (_kbIO ? _kbIO.observe(el) : el.classList.add("is-on"));

  card.querySelectorAll(".cg-shot").forEach((el, i) => {
    el.dataset.kb = KB_KINDS[i % KB_KINDS.length];
    watch(el);
  });
  card.querySelectorAll(".cg-marq").forEach(watch);
}

// Đếm ngược tới giờ làm lễ; renderWedding chạy lại (xem trực tiếp) thì huỷ nhịp cũ.
let _cdTimer = null;
const _pad = (n) => String(n).padStart(2, "0");

function _countdown(dateStr, timeStr) {
  if (_cdTimer) clearInterval(_cdTimer);
  _cdTimer = null;
  const target = dateStr
    ? new Date(`${dateStr}T${timeStr || "00:00"}:00`).getTime()
    : NaN;
  cxToggle("section-countdown", !isNaN(target));
  if (isNaN(target)) return;

  function tick() {
    const left = Math.max(0, Math.floor((target - Date.now()) / 1000));
    setText("cd-days", _pad(Math.floor(left / 86400)));
    setText("cd-hours", _pad(Math.floor((left % 86400) / 3600)));
    setText("cd-minutes", _pad(Math.floor((left % 3600) / 60)));
    setText("cd-seconds", _pad(left % 60));
    if (!left && _cdTimer) {
      clearInterval(_cdTimer);
      _cdTimer = null;
    }
  }
  tick();
  _cdTimer = setInterval(tick, 1000);
}
})();
