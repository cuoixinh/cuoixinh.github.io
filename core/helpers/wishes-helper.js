// Lời chúc của khách mời trên trang thiệp: một mục trong thân thiệp (thẻ, phân
// trang, chat, chồng thẻ, tâm điểm, sổ lưu bút) hoặc dải nổi ghim đáy khung nhìn
// (livestream, bong bóng bay) + ô gửi. Gọi
// một lần từ loadWeddingData (wedding-helper).
//
// Mẫu thiệp KHÔNG phải sửa gì: có #cx-wishes-list thì helper mount vào đó, không
// có thì tự chèn một mục vào cuối thân thiệp — nhờ vậy mẫu đã phát hành cũng có.
// Chỉ khách cầm link cá nhân hoá mới thấy ô nhập, và cổng chặn thật nằm ở Edge
// Function (khớp hàng guests theo slug + tên + xưng hô), không phải ở đây.

const CX_WISH_MAX = 3;
// Trần một lời chúc — trùng MAX_WISH_LEN của Edge Function guest-handler (server
// mới là nơi chốt, quá trần trả 400).
const CX_WISH_MAX_LEN = 300;

// Tốc độ trôi (px/giây) — danh sách dài ngắn đều đi cùng nhịp đọc.
const CX_WISH_SPEED = 32;

// Nghỉ bao lâu sau khi lời chúc cuối rời khỏi khung rồi chiếu lại từ đầu (ms).
const CX_WISH_REPLAY_MS = 3000;

// Ô nhập cao tối đa mấy dòng — quá đó thì cuộn trong chính ô.
const CX_WISH_INPUT_ROWS = 3;

// Còn bấy nhiêu ký tự nữa là chạm trần thì mới hiện bộ đếm — thiệp cưới không
// phải ô soạn tin, đếm từ ký tự đầu tiên chỉ làm dải nặng thêm.
const CX_WISH_COUNT_AT = 80;

// Giữ trạng thái "đã gửi" (chip đổi thành dấu tích) bao lâu trước khi ô nhập
// trở về lời mời gửi tiếp (ms).
const CX_WISH_SENT_MS = 2600;

// Cuộn qua bao nhiêu phần màn hình thì dải mới hiện ra (fade). Màn bìa và màn
// mở đầu phải sạch, dải chỉ xuất hiện khi khách đã bắt đầu đọc thiệp.
const CX_WISH_SHOW_AT = 0.6;

// Dạng hiện lời chúc do chủ thiệp chọn ở tab Giao diện (lưu ở
// theme_setting.wishes_mode, bảng chọn ở invitation-setup/js/05-theme-panel.js).
// Danh mục nằm ở CX_WISH_MODES bên dưới. Không lưu gì = dạng mẫu khai ở
// CX_THEME.wishesMode (_cxWishModeDefault), mẫu không khai thì "card". Dải nổi
// "live" chỉ có khi chủ thiệp tự chọn — không mẫu nào lấy làm mặc định.
const CX_WISH_MODE_DEFAULT = "card";

// Dạng "paged": mỗi trang mấy lời chúc.
const CX_WISH_PAGE_SIZE = 3;

// Dạng "chat": nhịp trồi một tin mới (ms) và số tin đứng trong khung cùng lúc.
const CX_WISH_CHAT_MS = 2800;
const CX_WISH_CHAT_KEEP = 5;

// Dạng "spotlight": mỗi câu đứng bao lâu (ms) — trùng thời lượng thanh tiến độ ở CSS
// (.cx-wspot-bar i, animation cx-wspot-prog).
const CX_WISH_SPOT_MS = 5000;

// Dạng "float": nhịp thả một bong bóng (ms).
const CX_WISH_FLOAT_MS = 2600;

// Năm ô màu của lời chúc, FIX CỨNG theo từng mẫu: mẫu khai gì (CX_THEME.wishes)
// thì lấy nấy, không khai thì rơi về token chung của thiệp. Mỗi khoá ứng với một
// biến CSS trên .cx-wdock / .cx-wsec (xem styles/_common.css).
// Độ mờ nền bong bóng mặc định (%) — trùng --cx-wish-bubble-a ở _common.css.
const CX_WISH_OPACITY = 94;

// varName2 = chặng CUỐI khi ô đó đổ màu (khoá "<tên>_to"); có nó thì dải mang
// thêm cờ .cx-wg-<tên> để CSS đổi sang linear-gradient (styles/_common.css).
// CHỈ nền bong bóng có chặng cuối: chữ đổ màu phải cắt nền theo hình chữ, đọc
// rất mệt.
// alias = khoá CŨ, hồi nút gửi còn dùng chung màu với tên khách: mẫu chỉ khai
// "accent" thì nút gửi rơi về đó, giữ nguyên hình thức cũ.
const CX_WISH_COLORS = {
  text: {
    varName: "--cx-wish-text-rgb",
    from: "--cx-body-rgb",
  },
  accent: {
    varName: "--cx-wish-accent-rgb",
    from: "--cx-accent-rgb",
  },
  bubble: {
    varName: "--cx-wish-bubble-rgb",
    varName2: "--cx-wish-bubble-2-rgb",
    from: "--cx-panel-rgb",
  },
  btn: {
    varName: "--cx-wish-btn-rgb",
    from: "--cx-accent-rgb",
    alias: "accent",
  },
  fade: {
    varName: "--cx-wish-fade-rgb",
  },
};

const CX_WISH_DEMO = [
  { id: "d1", name: "Anh Minh", relationship: "Bạn thân", text: "Chúc hai bạn trăm năm hạnh phúc, đầu bạc răng long!" },
  { id: "d2", name: "Chị Lan", relationship: "Đồng nghiệp", text: "Chúc mừng hạnh phúc hai em nhé, sớm có tin vui!" },
  { id: "d3", name: "Cô Hạnh", relationship: "Họ hàng", text: "Mong hai cháu luôn yêu thương và nhường nhịn nhau." },
  { id: "d4", name: "Bạn Tuấn", relationship: "Bạn đại học", text: "Cưới vui nhé! Chúc gia đình nhỏ luôn ngập tiếng cười." },
];

let _cxWishItems = [];
let _cxWishRemaining = CX_WISH_MAX;
let _cxWishDemo = false;

// Dạng đang hiện + khách này có gửi được lời chúc không — nhớ lại để đổi dạng
// trong khung xem trước chỉ việc dựng lại, không phải nạp lại cả thiệp.
let _cxWishMode = CX_WISH_MODE_DEFAULT;
let _cxWishCanWrite = false;

// Khách tự tắt dải trôi. CỐ Ý chỉ nằm trong bộ nhớ: tải lại trang là dải hiện
// lại, khách không phải nhớ mình đã tắt ở thiệp nào.
let _cxWishFeedOff = false;

// Vòng chiếu hiện tại — phải dọn trước khi vẽ lại, nếu không lượt cũ vẫn hẹn giờ
// khởi động lại một thẻ track đã bị gỡ khỏi DOM.
let _cxWishReplayTimer = null;
let _cxWishResizeTimer = null;
let _cxWishSentTimer = null;
let _cxWishRevealSync = null;
let _cxWishRevealMO = null;

function _cxWishReduceMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

// ── Màu của mục lời chúc ─────────────────────────────────────────────────────────────

function _cxWishRootVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// "#a89968" → "168 153 104". Token viết dạng bộ ba để chỗ dùng còn chèn được
// alpha: rgb(var(--cx-wish-bubble-rgb) / 0.82).
function _cxWishTriplet(hex) {
  if (typeof hex !== "string") return "";
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return "";
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
}

/**
 * Áp bảng màu của MẪU lên mục lời chúc. Màu là phần cố định của mẫu thiệp — khách
 * không chỉnh được — nên chỉ đọc CX_THEME.wishes, khoá nào mẫu không khai thì token
 * chung của thiệp lo (xem .cx-wsec ở styles/_common.css).
 */
function applyWishStyle() {
  // Ba gốc rời nhau: dải nổi, mục trong thân thiệp và bảng "Xem tất cả" (bảng nằm
  // NGOÀI dải nên không thừa hưởng token) — đặt cho cái nào đang có.
  const targets = ["cx-wish-dock", "cx-wish-sec", "cx-wish-all"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  if (!targets.length) return;

  const decl = (window.CX_THEME && window.CX_THEME.wishes) || {};

  Object.entries(CX_WISH_COLORS).forEach(([key, def]) => {
    const alias = def.alias;
    const val =
      _cxWishTriplet(decl[key]) ||
      (alias && _cxWishTriplet(decl[alias])) ||
      // Không khai `from` = giá trị mặc định nằm thẳng trong CSS (màn tối), ở
      // đây không có gì để đọc ra cả.
      (def.from && _cxWishRootVar(def.from));
    if (val) targets.forEach((t) => t.style.setProperty(def.varName, val));
    if (!def.varName2) return;
    const to =
      _cxWishTriplet(decl[key + "_to"]) ||
      (alias && _cxWishTriplet(decl[alias + "_to"])) ||
      "";
    targets.forEach((t) => {
      if (to) t.style.setProperty(def.varName2, to);
      t.classList.toggle("cx-wg-" + key, !!to);
    });
  });

  const op = Number.isFinite(decl.opacity) ? decl.opacity : CX_WISH_OPACITY;
  const a = String(Math.min(100, Math.max(0, op)) / 100);
  targets.forEach((t) => t.style.setProperty("--cx-wish-bubble-a", a));
}

// Thẻ bọc các mục của thân thiệp. ĐỪNG lấy firstElementChild: nhiều mẫu đặt một
// lớp phủ trang trí (absolute, pointer-events-none) làm con đầu tiên của
// #main-card — chèn mục vào đó là nó nằm trong DOM mà không ai thấy. Mốc chắc
// nhất là cha của mục quà; không có thì lấy con NẰM TRONG LUỒNG nhiều mục nhất.
function _cxWishHost() {
  const card = document.getElementById("main-card");
  if (!card) return null;

  const gift = document.getElementById("section-gift");
  if (gift && card.contains(gift) && gift.parentElement) return gift.parentElement;

  const flow = Array.from(card.children).filter((el) => {
    const pos = getComputedStyle(el).position;
    return pos !== "absolute" && pos !== "fixed";
  });
  flow.sort((a, b) => b.children.length - a.children.length);
  return flow[0] || card;
}

// Ô chữ cái đầu đứng thay ảnh đại diện. Lấy chữ đầu của TỪ CUỐI: tên khách
// thường kèm xưng hô ở trước ("Anh Minh", "Cô Hạnh") hoặc là họ tên đủ — từ cuối
// mới là tên gọi.
function _cxWishAvHtml(name) {
  const last = String(name || "").trim().split(/\s+/).pop() || "";
  const ch = Array.from(last)[0] || "♡";
  return `<span class="cx-wish-av" aria-hidden="true">${escapeHtml(ch.toUpperCase())}</span>`;
}

function _cxWishItemHtml(w) {
  return (
    '<div class="cx-wish-item cx-t">' +
    _cxWishAvHtml(w.name) +
    '<span class="cx-wish-body">' +
    `<span class="cx-wish-name">${escapeHtml(w.name || "Khách mời")}</span>` +
    `<span class="cx-wish-text">${escapeHtml(w.text)}</span>` +
    "</span>" +
    "</div>"
  );
}

// ── DANH MỤC DẠNG HIỆN LỜI CHÚC ─────────────────────────────────────────────
// Thêm một dạng = thêm MỘT mục ở đây + CSS của nó; luồng init/mount/render/
// teardown bên dưới không còn chỗ nào rẽ nhánh theo tên dạng.
//   mount(canWrite)  dựng vỏ (dải nổi, hay mục trong thân thiệp)
//   render(mount)    đổ danh sách _cxWishItems vào #cx-wishes-list
//   stop()           tắt hiệu ứng đang chạy (bỏ trống nếu dạng không có) — gọi
//                    trước mỗi lượt render và khi đổi dạng; phải chịu được gọi cả
//                    lúc chưa dựng gì
//   section          true = dùng chung vỏ mục trong thân thiệp (_cxWishBuildSection)
//   secClass         class thêm vào vỏ mục, để CSS nhận ra dạng
//   pager            true = vỏ mục có thêm hàng chuyển trang
//   dots             true = vỏ mục có dãy chấm chỉ vị trí dải thẻ
//   roll             true = danh sách là một lượt chiếu trôi lên (_cxWishStartRoll)
//   nav              true = vỏ mục có hàng Lùi · vị trí · Tiếp; bấm gọi go(dir)
//   dockClass        class thêm vào dải nổi, để CSS nhận ra dạng
const CX_WISH_MODES = {
  card: {
    mount: _cxWishBuildSection,
    render: _cxWishRenderCards,
    stop: _cxWishStopCards,
    section: true,
    secClass: "cx-wsec-card",
    dots: true,
  },
  live: {
    mount: _cxWishBuildDock,
    render: _cxWishRenderDock,
    stop: _cxWishStopRoll,
    roll: true,
  },
  paged: {
    mount: _cxWishBuildSection,
    render: _cxWishRenderPaged,
    section: true,
    secClass: "cx-wsec-paged",
    pager: true,
  },
  chat: {
    mount: _cxWishBuildSection,
    render: _cxWishRenderChat,
    stop: _cxWishStopTicker,
    section: true,
    secClass: "cx-wsec-chat",
  },
  stack: {
    mount: _cxWishBuildSection,
    render: _cxWishRenderStack,
    stop: _cxWishStopStack,
    go: _cxWishGoStack,
    section: true,
    secClass: "cx-wsec-stack",
    nav: true,
  },
  spotlight: {
    mount: _cxWishBuildSection,
    render: _cxWishRenderSpot,
    stop: _cxWishStopTicker,
    section: true,
    secClass: "cx-wsec-spot",
  },
  float: {
    mount: _cxWishBuildDock,
    render: _cxWishRenderFloat,
    stop: _cxWishStopFloat,
    dockClass: "cx-wdock-float",
  },
  guestbook: {
    mount: _cxWishBuildSection,
    render: _cxWishRenderBook,
    stop: _cxWishStopBook,
    go: _cxWishGoBook,
    section: true,
    secClass: "cx-wsec-book",
    nav: true,
  },
};

// Dọn hiệu ứng của MỌI dạng (stop chịu được gọi lúc chưa dựng gì).
function _cxWishStopAll() {
  Object.values(CX_WISH_MODES).forEach((m) => m.stop?.());
}

function _cxWishDef() {
  return CX_WISH_MODES[_cxWishMode] || CX_WISH_MODES[CX_WISH_MODE_DEFAULT];
}

function _cxWishRender() {
  const mount = document.getElementById("cx-wishes-list");
  if (!mount) return;
  _cxWishStopAll();
  _cxWishDef().render(mount);
}

// Dừng lượt chiếu của dải nổi.
function _cxWishStopRoll() {
  clearTimeout(_cxWishReplayTimer);
  _cxWishReplayTimer = null;
}

// Màn phủ mờ ở đáy dải (.cx-wdock::before) chỉ để chữ trôi không lẫn vào thiệp
// → chưa có lời chúc nào thì bỏ, nếu không đáy thiệp tối đi một mảng mà chẳng
// che gì. Không lời chúc LẪN không ô nhập (khách vào bằng link chung) thì dải
// rỗng hẳn: ẩn luôn nó cùng chỗ trống nó xin ở đáy thân thiệp.
function _cxWishSyncDockFade() {
  const dock = document.getElementById("cx-wish-dock");
  if (!dock) return;
  const has = _cxWishItems.length > 0;
  const blank = !has && !_cxWishCanWrite;
  dock.classList.toggle("is-bare", !has);
  dock.classList.toggle("is-blank", blank);
  document.getElementById("cx-wdock-spacer")?.classList.toggle("is-blank", blank);
}

// Dạng "live": cả danh sách nằm trong một thẻ track trôi từ dưới lên.
function _cxWishRenderDock(mount) {
  const tools = document.getElementById("cx-wdock-tools");
  if (tools) tools.hidden = _cxWishItems.length === 0;
  _cxWishSyncDockFade();

  if (_cxWishItems.length === 0) {
    mount.innerHTML = "";
    mount.hidden = true;
    return;
  }
  mount.hidden = false;

  mount.innerHTML =
    '<div class="cx-wish-track">' +
    _cxWishItems.map(_cxWishItemHtml).join("") +
    "</div>";

  _cxWishStartRoll();
}

// Một lượt chiếu của dải nổi: danh sách vào từ mép DƯỚI khung, đi
// lên cho tới khi lời chúc cuối khuất hẳn, nghỉ một nhịp rồi chạy lại từ đầu. Quãng đường phải đo
// bằng px (chiều cao khung + chiều cao danh sách) vì `translateY(%)` tính theo
// chính thẻ track — hai thứ có kích thước khác nhau.
function _cxWishStartRoll() {
  const view = document.getElementById("cx-wishes-list");
  const track = view?.querySelector(".cx-wish-track");
  if (!view || !track || _cxWishReduceMotion()) return;

  const viewH = view.clientHeight;
  const trackH = track.scrollHeight;

  // Thiệp có bìa thì #main-card còn display:none lúc này → khung đo ra 0. Chờ
  // tới khi nó có kích thước thật rồi mới đo lại, nếu không dải nằm im cả buổi.
  if (!viewH || !trackH) {
    if (!window.ResizeObserver) return;
    const ro = new ResizeObserver(() => {
      if (view.clientHeight && track.scrollHeight) {
        ro.disconnect();
        _cxWishStartRoll();
      }
    });
    ro.observe(view);
    return;
  }

  track.style.setProperty("--cx-wish-from", `${viewH}px`);
  track.style.setProperty("--cx-wish-to", `${-trackH}px`);
  track.style.setProperty("--cx-wish-dur", `${(viewH + trackH) / CX_WISH_SPEED}s`);

  // Gỡ rồi gắn lại .is-rolling để lượt sau chạy lại từ khung hình đầu; đọc
  // offsetHeight ở giữa để trình duyệt chốt trạng thái, không gộp hai thao tác.
  track.classList.remove("is-rolling");
  void track.offsetHeight;
  track.classList.add("is-rolling");

  track.addEventListener(
    "animationend",
    () => {
      clearTimeout(_cxWishReplayTimer);
      _cxWishReplayTimer = setTimeout(() => {
        // Danh sách có thể đã được vẽ lại (khách vừa gửi lời chúc) — thẻ track
        // rời DOM thì bỏ lượt này, lượt mới do _cxWishRender lo.
        if (track.isConnected) _cxWishStartRoll();
      }, CX_WISH_REPLAY_MS);
    },
    { once: true },
  );
}

// Xoay máy / đổi khổ màn là đổi chiều cao khung → phải đo và chiếu lại từ đầu.
// Chỉ dạng nào có lượt chiếu mới cần; các dạng còn lại tự co theo bố cục.
window.addEventListener("resize", () => {
  if (!_cxWishDef().roll) return;
  if (!document.getElementById("cx-wishes-list")) return;
  clearTimeout(_cxWishResizeTimer);
  _cxWishResizeTimer = setTimeout(_cxWishStartRoll, 200);
});

// ── Vỏ MỤC trong thân thiệp (thẻ, paged), ngay trên hộp mừng cưới ─────────

// Tiêu đề mục (kèm số lời chúc) — dùng chung cho mọi dạng có vỏ mục.
function _cxWishSyncSecTitle() {
  const title = document.getElementById("cx-wsec-title");
  if (!title) return;
  title.textContent = _cxWishItems.length
    ? `Lời chúc · ${_cxWishItems.length}`
    : "Lời chúc";
}

const CX_WISH_EMPTY_HTML =
  '<div class="cx-wsec-empty cx-t">Chưa có lời chúc nào — bạn gửi lời đầu tiên nhé!</div>';

// Đổ một mảng lời chúc vào khung; mảng rỗng thì thay bằng dòng mời gửi.
function _cxWishFillList(mount, items) {
  mount.classList.toggle("is-empty", items.length === 0);
  mount.innerHTML = items.length
    ? items.map(_cxWishItemHtml).join("")
    : CX_WISH_EMPTY_HTML;
}

// ── Dạng "card": dải ngang các thẻ cùng khổ ──────────────────────────────────
// Chữ dài bị cắt ở CSS (line-clamp) kèm nút "Xem thêm" — nút chỉ hiện ở thẻ có
// chữ thật sự bị cắt, nên phải ĐO sau khi vẽ. Thiệp có bìa thì mục còn nằm trong
// #main-card đang ẩn (đo ra 0) → ResizeObserver đo lại khi mục có khổ thật.
// Mở một thẻ = cờ .is-open trên khung, CSS cho cả dải cao theo thẻ đó.
// Dãy chấm dưới dải: chấm của thẻ gần tâm khung nhất sáng lên, bấm chấm thì trượt
// tới thẻ đó.
let _cxWishCardRO = null;

// Thẻ gần tâm khung nhất — dải scroll-snap về giữa nên đó là thẻ đang xem.
function _cxWishCardAt(mount) {
  const mid = mount.scrollLeft + mount.clientWidth / 2;
  let best = 0;
  let gap = Infinity;
  mount.querySelectorAll(".cx-wcard").forEach((c, i) => {
    const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
    if (d < gap) {
      gap = d;
      best = i;
    }
  });
  return best;
}

function _cxWishSyncCardDots(mount) {
  const dots = document.getElementById("cx-wcard-dots");
  if (!dots) return;
  const cur = _cxWishCardAt(mount);
  dots.querySelectorAll(".cx-wpage-dot").forEach((d, i) =>
    d.classList.toggle("is-on", i === cur),
  );
}

function _cxWishBuildCardDots(mount) {
  const dots = document.getElementById("cx-wcard-dots");
  if (!dots) return;
  const n = _cxWishItems.length;
  dots.hidden = n < 2;
  dots.innerHTML = Array.from(
    { length: n },
    (_, i) =>
      `<button type="button" class="cx-wpage-dot" data-w-dot="${i}" aria-label="Lời chúc ${i + 1}"></button>`,
  ).join("");
  if (!dots.dataset.wBound) {
    dots.dataset.wBound = "1";
    // Cuộn NGANG ngay trong khung — scrollIntoView sẽ kéo lây cả trang dọc.
    dots.addEventListener("click", (e) => {
      const btn = e.target.closest?.("[data-w-dot]");
      const card = btn && mount.querySelector(`[data-w-card="${btn.dataset.wDot}"]`);
      if (!card) return;
      mount.scrollTo({
        left: card.offsetLeft - (mount.clientWidth - card.offsetWidth) / 2,
        behavior: _cxWishReduceMotion() ? "auto" : "smooth",
      });
    });
  }
  _cxWishSyncCardDots(mount);
}

// Tự chuyển thẻ: dải đứng yên đủ CX_WISH_CARD_IDLE_MS thì trượt sang thẻ kế (hết
// vòng về thẻ đầu). Khách kéo/vuốt/lăn/bấm chấm là đếm lại từ 0. Bỏ nhịp khi dải
// ngoài khung nhìn, tab ẩn hoặc đang mở "Xem thêm" một thẻ.
const CX_WISH_CARD_IDLE_MS = 3000;
let _cxWishCardTimer = null;
let _cxWishCardIO = null;
let _cxWishCardSeen = false;
// Cuộn do chính bộ đếm gây ra — sự kiện scroll lúc này không phải khách kéo tay.
let _cxWishCardAutoUntil = 0;

function _cxWishArmCards(mount) {
  clearTimeout(_cxWishCardTimer);
  _cxWishCardTimer = null;
  if (_cxWishItems.length < 2 || !mount.isConnected) return;
  _cxWishCardTimer = setTimeout(() => _cxWishStepCards(mount), CX_WISH_CARD_IDLE_MS);
}

function _cxWishStepCards(mount) {
  const cards = mount.querySelectorAll(".cx-wcard");
  if (
    cards.length > 1 &&
    _cxWishCardSeen &&
    !document.hidden &&
    !mount.classList.contains("is-open")
  ) {
    const card = cards[(_cxWishCardAt(mount) + 1) % cards.length];
    _cxWishCardAutoUntil = Date.now() + 1000;
    mount.scrollTo({
      left: card.offsetLeft - (mount.clientWidth - card.offsetWidth) / 2,
      behavior: _cxWishReduceMotion() ? "auto" : "smooth",
    });
  }
  _cxWishArmCards(mount);
}

function _cxWishStopCards() {
  _cxWishCardRO?.disconnect();
  _cxWishCardRO = null;
  clearTimeout(_cxWishCardTimer);
  _cxWishCardTimer = null;
  _cxWishCardIO?.disconnect();
  _cxWishCardIO = null;
}

function _cxWishCardHtml(w, i) {
  return (
    `<div class="cx-wcard" data-w-card="${i}">` +
    '<div class="cx-wcard-head">' +
    _cxWishAvHtml(w.name) +
    `<span class="cx-wish-name">${escapeHtml(w.name || "Khách mời")}</span>` +
    "</div>" +
    `<div class="cx-wcard-text">${escapeHtml(w.text)}</div>` +
    `<button type="button" class="cx-wcard-more" data-w-more="${i}" hidden>Xem thêm</button>` +
    "</div>"
  );
}

// Hiện nút ở thẻ có chữ bị cắt; thẻ đang mở giữ nút ("Thu gọn") dù hết bị cắt.
function _cxWishSyncMore(mount) {
  mount.querySelectorAll(".cx-wcard").forEach((card) => {
    const btn = card.querySelector(".cx-wcard-more");
    const text = card.querySelector(".cx-wcard-text");
    if (!btn || !text) return;
    const open = card.classList.contains("is-open");
    btn.hidden = !open && text.scrollHeight <= text.clientHeight + 1;
    btn.textContent = open ? "Thu gọn" : "Xem thêm";
  });
}

function _cxWishToggleCard(mount, i) {
  const card = mount.querySelector(`[data-w-card="${i}"]`);
  if (!card) return;
  const open = !card.classList.contains("is-open");
  // Mỗi lần chỉ mở MỘT thẻ: dải cao theo thẻ đang mở.
  mount.querySelectorAll(".cx-wcard.is-open").forEach((c) => c.classList.remove("is-open"));
  card.classList.toggle("is-open", open);
  mount.classList.toggle("is-open", open);
  _cxWishSyncMore(mount);
}

// Chuột không "vuốt" được như ngón tay → nhấn giữ rồi kéo để cuộn dải (máy tính,
// kể cả trong khung điện thoại giả lập). Tắt snap lúc kéo cho dải bám theo chuột,
// thả ra mới trả snap để nó tự dừng đúng một thẻ. Kéo quá vài px thì nuốt cú click
// kế tiếp — nhả chuột trên nút "Xem thêm" không được mở thẻ.
function _cxWishBindCardDrag(mount) {
  let x0 = 0;
  let left0 = 0;
  let moved = false;
  let dragging = false;

  mount.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    dragging = true;
    moved = false;
    x0 = e.clientX;
    left0 = mount.scrollLeft;
  });
  mount.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - x0;
    if (!moved && Math.abs(dx) < 4) return;
    if (!moved) {
      moved = true;
      mount.setPointerCapture?.(e.pointerId);
      mount.classList.add("is-dragging");
    }
    mount.scrollLeft = left0 - dx;
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    if (!moved) return;
    mount.classList.remove("is-dragging");
    // Trả snap xong trình duyệt tự kéo về thẻ gần nhất; thêm một cú trượt rõ ràng
    // để máy không tự snap vẫn dừng đúng thẻ.
    const card = mount.querySelectorAll(".cx-wcard")[_cxWishCardAt(mount)];
    if (card)
      mount.scrollTo({
        left: card.offsetLeft - (mount.clientWidth - card.offsetWidth) / 2,
        behavior: _cxWishReduceMotion() ? "auto" : "smooth",
      });
  };
  mount.addEventListener("pointerup", end);
  mount.addEventListener("pointercancel", end);
  mount.addEventListener(
    "click",
    (e) => {
      if (!moved) return;
      moved = false;
      e.stopPropagation();
      e.preventDefault();
    },
    true,
  );
}

function _cxWishRenderCards(mount) {
  _cxWishSyncSecTitle();
  mount.classList.remove("is-open");
  mount.classList.toggle("is-empty", _cxWishItems.length === 0);
  mount.innerHTML = _cxWishItems.length
    ? _cxWishItems.map(_cxWishCardHtml).join("")
    : CX_WISH_EMPTY_HTML;
  if (!_cxWishItems.length) {
    const dots = document.getElementById("cx-wcard-dots");
    if (dots) dots.hidden = true;
    return;
  }

  // Uỷ quyền một lần cho khung: nội dung vẽ lại mỗi lượt render.
  if (!mount.dataset.wCards) {
    mount.dataset.wCards = "1";
    _cxWishBindCardDrag(mount);
    mount.addEventListener("click", (e) => {
      const btn = e.target.closest?.("[data-w-more]");
      if (btn) _cxWishToggleCard(mount, btn.dataset.wMore);
    });
    // Khách tự tương tác với dải → đếm lại 4 giây từ đầu.
    const reset = () => _cxWishArmCards(mount);
    ["pointerdown", "touchstart", "wheel", "keydown"].forEach((ev) =>
      mount.addEventListener(ev, reset, { passive: true }),
    );
    document.getElementById("cx-wcard-dots")?.addEventListener("click", reset);
    let tick = false;
    mount.addEventListener(
      "scroll",
      () => {
        if (Date.now() > _cxWishCardAutoUntil) reset();
        if (tick) return;
        tick = true;
        requestAnimationFrame(() => {
          tick = false;
          _cxWishSyncCardDots(mount);
        });
      },
      { passive: true },
    );
  }

  _cxWishBuildCardDots(mount);
  _cxWishSyncMore(mount);
  if (window.ResizeObserver) {
    _cxWishCardRO = new ResizeObserver(() => {
      _cxWishSyncMore(mount);
      _cxWishSyncCardDots(mount);
    });
    _cxWishCardRO.observe(mount);
  }

  _cxWishCardIO?.disconnect();
  _cxWishCardSeen = !window.IntersectionObserver;
  if (window.IntersectionObserver) {
    // Dải vừa lọt vào tầm nhìn thì đếm từ 0, khách kịp đọc thẻ đầu.
    _cxWishCardIO = new IntersectionObserver((es) => {
      const seen = es[es.length - 1].isIntersecting;
      if (seen && !_cxWishCardSeen) _cxWishArmCards(mount);
      _cxWishCardSeen = seen;
    });
    _cxWishCardIO.observe(mount);
  }
  _cxWishArmCards(mount);
}

// ── Dạng "paged": mỗi lần một trang, khách tự bấm sang ──────────────────────
// Không tự chạy: dạng này dành cho người muốn đọc kỹ, danh sách đứng yên cho
// tới khi bấm. Trang hiện tại giữ trong _cxWishPage và luôn được kẹp lại theo số
// trang thật — danh sách dài ra (khách vừa gửi) hay ngắn đi đều không kẹt.
let _cxWishPage = 0;

function _cxWishPageCount() {
  return Math.max(1, Math.ceil(_cxWishItems.length / CX_WISH_PAGE_SIZE));
}

function _cxWishRenderPaged(mount) {
  _cxWishSyncSecTitle();
  const pages = _cxWishPageCount();
  _cxWishPage = Math.min(Math.max(_cxWishPage, 0), pages - 1);
  const from = _cxWishPage * CX_WISH_PAGE_SIZE;
  _cxWishFillList(mount, _cxWishItems.slice(from, from + CX_WISH_PAGE_SIZE));
  _cxWishSyncPager(pages);
}

// Hàng chuyển trang: hai nút + dãy chấm. Chấm chỉ để nhìn cho biết đang ở đâu và
// bấm nhảy thẳng; nhiều trang quá thì nút vẫn là đường đi chính nên không cắt.
function _cxWishSyncPager(pages) {
  const bar = document.getElementById("cx-wish-pager");
  if (!bar) return;
  bar.hidden = _cxWishItems.length <= CX_WISH_PAGE_SIZE;
  const dots = bar.querySelector(".cx-wpage-dots");
  if (dots)
    dots.innerHTML = Array.from({ length: pages }, (_, i) =>
      [
        '<button type="button" class="cx-wpage-dot' +
          (i === _cxWishPage ? " is-on" : "") +
          '"',
        `data-w-page="${i}" aria-label="Trang ${i + 1}"></button>`,
      ].join(" "),
    ).join("");
  const prev = bar.querySelector('[data-w-page="prev"]');
  const next = bar.querySelector('[data-w-page="next"]');
  if (prev) prev.disabled = _cxWishPage <= 0;
  if (next) next.disabled = _cxWishPage >= pages - 1;
}

function _cxWishGoPage(to) {
  const pages = _cxWishPageCount();
  const n = to === "prev" ? _cxWishPage - 1 : to === "next" ? _cxWishPage + 1 : +to;
  const next = Math.min(Math.max(n, 0), pages - 1);
  if (next === _cxWishPage) return;
  _cxWishPage = next;
  const mount = document.getElementById("cx-wishes-list");
  if (mount) _cxWishRenderPaged(mount);
}

function _cxWishPagerHtml() {
  return (
    '<div class="cx-wpage" id="cx-wish-pager" hidden>' +
    '<button type="button" class="cx-wpage-btn" data-w-page="prev" aria-label="Trang trước">' +
    '<i data-lucide="chevron-left" style="width:16px;height:16px"></i>' +
    "</button>" +
    '<span class="cx-wpage-dots"></span>' +
    '<button type="button" class="cx-wpage-btn" data-w-page="next" aria-label="Trang sau">' +
    '<i data-lucide="chevron-right" style="width:16px;height:16px"></i>' +
    "</button>" +
    "</div>"
  );
}

// ── Nhịp tự chạy dùng chung (chat, spotlight, float) ────────────────────────
// Bỏ qua nhịp khi tab ẩn hoặc mục lời chúc nằm ngoài khung nhìn — chạy suông
// tốn pin, và khách cuộn tới sẽ thấy đúng lượt đang dở thay vì một khung rỗng.
let _cxWishTick = null;
let _cxWishTickIO = null;
let _cxWishSeen = true;

function _cxWishStartTicker(fn, ms) {
  _cxWishStopTicker();
  const sec = document.getElementById("cx-wish-sec");
  _cxWishSeen = true;
  if (sec && window.IntersectionObserver) {
    _cxWishTickIO = new IntersectionObserver((es) => {
      _cxWishSeen = es[es.length - 1].isIntersecting;
    });
    _cxWishTickIO.observe(sec);
  }
  _cxWishTick = setInterval(() => {
    if (document.hidden || !_cxWishSeen) return;
    fn();
  }, ms);
}

function _cxWishStopTicker() {
  clearInterval(_cxWishTick);
  _cxWishTick = null;
  _cxWishTickIO?.disconnect();
  _cxWishTickIO = null;
}

// Hàng Lùi · vị trí · Tiếp của dạng chồng thẻ và sổ lưu bút — cùng hình nút với
// hàng chuyển trang (.cx-wpage-btn), giữa là chữ "3 / 12" thay cho dãy chấm.
function _cxWishNavHtml() {
  return (
    '<div class="cx-wpage cx-wnav" id="cx-wish-nav" hidden>' +
    '<button type="button" class="cx-wpage-btn" data-w-nav="prev" aria-label="Lời chúc trước">' +
    '<i data-lucide="chevron-left" style="width:16px;height:16px"></i>' +
    "</button>" +
    '<span class="cx-wnav-pos cx-t" id="cx-wish-nav-pos"></span>' +
    '<button type="button" class="cx-wpage-btn" data-w-nav="next" aria-label="Lời chúc sau">' +
    '<i data-lucide="chevron-right" style="width:16px;height:16px"></i>' +
    "</button>" +
    "</div>"
  );
}

// `loop` = vòng tròn (hai nút luôn bấm được); không thì tắt nút ở hai đầu.
function _cxWishSyncNav(at, n, loop) {
  const bar = document.getElementById("cx-wish-nav");
  if (!bar) return;
  bar.hidden = n < 2;
  const pos = document.getElementById("cx-wish-nav-pos");
  if (pos) pos.textContent = `${at + 1} / ${n}`;
  const prev = bar.querySelector('[data-w-nav="prev"]');
  const next = bar.querySelector('[data-w-nav="next"]');
  if (prev) prev.disabled = !loop && at <= 0;
  if (next) next.disabled = !loop && at >= n - 1;
}

// Vuốt ngang trên `el` → go(±1). Ngón tay lẫn chuột; dưới 40px coi như chạm.
function _cxWishBindSwipe(el, go) {
  let x0 = null;
  el.addEventListener("pointerdown", (e) => {
    x0 = e.clientX;
  });
  el.addEventListener("pointerup", (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  });
  el.addEventListener("pointercancel", () => {
    x0 = null;
  });
}

// ── Dạng "chat": bong bóng trò chuyện ────────────────────────────────────────
// Khung cao cố định, tin dồn đáy; mỗi nhịp một tin mới trồi lên và tin cũ nhất
// rời khung — khung cố định để mục không co giãn đẩy cả thiệp theo mỗi nhịp.
// Giữ tối đa n-1 tin để một lời chúc không hiện hai lần cùng lúc. Một lời chúc
// hoặc khách tắt chuyển động thì đứng yên, cuộn tay.
let _cxWishChatAt = 0;

function _cxWishChatRowHtml(w, i) {
  return (
    `<div class="cx-wchat-row${i % 3 === 1 ? " is-r" : ""}">` +
    _cxWishAvHtml(w.name) +
    '<span class="cx-wchat-bub cx-t">' +
    `<span class="cx-wish-name">${escapeHtml(w.name || "Khách mời")}</span>` +
    `<span class="cx-wish-text">${escapeHtml(w.text)}</span>` +
    "</span>" +
    "</div>"
  );
}

function _cxWishRenderChat(mount) {
  _cxWishSyncSecTitle();
  const n = _cxWishItems.length;
  if (!n) {
    mount.classList.remove("is-live");
    _cxWishFillList(mount, []);
    return;
  }
  mount.classList.remove("is-empty");
  const live = n > 1 && !_cxWishReduceMotion();
  mount.classList.toggle("is-live", live);
  if (!live) {
    mount.innerHTML = _cxWishItems.map(_cxWishChatRowHtml).join("");
    return;
  }
  const keep = Math.min(CX_WISH_CHAT_KEEP, n - 1);
  mount.innerHTML = _cxWishItems.slice(0, keep).map(_cxWishChatRowHtml).join("");
  _cxWishChatAt = keep;
  _cxWishStartTicker(() => {
    const items = _cxWishItems;
    if (!items.length) return;
    mount.insertAdjacentHTML(
      "beforeend",
      _cxWishChatRowHtml(items[_cxWishChatAt % items.length], _cxWishChatAt),
    );
    _cxWishChatAt++;
    while (mount.children.length > keep) mount.firstElementChild.remove();
  }, CX_WISH_CHAT_MS);
}

// ── Dạng "stack": chồng thẻ, vuốt để sang ───────────────────────────────────
// MỌI thẻ nằm chung một ô lưới nên khung cao bằng thẻ dài nhất — đổi thẻ không
// làm mục co giãn. Thẻ đang xem độ sâu 0, hai thẻ sau ló ra phía dưới, còn lại
// ẩn (vẫn giữ chỗ trong ô lưới). Vòng tròn: hết thì quay về đầu.
let _cxWishStackAt = 0;
let _cxWishStackTimer = null;

function _cxWishStopStack() {
  clearTimeout(_cxWishStackTimer);
  _cxWishStackTimer = null;
}

function _cxWishSyncStack() {
  const n = _cxWishItems.length;
  document.querySelectorAll("#cx-wishes-list [data-w-stack]").forEach((c) => {
    const d = (+c.dataset.wStack - _cxWishStackAt + n) % n;
    c.dataset.d = d < 3 ? String(d) : "x";
  });
  _cxWishSyncNav(_cxWishStackAt, n, true);
}

function _cxWishRenderStack(mount) {
  _cxWishSyncSecTitle();
  const n = _cxWishItems.length;
  if (!n) {
    _cxWishFillList(mount, []);
    _cxWishSyncNav(0, 0, true);
    return;
  }
  mount.classList.remove("is-empty");
  _cxWishStackAt = Math.min(_cxWishStackAt, n - 1);
  mount.innerHTML =
    '<div class="cx-wstack">' +
    _cxWishItems
      .map(
        (w, i) =>
          `<div class="cx-wstack-card cx-t" data-w-stack="${i}">` +
          `<span class="cx-wstack-text">${escapeHtml(w.text)}</span>` +
          '<span class="cx-wstack-foot">' +
          _cxWishAvHtml(w.name) +
          `<span class="cx-wish-name">${escapeHtml(w.name || "Khách mời")}</span>` +
          "</span>" +
          "</div>",
      )
      .join("") +
    "</div>";
  _cxWishBindSwipe(mount.firstElementChild, _cxWishGoStack);
  _cxWishSyncStack();
}

// Tiếp: thẻ trên cùng bay sang phải rồi mới dồn chồng lên; Lùi: dồn ngay.
function _cxWishGoStack(dir) {
  const n = _cxWishItems.length;
  if (n < 2 || _cxWishStackTimer) return;
  const step = () => {
    _cxWishStackTimer = null;
    _cxWishStackAt = (_cxWishStackAt + dir + n) % n;
    _cxWishSyncStack();
  };
  const top = document.querySelector('#cx-wishes-list [data-w-stack][data-d="0"]');
  if (dir > 0 && top && !_cxWishReduceMotion()) {
    top.dataset.d = "out";
    _cxWishStackTimer = setTimeout(step, 320);
  } else step();
}

// ── Dạng "spotlight": một câu lớn, tự chuyển ────────────────────────────────
// Như chồng thẻ, mọi câu chung một ô lưới nên khung cao bằng câu dài nhất. Bấm
// vào câu để sang ngay (nhịp tự chuyển đếm lại từ đầu). Khách tắt chuyển động
// thì không tự chuyển — chỉ bấm.
let _cxWishSpotAt = 0;

function _cxWishShowSpot(i) {
  const n = _cxWishItems.length;
  _cxWishSpotAt = ((i % n) + n) % n;
  document.querySelectorAll("#cx-wishes-list [data-w-spot]").forEach((el) => {
    el.classList.toggle("is-on", +el.dataset.wSpot === _cxWishSpotAt);
  });
  const pos = document.getElementById("cx-wspot-pos");
  if (pos) pos.textContent = `${_cxWishSpotAt + 1} / ${n}`;
  // Gỡ rồi gắn lại để thanh tiến độ chạy lại từ đầu (đọc offsetWidth ở giữa).
  const bar = document.getElementById("cx-wspot-bar");
  if (bar) {
    bar.classList.remove("is-run");
    void bar.offsetWidth;
    bar.classList.add("is-run");
  }
}

function _cxWishRenderSpot(mount) {
  _cxWishSyncSecTitle();
  const n = _cxWishItems.length;
  if (!n) {
    _cxWishFillList(mount, []);
    return;
  }
  mount.classList.remove("is-empty");
  const auto = n > 1 && !_cxWishReduceMotion();
  mount.innerHTML =
    '<div class="cx-wspot">' +
    '<span class="cx-wspot-q cx-a" aria-hidden="true">“</span>' +
    '<div class="cx-wspot-stage">' +
    _cxWishItems
      .map(
        (w, i) =>
          `<figure class="cx-wspot-item" data-w-spot="${i}">` +
          `<blockquote class="cx-wspot-text cx-t">${escapeHtml(w.text)}</blockquote>` +
          `<figcaption class="cx-wish-name">${escapeHtml(w.name || "Khách mời")}</figcaption>` +
          "</figure>",
      )
      .join("") +
    "</div>" +
    (auto ? '<span class="cx-wspot-bar" id="cx-wspot-bar"><i></i></span>' : "") +
    (n > 1 ? '<span class="cx-wspot-pos cx-t" id="cx-wspot-pos"></span>' : "") +
    "</div>";

  const restart = () => {
    if (auto) _cxWishStartTicker(() => _cxWishShowSpot(_cxWishSpotAt + 1), CX_WISH_SPOT_MS);
  };
  if (n > 1)
    mount.querySelector(".cx-wspot-stage")?.addEventListener("click", () => {
      _cxWishShowSpot(_cxWishSpotAt + 1);
      restart();
    });
  _cxWishShowSpot(Math.min(_cxWishSpotAt, n - 1));
  restart();
}

// ── Dạng "float": bong bóng bay (dải nổi) ───────────────────────────────────
// Dùng chung vỏ dải nổi với "live"; khác ở chỗ mỗi nhịp thả MỘT bong bóng từ
// đáy khung bay lên rồi tan, kèm vài trái tim. Quãng bay đo theo chiều cao khung
// (--cx-wf-h) vì translateY(%) tính theo chính bong bóng. Chỉ thả khi dải đang
// hiện và khách chưa tắt dải; khách tắt chuyển động thì đứng yên vài lời mới nhất.
let _cxWishFloatAt = 0;

function _cxWishStopFloat() {
  _cxWishStopTicker();
  document.querySelectorAll(".cx-wfloat-bal, .cx-wfloat-hrt").forEach((el) => el.remove());
}

function _cxWishSpawnFloat(mount) {
  const dock = document.getElementById("cx-wish-dock");
  if (!dock || !dock.classList.contains("is-on") || _cxWishFeedOff) return;
  const items = _cxWishItems;
  if (!items.length || !mount.clientHeight) return;
  mount.style.setProperty("--cx-wf-h", mount.clientHeight + "px");

  const w = items[_cxWishFloatAt++ % items.length];
  const tpl = document.createElement("template");
  tpl.innerHTML = _cxWishItemHtml(w);
  const bal = tpl.content.firstElementChild;
  bal.classList.add("cx-wfloat-bal");
  bal.style.left = Math.round(Math.random() * 18) + "%";
  bal.style.setProperty("--cx-wf-sx", Math.round(Math.random() * 32 - 16) + "px");
  bal.addEventListener("animationend", () => bal.remove());
  mount.appendChild(bal);

  for (let i = 0; i < 2; i++) {
    const h = document.createElement("span");
    h.className = "cx-wfloat-hrt";
    h.innerHTML = '<i data-lucide="heart" style="width:16px;height:16px"></i>';
    h.style.left = 70 + Math.round(Math.random() * 24) + "%";
    h.style.animationDelay = i * 0.6 + "s";
    h.addEventListener("animationend", () => h.remove());
    mount.appendChild(h);
    window.lucide?.createIcons({ root: h });
  }
}

function _cxWishRenderFloat(mount) {
  const tools = document.getElementById("cx-wdock-tools");
  if (tools) tools.hidden = _cxWishItems.length === 0;
  _cxWishSyncDockFade();
  mount.classList.add("cx-wfloat");

  if (_cxWishItems.length === 0) {
    mount.innerHTML = "";
    mount.hidden = true;
    return;
  }
  mount.hidden = false;
  mount.innerHTML = "";

  if (_cxWishReduceMotion()) {
    mount.innerHTML =
      '<div class="cx-wish-track">' +
      _cxWishItems.slice(0, 3).map(_cxWishItemHtml).join("") +
      "</div>";
    return;
  }
  _cxWishFloatAt = 0;
  _cxWishSpawnFloat(mount);
  _cxWishStartTicker(() => _cxWishSpawnFloat(mount), CX_WISH_FLOAT_MS);
}

// ── Dạng "guestbook": sổ lưu bút, lật từng trang ────────────────────────────
// Mỗi trang một lời chúc trên giấy kẻ dòng; mọi trang chung một ô lưới (khung
// cao bằng trang dài nhất). Tiếp = trang hiện tại lật sang trái rồi trang sau
// lộ ra; hai đầu sổ thì nút tắt chứ không vòng lại.
let _cxWishBookAt = 0;
let _cxWishBookTimer = null;

function _cxWishStopBook() {
  clearTimeout(_cxWishBookTimer);
  _cxWishBookTimer = null;
}

function _cxWishSyncBook() {
  document.querySelectorAll("#cx-wishes-list [data-w-book]").forEach((p) => {
    const i = +p.dataset.wBook;
    p.classList.toggle("is-on", i === _cxWishBookAt);
    p.classList.toggle("is-next", i === _cxWishBookAt + 1);
    p.classList.remove("is-turn");
  });
  _cxWishSyncNav(_cxWishBookAt, _cxWishItems.length, false);
}

function _cxWishRenderBook(mount) {
  _cxWishSyncSecTitle();
  const n = _cxWishItems.length;
  if (!n) {
    _cxWishFillList(mount, []);
    _cxWishSyncNav(0, 0, false);
    return;
  }
  mount.classList.remove("is-empty");
  _cxWishBookAt = Math.min(_cxWishBookAt, n - 1);
  mount.innerHTML =
    '<div class="cx-wbook">' +
    _cxWishItems
      .map(
        (w, i) =>
          `<div class="cx-wbook-page" data-w-book="${i}">` +
          `<span class="cx-wbook-no cx-t">Trang ${i + 1}</span>` +
          `<span class="cx-wbook-text cx-t">${escapeHtml(w.text)}</span>` +
          `<span class="cx-wbook-sig cx-a">${escapeHtml(w.name || "Khách mời")}</span>` +
          "</div>",
      )
      .join("") +
    "</div>";
  _cxWishBindSwipe(mount.firstElementChild, _cxWishGoBook);
  _cxWishSyncBook();
}

function _cxWishGoBook(dir) {
  const n = _cxWishItems.length;
  const to = _cxWishBookAt + dir;
  if (to < 0 || to >= n || _cxWishBookTimer) return;
  const step = () => {
    _cxWishBookTimer = null;
    _cxWishBookAt = to;
    _cxWishSyncBook();
  };
  const cur = document.querySelector(`#cx-wishes-list [data-w-book="${_cxWishBookAt}"]`);
  if (dir > 0 && cur && !_cxWishReduceMotion()) {
    cur.classList.add("is-turn");
    _cxWishBookTimer = setTimeout(step, 700);
  } else step();
}

// Mục nằm ở ĐÂU: thêm vào CUỐI thân thiệp rồi đẩy lên trước hộp mừng cưới bằng
// flex `order` — chèn thẳng vào giữa là mọi selector :nth-child đã lưu trong
// text_overrides của các mục phía sau lệch đi một bậc (cùng lý do applyCustomBlocks
// append cuối rồi mới xếp order).
function _cxWishPlaceSection() {
  const sec = document.getElementById("cx-wish-sec");
  const host = _cxWishHost();
  // Mốc là con TRỰC TIẾP của thân thiệp: mẫu nào bọc mục quà thêm một lớp thì
  // leo ngược lên tới lớp đó (order chỉ có nghĩa giữa các con cùng một cha).
  let gift = document.getElementById("section-gift");
  while (gift && gift.parentElement && gift.parentElement !== host)
    gift = gift.parentElement;
  if (!sec || !host || !gift || gift.parentElement !== host) return;

  const cs = getComputedStyle(host);
  if (cs.display.indexOf("flex") === -1 || cs.flexDirection !== "column") return;

  // Mốc chưa có order (thiệp không có khối văn bản tự thêm) thì tự đánh số theo
  // ĐÚNG công thức i*100 của applyCustomBlocks để hai bên không đá nhau.
  if (!gift.style.order) {
    Array.from(host.children)
      .filter((k) => k !== sec && !k.classList.contains("cx-custom-block"))
      .forEach((k, i) => {
        k.style.order = String(i * 100);
        k.setAttribute("data-cx-ord", "1");
      });
  }
  sec.style.order = String(Number(gift.style.order || 0) - 1);
}
// applyCustomBlocks đánh lại order mỗi lần vẽ khối văn bản → gọi lại chỗ này.
window.cxWishPlace = _cxWishPlaceSection;

function _cxWishBuildSection(canWrite) {
  if (document.getElementById("cx-wish-sec")) return;
  const host = _cxWishHost();
  if (!host) return;

  const def = _cxWishDef();
  const sec = document.createElement("section");
  sec.id = "cx-wish-sec";
  // cx-no-edit: mục do helper dựng, không phải chữ của mẫu để mà chỉnh tay.
  sec.className = "cx-wsec cx-no-edit" + (def.secClass ? " " + def.secClass : "");
  // Ô gửi đứng TRÊN danh sách (khác dải nổi: ô gửi ở đáy) — khách thấy chỗ viết
  // ngay khi cuộn tới, không phải đọc hết lời chúc mới tìm ra.
  sec.innerHTML =
    '<div class="cx-wsec-head">' +
    '<span class="cx-wsec-title cx-a" id="cx-wsec-title">Lời chúc</span>' +
    "</div>" +
    _cxWishComposerHtml(canWrite) +
    '<div class="cx-wsec-list" id="cx-wishes-list"></div>' +
    (def.pager ? _cxWishPagerHtml() : "") +
    (def.nav ? _cxWishNavHtml() : "") +
    (def.dots ? '<div class="cx-wpage-dots cx-wcard-dots" id="cx-wcard-dots" hidden></div>' : "");

  host.appendChild(sec);
  _cxWishPlaceSection();

  // Uỷ quyền cho cả hàng: dãy chấm được vẽ lại mỗi lượt render.
  if (def.pager)
    sec.querySelector("#cx-wish-pager")?.addEventListener("click", (e) => {
      const btn = e.target.closest?.("[data-w-page]");
      if (btn && !btn.disabled) _cxWishGoPage(btn.dataset.wPage);
    });
  if (def.nav)
    sec.querySelector("#cx-wish-nav")?.addEventListener("click", (e) => {
      const btn = e.target.closest?.("[data-w-nav]");
      if (btn && !btn.disabled) _cxWishDef().go?.(btn.dataset.wNav === "prev" ? -1 : 1);
    });

  // lucide không tự quét lại phần chèn động.
  window.lucide?.createIcons({ root: sec });
  _cxWishBindComposer(canWrite);
}

function _cxWishSetDockText() {
  const hint = document.getElementById("cx-wdock-hint");
  if (!hint) return;
  // Ngắn gọn: pill co theo dòng này, câu dài là nó chiếm hết bề ngang cột.
  hint.textContent =
    _cxWishRemaining > 0 ? "Gửi lời chúc…" : "Cảm ơn lời chúc của bạn!";
  // Hết lượt thì ô nhập chỉ còn là một dòng cảm ơn: mờ đi, bỏ con trỏ gõ chữ.
  document
    .getElementById("cx-wdock-open")
    ?.classList.toggle("is-done", _cxWishRemaining <= 0);
}

// Bộ đếm chỉ xuất hiện ở đoạn cuối (CX_WISH_COUNT_AT ký tự) để báo sắp chạm trần.
function _cxWishSyncCount(input) {
  const el = document.getElementById("cx-wdock-count");
  if (!el) return;
  const left = CX_WISH_MAX_LEN - (input?.value || "").length;
  el.textContent = `Còn ${left} ký tự`;
  el.hidden = left > CX_WISH_COUNT_AT;
}

// Nút Gửi sáng lên khi có chữ — ô rỗng thì nó chỉ là một hình bóng, bấm không nổi.
function _cxWishSyncSend(input) {
  const btn = document.getElementById("cx-wdock-send");
  if (btn) btn.disabled = !(input?.value || "").trim();
}

// Dải nổi ghim đáy khung nhìn: danh sách lời chúc trôi lên ở trên, ô "Gửi lời
// chúc" ở dưới — cùng một khối, đè lên thiệp chứ không nằm trong thân thiệp.
// Bong bóng và ô nhập dùng CHUNG mặt giấy của mẫu (nền `panel`, chữ `body`), tách
// khỏi thiệp bằng viền màu nhấn + bóng đổ chứ không bằng tấm kính xám.
// Ai cũng đọc được danh sách; ô nhập chỉ dựng cho khách cầm link cá nhân hoá
// (hoặc bản xem thử), người còn lại chỉ có phần đọc.
function _cxWishBuildDock(canWrite) {
  if (document.getElementById("cx-wish-dock")) return;

  const dock = document.createElement("div");
  dock.id = "cx-wish-dock";
  const dockClass = _cxWishDef().dockClass;
  dock.className = "cx-wdock" + (dockClass ? " " + dockClass : "");
  dock.innerHTML =
    '<div class="cx-wdock-inner">' +
    '<div class="cx-wfeed" id="cx-wishes-list" hidden></div>' +
    // Hàng nút chỉ có icon: tắt/bật dải trôi và mở bảng đọc trọn danh sách.
    // Hai icon của nút tắt dựng sẵn cả hai, CSS chọn theo cờ .is-wfeed-off trên
    // dải — lucide không quét lại nên đừng đổi icon bằng JS.
    '<div class="cx-wdock-tools" id="cx-wdock-tools" hidden>' +
    '<button type="button" class="cx-wdock-tool" id="cx-wish-hide" aria-label="Ẩn lời chúc đang trôi">' +
    '<span class="cx-wdock-tool-ico cx-wdock-tool-ico-on"><i data-lucide="eye-off" style="width:15px;height:15px"></i></span>' +
    '<span class="cx-wdock-tool-ico cx-wdock-tool-ico-off"><i data-lucide="eye" style="width:15px;height:15px"></i></span>' +
    "</button>" +
    '<button type="button" class="cx-wdock-tool" id="cx-wish-more" aria-label="Xem tất cả lời chúc">' +
    '<i data-lucide="maximize" style="width:15px;height:15px"></i>' +
    "</button>" +
    "</div>" +
    _cxWishComposerHtml(canWrite) +
    "</div>";
  document.body.appendChild(dock);
  _cxWishBuildAllSheet();

  // Dải đè lên cuối thiệp — chừa đúng chiều cao nó ở đáy thân thiệp, nếu không
  // mục cuối (lời cảm ơn) bị che mất một đoạn.
  const host = _cxWishHost();
  if (host && !document.getElementById("cx-wdock-spacer")) {
    const spacer = document.createElement("div");
    spacer.id = "cx-wdock-spacer";
    // Không có ô nhập thì dải thấp hẳn đi — chừa nguyên 104px là hở một khoảng
    // trắng dưới mục cuối.
    spacer.className = "cx-wdock-spacer" + (canWrite ? "" : " is-slim");
    host.appendChild(spacer);
  }

  document.getElementById("cx-wish-hide")?.addEventListener("click", _cxWishToggleFeed);
  document.getElementById("cx-wish-more")?.addEventListener("click", _cxWishOpenAll);

  // lucide không tự quét lại phần chèn động.
  window.lucide?.createIcons({ root: dock });

  _cxWishBindComposer(canWrite);
  _cxWishWatchReveal(dock);
}

// Ô "Gửi lời chúc" — MỘT bộ markup dùng cho cả dải nổi lẫn mục trong thân thiệp
// (hình dạng do thẻ cha quyết định, xem .cx-wdock / .cx-wsec .cx-wdock-card ở
// styles/_common.css). Khách vào bằng link chung thì KHÔNG dựng gì cả — họ chỉ
// đọc lời chúc; cổng chặn thật nằm ở Edge Function, đây chỉ là phần nhìn.
// Khách cầm link riêng đã rõ danh tính → nhắc lời chúc sẽ đứng tên ai
// ("Viết lời chúc dưới tên Em Linh"). Xưng hô gõ kiểu gì cũng chuẩn về hoa chữ đầu.
function _cxWishPlaceholder() {
  const g = window.CX_GUEST;
  const name = String(g?.name || "").trim();
  if (!name) return "Viết lời chúc…";
  const rel = String(g.relationship || "").trim().toLowerCase();
  const who = rel ? rel.charAt(0).toUpperCase() + rel.slice(1) + " " + name : name;
  return "Viết lời chúc dưới tên " + who;
}

function _cxWishComposerHtml(canWrite) {
  if (!canWrite) return "";
  return (
    '<div class="cx-wdock-card cx-t" id="cx-wdock-open">' +
    '<div class="cx-wdock-row">' +
    // Chip bên trái là dấu hiệu "chỗ này gõ được", và cũng là chỗ báo gửi
    // xong. Hai icon dựng sẵn, CSS chọn cái nào hiện theo .is-sent của thẻ:
    // lucide không quét lại nên đừng đổi icon bằng JS.
    '<span class="cx-wdock-chip">' +
    '<span class="cx-wdock-ico-idle"><i data-lucide="pen-line" style="width:16px;height:16px"></i></span>' +
    '<span class="cx-wdock-ico-done"><i data-lucide="check" style="width:16px;height:16px"></i></span>' +
    "</span>" +
    '<span class="cx-wdock-hint" id="cx-wdock-hint"></span>' +
    `<textarea class="cx-wdock-text" id="cx-wdock-text" rows="1" maxlength="${CX_WISH_MAX_LEN}" ` +
    `placeholder="${escapeHtml(_cxWishPlaceholder())}" aria-label="Lời chúc của bạn"></textarea>` +
    '<button type="button" class="cx-wdock-btn" id="cx-wdock-send" aria-label="Gửi lời chúc" disabled>' +
    '<i data-lucide="send" style="width:16px;height:16px"></i>' +
    "</button>" +
    "</div>" +
    // Hàng dưới chỉ có mặt khi ô đang mở: báo lỗi + bộ đếm, canh trái.
    '<div class="cx-wdock-foot">' +
    '<span class="cx-wdock-msg" id="cx-wdock-msg" hidden></span>' +
    '<span class="cx-wdock-count" id="cx-wdock-count" hidden></span>' +
    "</div>" +
    "</div>"
  );
}

function _cxWishBindComposer(canWrite) {
  if (!canWrite) return;
  _cxWishSetDockText();

  const card = document.getElementById("cx-wdock-open");
  const input = document.getElementById("cx-wdock-text");
  const send = document.getElementById("cx-wdock-send");
  if (!card || !input || !send) return;

  card.addEventListener("click", _cxWishExpand);
  // Ô gõ mở sẵn ở MỌI dạng nên phải chốt chiều cao ngay từ đầu bằng CHÍNH phép
  // đo mà _cxWishExpand dùng — để đó cho trình duyệt tự tính thì lượt bấm đầu
  // tiên lại đo ra một con số khác vài px, thấy rõ là thẻ giật lên một nhịp.
  _cxWishAutoGrow(input);
  // Không đo được (mục còn nằm trong #main-card đang ẩn — thiệp có bìa) thì chờ
  // tới lúc ô thật sự có khổ rồi đo đúng một lần, không thì ô nhập hiện ra với
  // chiều cao rơi vãi và dòng placeholder khi có khi không.
  if (!input.style.height && window.ResizeObserver) {
    const ro = new ResizeObserver(() => {
      if (!input.offsetWidth) return;
      ro.disconnect();
      _cxWishFitInput();
    });
    ro.observe(input);
  }
  input.addEventListener("input", () => {
    _cxWishAutoGrow(input);
    _cxWishSyncCount(input);
    _cxWishSyncSend(input);
  });
  input.addEventListener("keydown", (e) => {
    // Enter gửi luôn (như ô chat), Shift+Enter mới xuống dòng.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      _cxWishSend();
    } else if (e.key === "Escape") {
      // Ô gõ mở sẵn, thu lại là XOÁ chữ đang viết → chỉ rời con trỏ.
      input.blur();
    }
  });
  // Nút Gửi nằm TRONG thẻ nên cú bấm cũng chạy _cxWishExpand — chặn lại để cú
  // bấm chỉ gửi, không kéo theo việc đặt con trỏ vào ô vừa gửi xong.
  send.addEventListener("click", (e) => {
    e.stopPropagation();
    _cxWishSend();
  });
}

// Tắt/bật dải trôi. Chỉ đổi cờ trên dải (CSS lo phần giấu khung + đổi icon);
// bật lại thì đo và chiếu lại từ đầu vì lúc giấu khung không có kích thước.
function _cxWishToggleFeed() {
  const dock = document.getElementById("cx-wish-dock");
  if (!dock) return;
  _cxWishFeedOff = !_cxWishFeedOff;
  dock.classList.toggle("is-wfeed-off", _cxWishFeedOff);
  document
    .getElementById("cx-wish-hide")
    ?.setAttribute(
      "aria-label",
      _cxWishFeedOff ? "Hiện lời chúc đang trôi" : "Ẩn lời chúc đang trôi",
    );
  if (!_cxWishFeedOff) _cxWishStartRoll();
}

// ── Bảng "Xem tất cả lời chúc" ──────────────────────────────────────────────

// Dựng một lần cùng lúc với dải (ẩn sẵn) để applyWishStyle() kịp đổ token màu
// vào — bảng nằm ngoài .cx-wdock nên không thừa hưởng được.
function _cxWishBuildAllSheet() {
  if (document.getElementById("cx-wish-all")) return;

  const wrap = document.createElement("div");
  wrap.id = "cx-wish-all";
  wrap.className = "cx-wall";
  wrap.hidden = true;
  wrap.innerHTML =
    '<div class="cx-wall-veil" id="cx-wish-all-veil"></div>' +
    '<div class="cx-wall-sheet" role="dialog" aria-modal="true" aria-label="Tất cả lời chúc">' +
    '<div class="cx-wall-head">' +
    '<span class="cx-wall-title" id="cx-wish-all-title">Lời chúc</span>' +
    '<button type="button" class="cx-wall-close" id="cx-wish-all-close" aria-label="Đóng">' +
    '<i data-lucide="x" style="width:16px;height:16px"></i>' +
    "</button>" +
    "</div>" +
    '<div class="cx-wall-body" id="cx-wish-all-body"></div>' +
    "</div>";
  document.body.appendChild(wrap);
  // Bảng nằm ngoài dải nên lượt quét icon của dải không với tới đây.
  window.lucide?.createIcons({ root: wrap });

  document.getElementById("cx-wish-all-close")?.addEventListener("click", _cxWishCloseAll);
  document.getElementById("cx-wish-all-veil")?.addEventListener("click", _cxWishCloseAll);
}

function _cxWishAllItemHtml(w) {
  return (
    '<div class="cx-wall-item cx-t">' +
    _cxWishAvHtml(w.name) +
    '<span class="cx-wish-body">' +
    `<span class="cx-wish-name">${escapeHtml(w.name || "Khách mời")}</span>` +
    `<span class="cx-wish-text">${escapeHtml(w.text)}</span>` +
    "</span>" +
    "</div>"
  );
}

function _cxWishAllKey(e) {
  if (e.key === "Escape") _cxWishCloseAll();
}

// Nạp lại nội dung mỗi lần mở: danh sách đổi sau mỗi lượt khách gửi.
function _cxWishOpenAll() {
  const wrap = document.getElementById("cx-wish-all");
  const body = document.getElementById("cx-wish-all-body");
  if (!wrap || !body) return;

  body.innerHTML = _cxWishItems.length
    ? _cxWishItems.map(_cxWishAllItemHtml).join("")
    : '<div class="cx-wall-empty cx-t">Chưa có lời chúc nào.</div>';
  const title = document.getElementById("cx-wish-all-title");
  if (title) title.textContent = `Lời chúc · ${_cxWishItems.length}`;

  wrap.hidden = false;
  document.addEventListener("keydown", _cxWishAllKey);
}

function _cxWishCloseAll() {
  const wrap = document.getElementById("cx-wish-all");
  if (wrap) wrap.hidden = true;
  document.removeEventListener("keydown", _cxWishAllKey);
}

// Dải chỉ hiện khi khách ĐÃ mở bìa VÀ đã cuộn qua màn mở đầu — màn bìa và màn
// hero phải sạch. Cuộn ngược lên đầu thì mờ đi trở lại (chuyển động ở .cx-wdock).
function _cxWishWatchReveal(dock) {
  const card = document.getElementById("main-card");
  _cxWishUnwatchReveal();

  const sync = () => {
    const opened = !card || card.style.display !== "none";
    const scrolled = window.scrollY >= window.innerHeight * CX_WISH_SHOW_AT;
    dock.classList.toggle("is-on", opened && scrolled);
  };

  window.addEventListener("scroll", sync, { passive: true });
  window.addEventListener("resize", sync, { passive: true });
  _cxWishRevealSync = sync;

  // Bìa mở ra không kèm sự kiện cuộn nào — theo dõi luôn thẻ thân thiệp.
  if (card) {
    _cxWishRevealMO = new MutationObserver(sync);
    _cxWishRevealMO.observe(card, {
      attributes: true,
      attributeFilter: ["style"],
    });
  }
  sync();
}

// Gỡ hết thứ _cxWishWatchReveal gắn lên window — đổi dạng lời chúc trong khung
// xem trước dựng lại dải, không gỡ là mỗi lần đổi chồng thêm một bộ listener.
function _cxWishUnwatchReveal() {
  if (_cxWishRevealSync) {
    window.removeEventListener("scroll", _cxWishRevealSync);
    window.removeEventListener("resize", _cxWishRevealSync);
    _cxWishRevealSync = null;
  }
  _cxWishRevealMO?.disconnect();
  _cxWishRevealMO = null;
}

// Ô nhập MỞ SẴN ở mọi dạng: ô gõ và nút Gửi có mặt từ đầu, bấm vào chỉ đặt con
// trỏ chứ hình dạng không đổi. Không mở panel riêng — khách vẫn thấy thiệp và
// danh sách lời chúc phía trên. Ô cao theo chữ, chặn ở CX_WISH_INPUT_ROWS dòng.

function _cxWishInputEl() {
  return document.getElementById("cx-wdock-text");
}

// Cao theo nội dung, chặn ở CX_WISH_INPUT_ROWS dòng rồi mới cho cuộn trong ô.
// Trần phải là BỘI SỐ của line-height (ô không có padding dọc — xem
// .cx-wdock-text), nếu không dòng trên cùng lòi ra một nửa lúc cuộn.
function _cxWishAutoGrow(input) {
  const line = parseFloat(getComputedStyle(input).lineHeight) || 20;
  input.style.height = "auto";
  // Ô đang nằm trong nhánh ẩn (thiệp có bìa: #main-card còn display:none lúc
  // dựng) thì scrollHeight = 0. Ghi "0px" vào là ô cao 0 vĩnh viễn — mở thiệp ra
  // chỉ thấy một vạch, mất cả dòng placeholder. Trả về khổ mặc định của rows=1
  // và đợi lượt đo sau (_cxWishFitInput, do ResizeObserver ở _cxWishBindComposer
  // gọi khi ô hiện ra).
  if (!input.scrollHeight) {
    input.style.height = "";
    return;
  }
  input.style.height =
    Math.min(input.scrollHeight, line * CX_WISH_INPUT_ROWS) + "px";
}

// Đo lại ô nhập khi mục lời chúc vừa thật sự hiện ra (mở bìa xong). Rẻ và không
// đụng gì nếu ô đã có khổ đúng.
function _cxWishFitInput() {
  const input = _cxWishInputEl();
  if (input && !input.value) _cxWishAutoGrow(input);
}

function _cxWishCollapse() {
  const card = document.getElementById("cx-wdock-open");
  if (!card) return;
  card.classList.remove("is-open");
  const input = _cxWishInputEl();
  if (input) {
    input.value = "";
    input.style.height = "";
    _cxWishSyncCount(input);
    _cxWishSyncSend(input);
  }
  _cxWishSetDockMsg("");
}

function _cxWishExpand() {
  const card = document.getElementById("cx-wdock-open");
  if (!card || card.classList.contains("is-open")) return;
  if (_cxWishRemaining <= 0) return;

  clearTimeout(_cxWishSentTimer);
  card.classList.remove("is-sent");
  card.classList.add("is-open");
  const input = _cxWishInputEl();
  input?.focus();
  if (input) _cxWishAutoGrow(input);
}

// Câu báo lỗi nằm ngay dưới ô nhập; chuỗi rỗng là gỡ đi.
function _cxWishSetDockMsg(text) {
  const el = document.getElementById("cx-wdock-msg");
  if (!el) return;
  el.textContent = text || "";
  el.hidden = !text;
}

// Gửi xong ô nhập trống trở lại, nên phải có một nhịp xác nhận: dòng gợi ý thế
// chỗ ô gõ bằng lời cảm ơn, hết CX_WISH_SENT_MS thì trở lại.
function _cxWishFlashSent() {
  const card = document.getElementById("cx-wdock-open");
  const hint = document.getElementById("cx-wdock-hint");
  if (!card || !hint) return;

  card.classList.add("is-sent");
  hint.textContent = "Đã gửi, cảm ơn bạn!";

  clearTimeout(_cxWishSentTimer);
  _cxWishSentTimer = setTimeout(() => {
    card.classList.remove("is-sent");
    _cxWishSetDockText();
  }, CX_WISH_SENT_MS);
}

async function _cxWishSend() {
  const input = _cxWishInputEl();
  const btn = document.getElementById("cx-wdock-send");
  const text = (input?.value || "").trim();
  if (!text) return;
  // maxlength của ô chặn gõ/dán quá trần, đây là lớp chặn thứ hai cho chắc.
  if (text.length > CX_WISH_MAX_LEN) {
    _cxWishSetDockMsg(`Lời chúc tối đa ${CX_WISH_MAX_LEN} ký tự`);
    return;
  }

  if (_cxWishDemo) {
    showPreviewAlert();
    return;
  }

  const g = window.CX_GUEST;
  if (!g || !window.guestDAL) return;

  if (btn) btn.disabled = true;
  _cxWishSetDockMsg("");

  try {
    const res = await window.guestDAL.sendWishPublic({
      slug: g.slug,
      name: g.name,
      relationship: g.relationship,
      text,
    });

    _cxWishItems.unshift(res.wish);
    _cxWishRemaining = res.remaining;
    // Lời vừa gửi nằm đầu danh sách, đưa khách tới xem.
    _cxWishPage = 0;
    _cxWishStackAt = 0;
    _cxWishSpotAt = 0;
    _cxWishBookAt = 0;
    _cxWishRender();
    _cxWishCollapse();
    _cxWishSetDockText();
    _cxWishFlashSent();
  } catch (error) {
    // Câu chữ từ Edge Function đã hợp cảnh (403 chưa được mời, 409 hết lượt) nên
    // hiện thẳng; im lặng là khách gõ lại lần nữa mà vẫn không hiểu vì sao trượt.
    console.error("Lỗi gửi lời chúc:", error);
    _cxWishSetDockMsg(
      error?.message || "Chưa gửi được lời chúc, bạn thử lại giúp nhé.",
    );
  } finally {
    // Gửi xong ô đã rỗng → nút phải tối lại; lỗi thì chữ còn nguyên, nút sáng.
    _cxWishSyncSend(_cxWishInputEl());
  }
}

/**
 * Dựng mục lời chúc cho một thiệp. Hỏng ở khâu nào cũng chỉ mất mục này —
 * KHÔNG được làm vỡ phần còn lại của thiệp, nên bọc try.
 */
async function initWishes(wedding) {
  try {
    if (!cxEnabled(wedding?.enable_wishes)) {
      _cxWishTeardown();
      return;
    }

    _cxWishMode = _cxWishModeOf(wedding?.theme_setting);

    // Xem trước (?preview=true hoặc iframe trang Thiết lập): chưa có dữ liệu thật,
    // dựng vài lời chúc mẫu để chủ thiệp thấy đúng bố cục. Ô nhập vẫn dựng, nút
    // Gửi dừng ở showPreviewAlert.
    _cxWishDemo = isPreviewMode();

    if (_cxWishDemo) {
      _cxWishMount(true);
      applyWishStyle();
      _cxWishItems = CX_WISH_DEMO.slice();
      _cxWishRender();
      return;
    }

    // Dựng vỏ trước rồi mới nạp: mount của danh sách nằm trong chính vỏ (mục / dải).
    const guest = window.CX_GUEST;
    _cxWishMount(!!guest);
    applyWishStyle();

    const slug = getSlugFromUrl();
    if (slug && window.guestDAL) {
      _cxWishItems = await window.guestDAL.listWishesPublic(slug);
    }
    _cxWishRender();

    if (!guest) return;

    // Đã gửi bao nhiêu lượt: đếm ngay trên danh sách vừa tải (server vẫn là nơi
    // chốt, đây chỉ để hiện đúng số lượt còn lại).
    const mine = _cxWishItems.filter(
      (w) => (w.name || "").trim().toLowerCase() === guest.name.trim().toLowerCase(),
    ).length;
    _cxWishRemaining = Math.max(0, CX_WISH_MAX - mine);
    _cxWishSetDockText();
  } catch (error) {
    console.error("Lỗi dựng mục lời chúc:", error);
  }
}

window.initWishes = initWishes;

// ── Chọn dạng hiện lời chúc ─────────────────────────────────────────────────

function _cxWishModeOf(setting) {
  if (typeof setting === "string") {
    try {
      setting = JSON.parse(setting);
    } catch (e) {
      setting = null;
    }
  }
  const v =
    setting && typeof setting === "object" ? String(setting.wishes_mode || "") : "";
  return CX_WISH_MODES[v] ? v : _cxWishModeDefault();
}

function _cxWishModeDefault() {
  const v = String((window.CX_THEME && window.CX_THEME.wishesMode) || "");
  return CX_WISH_MODES[v] ? v : CX_WISH_MODE_DEFAULT;
}

function _cxWishMount(canWrite) {
  _cxWishCanWrite = !!canWrite;
  _cxWishDef().mount(canWrite);
}

// Gỡ sạch mọi thứ helper đã dựng — dùng khi tắt mục lời chúc và khi đổi dạng.
function _cxWishTeardown() {
  // Dọn hiệu ứng của MỌI dạng, không chỉ dạng đang bật: teardown cũng là bước
  // đầu của lượt đổi dạng.
  _cxWishStopAll();
  _cxWishUnwatchReveal();
  ["cx-wish-dock", "cx-wdock-spacer", "cx-wish-all", "cx-wish-sec"].forEach((id) =>
    document.getElementById(id)?.remove(),
  );
}

// Trong khung xem trước của trang Thiết lập: đổi dạng dựng lại NGAY, không nạp
// lại cả thiệp (bảng chọn bên trang cha phải đứng yên để còn so hai dạng).
if (window.top !== window) {
  window.addEventListener("message", (ev) => {
    if (ev.source !== window.parent) return;
    const d = ev.data;
    if (!d || d.type !== "cx-wish-mode") return;
    const next = CX_WISH_MODES[d.value] ? d.value : _cxWishModeDefault();
    if (next === _cxWishMode && document.getElementById("cx-wishes-list")) return;
    _cxWishMode = next;
    _cxWishTeardown();
    _cxWishMount(_cxWishCanWrite);
    applyWishStyle();
    _cxWishRender();
  });
}
