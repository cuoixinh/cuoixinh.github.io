// ============================================================
// RENDER-HELPER.JS - Common rendering functions for all templates
// ============================================================

// Chấm mốc của hai dòng thời gian (chuyện tình yêu + lịch trình ngày cưới).
// Màu lấy từ bộ biến --cx-* của thiệp (styles/_common.css), theme ghi đè trong
// theme.css của mình.
const CX_TL_DOT =
  '<div class="absolute left-[-6px] top-[3px] w-[10px] h-[10px] rounded-full border-2 border-white bg-[rgb(var(--cx-accent-rgb))] shadow-[0_0_0_2px_rgb(var(--cx-accent-rgb))]"></div>';

const WEEKDAYS = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

function renderCeremonyDate(ceremonyDate, ceremonyTime, ceremonyLunar) {
  if (ceremonyDate) {
    const d = new Date(ceremonyDate);
    setText("invite-day", d.getDate());
    setText(
      "invite-month-year",
      `Tháng ${d.getMonth() + 1} · ${d.getFullYear()}`,
    );
    setText("invite-weekday", WEEKDAYS[d.getDay()]);
  }
  setText("invite-time", ceremonyTime, "--:--");
  setText("invite-lunar", ceremonyLunar, "--------------------");
}

function renderPartyDate(
  partyDate,
  partyTime,
  partyLunar,
  partyLocation,
  format = "full",
) {
  if (format === "full") {
    // Template1 format: "18:00 - 20.10.2024"
    if (partyDate && partyTime) {
      const d = new Date(partyDate);
      setText(
        "party-datetime",
        `${partyTime} - ${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`,
      );
    } else {
      setText("party-datetime", "--:-- - --.--.----");
    }
    setText("party-lunar", partyLunar ? `(${partyLunar})` : "(----)");
  } else {
    // Template2 format: separate day, month-year, weekday, time
    if (partyDate) {
      const d = new Date(partyDate);
      setText("party-day", d.getDate());
      setText(
        "party-month-year",
        `Tháng ${d.getMonth() + 1} · ${d.getFullYear()}`,
      );
      setText("party-weekday", WEEKDAYS[d.getDay()]);
    }
    setText("party-time", partyTime, "18:00");
    setText(
      "party-lunar",
      partyLunar ? `${partyLunar}` : "--------------------",
    );
  }

  setText("party-location", partyLocation, "------------------------");
}

/** Áp dụng điểm lấy nét (toạ độ %) cho ảnh; bỏ qua nếu không có. */
function applyFocalPoint(elementId, focalPoint) {
  if (
    !focalPoint ||
    typeof focalPoint.x !== "number" ||
    typeof focalPoint.y !== "number"
  )
    return;
  const el = document.getElementById(elementId);
  if (el) el.style.objectPosition = `${focalPoint.x}% ${focalPoint.y}%`;
}

function renderCoupleInfo(wedding) {
  // Groom info
  setText("groom-father", wedding.groom_father, "--------------------");
  setText("groom-mother", wedding.groom_mother, "--------------------");
  setText(
    "groom-address",
    wedding.groom_address,
    "----------------------------------------",
  );
  setText("groom-name-label", wedding.groom_name, "----------");

  // Bride info
  setText("bride-father", wedding.bride_father, "--------------------");
  setText("bride-mother", wedding.bride_mother, "--------------------");
  setText(
    "bride-address",
    wedding.bride_address,
    "----------------------------------------",
  );
  setText("bride-name-label", wedding.bride_name, "----------");

  // Photos - check if template uses setImageWithRing or setAttr
  const groomPhoto = document.getElementById("groom-photo");
  const bridePhoto = document.getElementById("bride-photo");

  if (groomPhoto) {
    if (typeof setImageWithRing === "function") {
      setImageWithRing("groom-photo", wedding.groom_image_url);
    } else {
      setAttr("groom-photo", "src", getImageUrl(wedding.groom_image_url));
    }
    applyFocalPoint("groom-photo", wedding.image_focal_points?.groom_image_url);
  }

  if (bridePhoto) {
    if (typeof setImageWithRing === "function") {
      setImageWithRing("bride-photo", wedding.bride_image_url);
    } else {
      setAttr("bride-photo", "src", getImageUrl(wedding.bride_image_url));
    }
    applyFocalPoint("bride-photo", wedding.image_focal_points?.bride_image_url);
  }
}

function renderQRCodes(wedding) {
  // Groom QR
  setText("groom-bank-label", wedding.groom_name, "----------");
  setText("groom-bank-name", wedding.groom_bank_name, "----------------");
  setText("groom-bank-number", wedding.groom_bank_number, "------------");
  setText("groom-bank-owner", wedding.groom_bank_owner, "--------------------");
  setAttr("groom-qr-img", "src", getImageUrl(wedding.groom_qr_url));
  applyFocalPoint("groom-qr-img", wedding.image_focal_points?.groom_qr_url);

  // Bride QR
  setText("bride-bank-label", wedding.bride_name, "----------");
  setText("bride-bank-name", wedding.bride_bank_name, "----------------");
  setText("bride-bank-number", wedding.bride_bank_number, "------------");
  setText("bride-bank-owner", wedding.bride_bank_owner, "--------------------");
  setAttr("bride-qr-img", "src", getImageUrl(wedding.bride_qr_url));
  applyFocalPoint("bride-qr-img", wedding.image_focal_points?.bride_qr_url);
}

function renderMap(mapEmbedUrl, locationName) {
  // extractMapEmbedUrl đã lọc theo allowlist host → "" là "không có bản đồ hợp lệ",
  // gán vào src/href lúc đó là mở đường cho `javascript:` và iframe lừa đảo.
  const mapEmbed = extractMapEmbedUrl(mapEmbedUrl);

  if (mapEmbed) {
    const iframe = document.getElementById("map-thumbnail-iframe");
    if (iframe) iframe.src = mapEmbed;

    const link = document.getElementById("map-link");
    if (link) link.href = mapEmbed;
  }

  setText("map-location-name", locationName, "------------------------");
}

// Mục Địa điểm: bản đồ tiệc của bên đang xem + bản đồ lễ (nhà gái bật vu quy thì là
// vu quy). Hai nơi trùng nhau (cùng link bản đồ hoặc cùng tên địa điểm) thì một bản
// đồ như cũ; khác nơi thì nhân cặp #map-location-name + #map-link thành bản đồ thứ
// hai, xếp theo giờ, mỗi bản đồ một nhãn. Mọi mẫu để #map-link CUỐI mục và cả hai có
// id, nên chèn quanh chúng không làm lệch selector :nth-child của text_overrides.
// Phần tử nào trong mục mang data-cx-map-dual thì đổi sang chữ đó khi có hai bản đồ.
// Bản sao mang id đuôi "-2": theme.css nhắm theo id thì phải khai thêm id đó; mục
// mang cờ .cx-map-dual để mẫu nào chật chỗ tự thu gọn hai bản đồ.
function renderVenueMaps(w, side) {
  const section = document.getElementById("section-map");
  section?.querySelectorAll("[data-cx-map2]").forEach((n) => n.remove());

  const vuQuy = side === "bride" && cxEnabled(w.vu_quy_enabled);
  const at = (d, t) => (d ? Date.parse(d + "T" + (t || "00:00")) || 0 : 0);
  const party = {
    label: "Tiệc cưới",
    url: extractMapEmbedUrl(w[side + "_party_map_embed_url"]),
    loc: w[side + "_party_location"] || "",
    at: at(w[side + "_party_date"], w[side + "_party_time"]),
  };
  const cer = {
    label: vuQuy ? "Lễ Vu Quy" : w.ceremony_name || "Lễ Thành Hôn",
    url: extractMapEmbedUrl(vuQuy ? w.vu_quy_map_embed_url : w.ceremony_map_embed_url),
    loc: (vuQuy ? w.vu_quy_location : w.ceremony_location) || "",
    at: at(w.ceremony_date, vuQuy ? w.vu_quy_time : w.ceremony_time),
  };
  const norm = (v) => String(v).trim().toLowerCase().replace(/\s+/g, " ");
  const same =
    cer.url === party.url || (norm(cer.loc) && norm(cer.loc) === norm(party.loc));

  let spots = [party];
  if (cer.url && same && !party.url) spots = [cer];
  else if (cer.url && !same)
    spots = !party.url && !norm(party.loc) ? [cer]
      : party.at && cer.at && party.at < cer.at ? [party, cer] : [cer, party];

  const main = spots[0];
  renderMap(main.url, main.loc);
  cxToggle("map-thumbnail-iframe", !!main.url);
  cxToggle("map-placeholder", !main.url);
  const link = document.getElementById("map-link");
  link?.classList.toggle("pointer-events-none", !main.url);

  const dual = spots.length > 1;
  section?.classList.toggle("cx-map-dual", dual);
  section?.querySelectorAll("[data-cx-map-dual]").forEach((el) => {
    if (el.dataset.cxMapOne === undefined) el.dataset.cxMapOne = el.textContent;
    el.textContent = dual ? el.dataset.cxMapDual : el.dataset.cxMapOne;
  });
  const name = document.getElementById("map-location-name");
  if (!dual || !link || !name) return false;

  const tag = (text) => {
    const t = document.createElement("div");
    t.className = "cx-map-tag";
    t.dataset.cxMap2 = "";
    t.textContent = text;
    return t;
  };
  // Bản sao: đổi id (thêm "-2") cho khỏi trùng, bỏ lớp hiệu ứng cuộn — observer của
  // theme-boot chỉ theo dõi bản gốc nên bản sao mang "reveal" sẽ tàng hình mãi.
  const copy = (el) => {
    const c = el.cloneNode(true);
    c.dataset.cxMap2 = "";
    [c, ...c.querySelectorAll("*")].forEach((n) => {
      if (n.id) n.id += "-2";
      n.classList.remove("reveal", "from-bottom", "from-left", "from-right");
    });
    return c;
  };
  const second = spots[1];
  const name2 = copy(name);
  name2.textContent = second.loc || "------------------------";
  const link2 = copy(link);
  link2.classList.toggle("pointer-events-none", !second.url);
  link2.href = second.url || "#";
  const frame2 = link2.querySelector("iframe");
  if (frame2) {
    frame2.src = second.url || "about:blank";
    frame2.classList.toggle("hidden", !second.url);
  }
  link2.querySelector("#map-placeholder-2")?.classList.toggle("hidden", !!second.url);

  name.before(tag(main.label));
  const tag2 = tag(second.label);
  tag2.classList.add("cx-map-tag-next");
  link.after(tag2, name2, link2);
  return true;
}

function renderCover(wedding) {
  const coverBgImg = document.getElementById("cover-bg-img");
  if (coverBgImg) {
    setAttr("cover-bg-img", "src", getImageUrl(wedding.cover_image_url));
    applyFocalPoint(
      "cover-bg-img",
      wedding.image_focal_points?.cover_image_url,
    );
  }

  setText("cover-groom-name", wedding.groom_name, "----------");
  setText("cover-bride-name", wedding.bride_name, "----------");
}

function renderHero(wedding, useRing = true) {
  if (useRing && typeof setImageWithRing === "function") {
    setImageWithRing("main-photo", wedding.cover_image_url);
  } else {
    setAttr("main-photo", "src", getImageUrl(wedding.cover_image_url));
  }
  applyFocalPoint("main-photo", wedding.image_focal_points?.cover_image_url);

  setText("couple-names-groom", wedding.groom_name, "----------");
  setText("couple-names-bride", wedding.bride_name, "----------");
}

function renderStoryQuote(quote) {
  if (quote) setText("story-quote", `"${quote}"`);
}

function renderLoveStory(events) {
  const section = document.getElementById("love-story");
  if (!section) return;
  if (!Array.isArray(events) || events.length === 0) {
    section.style.display = "none";
    return;
  }
  section.style.display = "";
  const list = document.getElementById("love-story-list");
  if (!list) return;
  list.innerHTML = events
    .map((ev, i) => {
      const imgSrc = ev.image_url ? cxImgSrc(ev.image_url) : null;
      const pbClass = i === events.length - 1 ? "pb-1" : "pb-5";
      const focalStyle = ev.focal_point
        ? ` style="object-position:${cxFocal(ev.focal_point)}"`
        : "";
      return `
    <div class="relative pl-[14px] ${pbClass} text-left">
      ${CX_TL_DOT}
      ${ev.date ? `<div class="text-[0.7rem] font-bold tracking-[0.06em] mb-0.5 cx-ac">${escapeHtml(ev.date)}</div>` : ""}
      ${ev.title ? `<div class="text-[0.95rem] font-semibold font-cormorant mb-1 cx-hd">${escapeHtml(ev.title)}</div>` : ""}
      ${ev.content ? `<div class="text-[0.82rem] leading-[1.65] cx-hd${imgSrc ? " mb-2" : ""}">${escapeHtml(ev.content)}</div>` : ""}
      ${imgSrc ? `<img src="${cxImgSrc(imgSrc)}" alt=""${focalStyle} class="w-full max-w-[280px] rounded-[10px] object-cover aspect-video" loading="lazy" />` : ""}
    </div>`;
    })
    .join("");
}

/**
 * Sắp xếp các NHÓM lịch trình — dùng chung cho mọi mẫu, kể cả mẫu tự vẽ kiểu khác
 * (chỉ phần sort, markup vẫn của mẫu). Nhận `[{date, items}]`, trả bản đã xếp:
 * nhóm tăng dần theo `date` (ISO yyyy-mm-dd, nhóm không có ngày xuống cuối; cùng
 * ngày thì nhóm có mốc sớm hơn đứng trước), trong nhóm tăng dần theo `time`.
 * Nhóm rỗng bị bỏ. Mốc thiếu giờ luôn xuống cuối nhóm.
 */
function cxSortTimelineGroups(groups) {
  const _t = (v) => String(v || "").trim();
  const byTime = (arr) =>
    [...arr].sort((a, b) => {
      const x = _t(a.time), y = _t(b.time);
      return !x ? 1 : !y ? -1 : x.localeCompare(y);
    });
  return groups
    .filter((g) => Array.isArray(g.items) && g.items.length)
    .map((g) => ({ ...g, items: byTime(g.items) }))
    .sort((a, b) => {
      const da = _t(a.date), db = _t(b.date);
      if (da !== db) return !da ? 1 : !db ? -1 : da.localeCompare(db);
      const ta = _t(a.items[0]?.time), tb = _t(b.items[0]?.time);
      return !ta ? 1 : !tb ? -1 : ta.localeCompare(tb);
    });
}

/**
 * Dòng thời gian ngày cưới. `side` = "groom" | "bride" — mục type "party" chỉ
 * hiện cho nhà trai, "bride-party" chỉ hiện cho nhà gái, "ceremony" hiện cả hai.
 * Vẽ vào #timeline-list-render, gom theo hai nhóm Tiệc Cưới / lễ chính.
 */
function renderTimeline(items, side, partyDate, ceremonyDate, ceremonyName) {
  const list = document.getElementById("timeline-list-render");
  if (!list) return;
  list.innerHTML = "";
  if (!Array.isArray(items) || items.length === 0) return;

  const relevant = items.filter((item) => {
    const t = item.type || "ceremony";
    if (t === "ceremony") return true;
    if (side === "groom" && t === "party") return true;
    if (side === "bride" && t === "bride-party") return true;
    return false;
  });
  if (relevant.length === 0) return;

  const groups = cxSortTimelineGroups([
    {
      label: "Tiệc Cưới",
      date: partyDate,
      items: relevant.filter((i) => (i.type || "ceremony") !== "ceremony"),
    },
    {
      label: ceremonyName || "Lễ Thành Hôn",
      date: ceremonyDate,
      items: relevant.filter((i) => (i.type || "ceremony") === "ceremony"),
    },
  ]);

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

  function _renderGroup(label, dateStr, groupItems) {
    if (!groupItems.length) return "";
    const dateLabel = _fmtDate(dateStr);
    const rows = groupItems
      .map((item, i) => {
        const pbClass = i === groupItems.length - 1 ? "pb-1" : "pb-4";
        return `
        <div class="relative pl-[14px] ${pbClass} text-left">
          ${CX_TL_DOT}
          <div class="text-[0.7rem] font-bold tracking-[0.06em] mb-0.5 cx-ac">${escapeHtml(item.time || "")}</div>
          <div class="text-[0.95rem] font-cormorant leading-snug cx-hd">${escapeHtml(item.title || "")}</div>
        </div>`;
      })
      .join("");
    return `
      <div class="mb-6 last:mb-0">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-[11px] uppercase tracking-widest font-inter cx-bd">${escapeHtml(label)}</span>
          ${dateLabel ? `<span class="text-[10px] font-inter cx-bd">· ${escapeHtml(dateLabel)}</span>` : ""}
        </div>
        <div class="flex flex-col border-l-2 ml-[5px] border-[rgb(var(--cx-line-rgb))]">
          ${rows}
        </div>
      </div>`;
  }

  list.innerHTML = groups
    .map((g) => _renderGroup(g.label, g.date, g.items))
    .join("");
}

// escapeHtml() dùng chung từ core/utils.js (nạp trước file này ở mọi trang).

function setupMiniCalendar(ceremonyDate, partyDate) {
  if (ceremonyDate && partyDate) {
    const d1 = new Date(ceremonyDate);
    const d2 = new Date(partyDate);
    updateWeddingDates([
      {
        year: d1.getFullYear(),
        month: d1.getMonth() + 1,
        day: d1.getDate(),
      },
      {
        year: d2.getFullYear(),
        month: d2.getMonth() + 1,
        day: d2.getDate(),
      },
    ]);
    renderMiniCalendar();
  }
}

/**
 * Bật trình phát nhạc. `enabled` = cờ enable_music, bỏ trống coi như bật; dữ
 * liệu từ form là chuỗi "true"/"false" nên phải so cả hai kiểu.
 */
function setupMusic(musicUrl, enabled) {
  const musicToggleBtn = document.getElementById("music-toggle");
  const on = enabled !== false && enabled !== "false" && !!musicUrl;

  // Công cụ "Trình phát nhạc" (tab Giao diện) cần biết thiệp có nhạc hay chưa để
  // quyết định vẽ trình phát hay vẽ ô nhắc "chưa có nhạc nền" — mà nó chạy sau
  // renderWedding nên không tự hỏi lại dữ liệu được.
  window.__cxMusicOn = on;

  if (on) {
    initYouTubeMusic(musicUrl);
    if (musicToggleBtn) {
      // Thanh ngang là flex-col; các mẫu gọn (.cx-mw) tự khai display trong CSS
      // nên trả về chuỗi rỗng, ép "flex" là đè mất bố cục của chúng.
      musicToggleBtn.style.display = musicToggleBtn.classList.contains("cx-mw")
        ? ""
        : "flex";
    }
  } else {
    if (musicToggleBtn) {
      musicToggleBtn.style.display = "none";
    }
  }
}

/**
 * Đổ dữ liệu vào khối "tóm tắt thiệp" của trình phát nhạc. Theme đánh dấu ô
 * bằng data-cx-summary (đều không bắt buộc): groom-photo/bride-photo,
 * groom-name/bride-name, event-name, event-date (ngày LỄ, dd.mm.yyyy),
 * event-weekday, event-time, event-location.
 * Ô rỗng nằm trong thẻ [data-cx-summary-row] thì ẩn cả hàng.
 * Đổ cho mọi trình phát đang có trên trang, không riêng cái của theme.
 */
function renderMusicSummary(wedding, opts = {}, scope) {
  if (!wedding) return;
  // Nhớ lại để dựng trình phát muộn vẫn có dữ liệu. Cờ này cũng là câu trả lời
  // cho "theme có cung cấp tóm tắt không?" — theme không gọi thì công cụ bỏ luôn
  // phần kéo xuống thay vì bày ra một khối rỗng.
  if (!scope) window.__cxMusicSummary = { wedding, opts };

  const roots = scope
    ? [scope]
    : Array.from(document.querySelectorAll('[data-cx-music="root"]')).concat(
        Array.from(document.querySelectorAll("#music-toggle")),
      );
  if (!roots.length) return;

  const _all = (role) => {
    const out = [];
    roots.forEach((r) =>
      out.push(...r.querySelectorAll('[data-cx-summary="' + role + '"]')),
    );
    return out;
  };

  const _setText = (role, value) => {
    _all(role).forEach((el) => {
      const row = el.closest("[data-cx-summary-row]");
      if (row) row.classList.toggle("hidden", !value);
      el.textContent = value || "";
    });
  };

  const _setPhoto = (role, filename, focal) => {
    _all(role).forEach((el) => {
      el.src = getImageUrl(filename);
      if (focal && typeof focal.x === "number" && typeof focal.y === "number") {
        el.style.objectPosition = `${focal.x}% ${focal.y}%`;
      }
    });
  };

  const focals = wedding.image_focal_points || {};
  _setPhoto("groom-photo", wedding.groom_image_url, focals.groom_image_url);
  _setPhoto("bride-photo", wedding.bride_image_url, focals.bride_image_url);
  _setText("groom-name", wedding.groom_name);
  _setText("bride-name", wedding.bride_name);

  _setText("event-name", opts.ceremonyName || wedding.ceremony_name || "");
  _setText("event-time", opts.ceremonyTime || wedding.ceremony_time || "");
  _setText(
    "event-location",
    opts.ceremonyLocation || wedding.ceremony_location || "",
  );

  const date = wedding.ceremony_date;
  if (date) {
    const d = new Date(date);
    _setText(
      "event-date",
      `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`,
    );
    _setText("event-weekday", WEEKDAYS[d.getDay()]);
  } else {
    _setText("event-date", "");
    _setText("event-weekday", "");
  }
}

// Make functions global
window.WEEKDAYS = WEEKDAYS;
window.renderCeremonyDate = renderCeremonyDate;
window.renderPartyDate = renderPartyDate;
window.renderCoupleInfo = renderCoupleInfo;
window.renderQRCodes = renderQRCodes;
window.renderMap = renderMap;
window.renderCover = renderCover;
window.renderHero = renderHero;
window.renderStoryQuote = renderStoryQuote;
window.renderLoveStory = renderLoveStory;
window.renderTimeline = renderTimeline;
window.cxSortTimelineGroups = cxSortTimelineGroups;
window.setupMiniCalendar = setupMiniCalendar;
window.setupMusic = setupMusic;
window.renderMusicSummary = renderMusicSummary;
// Đổ lại tóm tắt cho một trình phát vừa được dựng thêm (công cụ ở tab Giao diện).
window.replayMusicSummary = function (scope) {
  const a = window.__cxMusicSummary;
  if (a && scope) renderMusicSummary(a.wedding, a.opts, scope);
};
