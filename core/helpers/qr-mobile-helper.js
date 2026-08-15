// QR mở thiệp nhanh trên mobile (F-31). Dùng chung cho cả 3 theme: tự dựng card
// nổi hiện sẵn mã QR (không cần HTML riêng ở từng template), chỉ hiện trên
// desktop (Tailwind `lg:`), thu gọn được về nút tròn nhỏ.

const QRCODEJS_CDN_URL =
  "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js";

let qrLibLoadPromise = null;
let qrMobileRendered = false;

/** Key cache trạng thái thu gọn — theo từng thiệp (slug). */
function getQRCollapseStorageKey() {
  const slug = typeof getSlugFromUrl === "function" ? getSlugFromUrl() : null;
  return buildCacheKey("qr_mobile_collapsed", slug || "default");
}

/**
 * Nạp thư viện QRCode.js (davidshimjs/qrcodejs) khi cần, chỉ 1 lần.
 */
function loadQRCodeLib() {
  if (window.QRCode) return Promise.resolve();
  if (qrLibLoadPromise) return qrLibLoadPromise;

  qrLibLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = QRCODEJS_CDN_URL;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return qrLibLoadPromise;
}

/** Dựng markup card + nút thu gọn, chèn vào cuối body. */
function buildMobileQRWidget() {
  if (document.getElementById("qr-mobile-fab")) return;

  const wrapper = document.createElement("div");
  wrapper.id = "qr-mobile-fab";
  wrapper.className = "hidden lg:block fixed bottom-20 right-4 z-[60]";
  wrapper.innerHTML = `
    <div id="qr-mobile-card" class="w-[200px] bg-white rounded-2xl shadow-xl p-4 text-center relative">
      <x-button variant="soft" tone="neutral" size="xs" icon-only id="qr-mobile-collapse" type="button" aria-label="Ẩn gợi ý QR" class="absolute top-2 right-2"><i data-icon="x" class="text-[10px]"></i></x-button>
      <p class="font-inter text-xs font-semibold text-gray-800 mb-2">Xem trên điện thoại</p>
      <div
        id="qr-mobile-canvas"
        class="w-[150px] h-[150px] mx-auto bg-white rounded-xl border border-gray-100 flex items-center justify-center p-1.5"
      ><i data-icon="loader-circle" class="animate-spin text-gray-300 text-xl"></i></div>
      <p id="qr-mobile-hint" class="font-inter text-[10px] text-gray-400 mt-2 leading-snug">Quét mã để mở nhanh trên di động</p>
    </div>
    <x-button variant="outline" size="lg" icon-only id="qr-mobile-mini" type="button" aria-label="Xem QR mở thiệp trên mobile" class="hidden text-amber-600"><i data-icon="qr-code" class="text-lg"></i></x-button>
  `;
  document.body.appendChild(wrapper);

  document
    .getElementById("qr-mobile-collapse")
    .addEventListener("click", collapseMobileQR);
  document
    .getElementById("qr-mobile-mini")
    .addEventListener("click", expandMobileQR);

  // Đã đóng ở lần xem trước (cache) -> mở lại ngay ở trạng thái thu gọn.
  if (getCache(getQRCollapseStorageKey())) {
    collapseMobileQR();
  }
}

/**
 * Link sẽ nạp vào mã QR. Trang thiệp thật và preview mẫu demo: dùng thẳng URL
 * hiện tại. Preview dữ liệu thật (`source=live`) lấy nội dung từ
 * sessionStorage.preview_data của CHÍNH trình duyệt này nên máy khác quét sẽ ra
 * dữ liệu demo → dùng link thiệp thật do trang Thiết lập truyền qua `?qr=`;
 * không có (thiệp chưa lưu lên hệ thống) → không dựng QR.
 */
function getQRTargetUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("source") !== "live") return window.location.href;
  return params.get("qr") || null; // URLSearchParams đã tự giải mã
}

/** Thiệp chưa lên hệ thống → nói rõ lý do thay vì đưa QR dẫn tới bản demo. */
function renderMobileQRUnavailable() {
  const qrContainer = document.getElementById("qr-mobile-canvas");
  if (!qrContainer) return;
  qrContainer.innerHTML = `
    <div class="text-center px-2">
      <i data-icon="cloud-upload" class="text-gray-300 text-xl mb-1.5"></i>
      <p class="font-inter text-[10px] text-gray-500 leading-snug">Xuất bản để xem trên điện thoại</p>
    </div>
  `;
  const hint = document.getElementById("qr-mobile-hint");
  if (hint) {
    hint.textContent = "Thiệp chưa xuất bản nên máy khác chưa xem được.";
  }
}

/**
 * Render sẵn mã QR vào card. Không cần bấm gì.
 */
async function renderMobileQR() {
  const qrContainer = document.getElementById("qr-mobile-canvas");
  if (!qrContainer || qrMobileRendered) return;

  const target = getQRTargetUrl();
  if (!target) {
    renderMobileQRUnavailable();
    qrMobileRendered = true;
    return;
  }

  try {
    await loadQRCodeLib();
    qrContainer.innerHTML = "";
    new QRCode(qrContainer, {
      text: target,
      width: 150,
      height: 150,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });
    qrMobileRendered = true;
  } catch (error) {
    console.error("Lỗi tạo mã QR:", error);
    qrContainer.innerHTML = `
      <div class="text-center p-2">
        <i data-icon="triangle-alert" class="text-red-400 text-lg mb-1"></i>
        <p class="font-inter text-[10px] text-gray-500">Không thể tạo mã QR</p>
      </div>
    `;
  }
}

function collapseMobileQR() {
  document.getElementById("qr-mobile-card")?.classList.add("hidden");
  const mini = document.getElementById("qr-mobile-mini");
  if (mini) {
    mini.classList.remove("hidden");
    mini.classList.add("flex");
  }
  setCache(getQRCollapseStorageKey(), true);
}

function expandMobileQR() {
  document.getElementById("qr-mobile-card")?.classList.remove("hidden");
  const mini = document.getElementById("qr-mobile-mini");
  if (mini) {
    mini.classList.add("hidden");
    mini.classList.remove("flex");
  }
  removeCache(getQRCollapseStorageKey());
}

function initMobileQRWidget() {
  // Chỉ ẩn trong iframe nhỏ ở tab "Giao diện" (?edit=1, không gian chật). Tab
  // "Xem trước" (source=live, không edit) vẫn hiện QR bình thường.
  const params = new URLSearchParams(window.location.search);
  if (params.get("edit") === "1") return;

  buildMobileQRWidget();

  // Chỉ khách xem trên desktop mới cần QR để mở lại trên điện thoại -
  // không tải thư viện QR cho khách đang xem trực tiếp trên mobile.
  if (!window.matchMedia("(min-width: 1024px)").matches) return;

  renderMobileQR();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMobileQRWidget);
} else {
  initMobileQRWidget();
}
