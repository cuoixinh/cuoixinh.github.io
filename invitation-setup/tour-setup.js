// Gợi ý thẻ "Tạo thiệp với AI" ở trang thiết lập thiệp: vào trang, đợi 2s là hiện.
// Chỉ hiện MỘT LẦN cho mỗi máy (cờ ai_hint_seen trong localStorage).
// Phụ thuộc: showTour() trong core/helpers/guide-helper.js

(function () {
  const AI_HINT_KEY = buildCacheKey("ai_hint_seen");
  if (getCache(AI_HINT_KEY)) return;

  const CARD_SEL = ".ai-fab:not(.is-gone) .ai-card";
  const WAIT_MS = 30000; // quá lâu vẫn chưa thấy thẻ → thôi, KHÔNG đánh dấu đã xem

  // Thẻ AI ẩn suốt lúc skeleton (.hidden-boot) và chỉ hiện ở màn chỉnh sửa,
  // nên điều kiện đủ là: phần tử có trong DOM VÀ đang thực sự hiển thị.
  const cardReady = () => {
    const card = document.querySelector(CARD_SEL);
    return !!card && card.offsetParent !== null;
  };

  function showAiHint() {
    // Vào thẳng bằng ?open=ai/voice thì bảng AI đang mở — đừng chồng tour lên.
    if (!cardReady() || document.getElementById("ai-form")) return;
    showTour(
      [
        {
          selector: CARD_SEL,
          title: "Tạo thiệp với AI",
          desc: "Chỉ vài dòng thông tin, AI sẽ tự hoàn thiện nội dung cả tấm thiệp. Bấm “Thử ngay” để bắt đầu nhé!",
        },
      ],
      { storageKey: AI_HINT_KEY, dismissOnTargetClick: true },
    );
  }

  // Mốc 2s tính từ lúc thẻ hiện được (hết skeleton), chứ không phải từ lúc nạp
  // script — nạp xong trang vẫn còn skeleton thì chưa có gì để spotlight.
  const t0 = Date.now();
  const iv = setInterval(() => {
    if (cardReady()) {
      clearInterval(iv);
      setTimeout(showAiHint, 2000);
    } else if (Date.now() - t0 > WAIT_MS) {
      clearInterval(iv);
    }
  }, 300);
})();
