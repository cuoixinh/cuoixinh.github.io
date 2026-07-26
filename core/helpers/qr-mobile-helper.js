// ============================================================
// QR-MOBILE-HELPER.JS - QR code để mở thiệp nhanh trên mobile (F-31)
// Dùng chung cho cả 3 theme: tự dựng card nổi (không cần đặt HTML
// riêng ở từng template) hiện sẵn mã QR - không cần bấm gì, chỉ
// hiện trên desktop (Tailwind `lg:`), có thể thu gọn về nút tròn nhỏ.
// ============================================================

const QRCODEJS_CDN_URL =
  "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js";

let qrLibLoadPromise = null;
let qrMobileRendered = false;

/**
 * Key cache lưu trạng thái thu gọn - theo từng thiệp (slug) để đóng
 * ở thiệp này không ảnh hưởng thiệp khác xem cùng trình duyệt.
 */
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

/**
 * Dựng markup card + nút thu gọn, chèn vào cuối body. Không cần đặt
 * sẵn trong từng file index.html của theme.
 */
function buildMobileQRWidget() {
  if (document.getElementById("qr-mobile-fab")) return;

  const wrapper = document.createElement("div");
  wrapper.id = "qr-mobile-fab";
  wrapper.className = "hidden lg:block fixed bottom-20 right-4 z-[60]";
  wrapper.innerHTML = `
    <div id="qr-mobile-card" class="w-[200px] bg-white rounded-2xl shadow-xl p-4 text-center relative">
      <button
        id="qr-mobile-collapse"
        type="button"
        class="absolute top-2 right-2 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
        aria-label="Ẩn gợi ý QR"
      ><i class="fas fa-times text-[10px]"></i></button>
      <p class="font-inter text-xs font-semibold text-gray-800 mb-2">Xem trên điện thoại</p>
      <div
        id="qr-mobile-canvas"
        class="w-[150px] h-[150px] mx-auto bg-white rounded-xl border border-gray-100 flex items-center justify-center p-1.5"
      ><i class="fas fa-spinner fa-spin text-gray-300 text-xl"></i></div>
      <p class="font-inter text-[10px] text-gray-400 mt-2 leading-snug">Quét mã để mở nhanh trên di động</p>
    </div>
    <button
      id="qr-mobile-mini"
      type="button"
      class="hidden w-12 h-12 rounded-full bg-white shadow-lg items-center justify-center text-amber-600 hover:bg-amber-50 transition-all duration-300"
      aria-label="Xem QR mở thiệp trên mobile"
    ><i class="fas fa-qrcode text-lg"></i></button>
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
 * Render sẵn mã QR của link hiện tại vào card (giữ nguyên tên khách
 * đã cá nhân hoá trong URL nếu có).
 */
async function renderMobileQR() {
  const qrContainer = document.getElementById("qr-mobile-canvas");
  if (!qrContainer || qrMobileRendered) return;

  try {
    await loadQRCodeLib();
    qrContainer.innerHTML = "";
    new QRCode(qrContainer, {
      text: window.location.href,
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
        <i class="fas fa-exclamation-triangle text-red-400 text-lg mb-1"></i>
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
  // Chỉ ẩn trong iframe nhỏ ở tab "Giao diện" (?edit=1 - đang chỉnh màu/chữ
  // trực tiếp, không gian chật, hiện QR sẽ vướng). Tab "Xem trước"
  // (source=live, không edit) là iframe toàn màn hình mô phỏng đúng trải
  // nghiệm khách thật nên vẫn hiện QR bình thường.
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
