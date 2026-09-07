// Lời chúc của khách mời trên trang thiệp: mục danh sách tự cuộn + thanh ghim
// đáy khung nhìn để khách viết. Gọi một lần từ loadWeddingData (wedding-helper).
//
// Mẫu thiệp KHÔNG phải sửa gì: có #cx-wishes-list thì helper mount vào đó, không
// có thì tự chèn một mục vào cuối thân thiệp — nhờ vậy mẫu đã phát hành cũng có.
// Chỉ khách cầm link cá nhân hoá mới thấy ô nhập, và cổng chặn thật nằm ở Edge
// Function (khớp hàng guests theo slug + tên + xưng hô), không phải ở đây.

const CX_WISH_MAX = 3;
const CX_WISH_MAX_LEN = 500;

// Số lời chúc tối thiểu để danh sách bắt đầu trôi — ít hơn thì trôi trông như lỗi.
const CX_WISH_ROLL_MIN = 4;

// Giây cho MỘT lời chúc đi hết khung: giữ tốc độ đọc như nhau dù danh sách dài ngắn.
const CX_WISH_ROLL_SEC = 6;

const CX_WISH_DEMO = [
  { id: "d1", name: "Anh Minh", relationship: "Bạn thân", text: "Chúc hai bạn trăm năm hạnh phúc, đầu bạc răng long!" },
  { id: "d2", name: "Chị Lan", relationship: "Đồng nghiệp", text: "Chúc mừng hạnh phúc hai em nhé, sớm có tin vui!" },
  { id: "d3", name: "Cô Hạnh", relationship: "Họ hàng", text: "Mong hai cháu luôn yêu thương và nhường nhịn nhau." },
  { id: "d4", name: "Bạn Tuấn", relationship: "Bạn đại học", text: "Cưới vui nhé! Chúc gia đình nhỏ luôn ngập tiếng cười." },
];

let _cxWishItems = [];
let _cxWishRemaining = CX_WISH_MAX;
let _cxWishDemo = false;

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

// Vẽ lại cả danh sách. Danh sách trôi được nhân đôi để vòng lặp không thấy mối
// nối — nên MỌI thứ đọc số lượng thật phải nhìn _cxWishItems, đừng đếm thẻ DOM.
function _cxWishRender() {
  const mount = document.getElementById("cx-wishes-list");
  if (!mount) return;

  if (_cxWishItems.length === 0) {
    mount.innerHTML =
      '<div class="cx-wish-empty cx-t">Chưa có lời chúc nào — hãy là người đầu tiên nhé.</div>';
    return;
  }

  const rolling = _cxWishItems.length >= CX_WISH_ROLL_MIN && !_cxWishReduceMotion();
  const html = _cxWishItems.map(_cxWishItemHtml).join("");

  mount.innerHTML =
    '<div class="cx-wish-viewport">' +
    `<div class="cx-wish-track${rolling ? " is-rolling" : ""}" ` +
    `style="--cx-wish-dur:${_cxWishItems.length * CX_WISH_ROLL_SEC}s">` +
    (rolling ? html + html : html) +
    "</div></div>";
}

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
