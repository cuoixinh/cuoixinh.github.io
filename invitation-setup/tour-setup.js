// Tour hướng dẫn cho người dùng mới ở trang thiết lập thiệp.
// Tách từ khối <script> inline cuối index.html — nội dung giữ nguyên.
// Phụ thuộc: showTour() trong core/helpers/guide-helper.js

(function () {
  if (!sessionStorage.getItem("show_tour")) return;
  sessionStorage.removeItem("show_tour");

  // "Đang ở màn chỉnh sửa" = panel form đang hiển thị (không phải preview/config/theme).
  const isOnEditScreen = () => {
    const fp = document.getElementById("form-panel");
    return !!fp && !fp.classList.contains("hidden");
  };

  const STEPS = [
    {
      selector: "#tour-theme-btn",
      title: "Chọn mẫu thiệp",
      desc: "Nhấn vào đây để đổi mẫu thiệp bất cứ lúc nào. Bạn có thể thử nhiều mẫu trước khi quyết định.",
      advanceOnClick: true,
      // Mở popup chọn mẫu → chờ người dùng chọn/đóng xong (popup biến mất) mới sang bước 2.
      advanceWhen: () => !document.getElementById("theme-picker-modal"),
    },
    {
      // Bước nhập nhiều thông tin — KHÔNG advanceOnClick để người dùng thao tác thoải mái.
      selector: "#tour-couple",
      title: "Điền thông tin",
      desc: "Điền đầy đủ thông tin cặp đôi, ngày giờ, địa điểm, ảnh cưới và nhạc nền vào các mục bên dưới.",
    },
    {
      // Spotlight cả cụm "Chỉnh sửa / Xem trước".
      selector: "#tour-view-switch",
      title: "Chỉnh sửa & Xem trước",
      desc: "Chuyển qua lại giữa Chỉnh sửa và Xem trước bất cứ lúc nào.",
      // Nhấn vào cụm (một trong hai nút) → sang bước 4 ngay. Thanh công cụ vẫn
      // hiển thị ở chế độ xem trước nên nút Xuất bản (bước 4) vẫn spotlight được.
      advanceOnClick: true,
    },
    {
      selector: "#tab-publish",
      title: "Xuất bản & gửi khách",
      desc: "Khi đã ưng ý, nhấn xuất bản để kích hoạt thiệp và chia sẻ link đến từng khách mời.",
      advanceOnClick: true,
    },
  ];

  // Gợi ý card "Tạo thiệp với AI" — một BƯỚC TÁCH RIÊNG, chỉ hiện 1 lần cho
  // người mới, sau khi họ đã hoàn tất 4 bước hướng dẫn ở trên (đợi 2s).
  const AI_HINT_KEY = "cuoixinh_ai_hint_seen";
  function showAiHint() {
    if (localStorage.getItem(AI_HINT_KEY)) return;
    // Thẻ mời phải đang hiển thị (chưa thu gọn) mới spotlight được.
    const card = document.querySelector(".ai-fab:not(.collapsed) .ai-card");
    if (!card || card.offsetParent === null) {
      localStorage.setItem(AI_HINT_KEY, "1"); // không hiện được → coi như đã xong
      return;
    }
    showTour(
      [
        {
          selector: ".ai-fab:not(.collapsed) .ai-card",
          title: "Tạo thiệp với AI",
          desc: "Chỉ vài dòng thông tin, AI sẽ tự hoàn thiện nội dung cả tấm thiệp. Bấm “Thử ngay” để bắt đầu nhé!",
        },
      ],
      { storageKey: AI_HINT_KEY, dismissOnTargetClick: true },
    );
  }

  // Đếm 2s để gợi ý AI, nhưng CHỈ khi đang ở màn chỉnh sửa. Nếu đang xem
  // trước (hoặc tab khác) thì chờ tới khi người dùng quay lại edit mới đếm.
  function scheduleAiHint() {
    if (isOnEditScreen()) {
      setTimeout(showAiHint, 2000);
      return;
    }
    const obs = new MutationObserver(() => {
      if (isOnEditScreen()) {
        obs.disconnect();
        setTimeout(showAiHint, 2000);
      }
    });
    obs.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ["class"],
    });
  }

  // Wait for page to finish initializing before starting tour
  setTimeout(
    () =>
      showTour(STEPS, {
        storageKey: "cuoixinh_tour_seen",
        onDone: (completed) => {
          if (completed) scheduleAiHint();
        },
      }),
    800,
  );
})();
