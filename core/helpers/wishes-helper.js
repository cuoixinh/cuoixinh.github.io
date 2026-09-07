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
const CX_WISH_REPLAY_MS = 5000;

const CX_WISH_DEMO = [
  { id: "d1", name: "Anh Minh", relationship: "Bạn thân", text: "Chúc hai bạn trăm năm hạnh phúc, đầu bạc răng long!" },
  { id: "d2", name: "Chị Lan", relationship: "Đồng nghiệp", text: "Chúc mừng hạnh phúc hai em nhé, sớm có tin vui!" },
  { id: "d3", name: "Cô Hạnh", relationship: "Họ hàng", text: "Mong hai cháu luôn yêu thương và nhường nhịn nhau." },
  { id: "d4", name: "Bạn Tuấn", relationship: "Bạn đại học", text: "Cưới vui nhé! Chúc gia đình nhỏ luôn ngập tiếng cười." },
];

let _cxWishItems = [];
let _cxWishRemaining = CX_WISH_MAX;
let _cxWishDemo = false;

// Vòng chiếu hiện tại — phải dọn trước khi vẽ lại, nếu không lượt cũ vẫn hẹn giờ
// khởi động lại một thẻ track đã bị gỡ khỏi DOM.
let _cxWishReplayTimer = null;
let _cxWishResizeTimer = null;

function _cxWishReduceMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

// Thẻ con flex-column bọc các mục của thân thiệp (quy ước: #main-card có ĐÚNG một).
function _cxWishHost() {
  const card = document.getElementById("main-card");
  return card?.firstElementChild ?? card ?? null;
}

// Mục danh sách: mẫu tự khai #cx-wishes-list thì tôn trọng chỗ mẫu đặt, không thì
// chèn ngay trước mục "Lời cảm ơn" (hoặc cuối thân thiệp) cho mẫu cũ.
function _cxWishMount() {
  const declared = document.getElementById("cx-wishes-list");
  if (declared) return declared;

  const host = _cxWishHost();
  if (!host) return null;

  // Lề ngang: mẫu đặt padding ở CHÍNH thẻ bọc (base-theme) hay ở từng mục
  // (romantic-gold) là tuỳ mẫu — hỏi thẻ bọc rồi mới tự chừa, chèn cứng `px-6`
  // là mẫu kia thành lề đôi.
  const hostPad = parseFloat(getComputedStyle(host).paddingLeft) || 0;

  const section = document.createElement("section");
  section.id = "section-wishes";
  section.className =
    "flex flex-col gap-4 text-center" + (hostPad < 8 ? " px-6 py-8" : "");
  section.innerHTML =
    '<h2 class="cx-h text-[20px] tracking-[3px] uppercase">Lời Chúc</h2>' +
    '<div id="cx-wishes-list"></div>';

  const footer = document.getElementById("section-footer");
  if (footer && footer.parentElement === host) host.insertBefore(section, footer);
  else host.appendChild(section);

  return section.querySelector("#cx-wishes-list");
}

function _cxWishItemHtml(w) {
  const rel = w.relationship
    ? `<span class="cx-wish-rel cx-t">${escapeHtml(w.relationship)}</span>`
    : "";
  return (
    '<div class="cx-wish-item">' +
    '<div class="cx-wish-item-head">' +
    `<span class="cx-wish-name cx-h cx-a">${escapeHtml(w.name || "Khách mời")}</span>${rel}` +
    "</div>" +
    `<div class="cx-wish-text cx-t">${escapeHtml(w.text)}</div>` +
    "</div>"
  );
}

function _cxWishRender() {
  const mount = document.getElementById("cx-wishes-list");
  if (!mount) return;

  clearTimeout(_cxWishReplayTimer);
  _cxWishReplayTimer = null;

  if (_cxWishItems.length === 0) {
    mount.innerHTML =
      '<div class="cx-wish-empty cx-t">Chưa có lời chúc nào — hãy là người đầu tiên nhé.</div>';
    return;
  }

  mount.innerHTML =
    '<div class="cx-wish-viewport">' +
    '<div class="cx-wish-track">' +
    _cxWishItems.map(_cxWishItemHtml).join("") +
    "</div></div>";

  _cxWishStartRoll();
}

// Một lượt chiếu: danh sách vào từ mép DƯỚI khung, đi lên cho tới khi lời chúc
// cuối khuất hẳn, nghỉ CX_WISH_REPLAY_MS rồi chạy lại từ đầu. Quãng đường phải đo
// bằng px (chiều cao khung + chiều cao danh sách) vì `translateY(%)` tính theo
// chính thẻ track — hai thứ có kích thước khác nhau.
function _cxWishStartRoll() {
  const view = document.querySelector(".cx-wish-viewport");
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
  if (!document.querySelector(".cx-wish-viewport")) return;
  clearTimeout(_cxWishResizeTimer);
  _cxWishResizeTimer = setTimeout(_cxWishStartRoll, 200);
});

function _cxWishSetDockText() {
  const hint = document.getElementById("cx-wdock-hint");
  if (!hint) return;
  hint.textContent =
    _cxWishRemaining > 0
      ? "Gửi lời chúc tới cô dâu chú rể…"
      : `Bạn đã gửi đủ ${CX_WISH_MAX} lời chúc, cảm ơn bạn!`;
}

function _cxWishBuildDock() {
  if (document.getElementById("cx-wish-dock")) return;

  const dock = document.createElement("div");
  dock.id = "cx-wish-dock";
  dock.className = "cx-wdock";
  dock.innerHTML =
    '<div class="cx-wdock-card" id="cx-wdock-open">' +
    '<span class="cx-wdock-hint cx-t" id="cx-wdock-hint"></span>' +
    '<span class="cx-wdock-btn"><i data-lucide="send" style="width:18px;height:18px"></i></span>' +
    "</div>";
  document.body.appendChild(dock);

  // Thanh nổi đè lên cuối thiệp — chừa đúng chiều cao nó ở đáy thân thiệp, nếu
  // không mục cuối (lời cảm ơn) bị che mất một đoạn.
  const host = _cxWishHost();
  if (host && !document.getElementById("cx-wdock-spacer")) {
    const spacer = document.createElement("div");
    spacer.id = "cx-wdock-spacer";
    spacer.className = "cx-wdock-spacer";
    host.appendChild(spacer);
  }

  // lucide không tự quét lại phần chèn động.
  window.lucide?.createIcons({ root: dock });

  _cxWishSetDockText();
  document.getElementById("cx-wdock-open").addEventListener("click", _cxWishOpenSheet);

  // Thiệp có bìa thì thân thiệp còn display:none — thanh chỉ trượt lên sau khi
  // khách mở bìa, nếu không nó nằm chình ình trên ảnh bìa.
  const card = document.getElementById("main-card");
  const show = () => dock.classList.add("is-on");

  if (!card || card.style.display !== "none") {
    requestAnimationFrame(show);
    return;
  }
  const mo = new MutationObserver(() => {
    if (card.style.display !== "none") {
      mo.disconnect();
      show();
    }
  });
  mo.observe(card, { attributes: true, attributeFilter: ["style"] });
}

function _cxWishCloseSheet() {
  document.getElementById("cx-wish-sheet")?.remove();
}

function _cxWishOpenSheet() {
  if (document.getElementById("cx-wish-sheet")) return;
  if (_cxWishRemaining <= 0) return;

  const sheet = document.createElement("div");
  sheet.id = "cx-wish-sheet";
  sheet.className = "cx-wsheet";
  sheet.innerHTML =
    '<div class="cx-wsheet-card" id="cx-wsheet-card">' +
    '<div class="cx-wsheet-head">' +
    '<span class="cx-wsheet-title cx-h">Gửi lời chúc</span>' +
    '<span class="cx-wsheet-count cx-t" id="cx-wsheet-left">' +
    `Còn ${_cxWishRemaining}/${CX_WISH_MAX} lượt</span>` +
    "</div>" +
    `<textarea class="cx-wsheet-input cx-t" id="cx-wsheet-text" maxlength="${CX_WISH_MAX_LEN}" ` +
    'placeholder="Chúc hai bạn trăm năm hạnh phúc…"></textarea>' +
    '<div class="cx-wsheet-foot">' +
    `<span class="cx-wsheet-count cx-t" id="cx-wsheet-count">0/${CX_WISH_MAX_LEN}</span>` +
    '<button type="button" class="cx-wsheet-send" id="cx-wsheet-send" disabled>Gửi</button>' +
    "</div>" +
    '<div class="cx-wsheet-msg cx-a hidden" id="cx-wsheet-msg"></div>' +
    "</div>";
  document.body.appendChild(sheet);

  // Bấm ra ngoài thẻ để đóng.
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) _cxWishCloseSheet();
  });

  const input = document.getElementById("cx-wsheet-text");
  const count = document.getElementById("cx-wsheet-count");
  const send = document.getElementById("cx-wsheet-send");

  input.addEventListener("input", () => {
    count.textContent = `${input.value.length}/${CX_WISH_MAX_LEN}`;
    send.disabled = input.value.trim().length === 0;
  });
  send.addEventListener("click", () => _cxWishSend(input, send));
  input.focus();
}

async function _cxWishSend(input, sendBtn) {
  const msg = document.getElementById("cx-wsheet-msg");
  const text = input.value.trim();
  if (!text) return;

  if (_cxWishDemo) {
    showPreviewAlert();
    return;
  }

  const g = window.CX_GUEST;
  if (!g || !window.guestDAL) return;

  sendBtn.disabled = true;
  sendBtn.textContent = "Đang gửi…";

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
    _cxWishSetDockText();
    _cxWishCloseSheet();
  } catch (error) {
    // Câu chữ từ Edge Function đã hợp cảnh (403 chưa được mời, 409 hết lượt) nên
    // hiện thẳng; im lặng là khách gõ lại lần nữa mà vẫn không hiểu vì sao trượt.
    console.error("Lỗi gửi lời chúc:", error);
    if (msg) {
      msg.textContent = error?.message || "Chưa gửi được lời chúc, bạn thử lại giúp nhé.";
      msg.classList.remove("hidden");
    }
    sendBtn.disabled = false;
    sendBtn.textContent = "Gửi";
  }
}

/**
 * Dựng mục lời chúc cho một thiệp. Hỏng ở khâu nào cũng chỉ mất mục này —
 * KHÔNG được làm vỡ phần còn lại của thiệp, nên bọc try.
 */
async function initWishes(wedding) {
  try {
    if (!cxEnabled(wedding?.enable_wishes)) {
      document.getElementById("section-wishes")?.classList.add("hidden");
      document.getElementById("cx-wish-dock")?.remove();
      document.getElementById("cx-wdock-spacer")?.remove();
      return;
    }
    if (!_cxWishMount()) return;

    // Xem trước (?preview=true hoặc iframe trang Thiết lập): chưa có dữ liệu thật,
    // dựng vài lời chúc mẫu để chủ thiệp thấy đúng bố cục.
    _cxWishDemo = isPreviewMode();

    if (_cxWishDemo) {
      _cxWishItems = CX_WISH_DEMO.slice();
      _cxWishRender();
      _cxWishBuildDock();
      return;
    }

    const slug = getSlugFromUrl();
    if (slug && window.guestDAL) {
      _cxWishItems = await window.guestDAL.listWishesPublic(slug);
    }
    _cxWishRender();

    // Không có link cá nhân hoá thì chỉ được đọc: nói rõ lý do thay vì im lặng
    // giấu thanh nhập, khách tưởng thiệp lỗi.
    if (!window.CX_GUEST) {
      const mount = document.getElementById("cx-wishes-list");
      const note = document.createElement("div");
      note.className = "cx-wish-empty cx-t";
      note.textContent = "Chỉ khách mời nhận thiệp riêng mới gửi được lời chúc.";
      mount?.appendChild(note);
      return;
    }

    // Đã gửi bao nhiêu lượt: đếm ngay trên danh sách vừa tải (server vẫn là nơi
    // chốt, đây chỉ để hiện đúng số lượt còn lại).
    const mine = _cxWishItems.filter(
      (w) => (w.name || "").trim().toLowerCase() === window.CX_GUEST.name.trim().toLowerCase(),
    ).length;
    _cxWishRemaining = Math.max(0, CX_WISH_MAX - mine);

    _cxWishBuildDock();
  } catch (error) {
    console.error("Lỗi dựng mục lời chúc:", error);
  }
}

window.initWishes = initWishes;
