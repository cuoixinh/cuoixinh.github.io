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
  const opts = _cxShellOpts(slug);
  const stage = document.createElement("div");
  stage.className = "cx-pshell";
  stage.innerHTML = `
    <div class="cx-pshell-phone">
      <div class="cx-pshell-screen">
        ${window.CXPhoneChrome ? window.CXPhoneChrome.html(opts) : ""}
        <div class="cx-pviewport">
          <iframe class="cx-pshell-view" title="Xem trước thiệp"
                  allow="autoplay; encrypted-media" allowfullscreen></iframe>
        </div>
        <!-- Dải trắng đáy: giữ thiệp khỏi chạm góc bo của thân máy. -->
        <div class="cx-ppad"></div>
      </div>
      <img src="../../../assets/images/iphone_mockup.svg" alt="" class="cx-pshell-frame" />
    </div>`;
  stage.querySelector("iframe").src = src;

  document.documentElement.classList.add("cx-pshell-host");
  document.body.replaceChildren(stage);

  window.CXPhoneChrome?.wire(stage.querySelector(".cx-pchrome"), opts);
  _cxShellName(slug);

  // Ô màn hình là % của thân máy (px), thiệp lại dựng ở 390px cố định → tỉ lệ
  // thu nhỏ phải đo bằng JS mỗi lần khổ máy đổi.
  // Chiều cao iframe cũng phải đo, không để số cứng trong CSS: chrome và dải
  // trắng đáy ăn mất một phần ô màn, lệch bao nhiêu là hở bấy nhiêu ở mép dưới.
  // Lấy đúng chiều cao phần CÒN LẠI rồi chia ngược cho tỉ lệ thu là khít.
  const phone = stage.querySelector(".cx-pshell-phone");
  const screen = stage.querySelector(".cx-pshell-screen");
  const port = stage.querySelector(".cx-pviewport");
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

// Khai báo chrome của khung máy: quay lại (về kho mẫu nếu mở thẳng bằng link)
// và một mục menu duy nhất — chọn luôn mẫu đang xem.
//
// `source=live` = thiệp CỦA KHÁCH mở từ trang Thiết lập ("Mở tab mới"), không
// phải mẫu đang chào bán → menu rỗng, mời chọn mẫu ở đó là lạc chỗ.
function _cxShellOpts(slug) {
  const own = new URLSearchParams(location.search).get("source") === "live";
  return {
    title: _cxThemeTitle(slug),
    back: () => {
      if (history.length > 1) history.back();
      else location.href = "/theme-template/";
    },
    items: own
      ? []
      : [
          {
            label: "Chọn mẫu này",
            icon: "navigation",
            // Cùng đường tạo nháp với nút "Dùng mẫu" ở bảng đề xuất: hỏi trước nếu
            // khách còn thiệp làm dở (core/helpers/draft-start.js).
            onClick: () => {
              if (typeof cxStartDraft !== "function") {
                console.error("Thiếu core/helpers/draft-start.js");
                return;
              }
              const el = document.querySelector(".cx-pchrome-name");
              cxStartDraft(slug, (el && el.textContent) || _cxThemeTitle(slug));
            },
          },
        ],
  };
}

// Tên thật của mẫu nằm ở bảng `templates` (tên thư mục chỉ là slug). Hỏng thì
// giữ nguyên tên suy từ slug — không có gì để báo cho khách ở đây.
function _cxShellName(slug) {
  if (!window.templatesDAL) return;
  window.templatesDAL
    .list()
    .then((rows) => {
      const row = (rows || []).filter((t) => t.theme === slug)[0];
      if (row && row.name) window.CXPhoneChrome?.setTitle(row.name);
    })
    .catch(() => {});
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
