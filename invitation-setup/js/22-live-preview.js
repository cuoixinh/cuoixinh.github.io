// Khung điện thoại "xem trực tiếp": chạy chính thiệp đang chỉnh trong dải cố định
// sát mép phải (ngoài vùng ứng dụng — xem .cx-live-dock ở styles/_setup.css). Chỉ
// có từ 820px trở lên (iPad dựng đứng vẫn đủ chỗ); hẹp hơn thì dải biến mất,
// người dùng bấm "Xem trước". Dùng lại _savePreviewData()/_previewIframeSrc() của
// js/04-nav-tabs.js.

const CX_LIVE_MIN_W = 820;
const CX_LIVE_DELAY = 700; // gõ xong mới tải lại, không giật theo từng phím

let _cxLiveTimer = null;

function _cxLiveWide() {
  return window.innerWidth >= CX_LIVE_MIN_W;
}

/** Iframe đang thực sự nhìn thấy — hẹp quá hoặc đang mở tab khác (cờ .cx-rail-off
 *  của _syncRail) thì dải không hiện, tải lại chỉ tốn công. */
function _cxLiveFrames() {
  if (!_cxLiveWide()) return [];
  if (document.documentElement.classList.contains("cx-rail-off")) return [];
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
  // shell=0: theme-boot.js cắm cờ .cx-shell-view giấu thanh cuộn. Thanh cuộn cổ
  // điển (Chrome/Windows) ăn ~15px trong 390px bề ngang iframe → thiệp co lại,
  // chừa một dải trắng sát mép phải ngay trong lòng thân máy.
  frame.src = _previewIframeSrc("&shell=0");
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

// Thiệp dựng ở khổ 390px (máy thật) nên phải thu lại cho vừa ô màn hình — CSS
// không chia được px cho px, đành đo bằng JS. Xem .cx-phone-view.
// Bề rộng dải là thuần CSS (--cx-rail-w), không đo ở đây.
// Chiều cao iframe cũng phải đo, không để số cứng trong CSS: tỉ lệ ô màn của ảnh
// thân máy không trùng khít 390×837, lệch bao nhiêu là hở trắng bấy nhiêu ở mép
// dưới. Bề ngang cho dư 1px để phép làm tròn không chừa sợi trắng sát mép phải.
function _cxLiveMeasure() {
  const scr = document.querySelector("#live-dock .cx-phone-screen");
  if (!(scr?.offsetWidth > 0)) return;
  const scale = scr.offsetWidth / 390;
  document.documentElement.style.setProperty("--cx-scr-scale", String(scale));
  const view = document.getElementById("live-preview-iframe");
  if (view) {
    view.style.width = "391px";
    view.style.height = scr.offsetHeight / scale + "px";
  }
}

function _cxInitLive() {
  _cxLiveMeasure();

  if (window.ResizeObserver) {
    const dock = document.getElementById("live-dock");
    if (dock) new ResizeObserver(_cxLiveMeasure).observe(dock);
  }
  window.addEventListener(
    "resize",
    () => {
      _cxLiveMeasure();
      // Nhãn nút bước cuối đổi theo khổ màn ("Xem trước" ↔ "Cấu hình").
      window.cxRefreshStepStatus?.();
      // Vừa vượt ngưỡng CX_LIVE_MIN_W → dải mới hiện, chưa có gì trong đó.
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
