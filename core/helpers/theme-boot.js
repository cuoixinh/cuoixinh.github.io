// Khởi động trang thiệp. Theme chỉ khai `window.CX_THEME` + `renderWedding`;
// mọi phần "chạy" (nạp dữ liệu, mở thiệp, hiệu ứng cuộn, viewport iOS) nằm ở đây.
// Nạp CUỐI CÙNG trong index.html của theme, sau index.js.
//
// Thiếu CX_THEME hoặc renderWedding thì file này nằm im: trang Thiết lập cũng nạp
// index.js của theme (chỉ để đọc bản khai) nhưng không nạp file này.

// Cờ bật/tắt mục: dữ liệu từ form là chuỗi "true"/"false" nên phải so cả hai kiểu.
function cxEnabled(flag) {
  return flag !== false && flag !== "false";
}

// Ẩn/hiện một mục. Gỡ luôn `display:none` viết cứng trong HTML (một số mục dùng
// nó thay cho .hidden) để lần bật sau không bị kẹt.
function cxToggle(id, show) {
  const el = document.getElementById(id);
  if (!el) return;
  if (show) {
    el.classList.remove("hidden");
    if (el.style.display === "none") el.style.display = "";
  } else {
    el.classList.add("hidden");
  }
}

window.cxEnabled = cxEnabled;
window.cxToggle = cxToggle;

// Mục được gán hiệu ứng hiện dần khi cuộn tới, nếu theme không khai CX_THEME.reveal.
const CX_REVEAL_DEFAULT = ["#main-card [id^='section-']", "#love-story"];

// --- KHUNG MÁY CHO BẢN XEM TRƯỚC TRÊN MÁY TÍNH ---
// Xem trước (?preview=true) trên màn rộng thì thiệp KHÔNG nở theo bề ngang màn:
// trang tự biến thành khung điện thoại, thiệp thật chạy trong iframe cùng URL +
// shell=0 ở đúng khổ 390px. Cờ shell=0 là thứ chặn đệ quy, đừng bỏ.
// Ảnh thân máy dùng đường dẫn tương đối như mọi tài nguyên khác của theme
// (trang thiệp luôn ở /public/themes/<tên>/). Style: .cx-pshell* ở _common.css.
const CX_SHELL_MIN_W = 820;

// Cạnh ngắn của MÁY (screen), mốc loại điện thoại ra: máy tính bảng nhỏ nhất
// cũng 768px, điện thoại to nhất mới ~440px.
const CX_SHELL_MIN_DEV_W = 700;

// Khổ máy — KHÔNG dùng mỗi window.innerWidth để quyết định có dựng khung hay
// không: Safari iOS dựng trang bằng viewport mặc định ~980px khi tab chưa hiện
// (mở nền, prerender lúc gõ/dán vào thanh địa chỉ), tải lại mới ra 390px. Đo
// trúng nhịp đó là điện thoại lĩnh nguyên khung máy cho tới khi refresh.
// screen.* là khổ THIẾT BỊ nên không dính lỗi thời điểm đó; lấy cạnh ngắn để
// xoay ngang hay dọc đều ra cùng một con số.
function _cxDeviceMinW() {
  const s = window.screen || {};
  const w = s.width || 0;
  const h = s.height || 0;
  return w && h ? Math.min(w, h) : 0;
}

// Tên mẫu suy từ đường dẫn: /public/themes/romantic-gold/ → "Romantic Gold".
// Chỉ là bản tạm cho nhịp vẽ đầu; tên thật lấy từ bảng `templates` ngay sau đó.
function _cxThemeSlug() {
  const parts = location.pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "";
  return (/\.html?$/.test(last) ? parts[parts.length - 2] : last) || "";
}

function _cxThemeTitle(slug) {
  return String(slug || "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Hình icon của thanh chrome — nhúng thẳng chuỗi SVG: trang thiệp có lucide
// nhưng markup này dựng trước lượt quét icon, mà gọi createIcons thêm một lượt
// cho mấy hình cố định thì không đáng.
const CX_SHELL_ICONS = {
  // signal: bốn cột sóng cao dần.
  signal:
    '<rect x="1" y="9" width="3.2" height="4" rx="1" />' +
    '<rect x="6" y="6.5" width="3.2" height="6.5" rx="1" />' +
    '<rect x="11" y="4" width="3.2" height="9" rx="1" />' +
    '<rect x="16" y="1" width="3.2" height="12" rx="1" />',
  // wifi: ba vòng cung + chấm.
  wifi:
    '<path d="M1 4.6a13.5 13.5 0 0 1 16 0" fill="none" stroke="currentColor" ' +
    'stroke-width="2.1" stroke-linecap="round" />' +
    '<path d="M4 8a9 9 0 0 1 10 0" fill="none" stroke="currentColor" ' +
    'stroke-width="2.1" stroke-linecap="round" />' +
    '<path d="M9 12.4 6.6 10.2a4.6 4.6 0 0 1 4.8 0z" />',
  // battery: vỏ + mức pin + cực dương.
  battery:
    '<rect x="0.6" y="0.6" width="21" height="11.8" rx="3.2" fill="none" ' +
    'stroke="currentColor" stroke-width="1.2" opacity="0.4" />' +
    '<rect x="2.4" y="2.4" width="13" height="8.2" rx="2" />' +
    '<path d="M23.2 4.6v3.2a2.6 2.6 0 0 0 0-3.2z" opacity="0.4" />',
};

function _cxShellIcon(name, w, h) {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + " " + h + '"' +
    ' width="' + w + '" height="' + h + '" fill="currentColor" aria-hidden="true">' +
    CX_SHELL_ICONS[name] +
    "</svg>"
  );
}

// Nét vẽ kiểu lucide cho hai nút của thanh tiêu đề (chevron-left, ellipsis).
function _cxShellStroke(d) {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"' +
    ' stroke="currentColor" stroke-width="2" stroke-linecap="round"' +
    ' stroke-linejoin="round" aria-hidden="true">' + d + "</svg>"
  );
}

// Chrome giả lập điện thoại: thanh trạng thái (giờ · sóng · wifi · pin) và thanh
// tiêu đề (Quay lại · tên mẫu · Tùy chọn). Khổ khai bằng px của MÁY THẬT rồi
// nhân --cx-scr-scale ở CSS, xem .cx-pshell-chrome trong styles/_common.css.
function _cxShellChrome(title) {
  const now = new Date();
  const clock =
    String(now.getHours()).padStart(2, "0") + ":" +
    String(now.getMinutes()).padStart(2, "0");

  return (
    '<div class="cx-pshell-chrome">' +
      '<div class="cx-pshell-status">' +
        '<span class="cx-pshell-clock">' + clock + "</span>" +
        '<span class="cx-pshell-island"></span>' +
        '<span class="cx-pshell-sys">' +
          _cxShellIcon("signal", 20, 13) +
          _cxShellIcon("wifi", 18, 13) +
          _cxShellIcon("battery", 24, 13) +
        "</span>" +
      "</div>" +
      '<div class="cx-pshell-bar">' +
        '<x-button variant="bare" class="cx-pshell-nbtn" data-act="back"' +
        ' aria-label="Quay lại">' + _cxShellStroke('<path d="m15 18-6-6 6-6"/>') +
        "</x-button>" +
        '<span class="cx-pshell-name" id="cx-pshell-name">' + title + "</span>" +
        '<x-button variant="bare" class="cx-pshell-nbtn" data-act="more"' +
        ' aria-label="Tùy chọn" aria-haspopup="menu" aria-expanded="false">' +
        _cxShellStroke(
          '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>' +
          '<circle cx="5" cy="12" r="1"/>'
        ) +
        "</x-button>" +
      "</div>" +
      '<div class="cx-pshell-pop" id="cx-pshell-pop" role="menu" hidden>' +
        // Hàng trong menu, không phải nút hành động rời — giữ <button> trần
        // như các hàng danh sách khác (xem quy ước <x-button> ở CLAUDE.md).
        '<button type="button" class="cx-pshell-pop-item" data-act="use"' +
        ' role="menuitem">' +
        _cxShellStroke('<polygon points="3 11 22 2 13 21 11 13 3 11"/>') +
        "Chọn mẫu này</button>" +
      "</div>" +
    "</div>"
  );
}

function _cxPreviewShell() {
  // Nằm trong iframe = đang xem qua trang Thiết lập, nơi đã có khung máy riêng.
  if (window.self !== window.top) return false;

  const q = new URLSearchParams(location.search);
  if (q.get("preview") !== "true" || q.get("shell") === "0") return false;

  const dev = _cxDeviceMinW();
  if (dev && dev < CX_SHELL_MIN_DEV_W) return false;
  if (window.innerWidth < CX_SHELL_MIN_W) return false;

  q.set("shell", "0");
  const src = `${location.pathname}?${q}${location.hash}`;

  const slug = _cxThemeSlug();
  const stage = document.createElement("div");
  stage.className = "cx-pshell";
  stage.innerHTML = `
    <div class="cx-pshell-phone">
      <div class="cx-pshell-screen">
        ${_cxShellChrome(_cxThemeTitle(slug))}
        <div class="cx-pshell-viewport">
          <iframe class="cx-pshell-view" title="Xem trước thiệp"
                  allow="autoplay; encrypted-media" allowfullscreen></iframe>
        </div>
        <!-- Dải trắng đáy: giữ thiệp khỏi chạm góc bo của thân máy. -->
        <div class="cx-pshell-pad"></div>
      </div>
      <img src="../../../assets/images/iphone_mockup.svg" alt="" class="cx-pshell-frame" />
    </div>`;
  stage.querySelector("iframe").src = src;

  document.documentElement.classList.add("cx-pshell-host");
  document.body.replaceChildren(stage);

  _cxShellName(slug);
  _cxShellActions(stage, slug);

  // Ô màn hình là % của thân máy (px), thiệp lại dựng ở 390px cố định → tỉ lệ
  // thu nhỏ phải đo bằng JS mỗi lần khổ máy đổi.
  // Chiều cao iframe cũng phải đo, không để số cứng trong CSS: chrome và dải
  // trắng đáy ăn mất một phần ô màn, lệch bao nhiêu là hở bấy nhiêu ở mép dưới.
  // Lấy đúng chiều cao phần CÒN LẠI rồi chia ngược cho tỉ lệ thu là khít.
  const phone = stage.querySelector(".cx-pshell-phone");
  const screen = stage.querySelector(".cx-pshell-screen");
  const port = stage.querySelector(".cx-pshell-viewport");
  const view = stage.querySelector(".cx-pshell-view");
  const measure = () => {
    if (screen.offsetWidth <= 0) return;
    const scale = screen.offsetWidth / 390;
    // Đặt tỉ lệ TRƯỚC rồi mới đo: chrome khai khổ theo chính biến này, đọc
    // chiều cao ngay sau đó là trình duyệt đã tính lại xong bố cục.
    phone.style.setProperty("--cx-scr-scale", String(scale));
    view.style.height = port.offsetHeight / scale + "px";
  };
  measure();
  window.addEventListener("resize", measure, { passive: true });
  return true;
}

// Tên thật của mẫu nằm ở bảng `templates` (tên thư mục chỉ là slug). Hỏng thì
// giữ nguyên tên suy từ slug — không có gì để báo cho khách ở đây.
function _cxShellName(slug) {
  const el = document.getElementById("cx-pshell-name");
  if (!el || !window.templatesDAL) return;
  window.templatesDAL
    .list()
    .then((rows) => {
      const row = (rows || []).filter((t) => t.theme === slug)[0];
      if (row && row.name) el.textContent = row.name;
    })
    .catch(() => {});
}

// Ba việc của chrome: quay lại, mở/đóng popover, chọn mẫu đang xem. Bắt bằng uỷ
// quyền vì <x-button> tự thay mình bằng <button> khác — tham chiếu bắt sẵn sẽ
// trỏ vào phần tử đã bị gỡ.
function _cxShellActions(stage, slug) {
  const pop = stage.querySelector("#cx-pshell-pop");

  const togglePop = (open) => {
    pop.hidden = !open;
    const btn = stage.querySelector('[data-act="more"]');
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  };

  stage.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    const act = btn && btn.dataset.act;

    if (act === "more") return togglePop(pop.hidden);

    togglePop(false);

    // Quay lại: chưa có lịch sử (mở thẳng bằng link) thì về kho mẫu.
    if (act === "back") {
      if (history.length > 1) history.back();
      else location.href = "/theme-template/";
      return;
    }
    if (act !== "use") return;

    // Cùng đường với nút "Dùng mẫu" ở bảng đề xuất: tạo nháp, hỏi trước nếu
    // khách còn thiệp làm dở (core/helpers/draft-start.js).
    if (typeof cxStartDraft !== "function") {
      console.error("Thiếu core/helpers/draft-start.js");
      return;
    }
    const el = document.getElementById("cx-pshell-name");
    cxStartDraft(slug, (el && el.textContent) || _cxThemeTitle(slug));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") togglePop(false);
  });
}

(function () {
  const T = window.CX_THEME;
  if (!T || typeof window.renderWedding !== "function") return;

  // Trang đã hoá thành khung máy → mọi việc còn lại do iframe bên trong lo.
  if (_cxPreviewShell()) return;

  // Đang chạy TRONG khung máy đó (shell=0 + nằm trong iframe): cắm cờ để
  // themes.css giấu thanh cuộn. Thanh cuộn cổ điển của Chrome/Windows ăn ~15px
  // trong 390px bề ngang iframe → thiệp co lại, chừa một dải trống bên phải
  // ngay trong lòng thân máy.
  if (
    new URLSearchParams(location.search).get("shell") === "0" &&
    window.self !== window.top
  ) {
    document.documentElement.classList.add("cx-shell-view");
  }

  // --- NẠP DỮ LIỆU ---
  loadWeddingData(getSlugFromUrl(), window.renderWedding);

  // --- MỞ THIỆP ---
  // Theme chen thêm việc lúc thiệp hiện ra (dựng lại carousel, đo lại khung…)
  // bằng CX_THEME.onOpen — openInvitation() gọi nó sau khi #main-card đã hiện.
  const _openInvitation = window.openInvitation;
  window.openInvitation = function () {
    _openInvitation(T.onOpen);
  };

  // --- LỜI CHÀO RIÊNG ---
  const _greet = () =>
    setupPersonalizedGreeting(getSlugFromUrl(), isGroomSide(), () =>
      _openInvitation(T.onOpen),
    );
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _greet);
  } else {
    _greet();
  }

  // --- VIEWPORT iOS ---
  // core/helpers/vh-lock.js tự khoá --vh khi nạp; index.html của mẫu phải có
  // thẻ script của nó, thiếu thì CSS lùi về `1svh` (đúng màu, chỉ kém ổn định).

  // --- HIỆU ỨNG CUỘN ---
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 },
  );
  document
    .querySelectorAll((T.reveal || CX_REVEAL_DEFAULT).join(","))
    .forEach((el, i) => {
      const mod = i % 3;
      if (mod === 0) el.classList.add("reveal", "from-bottom");
      else if (mod === 1) el.classList.add("reveal", "from-left");
      else el.classList.add("reveal", "from-right");
      revealObserver.observe(el);
    });

  // --- NHỊP THỞ CHO NÚT XÁC NHẬN THAM DỰ ---
  document.getElementById("btn-attend")?.classList.add("btn-idle");
  document.getElementById("btn-decline")?.classList.add("btn-idle");

  // --- iOS CHROME: click trên nút mở thiệp hay bị nuốt ---
  const openBtn = document.querySelector(".open-btn");
  if (openBtn) {
    openBtn.addEventListener(
      "touchend",
      function (e) {
        e.preventDefault();
        window.openInvitation();
      },
      { passive: false },
    );
  }
})();
