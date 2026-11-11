// Cuộn thiệp tới đúng phần đang được chỉnh bên trang Thiết lập (khung "xem trực
// tiếp", tab Xem trước). Trang cha gửi {type:"cx-focus", key, field?, text?}: key
// trùng `data-step` của bước (riêng "map" là mục Địa điểm), field/text là ô sửa gần
// nhất — có thì tới thẳng dòng chữ đó. Thiệp thật không ai gửi gì nên file này nằm im.

// Mỗi vai trò một danh sách ứng viên vì id không thống nhất giữa các theme —
// lấy phần tử ĐẦU TIÊN có thật và đang hiện. Theme đặt id khác thì khai
// CX_THEME.focus trong index.js của mình (được ưu tiên trước bảng dưới đây),
// KHÔNG chèn thêm vào file này.
const CX_FOCUS_SEL = {
  couple: [], // đầu thiệp — xử lý riêng, cuộn hẳn lên trên
  ceremony: ["#section-ceremony", "#mini-calendar", "#invite-day"],
  family: ["#section-family", "#groom-photo", "#groom-father"],
  party: ["#section-party", "#party-location", "#party-day", "#section-map"],
  photos: [
    "#section-photos",
    "#gallery-carousel",
    "#gallery-grid",
    "#gallery-first-image",
  ],
  timeline: ["#section-timeline", "#timeline-list-render", "#timeline-list"],
  love_story: ["#love-story", "#love-story-list"],
  rsvp: ["#rsvp-section", "#attend-msg"],
  gift: ["#section-gift", "#groom-bank-label", "#bride-bank-label"],
  // Mục lời chúc (thẻ / phân trang) do wishes-helper dựng; dạng livestream không có
  // mục nào trong thân thiệp nên danh sách này rỗng và lượt cuộn tự bỏ qua.
  wishes: ["#cx-wish-sec"],
  footer: ["#section-footer"],
  // Không phải bước: trang Thiết lập gửi khi khách đang chọn/sửa địa điểm (bảng
  // chọn bản đồ, ô tên địa điểm) ở bước Lễ cưới hay Tiệc cưới.
  map: ["#section-map", "#map-location-name", "#map-link"],
};

// Mục cần tới có thể chưa dựng xong (renderWedding chạy sau load, ảnh còn đang
// về) → thử lại vài nhịp rồi mới bỏ.
const CX_FOCUS_TRIES = 8;
const CX_FOCUS_GAP = 120;

function _cxFocusList(key) {
  const own = (window.CX_THEME && window.CX_THEME.focus?.[key]) || [];
  return own.concat(CX_FOCUS_SEL[key] || []);
}

function _cxFocusFind(key) {
  for (const sel of _cxFocusList(key)) {
    const el = document.querySelector(sel);
    // offsetParent = null → mục đang tắt trong Thiết lập, đừng cuộn tới chỗ trống.
    if (el && el.offsetParent !== null) return el;
  }
  return null;
}

// Viền sáng loé một nhịp: sau khi cuộn, phải chỉ ra ĐÚNG khối vừa sửa, nhất là
// khi mục nằm giữa những khối trông giống nhau.
function _cxFocusFlash(el) {
  el.classList.remove("cx-focus-flash");
  void el.offsetWidth; // ép nhận lại animation khi loé liên tiếp
  el.classList.add("cx-focus-flash");
  setTimeout(() => el.classList.remove("cx-focus-flash"), 1200);
}

const _cxFocusNorm = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();

function _cxFocusVisible(el) {
  return el.offsetParent !== null || getComputedStyle(el).position === "fixed";
}

// Dòng chữ chứa đúng chuỗi khách vừa gõ — id không thống nhất giữa các mẫu, còn
// chữ thì mẫu nào cũng in ra y vậy. Chuỗi quá ngắn ("Anh") thì khớp lung tung, bỏ.
function _cxFocusText(text, root) {
  const needle = _cxFocusNorm(text);
  if (!root || needle.length < 3) return null;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const p = n.parentElement;
    if (!p || p.closest("script,style,noscript")) continue;
    if (_cxFocusNorm(n.data).includes(needle) && _cxFocusVisible(p)) return p;
  }
  return null;
}

// Ô sửa gần nhất → phần tử trên thiệp: chữ trong mục của bước trước (tên cô dâu
// còn in ở bìa, chân thiệp…), rồi cả thiệp, rồi đoán id theo tên ô (groom_father →
// #groom-father) cho ô không in nguyên văn (ngày giờ đã định dạng lại).
function _cxFocusExact(field, text, section) {
  const hit = _cxFocusText(text, section) || _cxFocusText(text, document.body);
  if (hit) return hit;
  if (!/^[a-z0-9_]+$/i.test(field || "")) return null;
  const el = document.getElementById(field.replace(/_/g, "-"));
  return el && _cxFocusVisible(el) ? el : null;
}

// Tới đầu mục NGAY (mục có sẵn trong markup), rồi dò tiếp dòng chữ của ô vừa sửa —
// renderWedding chạy sau load nên chữ có khi chưa vào; thấy thì chỉnh lại cho trúng.
// Không có ô sửa nào (vừa đổi bước) thì chỉ cần đầu mục: thấy là loé luôn.
function _cxFocusScroll(d, tries, atSection) {
  const key = d.key;
  const section = key === "couple" ? null : _cxFocusFind(key);
  const wantExact = !!(d.field || d.text);
  const exact = wantExact && _cxFocusExact(d.field, d.text, section);
  if (exact || (!wantExact && section)) {
    _cxFocusCenter(exact || section);
    _cxFocusFlash(exact || section);
    return;
  }
  if (!wantExact && key === "couple") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (!atSection) {
    if (key === "couple") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      atSection = true;
    } else if (section) {
      _cxFocusCenter(section);
      atSection = true;
    }
  }
  if (tries < CX_FOCUS_TRIES) {
    setTimeout(() => _cxFocusScroll(d, tries + 1, atSection), CX_FOCUS_GAP);
  } else if (section) {
    _cxFocusFlash(section);
  }
}

// Khung cuộn gần nhất CHỨA el trong chính thiệp (không có thì là trang).
function _cxFocusScroller(el) {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

// Đưa el về giữa khung nhìn. KHÔNG dùng scrollIntoView: nó cuộn lây cả khung chứa iframe
// ở trang cha — mục cuối (không cuộn thêm được) là iframe bị đẩy lên, lộ khoảng trắng.
function _cxFocusCenter(el) {
  const box = _cxFocusScroller(el);
  const r = el.getBoundingClientRect();
  if (box) {
    const b = box.getBoundingClientRect();
    const top = box.scrollTop + r.top - b.top - (box.clientHeight - r.height) / 2;
    box.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  } else {
    const top = window.scrollY + r.top - (window.innerHeight - r.height) / 2;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }
}

// Style nhúng bằng JS: thiệp dùng build CSS riêng (themes.css), nhét vào đó thì
// mỗi lần đổi hiệu ứng lại phải build lại cả bộ.
function _cxFocusStyle() {
  if (document.getElementById("cx-focus-style")) return;
  const st = document.createElement("style");
  st.id = "cx-focus-style";
  st.textContent = `
    @keyframes cx-focus-flash {
      0%, 100% { box-shadow: 0 0 0 0 rgb(251 113 133 / 0); }
      30% { box-shadow: 0 0 0 6px rgb(251 113 133 / 0.28); }
    }
    .cx-focus-flash {
      border-radius: 12px;
      animation: cx-focus-flash 1.1s ease;
    }
  `;
  document.head.appendChild(st);
}

window.addEventListener("message", (ev) => {
  if (ev.source !== window.parent) return;
  const d = ev.data;
  if (!d || d.type !== "cx-focus" || !d.key) return;
  _cxFocusStyle();
  _cxFocusScroll(
    { key: String(d.key), field: String(d.field || ""), text: String(d.text || "") },
    0,
    false,
  );
});
