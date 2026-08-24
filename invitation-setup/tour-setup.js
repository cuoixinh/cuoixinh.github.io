// Gợi ý nút trợ lý AI trên navbar trang thiết lập: vào trang, đợi 2s là hiện.
// Chỉ hiện MỘT LẦN cho mỗi máy (cờ ai_hint_seen trong localStorage).
// Phụ thuộc: showTour() trong core/helpers/guide-helper.js

(function () {
  const AI_HINT_KEY = buildCacheKey("ai_hint_seen");
  if (getCache(AI_HINT_KEY)) return;

  const CARD_SEL = "#tab-ai";
  const WAIT_MS = 30000; // quá lâu vẫn chưa thấy thẻ → thôi, KHÔNG đánh dấu đã xem

  // Nút nằm trong partial nav-bottom.html (loader chèn muộn) và có thể đang khuất
  // trong popover "Tùy chọn", nên điều kiện đủ là: có trong DOM VÀ đang hiển thị.
  const cardReady = () => {
    const card = document.querySelector(CARD_SEL);
    return !!card && card.offsetParent !== null;
  };

  function showAiHint() {
    // Bảng chat đang mở thì đừng chồng tour lên.
    const panel = document.getElementById("aichatPanel");
    if (!cardReady() || (panel && !panel.hidden)) return;
    showTour(
      [
        {
          selector: CARD_SEL,
          title: "Trợ lý AI",
          desc: "Kể vài dòng về đám cưới, trợ lý sẽ hỏi thêm rồi điền luôn nội dung vào thiệp cho bạn.",
        },
      ],
      { storageKey: AI_HINT_KEY, dismissOnTargetClick: true },
    );
  }

  // Mốc 2s tính từ lúc nút hiện được, chứ không phải từ lúc nạp script —
  // nạp xong trang vẫn còn skeleton thì chưa có gì để spotlight.
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
