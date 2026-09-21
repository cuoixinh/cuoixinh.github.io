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
//
// `native` = ô màn CHÍNH LÀ màn điện thoại đang cầm (tab Giao diện dưới md, vỏ
// máy đã bị giấu): dựng thiệp ở đúng bề ngang đó, tỉ lệ 1, thay vì dựng 390px
// rồi phóng lên — máy rộng hơn 390 (16 Pro Max là 440) mà ép 390 thì hoặc thừa
// hai bên, hoặc phóng to mọi thứ lên so với lúc khách thật mở thiệp. Chế độ này
// đi kèm điều kiện CSS đã giấu chrome giả lập: chrome khai khổ bằng 390 × tỉ lệ
// nên ở khổ màn thật nó sẽ hụt một khúc bên phải.
function _cxPhoneScreen(phone, native) {
  const scr = phone?.querySelector(".cx-phone-screen");
  if (!(scr?.offsetWidth > 0)) return;
  const scale = native ? 1 : scr.offsetWidth / 390;
  // Đặt tỉ lệ TRƯỚC rồi mới đo: chrome khai khổ theo chính biến này, đọc chiều
  // cao ngay sau đó là trình duyệt đã tính lại xong bố cục.
  phone.style.setProperty("--cx-scr-scale", String(scale));
  const view = phone.querySelector(".cx-phone-view");
  // Chỉ phần CÒN LẠI của ô màn mới là chỗ của thiệp — chrome và dải trắng đáy
  // ăn mất một khúc, đo cả ô là thiệp thò xuống dưới thân máy.
  const port = phone.querySelector(".cx-pviewport") || scr;
  if (view) {
    view.style.width = (native ? scr.offsetWidth : 390) + 1 + "px";
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
  const theme = document.querySelector("#theme-preview-stage .cx-phone-screen");
  // Tải lại ở tab Giao diện phải dựng src kèm &edit=1 → mượn hàm của
  // js/05-theme-panel.js (nạp trước file này, cùng scope toàn cục).
  if (theme) C.mount(theme, _cxChromeOpts(() => _reloadThemeFrame()));
}

// Khổ máy tối đa cho khung CÓ vỏ: quá số này thì ô màn rộng hơn 390px, tức là
// thiệp bị PHÓNG TO hơn máy thật — bản xem trước hết còn nói đúng thứ khách sẽ
// thấy trên điện thoại. 0.9217 là bề rộng ô màn so với thân máy (xem
// .cx-phone-screen). Khung KHÔNG vỏ không cần trần: ở đó ô màn là màn điện thoại
// thật nên thiệp dựng thẳng ở bề ngang đó (`native` của _cxPhoneScreen).
const CX_PHONE_MAX_W = 390 / 0.9217;

// `squashH` = cho phép máy LÙN lại cho vừa chiều cao, và chỉ ở mobile (< md):
// thân máy lấy TRỌN bề ngang chỗ trống (còn vỏ thì chặn ở CX_PHONE_MAX_W) rồi cắt
// chiều cao xuống bằng khoảng trống còn lại — thiệp vẫn rộng đúng như máy thật,
// chỉ thấy được ít dòng hơn. Ảnh thân máy là SVG trong <img> nên tự bóp theo
// (preserveAspectRatio="none"), ô màn khai bằng % nên bám theo khổ mới.
// CHỈ tab Giao diện bật cờ này vì thanh chỉnh nằm trong luồng ngay dưới khung;
// tab Xem trước thì KHÔNG — ở đó khung máy chính là thứ cho thấy thiệp trông ra
// sao trên điện thoại, méo tỉ lệ là hết ý nghĩa.
// Từ md+ thanh chỉnh là cột phải, không ăn chiều cao của khung, nên máy giữ
// ĐÚNG TỈ LỆ như cũ (thu cả hai chiều kiểu `contain`).
// Dải xem trực tiếp KHÔNG gọi hàm này — bề rộng của nó là thuần CSS
// (--cx-ph-w theo --cx-rail-w).
//
// Đo theo Ô NỘI DUNG: clientWidth/Height đã tính cả padding, lấy thẳng là máy
// nuốt luôn phần lề và dính sát mép trên/dưới.
function _cxPhoneFit(stage, squashH) {
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
  const squash =
    !!squashH && !window.matchMedia?.("(min-width: 768px)").matches;
  // CSS giấu vỏ máy ở một số khung (tab Giao diện trên mobile) → ô màn trải trọn
  // khung, lúc đó nó CHÍNH LÀ màn điện thoại đang cầm: lấy trọn bề ngang, không
  // trần, và thiệp dựng ở đúng khổ đó (`native` của _cxPhoneScreen) chứ không
  // dựng 390px rồi phóng. Hỏi CSS thay vì chép lại breakpoint.
  const frame = phone.querySelector(".cx-phone-frame");
  const bare = !!frame && getComputedStyle(frame).display === "none";
  const w = bare
    ? boxW
    : squash
      ? Math.min(boxW, CX_PHONE_MAX_W)
      : Math.min(boxW, boxH * CX_PHONE_RATIO, CX_PHONE_MAX_W);
  if (!(w > 0)) return; // đang ẩn → để nguyên, lúc hiện ResizeObserver gọi lại
  phone.style.setProperty("--cx-ph-w", w + "px");
  // Có squash: cao hết cỡ là đúng tỉ lệ ảnh, thiếu chỗ thì cắt xuống bằng chiều
  // cao còn lại; không có vỏ thì chẳng còn tỉ lệ nào phải giữ nên lấp trọn chiều
  // cao. Không squash: gỡ biến để CSS trả về đúng tỉ lệ. (Tên KHÁC --cx-ph-h
  // của dải xem trực tiếp — xem ghi chú ở .cx-phone trong styles/_setup.css.)
  if (squash && boxH > 0)
    phone.style.setProperty(
      "--cx-ph-fit-h",
      (bare ? boxH : Math.min(w / CX_PHONE_RATIO, boxH)) + "px",
    );
  else phone.style.removeProperty("--cx-ph-fit-h");
  _cxPhoneScreen(phone, bare);
}

// Tab Xem trước. Máy giữ ĐÚNG TỈ LỆ ở mọi khổ màn, kể cả điện thoại thật: cả
// panel là của khung nên không phải chia chiều cao với thanh chỉnh nào. Panel
// đang ẩn thì khổ bằng 0, nên switchTab() gọi lại sau khi bỏ .hidden;
// ResizeObserver lo phần xoay máy / đổi khổ.
function cxPreviewFit() {
  _cxPhoneFit(document.getElementById("cx-preview-stage"), false);
}

// Tab Giao diện. Thanh chỉnh nằm trong luồng ngay dưới khung, nên kéo nó cao lên
// là chỗ trống hụt đi và máy lùn lại theo (ResizeObserver trên stage gọi lại hàm
// này). Bề ngang không đổi, thiệp vẫn dựng ở khổ máy thật.
function cxThemeFit() {
  _cxPhoneFit(document.getElementById("theme-preview-stage"), true);
}

function _cxLiveMeasure() {
  _cxPhoneScreen(document.querySelector("#live-dock .cx-phone"));
}

function _cxInitLive() {
  // Chèn chrome TRƯỚC phép đo: nó ăn một khúc chiều cao ô màn.
  _cxMountChrome();
  _cxLiveMeasure();
  cxPreviewFit();
  cxThemeFit();

  if (window.ResizeObserver) {
    const dock = document.getElementById("live-dock");
    if (dock) new ResizeObserver(_cxLiveMeasure).observe(dock);
    // Khổ vùng xem trước đổi cả khi KHÔNG resize cửa sổ (mở/đóng panel, thanh
    // địa chỉ trên di động trượt lên xuống) → phải theo dõi chính nó.
    const stage = document.getElementById("cx-preview-stage");
    if (stage) new ResizeObserver(cxPreviewFit).observe(stage);
    // Khung ở tab Giao diện đổi khổ khi kéo cột chỉnh bên phải.
    const tStage = document.getElementById("theme-preview-stage");
    if (tStage) new ResizeObserver(cxThemeFit).observe(tStage);
  }
  window.addEventListener(
    "resize",
    () => {
      _cxLiveMeasure();
      cxPreviewFit();
      cxThemeFit();
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
window.cxThemeFit = cxThemeFit;
window.cxLiveRefresh = cxLiveRefresh;
window.cxLiveTouch = cxLiveTouch;
window.cxLiveFocus = cxLiveFocus;

if (window.__cxOnReady) window.__cxOnReady(_cxInitLive);
else _cxInitLive();
