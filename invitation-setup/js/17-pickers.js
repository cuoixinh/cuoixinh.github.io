// Flatpickr, co giãn iframe preview, upload nhạc, tách link bản đồ.
//
// Tách từ index.js (dòng 4816–4959 bản gốc). Thứ tự nạp khai báo ở loader.js.

// ============= FLATPICKR INIT =============

// Cấu hình flatpickr DÙNG CHUNG cho mọi ô ngày (form thiết lập + modal AI qua
// <x-date>). Tách ra factory để control ngày ở mọi nơi đồng nhất.
window._weddingFpOptions = function (input) {
  return {
    locale: {
      months: {
        shorthand: [
          "T1",
          "T2",
          "T3",
          "T4",
          "T5",
          "T6",
          "T7",
          "T8",
          "T9",
          "T10",
          "T11",
          "T12",
        ],
        longhand: [
          "Tháng 1",
          "Tháng 2",
          "Tháng 3",
          "Tháng 4",
          "Tháng 5",
          "Tháng 6",
          "Tháng 7",
          "Tháng 8",
          "Tháng 9",
          "Tháng 10",
          "Tháng 11",
          "Tháng 12",
        ],
      },
      weekdays: {
        shorthand: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"],
        longhand: [
          "Chủ Nhật",
          "Thứ Hai",
          "Thứ Ba",
          "Thứ Tư",
          "Thứ Năm",
          "Thứ Sáu",
          "Thứ Bảy",
        ],
      },
      firstDayOfWeek: 1,
      rangeSeparator: " đến ",
      weekAbbreviation: "Tuần",
      scrollTitle: "Cuộn để tăng",
      toggleTitle: "Nhấp để chuyển đổi",
    },
    dateFormat: "Y-m-d",
    altInput: true,
    altFormat: "d/m/Y",
    allowInput: false,
    disableMobile: true,
    // KHÔNG đặt minDate: cho phép chọn/bind cả ngày trong quá khứ (thiệp cưới đã
    // diễn ra vẫn phải mở lại chỉnh được — minDate khiến setDate lúc bind bị bỏ).
    onReady: function (selectedDates, dateStr, instance) {
      instance.altInput.placeholder = "Chọn ngày...";
    },
    onChange: function (selectedDates, dateStr, instance) {
      const event = new Event("change", { bubbles: true });
      input.dispatchEvent(event);
    },
    onClose: function (selectedDates, dateStr, instance) {
      const event = new Event("change", { bubbles: true });
      input.dispatchEvent(event);
    },
  };
};

// Khởi tạo flatpickr cho 1 ô ngày bằng cấu hình chung + đăng ký instance theo name.
window.createWeddingDatepicker = function (input) {
  if (!window.flatpickr || !input || input._flatpickr)
    return input?._flatpickr || null;
  const instance = flatpickr(input, window._weddingFpOptions(input));
  if (!window.flatpickrInstances) window.flatpickrInstances = {};
  if (input.name) window.flatpickrInstances[input.name] = instance;
  return instance;
};

_onDomReady(function () {
  const dateInputs = document.querySelectorAll('input[type="date"]');
  window.flatpickrInstances = {};

  dateInputs.forEach((input) => window.createWeddingDatepicker(input));
  // Đánh dấu đã init xong → <x-date> thêm SAU (VD modal AI) sẽ tự init flatpickr.
  window._weddingDateReady = true;

  // Wire time pickers
  document.querySelectorAll("input[data-timepicker]").forEach((input) => {
    input.addEventListener("click", () => {
      openTimePicker(input, input.value, (val) => {
        input.value = val;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  });
});

// ============= SCALE PREVIEW IFRAME =============

function scalePreviewIframe() {
  const wrap = document.getElementById("phone-frame-wrap");
  const iframe = document.getElementById("preview-iframe");
  if (!wrap || !iframe) return;
  const scale = Math.min(1, wrap.offsetWidth / 390);
  iframe.style.transform = `scale(${scale})`;
  iframe.style.width = "390px";
}
window.addEventListener("resize", scalePreviewIframe);
_onDomReady(scalePreviewIframe);
_onDomReady(_initNavHeightWatcher);

// ============= MUSIC UPLOAD CONTAINER =============

_onDomReady(function () {
  const musicContainer = document.getElementById("music-upload-container");
  const musicFileInput = document.getElementById("music-file-input");
  if (musicContainer && musicFileInput) {
    musicContainer.addEventListener("click", function () {
      musicFileInput.click();
    });
  }
});

// ============= EXTRACT MAP URL =============

function extractMapUrl(textarea) {
  const value = textarea.value.trim();
  if (value.includes("<iframe") && value.includes("src=")) {
    const srcMatch = value.match(/src=["']([^"']+)["']/);
    if (srcMatch && srcMatch[1]) {
      textarea.value = srcMatch[1];
      showToast("Đã trích xuất URL từ iframe", "success");
    }
  }
}
window.extractMapUrl = extractMapUrl;

