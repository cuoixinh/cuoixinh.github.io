// Cuộn thiệp tới đúng mục đang được chỉnh bên trang Thiết lập (khung "xem trực
// tiếp"). Trang cha gửi {type:"cx-focus", key}, key trùng `data-step` của bước.
// Thiệp thật không ai gửi gì nên file này nằm im.

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
  footer: ["#section-footer"],
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

function _cxFocusScroll(key, tries) {
  if (key === "couple") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const el = _cxFocusFind(key);
  if (!el) {
    if (tries < CX_FOCUS_TRIES)
      setTimeout(() => _cxFocusScroll(key, tries + 1), CX_FOCUS_GAP);
    return;
  }
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  _cxFocusFlash(el);
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
  _cxFocusScroll(String(d.key), 0);
});
