// Khung điện thoại "xem trực tiếp": chạy chính thiệp đang chỉnh, đặt cạnh form ở
// tab Chỉnh sửa. Chỉ có từ 1024px trở lên — hẹp hơn thì không đủ chỗ cho hai cột,
// người dùng bấm "Xem trước" như cũ (nút đó cũng chỉ còn ở dưới 1024px).
// Dùng lại _savePreviewData()/_previewIframeSrc() của js/04-nav-tabs.js.

const CX_LIVE_MIN_W = 1024;
const CX_LIVE_DELAY = 700; // gõ xong mới tải lại, không giật theo từng phím

let _cxLiveTimer = null;
let _cxTopbarMax = 0; // chiều cao vỏ trên lúc CHƯA thu (xem _cxLiveMeasure)

function _cxLiveWide() {
  return window.innerWidth >= CX_LIVE_MIN_W;
}

/** Iframe đang thực sự nhìn thấy — panel khác đang mở thì không tải gì cả. */
function _cxLiveFrames() {
  if (!_cxLiveWide()) return [];
  if (document.getElementById("form-panel")?.classList.contains("hidden"))
    return [];
  const el = document.getElementById("live-preview-iframe");
  return el ? [el] : [];
}

/** Bước đang mở — chỉ panel của nó bỏ .hidden. Trùng key mà thiệp hiểu. */
function _cxLiveKey() {
  return (
    document.querySelector("#wedding-form [data-step]:not(.hidden)")?.dataset
      .step || ""
  );
}

/**
 * Bảo thiệp cuộn tới mục đang chỉnh (core/helpers/preview-focus-helper.js xử lý
 * bên trong iframe). Gọi được cả khi không tải lại — đổi bước chẳng hạn.
 */
function cxLiveFocus(key) {
  const frame = _cxLiveFrames()[0];
  const k = key || _cxLiveKey();
  if (!frame || !frame.src || !k) return;
  frame.contentWindow?.postMessage({ type: "cx-focus", key: k }, "*");
}

// Tải lại xong thì đưa thiệp về đúng mục đang chỉnh; không biết mục nào thì giữ
// nguyên vị trí cuộn cũ (iframe cùng origin nên đọc được scrollY) — nhảy về đầu
// thiệp sau mỗi lần gõ là không theo dõi nổi phần đang sửa.
function _cxLiveReload(frame) {
  const key = _cxLiveKey();
  let y = 0;
  try {
    y = frame.contentWindow?.scrollY || 0;
  } catch (e) {
    y = 0;
  }
  frame.src = _previewIframeSrc();
  if (!key && !y) return;
  frame.addEventListener("load", function once() {
    frame.removeEventListener("load", once);
    // Đợi một nhịp vẽ: lúc load bắn xong theme vẫn đang dựng nội dung, cuộn ngay
    // thì trang chưa đủ dài để tới được vị trí cần.
    requestAnimationFrame(() => {
      if (key) return cxLiveFocus(key);
      try {
        frame.contentWindow.scrollTo(0, y);
      } catch (e) {
        /* iframe đã đổi src lần nữa */
      }
    });
  });
}

/** Nạp lại ngay bản xem trực tiếp bằng dữ liệu đang có trên form. */
function cxLiveRefresh() {
  const frames = _cxLiveFrames();
  if (!frames.length) return;
  _savePreviewData();
  frames.forEach(_cxLiveReload);
  _cxLiveSpin();
}

// Icon nút tải lại quay một vòng — bản xem trước mất một lúc mới dựng xong, không
// có phản hồi gì thì người dùng tưởng bấm hụt.
function _cxLiveSpin() {
  const btn = document.getElementById("live-reload");
  if (!btn) return;
  btn.classList.remove("is-spinning");
  void btn.offsetWidth; // ép trình duyệt nhận lại animation khi bấm liên tiếp
  btn.classList.add("is-spinning");
}

/** Có thay đổi → hẹn tải lại. Gọi từ _setDirty() nên bắt được cả ảnh, mốc thời
 *  gian, đổi mẫu… chứ không riêng ô nhập. */
function cxLiveTouch() {
  if (!_cxLiveFrames().length) return;
  clearTimeout(_cxLiveTimer);
  _cxLiveTimer = setTimeout(cxLiveRefresh, CX_LIVE_DELAY);
}

// Ba số CSS cần đo: chiều cao vỏ trên (dock dính bên dưới nó) và bề rộng phần
// dock chiếm (cặp nút bước phải canh giữa cột form chứ không giữa màn hình).
// Vỏ trên tự thu khi cuộn → lấy giá trị LỚN NHẤT đã thấy, không thì dock nhấp
// nhô theo mỗi lần thu/mở.
function _cxLiveMeasure() {
  const topbar = document.getElementById("setup-topbar");
  const header = document.getElementById("setup-header");
  // offsetHeight = 0 lúc còn skeleton (#actual-content ẩn) — ghi lúc đó là dán
  // dock lên tận mép trên; ResizeObserver sẽ gọi lại khi trang hiện ra.
  if (topbar?.offsetHeight > 0 && !header?.classList.contains("is-tucked")) {
    _cxTopbarMax = Math.max(_cxTopbarMax, topbar.offsetHeight);
    document.documentElement.style.setProperty(
      "--cx-topbar-h",
      `${_cxTopbarMax}px`,
    );
  }

  // Thiệp dựng ở khổ 390px (máy thật) nên phải thu lại cho vừa ô màn hình —
  // CSS không chia được px cho px, đành đo bằng JS. Xem .cx-phone-view.
  const scr = document.querySelector("#live-dock .cx-phone-screen");
  if (scr?.offsetWidth > 0) {
    document.documentElement.style.setProperty(
      "--cx-scr-scale",
      String(scr.offsetWidth / 390),
    );
  }

  const dock = document.getElementById("live-dock");
  const r = dock?.getBoundingClientRect();
  // clientWidth (không kể thanh cuộn) vì `right` của #step-nav cũng đo trong
  // vùng đó — lấy innerWidth sẽ lệch đúng bề rộng thanh cuộn.
  const vw = document.documentElement.clientWidth;
  const w = r && r.width > 0 ? Math.round(vw - r.left) : 0;
  document.documentElement.style.setProperty("--cx-dock-w", `${w}px`);
}

function _cxInitLive() {
  _cxLiveMeasure();

  if (window.ResizeObserver) {
    const ro = new ResizeObserver(_cxLiveMeasure);
    ["setup-topbar", "live-dock"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) ro.observe(el);
    });
  }
  window.addEventListener(
    "resize",
    () => {
      _cxLiveMeasure();
      // Nhãn nút bước cuối đổi theo khổ màn ("Xem trước" ↔ "Cấu hình").
      window.cxRefreshStepStatus?.();
      // Vừa vượt ngưỡng 1024px → khung mới xuất hiện, chưa có gì trong đó.
      const frames = _cxLiveFrames();
      if (frames.length && !frames[0].src) cxLiveRefresh();
    },
    { passive: true },
  );
}

window.cxLiveWide = _cxLiveWide; // switchTab() hỏi để chặn tab Xem trước ở desktop
window.cxLiveRefresh = cxLiveRefresh;
window.cxLiveTouch = cxLiveTouch;
window.cxLiveFocus = cxLiveFocus;

if (window.__cxOnReady) window.__cxOnReady(_cxInitLive);
else _cxInitLive();
