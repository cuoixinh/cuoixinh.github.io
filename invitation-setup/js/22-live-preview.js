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

// ── ĐO KHUNG ĐIỆN THOẠI ────────────────────────────────────────────────────
// Hai chỗ dùng khung máy: dải xem trực tiếp (từ 820px) và tab Xem trước (mọi
// khổ màn). Cùng markup .cx-phone nên dùng chung phép đo dưới đây; biến đặt
// NGAY TRÊN từng .cx-phone chứ không phải :root — hai khung có thể cùng tồn tại
// trong DOM, ghi lên biến chung là kéo lệch cái còn lại.
const CX_PHONE_RATIO = 0.4879; // 383/785 — tỉ lệ ảnh thân máy

// Thiệp dựng ở khổ 390px (máy thật) nên phải thu lại cho vừa ô màn hình — CSS
// không chia được px cho px, đành đo bằng JS. Xem .cx-phone-view.
// Chiều cao iframe cũng phải đo, không để số cứng trong CSS: tỉ lệ ô màn của ảnh
// thân máy không trùng khít 390×837, lệch bao nhiêu là hở trắng bấy nhiêu ở mép
// dưới. Bề ngang cho dư 1px để phép làm tròn không chừa sợi trắng sát mép phải.
function _cxPhoneScreen(phone) {
  const scr = phone?.querySelector(".cx-phone-screen");
  if (!(scr?.offsetWidth > 0)) return;
  const scale = scr.offsetWidth / 390;
  // Đặt tỉ lệ TRƯỚC rồi mới đo: chrome khai khổ theo chính biến này, đọc chiều
  // cao ngay sau đó là trình duyệt đã tính lại xong bố cục.
  phone.style.setProperty("--cx-scr-scale", String(scale));
  const view = phone.querySelector(".cx-phone-view");
  // Chỉ phần CÒN LẠI của ô màn mới là chỗ của thiệp — chrome và dải trắng đáy
  // ăn mất một khúc, đo cả ô là thiệp thò xuống dưới thân máy.
  const port = phone.querySelector(".cx-pviewport") || scr;
  if (view) {
    view.style.width = "391px";
    view.style.height = port.offsetHeight / scale + "px";
  }
}

// ── CHROME ĐIỆN THOẠI ──────────────────────────────────────────────────────
// Cùng bộ với khung xem thử mẫu trên máy tính (core/helpers/phone-chrome.js).

/** Tên mẫu đang dùng — cùng nguồn với huy hiệu ở thanh trên (js/18-theme-picker.js). */
function _cxPhoneTitle() {
  const badge = document
    .getElementById("header-theme-name")
    ?.textContent?.trim();
  return (
    badge ||
    sessionStorage.getItem("draft_template_name") ||
    (typeof WEDDING_THEME === "string" && WEDDING_THEME
      ? WEDDING_THEME.split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      : "") ||
    "Thiệp cưới"
  );
}

function _cxPreviewReload() {
  const frame = document.getElementById("preview-iframe");
  if (!frame) return;
  _savePreviewData();
  frame.src = _previewIframeSrc();
}

// Menu ba chấm ở đây KHÔNG có "Chọn mẫu này" như bản xem thử — khách đang chỉnh
// thiệp của mình rồi — mà là hai việc với chính khung đang nhìn. Mũi tên quay
// lại không khai việc gì: trang Thiết lập không có chỗ nào để quay về, nhưng bỏ
// nó đi thì thanh tiêu đề lệch hẳn so với máy thật.
function _cxChromeOpts(reload) {
  return {
    title: _cxPhoneTitle(),
    items: [
      { label: "Tải lại", icon: "refresh", onClick: reload },
      {
        label: "Mở tab mới",
        icon: "external",
        onClick: () => {
          _savePreviewData();
          window.open(_previewIframeSrc(), "_blank", "noopener");
        },
      },
    ],
  };
}

function _cxMountChrome() {
  const C = window.CXPhoneChrome;
  if (!C) return;
  const live = document.querySelector("#live-dock .cx-phone-screen");
  if (live) C.mount(live, _cxChromeOpts(cxLiveRefresh));
  const preview = document.querySelector("#cx-preview-stage .cx-phone-screen");
  if (preview) C.mount(preview, _cxChromeOpts(_cxPreviewReload));
}

// Khổ máy tối đa: quá số này thì ô màn rộng hơn 390px, tức là thiệp bị PHÓNG TO
// hơn máy thật — bản xem trước hết còn nói đúng thứ khách sẽ thấy trên điện
// thoại. 0.9217 là bề rộng ô màn so với thân máy (xem .cx-phone-screen).
const CX_PHONE_MAX_W = 390 / 0.9217;

// Thu cả thân máy cho vừa khoảng trống (kiểu `contain`): bề rộng suy từ chiều
// cao, rồi kẹp lại theo bề ngang để máy hẹp/cao vẫn không tràn. Dải xem trực
// tiếp KHÔNG gọi hàm này — bề rộng của nó là thuần CSS (--cx-ph-w theo --cx-rail-w).
//
// Đo theo Ô NỘI DUNG: clientWidth/Height đã tính cả padding, lấy thẳng là máy
// nuốt luôn phần lề và dính sát mép trên/dưới.
function _cxPhoneFit(stage) {
  const phone = stage?.querySelector(".cx-phone");
  if (!phone) return;
  const cs = getComputedStyle(stage);
  const boxW =
    stage.clientWidth -
    parseFloat(cs.paddingLeft) -
    parseFloat(cs.paddingRight);
  const boxH =
    stage.clientHeight -
    parseFloat(cs.paddingTop) -
    parseFloat(cs.paddingBottom);
  const w = Math.min(boxW, boxH * CX_PHONE_RATIO, CX_PHONE_MAX_W);
  if (!(w > 0)) return; // đang ẩn → để nguyên, lúc hiện ResizeObserver gọi lại
  phone.style.setProperty("--cx-ph-w", w + "px");
  _cxPhoneScreen(phone);
}

// Tab Xem trước. Panel đang ẩn thì khổ bằng 0, nên switchTab() gọi lại sau khi
// bỏ .hidden; ResizeObserver lo phần xoay máy / đổi khổ.
function cxPreviewFit() {
  _cxPhoneFit(document.getElementById("cx-preview-stage"));
}

function _cxLiveMeasure() {
  _cxPhoneScreen(document.querySelector("#live-dock .cx-phone"));
}

function _cxInitLive() {
  // Chèn chrome TRƯỚC phép đo: nó ăn một khúc chiều cao ô màn.
  _cxMountChrome();
  _cxLiveMeasure();
  cxPreviewFit();

  if (window.ResizeObserver) {
    const dock = document.getElementById("live-dock");
    if (dock) new ResizeObserver(_cxLiveMeasure).observe(dock);
    // Khổ vùng xem trước đổi cả khi KHÔNG resize cửa sổ (mở/đóng panel, thanh
    // địa chỉ trên di động trượt lên xuống) → phải theo dõi chính nó.
    const stage = document.getElementById("cx-preview-stage");
    if (stage) new ResizeObserver(cxPreviewFit).observe(stage);
  }
  window.addEventListener(
    "resize",
    () => {
      _cxLiveMeasure();
      cxPreviewFit();
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
window.cxPreviewFit = cxPreviewFit;
window.cxLiveRefresh = cxLiveRefresh;
window.cxLiveTouch = cxLiveTouch;
window.cxLiveFocus = cxLiveFocus;

if (window.__cxOnReady) window.__cxOnReady(_cxInitLive);
else _cxInitLive();
