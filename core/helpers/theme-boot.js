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

function _cxPreviewShell() {
  // Nằm trong iframe = đang xem qua trang Thiết lập, nơi đã có khung máy riêng.
  if (window.self !== window.top) return false;

  const q = new URLSearchParams(location.search);
  if (q.get("preview") !== "true" || q.get("shell") === "0") return false;
  if (window.innerWidth < CX_SHELL_MIN_W) return false;

  q.set("shell", "0");
  const src = `${location.pathname}?${q}${location.hash}`;

  const stage = document.createElement("div");
  stage.className = "cx-pshell";
  stage.innerHTML = `
    <div class="cx-pshell-phone">
      <div class="cx-pshell-screen">
        <iframe class="cx-pshell-view" title="Xem trước thiệp"
                allow="autoplay; encrypted-media" allowfullscreen></iframe>
      </div>
      <img src="../../../assets/images/iphone_mockup.svg" alt="" class="cx-pshell-frame" />
    </div>`;
  stage.querySelector("iframe").src = src;

  document.documentElement.classList.add("cx-pshell-host");
  document.body.replaceChildren(stage);

  // Ô màn hình là % của thân máy (px), thiệp lại dựng ở 390px cố định → tỉ lệ
  // thu nhỏ phải đo bằng JS mỗi lần khổ máy đổi.
  // Chiều cao iframe cũng phải đo, không để số cứng trong CSS: tỉ lệ ô màn của
  // ảnh thân máy không trùng khít 390×837, lệch bao nhiêu là hở bấy nhiêu ở mép
  // trên/dưới. Lấy đúng chiều cao ô rồi chia ngược cho tỉ lệ thu là khít.
  const phone = stage.querySelector(".cx-pshell-phone");
  const screen = stage.querySelector(".cx-pshell-screen");
  const view = stage.querySelector(".cx-pshell-view");
  const measure = () => {
    if (screen.offsetWidth <= 0) return;
    const scale = screen.offsetWidth / 390;
    phone.style.setProperty("--cx-scr-scale", String(scale));
    view.style.height = screen.offsetHeight / scale + "px";
  };
  measure();
  window.addEventListener("resize", measure, { passive: true });
  return true;
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
  initViewportFix();

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
