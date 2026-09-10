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

// Khách tự tắt dải trôi. CỐ Ý chỉ nằm trong bộ nhớ: tải lại trang là dải hiện
// lại, khách không phải nhớ mình đã tắt ở thiệp nào.
let _cxWishFeedOff = false;

// Vòng chiếu hiện tại — phải dọn trước khi vẽ lại, nếu không lượt cũ vẫn hẹn giờ
// khởi động lại một thẻ track đã bị gỡ khỏi DOM.
let _cxWishReplayTimer = null;
let _cxWishResizeTimer = null;
let _cxWishSentTimer = null;

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

// ── Cặp màu tương phản tự tính ──────────────────────────────────────────────
// Bong bóng lời chúc TRÔI ĐÈ lên thân thiệp, mà thiệp cưới gần như luôn nền rất
// nhạt: lấy đúng mặt giấy của thiệp (`panel` + `body`) thì cả dải chìm vào nền.
// Nên mặc định là LẬT ĐỘ SÁNG so với thiệp — nền sáng thì bong bóng đậm, nền tối
// thì bong bóng nhạt — nhưng ĐI THEO ĐÚNG SẮC MÀU NHẤN của mẫu: mọi màu ở đây
// dựng bằng HSL từ hue của `--cx-accent-rgb`, KHÔNG pha với đen/trắng. Thiệp tông
// trắng + nhấn hồng thì ra bong bóng hồng đậm, không bao giờ ra một mảng đen.
// Mẫu khai CX_THEME.wishes vẫn thắng (xem _cxWishAutoColors).
const CX_WISH_TEXT_CR = 5.5; // chữ lời chúc: trên mức AA (4.5) một quãng
const CX_WISH_NAME_CR = 4.5; // tên khách: đậm hơn, mức AA là đủ

// Trần/sàn độ sáng khi ép tương phản. Sàn CỐ Ý không xuống thấp: dưới mức này
// mọi sắc màu đều tiến về một mảng gần đen — đúng thứ phải tránh. Kèm sàn độ bão
// hoà ở dưới, màu đậm nhất vẫn ra "đỏ trầm / xanh rêu", không ra đen.
const CX_WISH_L_MIN = 0.26;
const CX_WISH_L_MAX = 0.94;

// "168 153 104" hoặc "#a89968" → [168,153,104]; sai định dạng → null.
function _cxWishRgb(v) {
  const t = _cxWishTriplet(v) || (typeof v === "string" ? v.trim() : "");
  const p = t.split(/[\s,/]+/).slice(0, 3).map(Number);
  return p.length === 3 && p.every(Number.isFinite) ? p : null;
}

function _cxWishStr(c) {
  return c.map((n) => Math.round(Math.min(255, Math.max(0, n)))).join(" ");
}

function _cxWishLum(c) {
  const f = c.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
}

function _cxWishCR(a, b) {
  const l1 = _cxWishLum(a);
  const l2 = _cxWishLum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// [r,g,b] → [h(0..1), s, l]. Màu xám (s = 0) không có hue: trả h = null để chỗ
// dùng biết mà mượn hue khác — mẫu nào nhấn bằng xám thì lấy hue của nền thiệp.
function _cxWishHsl([r, g, b]) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return [null, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) / 6;
  else if (max === G) h = ((B - R) / d + 2) / 6;
  else h = ((R - G) / d + 4) / 6;
  return [h, s, l];
}

function _cxWishFromHsl([h, s, l]) {
  const L = Math.min(1, Math.max(0, l));
  const S = Math.min(1, Math.max(0, s));
  if (h == null || !S) return [L * 255, L * 255, L * 255];
  const q = L < 0.5 ? L * (1 + S) : L + S - L * S;
  const p = 2 * L - q;
  const f = (t) => {
    let x = (t + 1) % 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => v * 255);
}

// Ép tương phản bằng cách ĐỔI ĐỘ SÁNG, giữ nguyên hue và độ bão hoà — nên màu
// nhạt đi hay đậm lên vẫn là màu đó, không bợt ra xám.
function _cxWishFitL(hsl, on, min) {
  const step = _cxWishLum(on) > 0.5 ? -0.03 : 0.03; // nền sáng thì kéo tối đi
  let out = hsl.slice();
  for (let i = 0; i < 40 && _cxWishCR(_cxWishFromHsl(out), on) < min; i++) {
    const l = out[2] + step;
    if (l < CX_WISH_L_MIN || l > CX_WISH_L_MAX) break;
    out[2] = l;
  }
  return out;
}

/**
 * Bảng màu mặc định của dải: lật độ sáng so với thân thiệp nhưng giữ đúng sắc
 * màu nhấn của mẫu. Trả về null khi mẫu đã tự khai mặt giấy (bubble/text/accent/
 * btn) — lúc đó giữ nguyên bản khai của mẫu, không tự tính gì thêm.
 */
function _cxWishAutoColors(decl) {
  if (["bubble", "text", "accent", "btn"].some((k) => _cxWishTriplet(decl[k]))) {
    return null;
  }
  const bg =
    _cxWishRgb(_cxWishRootVar("--cx-card-bg-rgb")) ||
    _cxWishRgb(_cxWishRootVar("--cx-page-bg-rgb"));
  if (!bg) return null;

  const accent = _cxWishRgb(_cxWishRootVar("--cx-accent-rgb")) || [190, 90, 118];
  const [ha, sa] = _cxWishHsl(accent);
  // Mẫu nhấn bằng xám/đen: mượn hue của nền thiệp, hết nữa thì hồng của thương hiệu.
  const hue = ha ?? _cxWishHsl(bg)[0] ?? 0.95;
  // Nhấn nhợt quá thì màu đậm lên trông vẫn xám → nâng sàn độ bão hoà.
  const sat = Math.min(0.72, Math.max(0.4, sa || 0.5));
  const lightCard = _cxWishLum(bg) > 0.45;

  // Chốt màu CHỮ trước (vẫn nhuốm hue của mẫu, không phải trắng/đen trơn) rồi
  // mới dịch độ sáng của MẶT GIẤY cho tới khi đủ tương phản với chữ. Làm ngược
  // lại — cố định độ sáng mặt giấy — thì hue vàng/be sáng sẵn sẽ không bao giờ
  // đủ tối, chữ nhạt trên nền be là hỏng.
  const text = lightCard
    ? [hue, Math.min(sat, 0.35), 0.96]
    : [hue, Math.min(sat, 0.55), 0.22];
  const textRgb = _cxWishFromHsl(text);
  // Màu càng tối càng trông nhạt màu → nâng độ bão hoà cho mặt giấy đậm, nếu
  // không bong bóng ra một mảng nâu/xám thay vì đúng sắc của mẫu.
  const bubble = _cxWishFitL(
    lightCard
      ? [hue, Math.min(0.82, sat + 0.24), 0.52]
      : [hue, Math.min(sat, 0.45), 0.78],
    textRgb,
    CX_WISH_TEXT_CR,
  );
  const bubbleRgb = _cxWishFromHsl(bubble);
  // Tên khách: chính màu nhấn, chỉ chỉnh sáng cho nổi trên mặt giấy.
  const name = _cxWishFitL(
    lightCard ? [hue, Math.min(0.85, sat + 0.15), 0.86] : [hue, sat, 0.36],
    bubbleRgb,
    CX_WISH_NAME_CR,
  );
  const nameRgb = _cxWishFromHsl(name);
  return {
    bubble: _cxWishStr(bubbleRgb),
    text: _cxWishStr(textRgb),
    accent: _cxWishStr(nameRgb),
    btn: _cxWishStr(nameRgb),
    // Nút Gửi có nền đặc bằng chính màu tên → chữ trên nút cũng cùng hue, chỉ
    // ngược sáng.
    on_btn: _cxWishStr(
      _cxWishFromHsl(
        _cxWishFitL(
          _cxWishLum(nameRgb) > 0.5 ? [hue, sat, 0.18] : [hue, sat * 0.5, 0.95],
          nameRgb,
          CX_WISH_NAME_CR,
        ),
      ),
    ),
    // Vệt phủ neo dải xuống mép dưới: cũng là màu của mẫu (đậm hơn mặt giấy một
    // quãng) chứ không phải đen trơn.
    fade: _cxWishStr(_cxWishFromHsl([hue, Math.min(0.7, sat + 0.2), 0.22])),
  };
}

/**
 * Áp bảng màu của MẪU lên dải. Màu là phần cố định của mẫu thiệp — khách không
 * chỉnh được — nên chỉ đọc CX_THEME.wishes, khoá nào mẫu không khai thì token
 * chung của thiệp lo (xem .cx-wdock ở styles/_common.css).
 */
function applyWishStyle() {
  const dock = document.getElementById("cx-wish-dock");
  if (!dock) return;
  // Bảng "Xem tất cả" nằm ngoài dải nên không thừa hưởng token — đặt cho cả hai.
  const targets = [dock, document.getElementById("cx-wish-all")].filter(Boolean);

  const decl = (window.CX_THEME && window.CX_THEME.wishes) || {};
  const auto = _cxWishAutoColors(decl) || {};
  if (auto.on_btn) {
    targets.forEach((t) => t.style.setProperty("--cx-wish-on-btn-rgb", auto.on_btn));
  }

  Object.entries(CX_WISH_COLORS).forEach(([key, def]) => {
    const alias = def.alias;
    const val =
      _cxWishTriplet(decl[key]) ||
      (alias && _cxWishTriplet(decl[alias])) ||
      auto[key] ||
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

// Thẻ con flex-column bọc các mục của thân thiệp (quy ước: #main-card có ĐÚNG một).
function _cxWishHost() {
  const card = document.getElementById("main-card");
  return card?.firstElementChild ?? card ?? null;
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
  if (!document.getElementById("cx-wishes-list")) return;
  clearTimeout(_cxWishResizeTimer);
  _cxWishResizeTimer = setTimeout(_cxWishStartRoll, 200);
});

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
    (canWrite
      ? '<div class="cx-wdock-card cx-t" id="cx-wdock-open">' +
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
      : '<div class="cx-wdock-note cx-t">Chỉ khách mời nhận thiệp riêng mới gửi được lời chúc.</div>') +
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

  if (canWrite) {
    _cxWishSetDockText();

    const card = document.getElementById("cx-wdock-open");
    const input = document.getElementById("cx-wdock-text");
    const send = document.getElementById("cx-wdock-send");

    card.addEventListener("click", _cxWishExpand);
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
        _cxWishCollapse();
      }
    });
    // Nút Gửi nằm TRONG thẻ nên cú bấm cũng chạy _cxWishExpand — chặn lại, nếu
    // không lượt bấm đầu tiên chỉ bung ô ra chứ không gửi.
    send.addEventListener("click", (e) => {
      e.stopPropagation();
      if (card.classList.contains("is-open")) _cxWishSend();
      else _cxWishExpand();
    });
  }

  _cxWishWatchReveal(dock);
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

  const sync = () => {
    const opened = !card || card.style.display !== "none";
    const scrolled = window.scrollY >= window.innerHeight * CX_WISH_SHOW_AT;
    dock.classList.toggle("is-on", opened && scrolled);
  };

  window.addEventListener("scroll", sync, { passive: true });
  window.addEventListener("resize", sync, { passive: true });

  // Bìa mở ra không kèm sự kiện cuộn nào — theo dõi luôn thẻ thân thiệp.
  if (card) {
    new MutationObserver(sync).observe(card, {
      attributes: true,
      attributeFilter: ["style"],
    });
  }
  sync();
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
  // chạm rơi vào iframe/canvas của mẫu thiệp.
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
      document.getElementById("cx-wish-dock")?.remove();
      document.getElementById("cx-wdock-spacer")?.remove();
      return;
    }

    // Xem trước (?preview=true hoặc iframe trang Thiết lập): chưa có dữ liệu thật,
    // dựng vài lời chúc mẫu để chủ thiệp thấy đúng bố cục. Ô nhập vẫn dựng, nút
    // Gửi dừng ở showPreviewAlert.
    _cxWishDemo = isPreviewMode();

    if (_cxWishDemo) {
      _cxWishBuildDock(true);
      applyWishStyle();
      _cxWishItems = CX_WISH_DEMO.slice();
      _cxWishRender();
      return;
    }

    // Dựng vỏ trước rồi mới nạp: mount của danh sách nằm trong chính dải nổi.
    const guest = window.CX_GUEST;
    _cxWishBuildDock(!!guest);
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
