// Lời chúc của khách mời trên trang thiệp: mục danh sách tự cuộn + thanh ghim
// đáy khung nhìn để khách viết. Gọi một lần từ loadWeddingData (wedding-helper).
//
// Mẫu thiệp KHÔNG phải sửa gì: có #cx-wishes-list thì helper mount vào đó, không
// có thì tự chèn một mục vào cuối thân thiệp — nhờ vậy mẫu đã phát hành cũng có.
// Chỉ khách cầm link cá nhân hoá mới thấy ô nhập, và cổng chặn thật nằm ở Edge
// Function (khớp hàng guests theo slug + tên + xưng hô), không phải ở đây.

const CX_WISH_MAX = 3;
const CX_WISH_MAX_LEN = 500;

// Tốc độ trôi (px/giây) — danh sách dài ngắn đều đi cùng nhịp đọc.
const CX_WISH_SPEED = 32;

// Nghỉ bao lâu sau khi lời chúc cuối rời khỏi khung rồi chiếu lại từ đầu (ms).
const CX_WISH_REPLAY_MS = 3000;

// Ô nhập cao tối đa mấy dòng khi bung ra — quá đó thì cuộn trong chính ô.
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

// Hai DẠNG hiện lời chúc, chủ thiệp chọn ở tab Giao diện (lưu ở
// theme_setting.wishes_mode, bảng chọn ở invitation-setup/js/05-theme-panel.js):
//   "live"    — dải nổi ghim đáy khung nhìn, lời chúc trôi lên (mặc định)
//   "comment" — một mục nằm NGAY TRÊN hộp mừng cưới, liệt kê hết lời chúc trong
//               một khung cuộn và tự bò khi khách xem tới chỗ đó
const CX_WISH_MODE_DEFAULT = "live";

// Dạng comment: tốc độ tự bò (px/giây) và hai quãng nghỉ (ms) — nghỉ trước khi
// bắt đầu / sau khi quay về đầu, và nhường bao lâu khi khách vừa tự cuộn.
const CX_WISH_SEC_SPEED = 24;
const CX_WISH_SEC_PAUSE_MS = 2200;
const CX_WISH_SEC_IDLE_MS = 4000;

// Năm ô màu của dải, FIX CỨNG theo từng mẫu: mẫu khai gì (CX_THEME.wishes) thì
// lấy nấy, không khai thì rơi về token chung của thiệp. Mỗi khoá ứng với một
// biến CSS trên .cx-wdock (xem styles/_common.css).
// Độ mờ nền bong bóng mặc định (%) — trùng --cx-wish-bubble-a ở _common.css.
const CX_WISH_OPACITY = 94;

// varName2 = chặng CUỐI khi ô đó đổ màu (khoá "<tên>_to"); có nó thì dải mang
// thêm cờ .cx-wg-<tên> để CSS đổi sang linear-gradient (styles/_common.css).
// CHỈ nền bong bóng có chặng cuối: chữ đổ màu phải cắt nền theo hình chữ (cỡ chữ
// của dải đọc rất mệt), còn nút gửi thì không có nền để mà đổ.
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

// ── Màu của dải ─────────────────────────────────────────────────────────────

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
 * Áp bảng màu của MẪU lên dải. Màu là phần cố định của mẫu thiệp — khách không
 * chỉnh được — nên chỉ đọc CX_THEME.wishes, khoá nào mẫu không khai thì token
 * chung của thiệp lo (xem .cx-wdock ở styles/_common.css).
 */
function applyWishStyle() {
  // Ba gốc rời nhau: dải nổi, mục dạng comment và bảng "Xem tất cả" (bảng nằm
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

function _cxWishItemHtml(w) {
  return (
    '<div class="cx-wish-item cx-t">' +
    `<span class="cx-wish-name">${escapeHtml(w.name || "Khách mời")}</span>` +
    `<span class="cx-wish-text">${escapeHtml(w.text)}</span>` +
    "</div>"
  );
}

function _cxWishRender() {
  const mount = document.getElementById("cx-wishes-list");
  if (!mount) return;

  clearTimeout(_cxWishReplayTimer);
  _cxWishReplayTimer = null;

  if (_cxWishMode === "comment") return _cxWishRenderSection(mount);

  const tools = document.getElementById("cx-wdock-tools");
  if (tools) tools.hidden = _cxWishItems.length === 0;

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

// Một lượt chiếu: danh sách vào từ mép DƯỚI khung, đi lên cho tới khi lời chúc
// cuối khuất hẳn, nghỉ CX_WISH_REPLAY_MS rồi chạy lại từ đầu. Quãng đường phải đo
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
window.addEventListener("resize", () => {
  if (_cxWishMode === "comment") return;
  if (!document.getElementById("cx-wishes-list")) return;
  clearTimeout(_cxWishResizeTimer);
  _cxWishResizeTimer = setTimeout(_cxWishStartRoll, 200);
});

// ── Dạng COMMENT: một mục trong thân thiệp, ngay trên hộp mừng cưới ─────────
// Liệt kê HẾT lời chúc trong một khung cuộn; khách cuộn tới chỗ này thì danh
// sách tự bò xuống, tới đáy nghỉ một nhịp rồi về đầu. Khách tự cuộn thì nhường
// CX_WISH_SEC_IDLE_MS mới chạy tiếp.

let _cxWishSecIO = null;
let _cxWishSecRaf = null;
let _cxWishSecOn = false;
// Mốc thời gian (ms) được phép bò tiếp — dùng cho cả nhịp nghỉ lẫn lúc nhường.
let _cxWishSecWait = 0;

function _cxWishStopAutoScroll() {
  if (_cxWishSecRaf) cancelAnimationFrame(_cxWishSecRaf);
  _cxWishSecRaf = null;
  _cxWishSecOn = false;
  _cxWishSecIO?.disconnect();
  _cxWishSecIO = null;
}

// Một bước bò. Quãng đường tính theo THỜI GIAN thật (dt) nên máy nhanh máy chậm
// đều đi cùng tốc độ đọc; dt kẹp ở 100ms để lúc tab ngủ dậy không nhảy một phát.
function _cxWishSecStep(box, prev) {
  _cxWishSecRaf = requestAnimationFrame((now) => {
    if (!_cxWishSecOn || !box.isConnected) return;
    const rest = box.scrollHeight - box.clientHeight - box.scrollTop;
    if (Date.now() >= _cxWishSecWait) {
      if (rest > 0.5) {
        box.scrollTop += (CX_WISH_SEC_SPEED * Math.min(now - prev, 100)) / 1000;
      } else {
        // Hết danh sách: về đầu rồi nghỉ một nhịp mới bò tiếp.
        box.scrollTo({ top: 0, behavior: "smooth" });
        _cxWishSecWait = Date.now() + CX_WISH_SEC_PAUSE_MS;
      }
    }
    _cxWishSecStep(box, now);
  });
}

function _cxWishWatchAutoScroll(box) {
  _cxWishStopAutoScroll();
  if (_cxWishReduceMotion() || !window.IntersectionObserver) return;

  // Khách vừa tự cuộn / chạm vào danh sách → nhường quyền điều khiển một lúc.
  const hold = () => {
    _cxWishSecWait = Date.now() + CX_WISH_SEC_IDLE_MS;
  };
  ["pointerdown", "wheel", "touchmove"].forEach((ev) =>
    box.addEventListener(ev, hold, { passive: true }),
  );

  _cxWishSecIO = new IntersectionObserver(
    (ents) => {
      const vis = ents.some((e) => e.isIntersecting);
      if (vis === _cxWishSecOn) return;
      _cxWishSecOn = vis;
      if (!vis) {
        if (_cxWishSecRaf) cancelAnimationFrame(_cxWishSecRaf);
        _cxWishSecRaf = null;
        return;
      }
      // Vừa lọt vào tầm nhìn: để khách kịp nhìn thấy danh sách đứng yên đã.
      _cxWishSecWait = Date.now() + CX_WISH_SEC_PAUSE_MS;
      _cxWishSecStep(box, performance.now());
    },
    { threshold: 0.35 },
  );
  _cxWishSecIO.observe(box);
}

function _cxWishRenderSection(mount) {
  _cxWishStopAutoScroll();

  const title = document.getElementById("cx-wsec-title");
  if (title)
    title.textContent = _cxWishItems.length
      ? `Lời chúc · ${_cxWishItems.length}`
      : "Lời chúc";

  mount.classList.toggle("is-empty", _cxWishItems.length === 0);
  mount.innerHTML = _cxWishItems.length
    ? _cxWishItems.map(_cxWishItemHtml).join("")
    : '<div class="cx-wsec-empty cx-t">Chưa có lời chúc nào — bạn gửi lời đầu tiên nhé!</div>';

  if (_cxWishItems.length > 1) _cxWishWatchAutoScroll(mount);
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

  const sec = document.createElement("section");
  sec.id = "cx-wish-sec";
  // cx-no-edit: mục do helper dựng, không phải chữ của mẫu để mà chỉnh tay.
  sec.className = "cx-wsec cx-no-edit";
  sec.innerHTML =
    '<div class="cx-wsec-head">' +
    '<span class="cx-wsec-title cx-a" id="cx-wsec-title">Lời chúc</span>' +
    "</div>" +
    '<div class="cx-wsec-list" id="cx-wishes-list"></div>' +
    _cxWishComposerHtml(canWrite);

  host.appendChild(sec);
  _cxWishPlaceSection();

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
// (hoặc bản xem thử), người còn lại thấy một dòng giải thích thay chỗ đó.
function _cxWishBuildDock(canWrite) {
  if (document.getElementById("cx-wish-dock")) return;

  const dock = document.createElement("div");
  dock.id = "cx-wish-dock";
  dock.className = "cx-wdock";
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
    spacer.className = "cx-wdock-spacer";
    host.appendChild(spacer);
  }

  document.getElementById("cx-wish-hide")?.addEventListener("click", _cxWishToggleFeed);
  document.getElementById("cx-wish-more")?.addEventListener("click", _cxWishOpenAll);

  // lucide không tự quét lại phần chèn động.
  window.lucide?.createIcons({ root: dock });

  _cxWishBindComposer(canWrite);
  _cxWishWatchReveal(dock);
}

// Ô "Gửi lời chúc" — MỘT bộ markup dùng cho cả dải nổi lẫn mục dạng comment
// (hình dạng do thẻ cha quyết định, xem .cx-wsec .cx-wdock-card ở
// styles/_common.css). Khách vào bằng link chung thì thay bằng một dòng giải
// thích: cổng chặn thật nằm ở Edge Function, đây chỉ là phần nhìn.
function _cxWishComposerHtml(canWrite) {
  if (!canWrite)
    return '<div class="cx-wdock-note cx-t">Chỉ khách mời nhận thiệp riêng mới gửi được lời chúc.</div>';
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
    'placeholder="Viết lời chúc…"></textarea>' +
    '<button type="button" class="cx-wdock-btn" id="cx-wdock-send" aria-label="Gửi lời chúc" disabled>' +
    '<i data-lucide="send" style="width:16px;height:16px"></i>' +
    "</button>" +
    "</div>" +
    // Hàng dưới chỉ có mặt khi ô đang mở: báo lỗi bên trái, bộ đếm bên phải.
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
  // Dạng comment: ô gõ mở sẵn nên phải chốt chiều cao ngay từ đầu bằng CHÍNH phép
  // đo mà _cxWishExpand dùng — để đó cho trình duyệt tự tính thì lượt bấm đầu
  // tiên lại đo ra một con số khác vài px, thấy rõ là thẻ giật lên một nhịp.
  if (_cxWishMode === "comment") _cxWishAutoGrow(input);
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
      // Dạng comment ô gõ mở sẵn, thu lại là XOÁ chữ đang viết → chỉ rời con trỏ.
      if (_cxWishMode === "comment") input.blur();
      else _cxWishCollapse();
    }
  });
  // Nút Gửi nằm TRONG thẻ nên cú bấm cũng chạy _cxWishExpand — chặn lại, nếu
  // không lượt bấm đầu tiên chỉ bung ô ra chứ không gửi.
  send.addEventListener("click", (e) => {
    e.stopPropagation();
    if (card.classList.contains("is-open") || _cxWishMode === "comment")
      _cxWishSend();
    else _cxWishExpand();
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
    `<span class="cx-wish-name">${escapeHtml(w.name || "Khách mời")}</span>` +
    `<span class="cx-wish-text">${escapeHtml(w.text)}</span>` +
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

// Ô nhập bung TẠI CHỖ: pill nhỏ co theo nội dung, bấm vào thì trải hết bề ngang
// cột và đổi dòng gợi ý thành ô gõ cao tối đa hai dòng. Không mở panel riêng —
// khách vẫn thấy thiệp và danh sách lời chúc phía trên.

function _cxWishInputEl() {
  return document.getElementById("cx-wdock-text");
}

// Cao theo nội dung, chặn ở CX_WISH_INPUT_ROWS dòng rồi mới cho cuộn trong ô.
// Trần phải là BỘI SỐ của line-height (ô không có padding dọc — xem
// .cx-wdock-text), nếu không dòng trên cùng lòi ra một nửa lúc cuộn.
function _cxWishAutoGrow(input) {
  const line = parseFloat(getComputedStyle(input).lineHeight) || 20;
  input.style.height = "auto";
  input.style.height =
    Math.min(input.scrollHeight, line * CX_WISH_INPUT_ROWS) + "px";
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
  document.removeEventListener("pointerdown", _cxWishOutside, true);
}

function _cxWishOutside(e) {
  const card = document.getElementById("cx-wdock-open");
  if (card && !card.contains(e.target)) _cxWishCollapse();
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

  // Bấm ra ngoài thì thu lại. Dùng pointerdown ở pha capture để bắt được cả cú
  // chạm rơi vào iframe/canvas của mẫu thiệp. Dạng comment thì KHÔNG: ô gõ vốn
  // mở sẵn, thu lại chỉ để xoá trắng thứ khách đang viết dở.
  if (_cxWishMode !== "comment")
    document.addEventListener("pointerdown", _cxWishOutside, true);
}

// Câu báo lỗi nằm ngay dưới ô nhập; chuỗi rỗng là gỡ đi.
function _cxWishSetDockMsg(text) {
  const el = document.getElementById("cx-wdock-msg");
  if (!el) return;
  el.textContent = text || "";
  el.hidden = !text;
}

// Gửi xong ô nhập thu lại ngay, nên phải có một nhịp xác nhận: chip đổi thành
// dấu tích và dòng gợi ý thành lời cảm ơn, hết CX_WISH_SENT_MS thì trở lại.
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

    // Dựng vỏ trước rồi mới nạp: mount của danh sách nằm trong chính dải nổi.
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
  return v === "comment" ? "comment" : CX_WISH_MODE_DEFAULT;
}

function _cxWishMount(canWrite) {
  _cxWishCanWrite = !!canWrite;
  if (_cxWishMode === "comment") _cxWishBuildSection(canWrite);
  else _cxWishBuildDock(canWrite);
}

// Gỡ sạch mọi thứ helper đã dựng — dùng khi tắt mục lời chúc và khi đổi dạng.
function _cxWishTeardown() {
  clearTimeout(_cxWishReplayTimer);
  _cxWishReplayTimer = null;
  _cxWishStopAutoScroll();
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
    const next = d.value === "comment" ? "comment" : CX_WISH_MODE_DEFAULT;
    if (next === _cxWishMode && document.getElementById("cx-wishes-list")) return;
    _cxWishMode = next;
    _cxWishTeardown();
    _cxWishMount(_cxWishCanWrite);
    applyWishStyle();
    _cxWishRender();
  });
}
