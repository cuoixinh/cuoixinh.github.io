// ============= PAYMENT MODULE =============
// Dùng chung cho index.html và account.html

(function () {
  // ============= FEATURE FLAGS (Task 9.1) =============
  const USE_REAL_PAYMENT = true; // Set to false to use fake payment delay (1.5s)

  // ============= CONSTANTS & STATE (Task 5.1) =============
  const PAYMENT_API_URL = CONFIG.supabase.paymentUrl;
  const ANON_KEY = CONFIG.supabase.anonKey;
  const POLLING_INTERVAL = CONFIG.polling.interval;
  const POLLING_TIMEOUT = CONFIG.polling.timeout;

  // State management
  let pollingTimer = null;
  let pollingStartTime = null;
  let currentOrderId = null;
  // ============= PAYMENT FUNCTIONS (Task 5.2, 5.3, 5.5, 5.8) =============

  // qrcodejs không trang nào nạp sẵn → tự lấy khi thật sự cần vẽ QR, chỉ một lần.
  const QRCODEJS_CDN_URL =
    "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js";
  let _qrLibPromise = null;
  function _loadQRCodeLib() {
    if (window.QRCode) return Promise.resolve();
    if (_qrLibPromise) return _qrLibPromise;
    _qrLibPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = QRCODEJS_CDN_URL;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Không nạp được qrcodejs"));
      document.head.appendChild(script);
    });
    return _qrLibPromise;
  }

  // JWT của phiên đang đăng nhập (null nếu là khách) — backend dùng để ghi nhận
  // ai đã áp mã giảm giá; anon key thì ai cũng như ai.
  async function _authToken() {
    return (await window.CXAuth?.accessToken()) ?? null;
  }

  // Task 5.2 & 6.1 & 6.2: Create payment with PayOS - Enhanced error handling
  async function createPayment(orderData) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const token = await _authToken();
      const response = await fetch(`${PAYMENT_API_URL}/create-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${token || ANON_KEY}`,
        },
        body: JSON.stringify(orderData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Handle specific HTTP status codes
        if (response.status === 400) {
          const err = new Error(
            errorData.error || "Thông tin không hợp lệ, vui lòng kiểm tra lại",
          );
          // Mã giảm giá hỏng giữa chừng (hết lượt/hết hạn) → đánh dấu để
          // process() bôi đỏ đúng ô mã thay vì báo lỗi chung.
          if (errorData.promo_error) err.promoError = errorData.promo_error;
          throw err;
        } else if (response.status === 401) {
          // 401 ở đây cũng dùng cho "mã này phải đăng nhập mới dùng được", nên
          // phải ưu tiên message của server thay vì câu chung chung.
          const err = new Error(errorData.error || "Xác thực thất bại, vui lòng thử lại");
          if (errorData.promo_error) err.promoError = errorData.promo_error;
          throw err;
        } else if (response.status === 404) {
          throw new Error("Không tìm thấy dịch vụ thanh toán");
        } else if (response.status >= 500) {
          throw new Error("Lỗi server, vui lòng thử lại sau");
        } else {
          throw new Error(errorData.error || `Lỗi server (${response.status})`);
        }
      }

      const data = await response.json();

      // Đơn 0đ (mã giảm 100%) không đi qua PayOS nên không có QR — backend đã
      // đánh dấu hoàn tất, chỉ cần order_id để hiện màn thành công.
      if (data.free) {
        if (!data.order_id) throw new Error("Dữ liệu phản hồi không hợp lệ");
        return data;
      }

      // Validate response format
      if (!data.qr_code || !data.payment_info || !data.order_id) {
        throw new Error("Dữ liệu phản hồi không hợp lệ");
      }

      return data;
    } catch (error) {
      console.error("Create payment error:", error);

      // Handle network errors
      if (error.name === "AbortError") {
        throw new Error("Kết nối quá lâu, vui lòng kiểm tra mạng và thử lại");
      } else if (
        error.name === "TypeError" &&
        error.message.includes("fetch")
      ) {
        throw new Error("Lỗi kết nối, vui lòng kiểm tra mạng");
      } else if (
        error.message.includes("NetworkError") ||
        error.message.includes("Failed to fetch")
      ) {
        throw new Error("Lỗi kết nối, vui lòng kiểm tra mạng");
      }

      throw error;
    }
  }

  // Tô thanh bước theo bước đang hiện (1 xác nhận · 2 quét mã · 3 hoàn tất):
  // bước trước đó đánh dấu xong, bước hiện tại đánh dấu đang ở.
  function _setStep(n) {
    // Đã thanh toán xong thì không còn gì để "quay lại": ẩn nút ← của trang
    // /checkout/ (lối ra ở bước 3 là "Thiết lập ngay" / "Để sau").
    const back = document.getElementById("checkout-back");
    if (back) back.style.display = n === 3 ? "none" : "";
    document.querySelectorAll("#payment-steps li").forEach((li, i) => {
      li.classList.toggle("is-done", i + 1 < n);
      li.classList.toggle("is-on", i + 1 === n);
      if (i + 1 === n) li.setAttribute("aria-current", "step");
      else li.removeAttribute("aria-current");
    });
  }

  // Task 5.3: Display QR code
  function displayQRCode(qrDataString, paymentInfo, orderId) {
    const step2 = document.getElementById("payment-step-2");
    // Vỏ bước 2 mặc định là khối "đang xử lý" (p-12, canh giữa). Màn QR tự lo
    // padding bên trong nên phải trả vỏ về không lề, không thì thừa gần 100px.
    step2.className = "flex w-full flex-col items-center";

    // Màn QR: một việc duy nhất — quét & trả tiền. Số tiền + mã QR ở trên
    // cùng, thông tin chuyển khoản thủ công là các HÀNG có nút sao chép (gõ tay
    // số tài khoản/nội dung trên điện thoại rất dễ sai), hướng dẫn gấp trong
    // <details> để không đẩy QR ra khỏi màn.
    step2.innerHTML = `
        <div class="flex w-full flex-col gap-4 p-5 sm:p-6">
          <div class="text-center">
            <h3 class="font-playfair text-xl font-bold m-0" style="color:rgb(var(--text-heading-rgb));">Quét mã để thanh toán</h3>
            <p class="text-xs text-gray-400 mt-1 m-0">Mở app ngân hàng, chọn quét QR</p>
          </div>

          <!-- Số tiền: con số khách cần đối chiếu trước khi bấm xác nhận -->
          <div class="mx-auto flex items-baseline gap-2 rounded-full px-4 py-1.5" style="background:rgb(var(--surface-brand-rgb));">
            <span class="text-[11px] font-medium" style="color:rgb(var(--text-body-rgb));">Số tiền</span>
            <span class="text-lg font-bold" style="color:rgb(var(--brand-accent-rgb));">${paymentInfo.amount.toLocaleString("vi-VN")}đ</span>
          </div>

          <!-- Mã QR: viền góc thay cho khung kín, để mắt rơi vào giữa ô -->
          <div class="relative mx-auto rounded-2xl bg-white p-2">
            <div class="absolute -top-1 -left-1 w-5 h-5 border-t-[3px] border-l-[3px] rounded-tl" style="border-color:rgb(var(--brand-primary-rgb));"></div>
            <div class="absolute -top-1 -right-1 w-5 h-5 border-t-[3px] border-r-[3px] rounded-tr" style="border-color:rgb(var(--brand-primary-rgb));"></div>
            <div class="absolute -bottom-1 -left-1 w-5 h-5 border-b-[3px] border-l-[3px] rounded-bl" style="border-color:rgb(var(--brand-primary-rgb));"></div>
            <div class="absolute -bottom-1 -right-1 w-5 h-5 border-b-[3px] border-r-[3px] rounded-br" style="border-color:rgb(var(--brand-primary-rgb));"></div>
            <div id="qrcode-container" class="w-[220px] h-[220px] min-w-[220px] min-h-[220px] flex items-center justify-center bg-white rounded-xl"></div>
          </div>

          <!-- Trạng thái chờ: một hàng mảnh, KHÔNG phải khối lớn — máy đang chờ,
               không có gì để khách làm ở đây. -->
          <div class="flex items-center justify-center gap-2 text-xs">
            <span class="w-4 h-4 border-2 rounded-full animate-spin" style="border-color:rgb(var(--surface-brand-rgb));border-top-color:rgb(var(--brand-primary-rgb));"></span>
            <span class="font-medium" style="color:rgb(var(--text-body-rgb));">Đang chờ thanh toán</span>
            <span id="payment-timer" class="font-mono text-gray-400">--:--</span>
          </div>

          <!-- Chuyển khoản thủ công: mỗi dòng một trường, trường phải gõ lại thì
               có nút sao chép ngay cạnh. -->
          <div class="w-full rounded-2xl border border-gray-100 overflow-hidden">
            <p class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 m-0 bg-gray-50">Hoặc chuyển khoản thủ công</p>
            <div class="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100">
              <span class="text-xs text-gray-400 w-24 shrink-0">Ngân hàng</span>
              <span class="text-xs font-semibold flex-1 min-w-0 break-words" style="color:rgb(var(--text-heading-rgb));">${paymentInfo.bank_name}</span>
            </div>
            <div class="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100">
              <span class="text-xs text-gray-400 w-24 shrink-0">Chủ tài khoản</span>
              <span class="text-xs font-semibold flex-1 min-w-0 break-words" style="color:rgb(var(--text-heading-rgb));">${paymentInfo.account_name}</span>
            </div>
            <div class="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100">
              <span class="text-xs text-gray-400 w-24 shrink-0">Số tài khoản</span>
              <span class="text-xs font-mono font-semibold flex-1 min-w-0 break-all" style="color:rgb(var(--text-heading-rgb));">${paymentInfo.account_number}</span>
              <x-button variant="ghost" tone="neutral" size="xs" icon-only onclick="PaymentModal.copyField(this)" data-copy="${paymentInfo.account_number}" aria-label="Sao chép số tài khoản"><i data-lucide="copy" style="width:14px;height:14px"></i></x-button>
            </div>
            <div class="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100">
              <span class="text-xs text-gray-400 w-24 shrink-0">Nội dung</span>
              <span class="text-xs font-mono font-semibold flex-1 min-w-0 break-all" style="color:rgb(var(--text-heading-rgb));">${paymentInfo.content}</span>
              <x-button variant="ghost" tone="neutral" size="xs" icon-only onclick="PaymentModal.copyField(this)" data-copy="${paymentInfo.content}" aria-label="Sao chép nội dung chuyển khoản"><i data-lucide="copy" style="width:14px;height:14px"></i></x-button>
            </div>
            <p class="px-4 py-2.5 text-[11px] leading-relaxed text-gray-400 m-0 border-t border-gray-100">Giữ nguyên <b class="font-semibold" style="color:rgb(var(--text-heading-rgb));">nội dung chuyển khoản</b> để hệ thống nhận đúng đơn của bạn.</p>
          </div>

          <details class="w-full rounded-2xl border border-gray-100 px-4 py-3">
            <summary class="flex cursor-pointer list-none [&::-webkit-details-marker]:hidden items-center gap-2 text-xs font-semibold" style="color:rgb(var(--text-body-rgb));">
              <i data-lucide="circle-help" style="width:14px;height:14px"></i>Hướng dẫn thanh toán
            </summary>
            <ol class="mt-2 mb-0 pl-5 text-xs text-gray-500 leading-relaxed text-left">
              <li>Mở ứng dụng ngân hàng của bạn</li>
              <li>Chọn chức năng quét mã QR</li>
              <li>Quét mã QR bên trên</li>
              <li>Kiểm tra thông tin và xác nhận thanh toán</li>
            </ol>
          </details>

          <!-- Khối báo hết giờ / lỗi (ẩn lúc đầu). showTimeoutUI, showPaymentFailedUI
               và showPollingErrorUI sửa hai thẻ <p> bên trong theo thứ tự → giữ
               nguyên đúng hai thẻ p cùng cha. -->
          <div id="payment-timeout" class="hidden w-full flex-col gap-2.5 p-4 rounded-2xl border" style="background:rgb(var(--state-error-tint-rgb));border-color:rgb(var(--state-error-bg-rgb));">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgb(var(--state-error-bg-rgb));">
                <i data-lucide="triangle-alert" style="width:18px;height:18px;color:rgb(var(--state-error-text-rgb));"></i>
              </div>
              <div class="text-left flex-1">
                <p class="text-xs font-semibold m-0" style="color:rgb(var(--state-error-text-rgb));">Chưa nhận được xác nhận</p>
                <p class="text-[11px] text-gray-600 mt-1 m-0">Nếu đã thanh toán, vui lòng kiểm tra lại</p>
              </div>
            </div>
            <div class="flex gap-2.5">
              <x-button variant="outline" tone="neutral" size="sm" onclick="PaymentModal.retryCheck()" class="flex-1">
                <i data-lucide="refresh-cw" class="mr-2" style="width:16px;height:16px"></i>Kiểm tra lại
              </x-button>
              <x-button size="sm" onclick="PaymentModal.createNewPayment()" class="flex-1">
                <i data-lucide="qr-code" class="mr-2" style="width:16px;height:16px"></i>Tạo mã mới
              </x-button>
            </div>
          </div>

          <x-button variant="ghost" tone="neutral" size="sm" onclick="PaymentModal.cancelPayment()" class="mx-auto">
            <i data-lucide="x" class="mr-2" style="width:16px;height:16px"></i>Hủy thanh toán
          </x-button>
        </div>
      `;
    window.lucide?.createIcons({ root: step2 });

    // Generate QR code from string using QRCode.js
    setTimeout(async () => {
      try {
        await _loadQRCodeLib();
        const qrcodeContainer = document.getElementById("qrcode-container");
        if (qrcodeContainer && window.QRCode) {
          // Clear container first to prevent size jump
          qrcodeContainer.innerHTML = "";
          new QRCode(qrcodeContainer, {
            text: qrDataString,
            width: 220,
            height: 220,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M,
          });
          // Force QR code to fit container
          const qrImg = qrcodeContainer.querySelector("img");
          if (qrImg) {
            qrImg.style.width = "100%";
            qrImg.style.height = "100%";
            qrImg.style.objectFit = "contain";
          }
        } else {
          // Fallback: show error message
          qrcodeContainer.innerHTML = `
          <div style="text-align:center;padding:32px;">
            <div style="width:48px;height:48px;border-radius:9999px;background:rgb(var(--state-error-bg-rgb));display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
              <i data-lucide="triangle-alert" style="width:16px;height:16px;color:rgb(var(--state-error-text-rgb));font-size:20px;"></i>
            </div>
            <p style="color:rgb(var(--state-error-text-rgb));font-size:14px;margin:0 0 8px;font-weight:600;">Không thể tạo mã QR</p>
            <p style="color:rgb(var(--text-tertiary-rgb));font-size:12px;margin:0;">Vui lòng sử dụng nút thanh toán bên dưới</p>
          </div>
        `;
          window.lucide?.createIcons({ root: qrcodeContainer });
        }
      } catch (error) {
        console.error("QR code generation error:", error);
        const qrcodeContainer = document.getElementById("qrcode-container");
        if (qrcodeContainer) {
          qrcodeContainer.innerHTML = `
            <div style="text-align:center;padding:32px;">
              <div style="width:48px;height:48px;border-radius:9999px;background:rgb(var(--state-error-bg-rgb));display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
                <i data-lucide="circle-x" style="width:16px;height:16px;color:rgb(var(--state-error-text-rgb));font-size:20px;"></i>
              </div>
              <p style="color:rgb(var(--state-error-text-rgb));font-size:14px;margin:0 0 8px;font-weight:600;">Lỗi tạo mã QR</p>
              <p style="color:rgb(var(--text-tertiary-rgb));font-size:12px;margin:0;">Vui lòng sử dụng nút thanh toán bên dưới</p>
            </div>
          `;
          window.lucide?.createIcons({ root: qrcodeContainer });
        }
      }
    }, 100);

    // Start timer display
    startTimerDisplay();

    // Start polling
    startPolling(orderId);
  }

  // Task 5.5 & 6.1 & 6.2: Polling logic - Enhanced error handling
  async function checkPaymentStatus(orderId) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for polling

      const response = await fetch(
        `${PAYMENT_API_URL}/check-payment-status?order_id=${orderId}`,
        {
          headers: {
            Authorization: `Bearer ${ANON_KEY}`,
          },
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error("Check payment status failed:", response.status);

        // For polling, we don't want to show errors to user on every failed check
        // Just return pending and log the error
        if (response.status >= 500) {
          console.error(
            "Server error during status check, will retry on next poll",
          );
        } else if (response.status === 404) {
          console.error("Payment order not found");
        }

        return { status: "pending" };
      }

      const data = await response.json();

      // Validate response format
      if (!data.status) {
        console.error("Invalid status check response format");
        return { status: "pending" };
      }

      return data;
    } catch (error) {
      console.error("Check payment status error:", error);

      // Handle network errors during polling
      if (error.name === "AbortError") {
        console.error("Status check timeout, will retry on next poll");
      } else if (
        error.name === "TypeError" ||
        error.message.includes("fetch")
      ) {
        console.error(
          "Network error during status check, will retry on next poll",
        );
      }

      // Return pending to continue polling
      return { status: "pending" };
    }
  }

  function startPolling(orderId) {
    pollingStartTime = Date.now();
    currentOrderId = orderId;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 5;

    const poll = async () => {
      const elapsed = Date.now() - pollingStartTime;

      // Check timeout (5 minutes)
      if (elapsed >= POLLING_TIMEOUT) {
        stopPolling();
        showTimeoutUI();
        return;
      }

      // Check payment status
      const result = await checkPaymentStatus(orderId);

      if (result.status === "completed") {
        stopPolling();
        showSuccessScreen(result);
        consecutiveFailures = 0;
      } else if (result.status === "failed") {
        stopPolling();
        showPaymentFailedUI();
      } else if (result.status === "pending") {
        consecutiveFailures = 0;

        // Nhịp CỐ ĐỊNH, không giãn dần: mỗi lượt chỉ đọc một hàng theo index nên
        // giãn ra không tiết kiệm được gì đáng kể, mà lại làm màn "Thành công"
        // hiện chậm đúng lúc khách vừa quét xong và đang nhìn màn hình.
        pollingTimer = setTimeout(poll, POLLING_INTERVAL);
      } else {
        consecutiveFailures++;
        console.warn(
          `Polling attempt failed (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`,
        );

        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.error(
            "Too many consecutive polling failures, showing error UI",
          );
          stopPolling();
          showPollingErrorUI();
        } else {
          pollingTimer = setTimeout(poll, POLLING_INTERVAL);
        }
      }
    };

    // Start first poll
    poll();
  }

  function stopPolling() {
    if (pollingTimer) {
      clearTimeout(pollingTimer); // Use clearTimeout since we use setTimeout in startPolling
      pollingTimer = null;
    }

    // Also stop timer display
    const timerEl = document.getElementById("payment-timer");
    if (timerEl && timerEl.dataset.intervalId) {
      clearInterval(parseInt(timerEl.dataset.intervalId));
      timerEl.dataset.intervalId = null;
    }
  }

  // Task 5.8: Timer display
  function startTimerDisplay() {
    const timerEl = document.getElementById("payment-timer");
    if (!timerEl) return;

    // Đếm NGƯỢC về 0: con số khách cần biết là "còn bao lâu nữa thì hết hiệu
    // lực", không phải "đã chờ bao lâu". Hết giờ thì startPolling gọi showTimeoutUI.
    const updateTimer = () => {
      if (!pollingStartTime) return;
      const left = Math.max(
        0,
        Math.ceil((POLLING_TIMEOUT - (Date.now() - pollingStartTime)) / 1000),
      );
      const minutes = Math.floor(left / 60);
      const seconds = left % 60;
      timerEl.textContent = `còn ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);

    // Store interval ID to clear later
    timerEl.dataset.intervalId = timerInterval;
  }

  // Task 5.8: Show timeout UI
  function showTimeoutUI() {
    const timeoutEl = document.getElementById("payment-timeout");
    if (timeoutEl) {
      timeoutEl.style.display = "flex";
    }
  }

  // Task 6.2: Show payment failed UI
  function showPaymentFailedUI() {
    const timeoutEl = document.getElementById("payment-timeout");
    if (timeoutEl) {
      const title = timeoutEl.querySelector("p:first-of-type");
      const message = timeoutEl.querySelector("p:nth-of-type(2)");

      if (title) {
        title.textContent = "❌ Thanh toán thất bại";
      }
      if (message) {
        message.textContent =
          "Giao dịch không thành công. Vui lòng tạo mã mới để thử lại.";
      }

      timeoutEl.style.display = "flex";
    }
  }

  // Task 6.1: Show polling error UI
  function showPollingErrorUI() {
    const timeoutEl = document.getElementById("payment-timeout");
    if (timeoutEl) {
      const title = timeoutEl.querySelector("p:first-of-type");
      const message = timeoutEl.querySelector("p:nth-of-type(2)");

      if (title) {
        title.textContent = "⚠️ Lỗi kết nối";
      }
      if (message) {
        message.textContent =
          "Không thể kiểm tra trạng thái thanh toán. Vui lòng kiểm tra kết nối mạng và thử lại.";
      }

      timeoutEl.style.display = "flex";
    }
  }

  // Show success screen
  function showSuccessScreen(paymentResult) {
    const { manage_id, slug, transaction_id, payment_time } = paymentResult;

    // Update localStorage order
    updateOrderStatus(manage_id, transaction_id, payment_time);

    // Sau thanh toán: xuất bản thiệp. Chỉ nháp CHƯA lên DB (_localOnly) mới đẩy
    // nội dung lên — bản sao local của thiệp đã có trên DB là bản cũ, đẩy lên là
    // đè mất những gì đã sửa ở máy khác (và đổi mẫu thì ăn THEME_LOCKED).
    if (manage_id && window.weddingDAL) {
      const draftKey = buildCacheKey("draft", manage_id);
      const draftData = getCache(draftKey);
      const publishOnly = () => window.weddingDAL.publishWedding(manage_id);
      let job;
      if (draftData?._localOnly) {
        // Bỏ khoá riêng của nháp local (_localOnly, _savedAt) — edge không có cột đó.
        const { _localOnly, _savedAt, _owner, _aiCard, _seed, ...fields } = draftData;
        job = window.weddingDAL
          .updateWedding({ id: manage_id, ...fields, is_published: true })
          .catch(publishOnly);
      } else {
        job = publishOnly();
      }
      // Đã trả tiền mà thiệp chưa xuất bản thì PHẢI nói, nuốt lỗi là khách tưởng xong.
      job
        .then(() => {
          markDraftUploaded(manage_id);
          removeCache(draftKey);
        })
        .catch((e) => {
          console.error("publish after payment:", e);
          window.showToast?.(
            "Đã thanh toán nhưng chưa xuất bản được thiệp — mở trang chỉnh sửa và bấm Xuất bản.",
            "warning",
          );
        });
    }

    _renderSuccess(manage_id);
  }

  // Chỉ VẼ màn "Thanh toán thành công" (không ghi đơn, không xuất bản).
  function _renderSuccess(manage_id) {
    const buyer = _buyer() || { name: "", phone: "" };
    const templateName = document.getElementById(
      "payment-template-name",
    ).textContent;

    // Update success screen
    document.getElementById("success-name").textContent = buyer.name;
    document.getElementById("success-template").textContent = templateName;

    // Gói vừa mua: lấy từ báo giá của lượt này (gói chọn + hạn server tính).
    const q = window._planQuote;
    const plan = q?.plans?.find((x) => x.id === window._paymentPlan);
    const planRow = document.getElementById("success-plan-row");
    const expRow = document.getElementById("success-expiry-row");
    if (planRow) planRow.style.display = plan ? "flex" : "none";
    // Gói vĩnh viễn không có ngày → bỏ đoạn "· hiển thị đến …".
    if (expRow) expRow.style.display = plan?.expires_at ? "inline" : "none";
    const until = plan
      ? plan.expires_at ? `hết ngày ${_fmtDate(plan.expires_at)}` : "Vĩnh viễn"
      : "";
    if (plan) {
      document.getElementById("success-plan").textContent = plan.label;
      document.getElementById("success-expiry").textContent = until;
    }
    const subEl = document.getElementById("success-sub");
    if (subEl)
      subEl.textContent = q?.current_plan && plan
        ? `Đã nâng lên gói ${plan.label} — khách mời xem được thiệp ${plan.expires_at ? `đến ${until}` : "mãi mãi"}.`
        : "Thiệp cưới đã là của bạn — bắt đầu nhập thông tin ngay nhé.";
    // Hồ sơ tài khoản có thể không có số điện thoại → giấu cả hàng thay vì để
    // một dòng nhãn trống.
    const phoneRow = document.getElementById("success-phone-row");
    document.getElementById("success-phone").textContent = buyer.phone;
    if (phoneRow) phoneRow.style.display = buyer.phone ? "flex" : "none";

    const manageLink = manage_id
      ? window.location.origin + "/invitation-setup/?id=" + manage_id
      : null;

    if (manageLink) {
      document.getElementById("success-manage-link").value = manageLink;
      document.getElementById("success-manage-btn").href = manageLink;
      document.getElementById("success-manage-block").style.display = "block";
    } else {
      document.getElementById("success-manage-block").style.display = "none";
    }

    // Show success screen
    document.getElementById("payment-step-1").style.display = "none";
    document.getElementById("payment-step-2").style.display = "none";
    const step3 = document.getElementById("payment-step-3");
    step3.style.display = "flex";
    _setStep(3);
    // Đơn 0đ đi thẳng từ bước 1 sang đây; icon của bước 3 đã dựng lúc mount,
    // nhưng gọi lại cho chắc khi markup vừa bị thay ở luồng khác.
    window.lucide?.createIcons({ root: step3 });
  }

  // Task 5.11: Update localStorage order status
  function updateOrderStatus(manage_id, transaction_id, payment_time) {
    const storageKey = buildCacheKey("orders", getCurrentUser()?.email || "guest");

    const orders = getCache(storageKey, []);

    // Khớp theo manage_id; chỉ lùi về đơn pending CHƯA gắn thiệp nào (do mở hộp
    // thanh toán để lại) — lấy "đơn pending đầu tiên" là đánh dấu nhầm thiệp khác.
    let orderIdx = orders.findIndex((o) => o.manage_id === manage_id);
    if (orderIdx < 0)
      orderIdx = orders.findIndex((o) => !o.manage_id && o.status === "pending");
    if (orderIdx >= 0) {
      orders[orderIdx] = {
        ...orders[orderIdx],
        status: "completed",
        manage_id,
        transaction_id,
        payment_time,
      };
    }

    setCache(storageKey, orders);
  }

  // Inject modal HTML vào body
  // Ba bước của luồng thanh toán, KHÔNG kèm vỏ. Dùng cho cả hai chỗ đứng: hộp
  // thoại (injectPaymentModal) và trang /checkout/ (PaymentModal.mount) — mọi
  // hàm bên dưới tìm phần tử bằng id nên không cần biết mình đang ở vỏ nào.
  function _stepsHTML() {
    return `
          <!-- Step 1: Xác nhận đơn hàng.
               Bố cục: thanh bước → mẫu đang mua (phong bì) → người mua → chi tiết
               thanh toán (kèm mã giảm giá) → dải trả tiền. Thẻ giữ phẳng, chỉ
               phong bì là chỗ nhấn — màn này chỉ có một việc.
               TIỀN CHỈ ĐƯỢC KỂ MỘT LẦN: hàng sản phẩm không mang giá, mọi con
               số (giá gốc · ưu đãi · mã giảm) dồn vào chi tiết thanh toán, tổng
               nằm trên nút trả tiền. Rải giá ra hai chỗ là khách phải tự đối
               chiếu, và lúc áp mã thì hai chỗ nói hai giá khác nhau. -->
          <!-- Ba chặng THẬT của luồng, đứng trên CẢ BA bước (khối #payment-step-N
               tương ứng): khách do dự vì không biết bấm xong thì rơi vào đâu, và
               đang ở màn QR thì cần biết còn một chặng nữa. Trạng thái do
               _setStep đặt — chỗ nào chuyển bước thì gọi nó. Dòng chữ nhỏ trên cùng
               cho biết đây là màn thanh toán, đứng NGANG HÀNG nút đóng (hộp thoại)
               / nút quay lại (trang) nên thanh bước ở hàng dưới không đụng nút. -->
          <p class="cx-ord-eyebrow cx-ord-kicker">Thanh toán đơn hàng</p>
          <ol id="payment-steps" class="cx-ord-steps px-6 pt-3 m-0" aria-label="Các bước thanh toán">
            <li><span>1</span>Xác nhận</li>
            <li><span>2</span>Quét mã</li>
            <li><span>3</span>Hoàn tất</li>
          </ol>

          <div id="payment-step-1">
            <!-- Tiêu đề CHỈ cho trình đọc màn hình: thanh bước ở trên đã báo
                 "Xác nhận", hiện thêm một dòng là nói lại điều đó và đẩy thẻ
                 thiệp — thứ khách cần nhìn — xuống thấp. -->
            <h3 class="sr-only">Xác nhận đơn hàng</h3>

            <!-- Thiệp đang thanh toán, dựng như thẻ ở "Đã chọn" (my-invitations):
                 ảnh bìa THẬT của khách + tên cô dâu chú rể + tên mẫu, để khách có
                 nhiều thiệp vẫn chắc mình đang trả cho đúng thiệp. Mua mẫu mới
                 (chưa có thiệp) thì ảnh là ảnh mẫu — xem _syncProduct.
                 #payment-template-name phải giữ ĐÚNG tên mẫu: process() đọc lại
                 chữ trong đó để dựng đơn. -->
            <div class="px-6 pt-5 pb-6">
              <div class="cx-ord-item">
                <div class="cx-ord-thumb">
                  <span id="payment-thumb-fallback" class="cx-ord-thumb-empty"></span>
                  <!-- src rỗng phân giải thành URL trang hiện tại → trình duyệt tải
                       HTML về rồi vẽ icon vỡ; đặt sẵn ảnh 1x1 trong suốt. -->
                  <img id="payment-thumb" alt="" class="hidden"
                    src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
                </div>
                <div class="min-w-0 flex-1 flex flex-col gap-1 py-1">
                  <!-- Cùng kiểu chữ tên thiệp ở thẻ "Đã chọn" (.mi-title): Inter 16px
                       đậm vừa, một dòng. -->
                  <p class="text-base font-semibold leading-[1.35] m-0 truncate" style="color:rgb(var(--scrim-plum-rgb));" id="payment-product-sub">Thiệp cưới online</p>
                  <p class="flex items-center gap-1.5 text-xs text-gray-500 m-0 min-w-0">
                    <i data-lucide="palette" class="shrink-0" style="width:14px;height:14px"></i><span id="payment-template-name" class="truncate">-</span>
                  </p>
                  <p class="flex items-start gap-1.5 text-xs leading-4 text-gray-500 m-0">
                    <i data-lucide="calendar-clock" class="shrink-0 mt-px" style="width:14px;height:14px"></i><span id="payment-plan-line">Thiệp cưới online</span>
                  </p>
                </div>
              </div>
            </div>

            <!-- Chọn gói: ba thẻ do _renderPlans vẽ từ báo giá của server. Thiệp
                 đã thanh toán thì đây là bảng NÂNG gói (giá trên thẻ = phần chênh). -->
            <div class="px-6 pb-5">
              <p id="payment-plans-title" class="cx-ord-eyebrow">Chọn gói</p>
              <div id="payment-plans" class="cx-ord-plans" role="radiogroup" aria-labelledby="payment-plans-title"></div>
              <p id="payment-plan-note" class="cx-ord-plan-note" style="display:none;"></p>
            </div>

            <!-- Người mua = tài khoản đang đăng nhập, không nhập lại gì và KHÔNG
                 cho đổi ở đây. Chưa đăng nhập thì #payment-login thế chỗ (xem
                 _syncBuyer). -->
            <div class="px-6 pb-5">
              <p class="cx-ord-eyebrow">Người mua</p>
              <div id="payment-user-info" class="hidden items-center gap-3 rounded-2xl px-4 py-3" style="background:rgb(var(--surface-brand-subtle-rgb));">
                <!-- Chữ cái đầu nằm sẵn dưới ảnh: tài khoản email thuần không
                     có avatar, và link avatar Google cũng có lúc chết. -->
                <span class="relative shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full overflow-hidden text-sm font-semibold"
                  style="background:rgb(var(--white-rgb));color:rgb(var(--avatar-initial-rgb));box-shadow:0 0 0 2px rgb(var(--white-rgb)), 0 0 0 3px rgb(var(--brand-primary-rgb));">
                  <span id="payment-avatar-ini"></span>
                  <img id="payment-avatar" src="" alt="" class="absolute inset-0 w-full h-full object-cover" />
                </span>
                <div class="min-w-0">
                  <p class="text-sm font-semibold m-0 truncate" style="color:rgb(var(--text-heading-rgb));" id="payment-user-name-display"></p>
                  <p class="text-xs text-gray-500 m-0 truncate" id="payment-user-email-display"></p>
                </div>
              </div>
              <div id="payment-login" class="hidden flex-col items-start gap-3 rounded-2xl px-4 py-4" style="background:rgb(var(--surface-brand-subtle-rgb));">
                <p class="text-sm text-gray-600 m-0">Đăng nhập để thanh toán và quản lý thiệp của bạn.</p>
                <x-button size="sm" icon="log-in" onclick="PaymentModal.login()">Đăng nhập</x-button>
              </div>
            </div>

            <!-- Chi tiết thanh toán: nơi DUY NHẤT cộng trừ, dựng như tờ hoá đơn
                 (chấm dẫn từ nhãn sang số). Hai hàng giảm giá dùng style.display
                 chứ không phải class "hidden" — hàng là flex, mà gỡ "hidden" chỉ
                 trả về display:block nên hai đầu hàng dồn hết sang trái. -->
            <div class="px-6 pb-5">
              <p class="cx-ord-eyebrow">Chi tiết thanh toán</p>
              <div class="flex flex-col gap-2.5">
                <div class="cx-ord-line">
                  <span id="payment-base-label" class="text-gray-600">Giá mẫu thiệp</span><span class="cx-ord-lead"></span>
                  <span id="payment-base-price" class="font-semibold" style="color:rgb(var(--text-heading-rgb));">…</span>
                </div>
                <div id="payment-sale-row" class="cx-ord-line" style="display:none;color:rgb(var(--action-primary-deep-rgb));">
                  <span>Ưu đãi ra mắt</span><span class="cx-ord-lead"></span>
                  <span id="payment-sale-amount" class="font-semibold">-0đ</span>
                </div>
              </div>
              <!-- Mã giảm giá là MỘT HÀNG của chi tiết thanh toán, dáng phiếu cắt
                   viền đứt: vừa là nút mở ô nhập, vừa là chỗ báo kết quả — mã
                   giảm nằm đúng chỗ nó tác động. Chưa dùng thì ghi lời mời, dùng
                   rồi thì ghi mã + mức giảm. -->
              <!-- Vỏ #promo-ticket mang cờ .is-applied (đặt ở _setPromoRow): đã áp mã
                   thì mũi tên nhường chỗ cho nút ✕ gỡ mã. Nút ✕ là ANH EM của nút
                   hàng (button không lồng được button), đè lên chỗ mũi tên. -->
              <div id="promo-ticket" class="cx-ord-coupon-wrap mt-4">
                <button type="button" id="promo-row" onclick="cxPromoToggle()" class="cx-ord-coupon">
                  <span class="flex items-center gap-2 text-sm font-medium min-w-0" style="color:rgb(var(--text-heading-rgb));">
                    <i data-lucide="ticket-percent" class="shrink-0" style="width:16px;height:16px;color:rgb(var(--brand-accent-rgb));"></i><span id="promo-row-label" class="truncate">Nhập mã giảm giá</span>
                  </span>
                  <span class="flex items-center gap-1 shrink-0">
                    <span id="promo-discount-amount" class="hidden text-sm font-semibold" style="color:rgb(var(--action-primary-deep-rgb));">-0đ</span>
                    <i data-lucide="chevron-right" class="cx-ord-coupon-chev text-gray-400 shrink-0" style="width:16px;height:16px"></i>
                  </span>
                </button>
                <x-button variant="bare" icon-only onclick="cxPromoRemove()" class="cx-ord-coupon-x"
                  title="Gỡ mã giảm giá" aria-label="Gỡ mã giảm giá"><i data-lucide="x" style="width:14px;height:14px"></i></x-button>
              </div>
              <div id="promo-box" class="mt-3" style="display:none;">
                <!-- Nút "Áp dụng" dùng suffix của x-input: dính liền ô nhập nên
                     không đọc thành một hành động ngang cơ nút thanh toán.
                     .cx-ord-promo gộp ô + nút thành MỘT khung (styles/_common.css). -->
                <div class="cx-ord-promo">
                  <i data-lucide="ticket-percent" class="cx-ord-promo-ico" style="width:18px;height:18px"></i>
                  <x-input
                    id="promo-input"
                    placeholder="Nhập mã giảm giá"
                    uppercase
                    suffix-btn-label="Áp dụng"
                    suffix-btn-action="applyPromo()"
                  ></x-input>
                </div>
                <p id="promo-msg" class="cx-ord-msg hidden" role="status" aria-live="polite"></p>
              </div>
            </div>

            <!-- Trấn an bằng thứ kiểm chứng được (trả một lần, tên cổng thanh
                 toán), không phải câu "an toàn & bảo mật" suông. Nằm trong thẻ
                 chứ không nằm ở dải: dải bị ghim nên mỗi dòng thêm vào đó là
                 một dòng ăn mất của phần nội dung. -->
            <div class="px-6 pb-6 flex flex-wrap justify-center gap-2">
              <span class="cx-ord-chip"><i data-lucide="badge-check" style="width:14px;height:14px"></i>Trả một lần, không tự động gia hạn</span>
              <span class="cx-ord-chip"><i data-lucide="shield-check" style="width:14px;height:14px"></i>PayOS · quét VietQR</span>
            </div>

            <!-- Dải trả tiền. Ở dạng TRANG, mount() ghim khối này xuống đáy màn
                 (xem _pinPaybar — class ở đây bị ghi đè ở đó, sửa thì sửa cả hai)
                 nên tổng tiền + nút luôn trong tầm tay. Nó nằm TRONG
                 #payment-step-1 là cố ý: các bước ẩn nhau bằng display:none, con
                 cháu "fixed" cũng biến mất theo nên không cần đồng bộ thêm. -->
            <div id="payment-paybar" class="px-6 pt-5 pb-6 flex flex-col gap-3 border-t border-gray-100">
              <p id="payment-api-error" class="hidden text-xs text-red-500 text-center p-2 bg-red-50 rounded-lg m-0"></p>
              <!-- Mức tiết kiệm ở ngay giây quyết định, dồn phải cho đứng thẳng
                   trên con số ở đầu phải nút; ẩn khi bằng 0 (xem _syncSaving).
                   w-fit + ml-auto chứ không inline-flex: class "hidden" bật tắt
                   trên chính thẻ này, hai utility display đè nhau là khó đoán.
                   Mọi chỗ nói về tiền tiết kiệm dùng chung tông hồng đậm này. -->
              <p id="payment-saving" class="hidden w-fit ml-auto rounded-full px-3 py-1 text-xs font-semibold m-0" style="color:rgb(var(--action-primary-deep-rgb));background:rgb(var(--surface-blossom-rgb));"></p>
              <!-- Nền gradient đè lên bg-rose-600 của fill/brand: cùng một màu
                   hành động của site (--action-primary-rgb), chỉ chuyển sang hồng
                   nhấn ở đầu kia nên nút hoà vào bảng màu của trang.
                   Số tiền nằm TRÊN nút: con số chốt đứng đúng điểm bấm. Icon đặt
                   trong span (không dùng thuộc tính icon=) vì x-button chèn icon
                   thành con ĐẦU TIÊN, ngoài hàng flex này. -->
              <!-- Hai tầng chữ bên trái (hành động + gói đang mua) để khách
                   bấm là biết mình trả cho gói nào; tổng tiền tách bằng vạch mảnh. -->
              <x-button id="payment-submit" size="lg" full onclick="PaymentModal.process()" class="cx-ord-pay"
                style="background:linear-gradient(135deg,rgb(var(--brand-accent-rgb)),rgb(var(--action-primary-rgb)));box-shadow:0 12px 24px -12px rgb(var(--action-primary-rgb) / 0.6);">
                <span class="cx-ord-pay-in">
                  <span class="cx-ord-pay-ico"><i data-lucide="qr-code" style="width:18px;height:18px"></i></span>
                  <span class="cx-ord-pay-txt">
                    <span class="cx-ord-pay-label">Thanh toán ngay</span>
                    <span id="payment-submit-sub" class="cx-ord-pay-sub">Kích hoạt tức thì</span>
                  </span>
                  <span id="payment-total-price" class="cx-ord-pay-total">…</span>
                </span>
              </x-button>
              <!-- Cùng câu chữ với hộp đăng nhập (core/auth-ui.js). Mở tab mới
                   để khách đọc xong quay lại không mất đơn đang dở. -->
              <p class="text-center text-[11px] text-gray-400 leading-relaxed m-0">
                Tiếp tục đồng nghĩa bạn đồng ý với
                <a href="/policy/#terms" target="_blank" rel="noopener" class="text-color-secondary font-medium underline">Điều khoản</a> &amp;
                <a href="/policy/#privacy" target="_blank" rel="noopener" class="text-color-secondary font-medium underline">Chính sách bảo mật</a> của Cưới Xinh.
              </p>
            </div>
          </div>

          <!-- Step 2: Processing (bị displayQRCode thay bằng màn QR khi có mã) -->
          <div id="payment-step-2" class="hidden p-12 flex-col items-center gap-6 text-center">
            <div class="w-16 h-16 rounded-full flex items-center justify-center" style="background:rgb(var(--surface-brand-rgb));">
              <div class="w-8 h-8 border-4 rounded-full animate-spin" style="border-color:rgb(var(--surface-brand-rgb));border-top-color:rgb(var(--brand-primary-rgb));"></div>
            </div>
            <div>
              <p class="font-semibold m-0" style="color:rgb(var(--text-heading-rgb));">Đang tạo đơn thanh toán…</p>
              <p class="text-sm text-gray-400 mt-1 m-0">Vui lòng không đóng cửa sổ này</p>
            </div>
          </div>

          <!-- Step 3: Thanh toán xong.
               Thứ tự: báo xong → VIỆC TIẾP THEO (link thiết lập thiệp) → thông
               tin đơn để đối chiếu. Link thiết lập là thứ khách cần ngay, nên nó
               đứng trên chứ không nằm dưới bảng thông tin đơn. -->
          <div id="payment-step-3" class="hidden cx-ok flex-col items-center text-center">
            <!-- Mảng XANH (token --state-success-*), cố ý không dùng màu thương
                 hiệu: ô này báo TRẠNG THÁI, không phải chỗ mời bấm. Vòng sáng
                 lan một nhịp (.cx-ok-badge::before). -->
            <div class="cx-ok-badge"><i data-lucide="check" style="width:28px;height:28px"></i></div>
            <h3 class="font-playfair cx-ok-title">Thanh toán thành công!</h3>
            <p id="success-sub" class="cx-ok-sub">Thiệp cưới đã là của bạn — bắt đầu nhập thông tin ngay nhé.</p>

            <!-- Gói vừa mua: dải nổi bật ngay dưới tiêu đề (showSuccessScreen điền,
                 không biết gói thì ẩn cả hai hàng #success-plan-row/#success-expiry-row). -->
            <div id="success-plan-row" class="cx-ok-plan">
              <i data-lucide="calendar-check" style="width:16px;height:16px"></i>
              <span>Gói <b id="success-plan"></b></span>
              <span id="success-expiry-row" class="cx-ok-plan-until">· hiển thị đến <b id="success-expiry"></b></span>
            </div>

            <!-- Tờ hoá đơn: nhãn — chấm dẫn — giá trị, cùng kiểu bảng tiền bước 1. -->
            <div class="cx-ok-receipt">
              <p class="cx-ord-eyebrow cx-ok-receipt-head">Thông tin đơn hàng</p>
              <div class="cx-ord-line cx-ok-line">
                <span class="text-gray-500">Mẫu thiệp</span><span class="cx-ord-lead"></span>
                <span id="success-template" class="cx-ok-val"></span>
              </div>
              <div class="cx-ord-line cx-ok-line">
                <span class="text-gray-500">Người mua</span><span class="cx-ord-lead"></span>
                <span id="success-name" class="cx-ok-val"></span>
              </div>
              <!-- Số điện thoại lấy từ hồ sơ tài khoản, có thể trống → ẩn hàng
                   này khi rỗng (xem showSuccessScreen). -->
              <div id="success-phone-row" class="cx-ord-line cx-ok-line">
                <span class="text-gray-500">Điện thoại</span><span class="cx-ord-lead"></span>
                <span id="success-phone" class="cx-ok-val"></span>
              </div>
            </div>

            <!-- Link thiết lập: một hàng, nhãn nhỏ phía trên. -->
            <div id="success-manage-block" class="cx-ok-link">
              <p class="cx-ok-link-label"><i data-lucide="link" style="width:12px;height:12px"></i>Link thiết lập thiệp — lưu lại để quay lại chỉnh sửa</p>
              <div class="cx-ok-link-row">
                <input id="success-manage-link" readonly class="cx-ok-link-input" />
                <x-button variant="bare" icon-only onclick="copyManageLink()" class="cx-ok-link-copy" aria-label="Sao chép link thiết lập">
                  <i data-lucide="copy" style="width:14px;height:14px"></i>
                </x-button>
              </div>
            </div>

            <!-- Đáy: MỘT nút chính vừa phải ôm theo chữ + "Đóng" dạng chữ nhỏ — màn này
                 chỉ có một việc nên đừng cho hai nút to ngang nhau. -->
            <div class="cx-ok-foot">
              <a id="success-manage-btn" href="#" class="cx-ok-cta">
                <i data-lucide="square-pen" style="width:16px;height:16px"></i>Thiết lập ngay
              </a>
              <x-button variant="bare" onclick="PaymentModal.close()" class="cx-ok-close">Để sau</x-button>
            </div>
          </div>
    `;
  }

  function injectPaymentModal() {
    if (document.getElementById("paymentModal")) return; // Đã có rồi
    const el = document.createElement("div");
    el.innerHTML = `
      <div id="paymentModal" class="modal hidden fixed inset-0 z-[100] items-center justify-center p-4" style="display:none;">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="PaymentModal.close()"></div>
        <div class="relative bg-white rounded-3xl max-w-[480px] w-full max-h-[90vh] shadow-2xl z-10 overflow-hidden">
          <div class="overflow-y-auto max-h-[90vh]">
          <x-button variant="outline" size="sm" icon-only onclick="PaymentModal.close()" class="absolute top-4 right-4 z-20">
            <i data-lucide="x" class="text-gray-400 text-sm" style="width:16px;height:16px"></i>
          </x-button>
          ${_stepsHTML()}
          </div>
        </div>
      </div>
    `;
    const modal = el.firstElementChild;
    document.body.appendChild(modal);
    window.lucide?.createIcons({ root: modal });
  }

  // User hiện tại — hỏi CXAuth (core/auth.js), nguồn sự thật duy nhất của cả site.
  function getCurrentUser() {
    return window.CXAuth?.getUserSync() ?? null;
  }

  window.copyManageLink = function () {
    const input = document.getElementById("success-manage-link");
    if (!input) return;
    navigator.clipboard.writeText(input.value).then(() => {
      const btn = input.nextElementSibling;
      btn.innerHTML = '<i data-lucide="check" style="width:16px;height:16px"></i>';
      window.lucide?.createIcons({ root: btn });
      setTimeout(() => {
        btn.innerHTML = '<i data-lucide="copy" style="width:16px;height:16px"></i>';
        window.lucide?.createIcons({ root: btn });
      }, 2000);
    });
  };

  // ============= PROMO CODE =============

  // Hàng mã giảm giá trong bảng tiền. code=null là trả hàng về lời mời ban đầu.
  function _setPromoRow(code, discount) {
    document.getElementById("promo-ticket")?.classList.toggle("is-applied", !!code);
    const label = document.getElementById("promo-row-label");
    const amount = document.getElementById("promo-discount-amount");
    if (label) label.textContent = code ? `Mã ${code}` : "Nhập mã giảm giá";
    if (amount) {
      amount.textContent = `-${(discount || 0).toLocaleString("vi-VN")}đ`;
      amount.classList.toggle("hidden", !code);
    }
  }

  // Tổng tiết kiệm (so với giá gốc). Bằng 0 thì ẩn hẳn dòng, không hiện "Tiết
  // kiệm 0đ".
  function _syncSaving() {
    const el = document.getElementById("payment-saving");
    if (!el) return;
    // Tiết kiệm = giá gốc − số phải trả (có mã thì ưu đãi ra mắt đã bị thay bằng mã).
    const saved = Number.isFinite(window._discountedTotal)
      ? Math.max(0, _promoBase() - window._discountedTotal)
      : 0;
    el.textContent = `Tổng tiết kiệm ${saved.toLocaleString("vi-VN")}đ`;
    el.classList.toggle("hidden", saved <= 0);
  }

  // Bung ô nhập mã. Một chiều — nhánh báo lỗi mã gọi để chắc ô đang mở; bấm vào
  // hàng mã thì đi qua cxPromoToggle. Hàng mã ở lại vì nó còn là chỗ báo kết quả.
  window.cxPromoOpen = function () {
    const box = document.getElementById("promo-box");
    if (!box) return;
    box.style.display = "block";
    document.getElementById("promo-input")?.focus();
  };

  // Gỡ mã đang áp (nút ✕ trên hàng mã): bảng tiền về giá bán, ô nhập mở sẵn
  // + trống để gõ mã khác ngay.
  window.cxPromoRemove = function () {
    window._promoCandidate = null;
    window._appliedPromo = null;
    const input = document.getElementById("promo-input");
    if (input) input.value = "";
    document.getElementById("promo-msg")?.classList.add("hidden");
    _setPromoRow(null, 0);
    _renderPlans();
    _renderPrices();
    window.cxPromoOpen();
  };

  // Bấm hàng mã: mở/gấp ô nhập. Gấp chỉ ẩn đi nên chữ đang gõ dở vẫn còn.
  window.cxPromoToggle = function () {
    const box = document.getElementById("promo-box");
    if (!box) return;
    if (box.style.display === "none") window.cxPromoOpen();
    else box.style.display = "none";
  };

  window.applyPromo = async function () {
    const code = (document.getElementById("promo-input").value || "").trim().toUpperCase();
    if (!code) return;
    // Chưa có báo giá thì chưa có nền để tính mức giảm / đơn tối thiểu.
    if (!Number.isFinite(window._paymentPricing?.price)) {
      _promoMsg("info", "Đang tải bảng giá, thử lại sau giây lát");
      return;
    }

    _promoMsg("wait", "Đang kiểm tra mã…");

    try {
      // Chỉ XEM TRƯỚC mức giảm, chưa giữ lượt của mã. Lượt thật do backend giành
      // khi bấm Thanh toán (payment-handler → cx_promo_reserve), nên mã vẫn có
      // thể hết lượt giữa chừng — lúc đó create-payment trả về promo_error.
      const theme = window._paymentTheme ? `&theme=${encodeURIComponent(window._paymentTheme)}` : "";
      const amount = _promoBase() > 0 ? `&amount=${_promoBase()}` : "";
      const token = await _authToken();
      const res = await fetch(
        `${CONFIG.supabase.edgeUrl}?resource=promo&code=${encodeURIComponent(code)}${theme}${amount}`,
        {
          headers: {
            apikey: CONFIG.supabase.anonKey,
            Authorization: `Bearer ${token || CONFIG.supabase.anonKey}`,
          },
        }
      );
      const data = await res.json();

      if (!data.valid) {
        _promoMsg("err", data.error || "Mã không hợp lệ hoặc đã hết hạn");
        window._promoCandidate = null;
        window._appliedPromo = null;
        _setPromoRow(null, 0);
        _renderPlans();
        _renderPrices();
        return;
      }

      // Mã hợp lệ ở server → giữ làm ỨNG VIÊN; có áp hay không còn tuỳ gói đang
      // chọn (đơn tối thiểu, có lợi hơn ưu đãi ra mắt không) — _syncPromo xét.
      window._promoCandidate = { ...data, code: data.code || code };
      _syncPromo();
    } catch (e) {
      _promoMsg("err", "Không thể kiểm tra mã, thử lại sau");
    }
  };

  // Dòng báo dưới ô mã: kind = wait (đang kiểm) · ok · free (về 0đ) · err · info.
  // Kiểu ở .cx-ord-msg--* (styles/_common.css); ẩn bằng class "hidden".
  const PROMO_MSG_ICON = { ok: "circle-check", free: "gift", err: "circle-alert", info: "info" };
  function _promoMsg(kind, text) {
    const msg = document.getElementById("promo-msg");
    if (!msg) return;
    msg.className = `cx-ord-msg cx-ord-msg--${kind}`;
    const ico = kind === "wait"
      ? '<span class="cx-ord-msg-spin" aria-hidden="true"></span>'
      : `<i data-lucide="${PROMO_MSG_ICON[kind]}" style="width:14px;height:14px"></i>`;
    msg.innerHTML = `${ico}<span></span>`;
    msg.lastChild.textContent = text; // chữ từ server → textContent, không ghép HTML
    window.lucide?.createIcons({ root: msg });
  }

  // Mã có áp được cho MỘT mức giá không. base = giá gốc của gói (nền tính mã),
  // sale = giá đang bán (đã trừ ưu đãi ra mắt). Khớp hai chốt ở server: đơn tối
  // thiểu (cx_promo_reserve) và "không lợi hơn giá đang giảm" (payment-handler).
  function _promoVerdict(promo, base, sale) {
    if (!promo || !Number.isFinite(sale)) return null;
    const total = base - _discountOf(promo, base);
    const min = promo.min_order_amount || 0;
    if (min > 0 && base < min)
      return { ok: false, total, text: `Đơn tối thiểu ${_fmtVnd(min)} mới dùng được mã này` };
    if (base > sale && total >= sale)
      return { ok: false, total, text: `Mã này ít ưu đãi hơn giá đang giảm (${_fmtVnd(sale)}) nên không áp dụng` };
    return {
      ok: true,
      total,
      text: total <= 0 ? "Áp dụng thành công — thiệp này miễn phí!" : "Áp dụng thành công!",
    };
  }

  // Xét lại mã ứng viên theo gói ĐANG chọn — gọi sau khi áp mã và mỗi lần đổi gói,
  // để câu báo + bảng tiền không còn nói theo gói cũ. Không hợp lệ thì gỡ mã khỏi
  // đơn nhưng giữ ứng viên: quay lại gói hợp lệ là mã tự áp lại.
  function _syncPromo() {
    const promo = window._promoCandidate;
    const v = promo && _promoVerdict(promo, _promoBase(), window._paymentPricing?.price);
    if (!v) {
      window._appliedPromo = null;
      _setPromoRow(null, 0);
    } else if (v.ok) {
      window._appliedPromo = promo;
      _setPromoRow(promo.code, _discountOf(promo, _promoBase()));
      _promoMsg(v.total <= 0 ? "free" : "ok", v.text);
    } else {
      window._appliedPromo = null;
      _setPromoRow(null, 0);
      // Bung ô mã (không focus — đang bấm thẻ gói, bật bàn phím là phiền) để lời
      // báo không nằm trong khối ẩn.
      const box = document.getElementById("promo-box");
      if (box) box.style.display = "block";
      _promoMsg("err", v.text);
    }
    _renderPlans();
    _renderPrices();
  }

  // Mức giảm hiển thị. Con số CHỐT vẫn do backend tính lại lúc tạo đơn — đây
  // chỉ là bản xem trước, phải khớp công thức trong cx_promo_reserve. basePrice
  // phải là _promoBase(): áp mã thì bỏ ưu đãi ra mắt, tính lại từ giá gốc.
  function _discountOf(promo, basePrice) {
    if (!promo) return 0;
    const raw = promo.discount_type === "percent"
      ? Math.round(basePrice * promo.discount_value / 100)
      : promo.discount_value;
    return Math.min(Math.max(raw, 0), basePrice);
  }

  // ============= GIÁ =============

  // Vẽ bảng tiền + con số trên nút theo window._paymentPricing. Giá chưa biết
  // thì để dấu chờ; hỏi xong mà mẫu không có hàng `template_pricing` thì ghi
  // "Liên hệ" và khoá nút — không có con số nào đúng để dựng đơn cho mẫu đó.
  // Số tiền làm nền cho mã giảm giá — khớp promoBase ở payment-handler: GIÁ GỐC của
  // gói (mã thay cho ưu đãi ra mắt, không cộng dồn), không có giá gốc thì giá bán.
  function _promoBase() {
    const { price, originalPrice } = window._paymentPricing || {};
    return Math.max(originalPrice || 0, price || 0);
  }

  function _renderPrices() {
    const { price, originalPrice } = window._paymentPricing || {};
    const known = Number.isFinite(price);
    // Đang áp mã thì ẩn hàng ưu đãi ra mắt: mã thay cho nó.
    const hasDiscount = known && !window._appliedPromo && originalPrice > price;
    const fmt = (v) => `${v.toLocaleString("vi-VN")}đ`;
    const blank = window._pricingPending ? "…" : "Liên hệ";

    const baseEl = document.getElementById("payment-base-price");
    const saleRow = document.getElementById("payment-sale-row");
    const saleEl = document.getElementById("payment-sale-amount");
    // Hàng giá gói: có ưu đãi ra mắt hoặc đang áp mã thì đều là GIÁ GỐC (mã tính
    // lại từ giá gốc) — hiện giá bán ở đây là bảng tiền cộng không ra tổng.
    if (baseEl)
      baseEl.textContent = known
        ? fmt(hasDiscount || window._appliedPromo ? _promoBase() : price)
        : blank;
    if (saleRow) saleRow.style.display = hasDiscount ? "flex" : "none";
    if (saleEl && hasDiscount)
      saleEl.textContent = `-${fmt(originalPrice - price)}`;

    const total = !known
      ? null
      : window._appliedPromo
        ? _promoBase() - _discountOf(window._appliedPromo, _promoBase())
        : price;
    window._discountedTotal = total;
    const totalEl = document.getElementById("payment-total-price");
    if (totalEl) totalEl.textContent = known ? fmt(total) : blank;

    _syncSaving();
    _syncPayEnabled();
  }

  /**
   * Giá CHỐT chỉ có MỘT nguồn: payment-handler/quote báo giá ba gói từ hàng
   * `template_pricing` (giá gói 3 tháng) × hệ số gói ở server — đúng phép tính lúc
   * tạo đơn. Thiệp đã thanh toán thì server trả bảng NÂNG gói (giá = phần chênh).
   * Client không giữ hệ số nào: viết cứng là khách nhìn một giá, quét QR trả giá khác.
   */
  let _pricingSeq = 0;
  async function _resolvePricing(theme, manageId) {
    const seq = ++_pricingSeq;
    window._pricingPending = true;
    window._planQuote = null;
    _renderPlans();
    _renderPrices();

    let quote = null;
    try {
      const token = await _authToken();
      const res = await fetch(`${PAYMENT_API_URL}/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${token || ANON_KEY}`,
        },
        body: JSON.stringify({ theme, manage_id: manageId || undefined }),
      });
      if (res.ok) quote = await res.json();
    } catch (e) {
      /* mất mạng: để "Liên hệ" + khoá nút, không đoán giá */
    }
    if (seq !== _pricingSeq) return; // lượt mua khác đã mở đè lên

    // Phiên đăng nhập có thể vừa khôi phục xong trong lúc chờ giá: vẽ lại thẻ
    // người mua để nó không mời đăng nhập trong khi nút đã mở.
    _syncBuyer();
    window._pricingPending = false;
    window._planQuote = quote;
    if (quote?.theme) window._paymentTheme = quote.theme;
    const plans = quote?.plans || [];
    const pick =
      plans.find((p) => p.id === window._paymentPlan && p.available) ||
      // Mua mới mặc định gói "Khuyên dùng" (3 tháng); nâng gói thì gói rẻ nhất còn nâng được.
      (!quote?.current_plan && plans.find((p) => p.id === "3m" && p.available)) ||
      plans.find((p) => p.available);
    _selectPlan(pick ? pick.id : null);
  }

  const _fmtVnd = (v) => `${v.toLocaleString("vi-VN")}đ`;
  const _fmtDate = (iso) => new Date(iso).toLocaleDateString("vi-VN");

  // Chọn một gói: đổi bảng tiền theo đúng số của gói đó (giá mua mới hoặc phần
  // chênh khi nâng). Mã giảm giá đã áp vẫn giữ, mức giảm tự tính lại theo số mới.
  function _selectPlan(id) {
    const q = window._planQuote;
    const p = q?.plans?.find((x) => x.id === id && x.available) || null;
    window._paymentPlan = p ? p.id : null;
    window._paymentPricing = {
      price: p ? p.amount : null,
      originalPrice: p && p.original_price > p.amount ? p.original_price : null,
    };

    const label = document.getElementById("payment-base-label");
    if (label)
      label.textContent = !p
        ? "Giá mẫu thiệp"
        : q.current_plan
          ? `Nâng lên gói ${p.label}`
          : `Gói ${p.label}`;
    const line = document.getElementById("payment-plan-line");
    if (line) {
      const cur = q?.current_plan && q.plans.find((x) => x.id === q.current_plan);
      line.textContent = cur
        ? `Đang dùng gói ${cur.label}` +
          (q.plan_expires_at ? ` · hạn ${_fmtDate(q.plan_expires_at)}` : "")
        : p
          ? `Thiệp cưới online · ${p.months ? `hiển thị ${p.months} tháng` : "dùng trọn đời"}`
          : "Thiệp cưới online";
    }
    _renderPlans();
    _syncPlanNote(p);
    if (window._promoCandidate) _syncPromo();
    else _renderPrices();
  }
  window.cxPickPlan = _selectPlan;

  // Ba thẻ gói. Gói đang dùng / thấp hơn / quá hạn để nâng vẫn hiện (khách cần
  // thấy mình đang ở đâu) nhưng khoá lại. Huy hiệu "Khuyên dùng" chỉ khi mua mới.
  function _renderPlans() {
    const box = document.getElementById("payment-plans");
    if (!box) return;
    const q = window._planQuote;
    const title = document.getElementById("payment-plans-title");
    if (title) title.textContent = q?.current_plan ? "Nâng cấp gói" : "Chọn gói";
    if (!q?.plans?.length) {
      const msg = window._pricingPending ? "Đang tải bảng giá…" : "Mẫu này chưa có giá, vui lòng liên hệ.";
      box.innerHTML = `<p class="text-xs text-gray-400 m-0" style="grid-column:1/-1">${msg}</p>`;
      return;
    }
    const SUB = { current: "Đang dùng", too_late: "Đã quá hạn nâng", lower: "Gói thấp hơn" };
    const sub = (p) =>
      SUB[p.reason] || (q.current_plan ? "Trả thêm" : p.months ? `${p.months} tháng` : "Trọn đời");
    box.innerHTML = q.plans
      .map((p) => {
        const on = p.id === window._paymentPlan;
        const badge = !q.current_plan && p.id === "3m" ? '<span class="cx-ord-plan-badge">Khuyên dùng</span>' : "";
        // Đang có mã mà mã áp được cho gói này → thẻ hiện đúng số phải trả sau
        // mã (mã thay ưu đãi ra mắt nên bỏ giá gạch), khớp với tổng trên nút.
        const v = p.available && window._promoCandidate
          ? _promoVerdict(window._promoCandidate, Math.max(p.original_price || 0, p.amount), p.amount)
          : null;
        const withPromo = v && v.ok;
        const shown = withPromo ? Math.max(0, v.total) : p.amount;
        const price = p.available ? (q.current_plan ? "+" : "") + _fmtVnd(shown) : "—";
        const was = p.available && !withPromo && p.original_price > p.amount
          ? `<s class="cx-ord-plan-was">${_fmtVnd(p.original_price)}</s>`
          : "";
        const name = p.months
          ? p.label
          : `<i data-lucide="infinity" style="width:14px;height:14px"></i>${p.label}`;
        return (
          `<button type="button" role="radio" aria-checked="${on}" class="cx-ord-plan${on ? " is-on" : ""}"` +
          (p.available ? ` onclick="cxPickPlan('${p.id}')"` : " disabled") +
          `>${badge}<span class="cx-ord-plan-dot" aria-hidden="true"></span>` +
          `<span class="cx-ord-plan-name">${name}</span>` +
          `<span class="cx-ord-plan-price">${price}</span>${was}` +
          `<span class="cx-ord-plan-sub">${withPromo ? "Đã gồm mã" : sub(p)}</span></button>`
        );
      })
      .join("");
    window.lucide?.createIcons({ root: box });
  }

  // Dòng ngay dưới các thẻ: gói đang chọn mở thiệp tới NGÀY NÀO (server tính, kể cả
  // khi nâng gói — hạn mới tính từ ngày mua gói đầu, không phải từ hôm nay). Cùng
  // lúc đổi dòng phụ trên nút thanh toán.
  function _syncPlanNote(p) {
    const note = document.getElementById("payment-plan-note");
    const sub = document.getElementById("payment-submit-sub");
    if (sub)
      sub.textContent = p
        ? `${window._planQuote?.current_plan ? "Nâng lên" : "Gói"} ${p.label}`
        : "Kích hoạt tức thì";
    if (!note) return;
    // Gói vĩnh viễn không có ngày để báo → ẩn dòng này.
    if (!p || !p.expires_at) {
      note.style.display = "none";
      return;
    }
    note.innerHTML = `<i data-lucide="calendar-check" style="width:14px;height:14px"></i><span>Khách mời xem được thiệp đến hết ngày <b>${_fmtDate(p.expires_at)}</b></span>`;
    note.style.display = "flex";
    window.lucide?.createIcons({ root: note });
  }

  // Nút thanh toán cần CẢ HAI: có người mua (không có danh tính thì không dựng
  // được đơn) và biết giá. Đặt bằng ATTRIBUTE, không phải thuộc tính .disabled:
  // phần tử có thể còn là <x-button> chưa dựng (trang gọi mount() khi DOM đang
  // parse) — nó chỉ bê attribute sang <button> thật, gán .disabled mất trắng.
  function _syncPayEnabled() {
    const btn = document.getElementById("payment-submit");
    if (!btn) return;
    const ok = !!_buyer() && Number.isFinite(window._paymentPricing?.price);
    if (ok) btn.removeAttribute("disabled");
    else btn.setAttribute("disabled", "");
  }

  // Public API
  // Dạng TRANG (/checkout/) thay vì hộp thoại: đóng thì rời trang chứ không ẩn đi.
  let _pageMode = false;

  // Bước QR có MỐC LỊCH SỬ riêng (chỉ dạng trang): Back của trình duyệt / vuốt lùi /
  // nút ← quay về bước 1 thay vì rời trang. Mọi lối ra đều đi qua popstate dưới đây.
  const _onQrStep = () => window.history.state?.cxPay === 2;
  function _pushQrStep() {
    if (_pageMode && !_onQrStep()) window.history.pushState({ cxPay: 2 }, "");
  }
  function _backToStep1() {
    stopPolling();
    document.getElementById("payment-step-2").style.display = "none";
    document.getElementById("payment-step-1").style.display = "block";
    _setStep(1);
    const timeoutEl = document.getElementById("payment-timeout");
    if (timeoutEl) timeoutEl.style.display = "none";
  }
  window.addEventListener("popstate", () => {
    if (!_pageMode) return;
    // Đã thanh toán xong: lùi khỏi mốc QR là rời luôn trang, đừng mở lại màn chọn
    // gói của thiệp vừa trả tiền.
    if (document.getElementById("payment-step-3")?.style.display === "flex") {
      window.history.back();
      return;
    }
    if (document.getElementById("payment-step-2")?.style.display !== "none") _backToStep1();
  });

  // Ghim dải trả tiền xuống đáy màn ở khổ điện thoại (chỉ dạng trang — trong
  // hộp thoại thì khối này đã nằm cuối thẻ, ghim theo màn hình là nó thoát ra
  // ngoài hộp). Phần ghim nằm ở .cx-paybar-pin (styles/_common.css), từ md thì
  // media query tắt và các utility md:* dưới đây trả dải về trong luồng.
  function _pinPaybar() {
    const bar = document.getElementById("payment-paybar");
    if (!bar) return;
    bar.className =
      "cx-paybar-pin flex flex-col gap-3 md:px-6 md:pt-5 md:pb-6 md:border-t md:border-gray-100";

    // Lề đáy của trang ĐO theo dải thật thay vì một số viết cứng: dòng điều
    // khoản xuống dòng ở màn hẹp, hay thêm bớt một dòng trong dải, là chiều cao
    // đổi — số cứng thì phần cuối nội dung bị dải che mất. Class pb-* trên
    // <body> chỉ còn là bản dự phòng cho lúc chưa đo xong.
    const narrow = window.matchMedia("(max-width: 767px)");
    const syncPad = () => {
      document.body.style.paddingBottom = narrow.matches
        ? `${bar.offsetHeight + 16}px`
        : "";
    };
    new ResizeObserver(syncPad).observe(bar);
    narrow.addEventListener("change", syncPad);
    syncPad();
  }

  /**
   * URL trang thanh toán. Mọi nơi muốn đưa khách đi trả tiền đều đi qua đây —
   * đổi đường dẫn hay tên tham số thì chỉ sửa một chỗ.
   * { id, theme, name, price, original } — thiếu trường nào thì bỏ khỏi URL.
   */
  window.cxCheckoutUrl = function (opts) {
    const q = new URLSearchParams();
    ["id", "theme", "name", "price", "original"].forEach((k) => {
      if (opts[k] !== undefined && opts[k] !== null && opts[k] !== "") {
        q.set(k, String(opts[k]));
      }
    });
    return `/checkout/?${q.toString()}`;
  };

  // Nạp dữ liệu + dọn form cho một lượt thanh toán. Chạy được ở cả hai vỏ vì
  // markup (id các ô) là một.
  function _initFlow(templateName, theme, pricing, existingManageId) {
    {
      // Lưu theme và existingManageId
      window._paymentTheme = theme || "basic-gold";
      window._existingManageId = existingManageId || null;
      window._appliedPromo = null;
      window._promoCandidate = null;
      window._discountedTotal = null;
      // Reset promo UI — gấp ô mã lại như lúc mới vào.
      const promoInput = document.getElementById("promo-input");
      const promoMsg = document.getElementById("promo-msg");
      const promoBox = document.getElementById("promo-box");
      if (promoInput) promoInput.value = "";
      if (promoMsg) { promoMsg.textContent = ""; promoMsg.classList.add("hidden"); }
      if (promoBox) promoBox.style.display = "none";
      _setPromoRow(null, 0);

      // Giá tuỳ gói, mà gói chỉ biết sau khi có báo giá → bảng tiền để dấu chờ
      // tới lúc _resolvePricing (cuối hàm) xong; giá nơi gọi đưa sang (gói 3 tháng)
      // không dùng làm bản nháp, hiện ra rồi nhảy số là khách hoang mang.
      window._paymentPricing = { price: null, originalPrice: null };
      window._paymentPlan = null;
      window._planQuote = null;
      window._pricingPending = true;

      // Lưu order pending ngay khi mở modal (nếu chưa có)
      const sessionUser = getCurrentUser();
      const sessionEmail = sessionUser?.email || "";
      const storageKey = buildCacheKey("orders", sessionEmail || "guest");
      const orders = getCache(storageKey, []);
      const alreadyExists = orders.some((o) => o.templateName === templateName);
      if (!alreadyExists) {
        orders.push({
          id: "CX" + Date.now().toString().slice(-6),
          templateName,
          status: "pending",
          date: new Date().toISOString(),
          slug: null,
        });
        setCache(storageKey, orders);
      }

      // Reset steps
      document.getElementById("payment-step-1").style.display = "block";
      document.getElementById("payment-step-2").style.display = "none";
      document.getElementById("payment-step-3").style.display = "none";
      _setStep(1);
      document.getElementById("payment-template-name").textContent =
        templateName || "-";

      // Bảng tiền. Không có ưu đãi thì hàng "Giá gốc" mang thẳng giá bán và
      // hàng ưu đãi ẩn đi — bảng vẫn cộng đúng, không phải bịa ra mức giảm.
      _renderPrices();

      const apiErr = document.getElementById("payment-api-error");
      if (apiErr) apiErr.style.display = "none";

      _syncBuyer();
      _syncProduct(templateName, theme, existingManageId);
      _resolvePricing(window._paymentTheme, existingManageId);
    }
  }

  // Ô ảnh khi chưa/không có ảnh: đang chờ (icon thiệp) hoặc thiệp chưa có ảnh bìa.
  function _thumbEmpty(kind) {
    const el = document.getElementById("payment-thumb-fallback");
    if (!el) return;
    el.innerHTML =
      kind === "none"
        ? '<i data-lucide="image-off" style="width:20px;height:20px"></i><span>Chưa có ảnh bìa</span>'
        : '<i data-lucide="mail-open" style="width:20px;height:20px"></i>';
    el.style.display = "flex";
    window.lucide?.createIcons({ root: el });
  }

  // Chỉ thay ô chờ SAU khi ảnh tải xong — đổi trước là khách thấy ô trống nhấp
  // nháy. Ảnh hỏng (đã bị dọn) thì lùi về `onFail`.
  function _thumbShow(url, onFail) {
    const img = document.getElementById("payment-thumb");
    const fallback = document.getElementById("payment-thumb-fallback");
    if (!img || !url) return onFail();
    img.onload = () => {
      img.classList.remove("hidden");
      if (fallback) fallback.style.display = "none";
    };
    img.onerror = onFail;
    img.src = url;
  }

  // Thẻ thiệp của màn xác nhận. Có thiệp (manageId) thì giống thẻ ở "Đã chọn":
  // ảnh bìa THẬT của khách + tên cặp đôi, KHÔNG BAO GIỜ rơi về ảnh mẫu — thấy ảnh
  // mẫu là khách tưởng mình đã đặt ảnh đó. Mua mẫu mới thì sản phẩm chính là
  // mẫu, nên ảnh mẫu. Chạy ngầm: thiếu dữ liệu thì thẻ đứng nguyên như lúc dựng.
  async function _syncProduct(templateName, theme, manageId) {
    // Dọn về mặc định trước: ở dạng hộp thoại, DOM được dùng lại cho lượt mua
    // sau nên ảnh và tên của thiệp trước còn nằm đó.
    const img0 = document.getElementById("payment-thumb");
    if (img0) {
      img0.onload = img0.onerror = null;
      img0.classList.add("hidden");
    }
    _thumbEmpty("wait");
    const title = document.getElementById("payment-product-sub");
    if (title) title.textContent = "Thiệp cưới online";

    if (!manageId) {
      if (!window.templatesDAL) return;
      try {
        const row = (await templatesDAL.list()).find((t) => t.theme === theme);
        _thumbShow(row?.thumbnailUrl, () => {});
      } catch (e) {
        /* giữ ô chờ */
      }
      return;
    }

    // Tên cặp đôi từ đơn trong localStorage (invitation-setup ghi vào đó) hiện
    // ngay; bản trên hệ thống về sau mới đè lên.
    const email = getCurrentUser()?.email || "";
    const hit = [
      ...getCache(buildCacheKey("orders", email), []),
      ...getCache(buildCacheKey("orders", "guest"), []),
    ].find((o) => o && o.manage_id === manageId);
    const setCouple = (g, b) => {
      const couple = [g, b].filter(Boolean).join(" & ");
      if (title && couple) title.textContent = couple;
    };
    setCouple(hit?.groomName, hit?.brideName);

    let w = null;
    try {
      w = window.weddingDAL ? await weddingDAL.getWeddingById(manageId) : null;
    } catch (e) {
      /* nháp chưa lên hệ thống / chưa đăng nhập → không có ảnh bìa */
    }
    if (w) setCouple(w.groom_name, w.bride_name);
    // Cùng thứ tự ưu tiên với thẻ ở "Đã chọn": ảnh bìa, rồi tấm album đầu.
    const file = w ? w.cover_image_url || (w.gallery_images || [])[0] : "";
    const url = file && window.storageDAL ? storageDAL.getPublicUrl(file) : "";
    _thumbShow(url, () => _thumbEmpty("none"));
  }

  // Người mua lấy THẲNG từ tài khoản đang đăng nhập — màn này không nhập gì.
  function _buyer() {
    const user = getCurrentUser();
    if (!user) return null;
    const meta = user.user_metadata || {};
    return {
      name: meta.full_name || meta.name || user.email || "",
      email: user.email || "",
      phone: meta.phone || "",
      avatar: meta.avatar_url || meta.picture || "",
    };
  }

  // Vẽ thẻ người mua, hoặc lời mời đăng nhập nếu chưa có phiên (cổng bật/tắt
  // nút thanh toán nằm ở _syncPayEnabled).
  function _syncBuyer() {
    const b = _buyer();
    const info = document.getElementById("payment-user-info");
    const login = document.getElementById("payment-login");

    if (info) info.style.display = b ? "flex" : "none";
    if (login) login.style.display = b ? "none" : "flex";
    _syncPayEnabled();
    if (!b) return;

    const avatarEl = document.getElementById("payment-avatar");
    if (avatarEl) {
      avatarEl.src = b.avatar;
      avatarEl.style.display = b.avatar ? "block" : "none";
    }
    const iniEl = document.getElementById("payment-avatar-ini");
    if (iniEl) iniEl.textContent = (b.name.trim()[0] || "?").toUpperCase();
    document.getElementById("payment-user-name-display").textContent = b.name;
    document.getElementById("payment-user-email-display").textContent = b.email;
  }

  window.PaymentModal = {
    open(templateName, theme, pricing = {}, existingManageId = null) {
      injectPaymentModal();
      _initFlow(templateName, theme, pricing, existingManageId);

      // Show modal
      const modal = document.getElementById("paymentModal");
      modal.style.display = "flex";
      document.body.style.overflow = "hidden";
    },

    /**
     * Dựng luồng thanh toán thành NỘI DUNG TRANG (dùng ở /checkout/index.html).
     * root: selector hoặc phần tử chứa; opts: { templateName, theme, pricing, manageId }.
     */
    mount(root, opts = {}) {
      _pageMode = true;
      const host = typeof root === "string" ? document.querySelector(root) : root;
      if (!host) return;
      // Trang dựng LẠI trên mốc QR cũ (F5 ở bước QR, hay Back từ "Thiết lập ngay"
      // mà trình duyệt không giữ trang): đơn cũ đã mất, trang mở ở bước 1 → lùi bỏ
      // mốc đó, không thì phải bấm Back hai lần mới rời được trang. Bước 2/3 còn ẩn
      // nên popstate không làm gì thêm.
      if (_onQrStep()) window.history.back();
      host.innerHTML = _stepsHTML();
      _pinPaybar();
      // Markup chèn động → lucide không tự quét, phải dựng icon cho phần vừa chèn.
      window.lucide?.createIcons({ root: host });
      _initFlow(
        opts.templateName,
        opts.theme,
        opts.pricing || {},
        opts.manageId || null,
      );
    },

    close() {
      // Stop polling when modal is closed
      stopPolling();

      // Dạng trang: "đóng" nghĩa là rời khỏi trang. Quay lại chỗ vừa bấm nếu
      // có, không thì về danh sách thiệp — đừng để khách kẹt ở trang trống.
      if (_pageMode) {
        const done = document.getElementById("payment-step-3")?.style.display === "flex";
        if (_onQrStep() && !done) {
          window.history.back(); // popstate đưa về bước 1
          return;
        }
        const steps = _onQrStep() ? 2 : 1;
        if (window.history.length > steps) window.history.go(-steps);
        else window.location.href = "/my-invitations/";
        return;
      }

      const modal = document.getElementById("paymentModal");
      if (modal) modal.style.display = "none";
      // Trả về rỗng để CSS của trang tự quyết — ép "auto" là mở khoá cuộn cho
      // cả những trang cố tình không cho cuộn (app shell của invitation-setup).
      document.body.style.overflow = "";
    },

    /** Chưa đăng nhập → mở đăng nhập ngay tại trang, xong thì vẽ lại thẻ mua. */
    login() {
      if (window.AuthUI) {
        AuthUI.openModal({
          title: "Đăng nhập",
          subtitle: "Để thanh toán và quản lý thiệp cưới của bạn",
          oauthRedirect: window.location.href,
          onAuth: () => _syncBuyer(),
        });
        return;
      }
      window.location.href = `/my-invitations/?urlRedirect=${encodeURIComponent(window.location.href)}`;
    },

    async process() {
      const templateName = document.getElementById(
        "payment-template-name",
      ).textContent;

      // Không nhập gì ở màn này: người mua CHÍNH LÀ tài khoản đang đăng nhập.
      const buyer = _buyer();
      const apiErr = document.getElementById("payment-api-error");
      if (!buyer) {
        _syncBuyer();
        if (apiErr) {
          apiErr.textContent = "Vui lòng đăng nhập để thanh toán.";
          apiErr.style.display = "block";
        }
        return;
      }
      const { name, phone, email } = buyer;

      // Hide error message
      if (apiErr) apiErr.style.display = "none";

      // Step 2: Show processing - reset về loading state trước khi show
      const step2El = document.getElementById("payment-step-2");
      // displayQRCode đã đổi class của vỏ → đặt lại đúng vỏ "đang xử lý".
      step2El.className = "p-12 flex flex-col items-center gap-6 text-center";
      step2El.innerHTML = `
        <div class="w-16 h-16 rounded-full flex items-center justify-center" style="background:rgb(var(--surface-brand-rgb));">
          <div class="w-8 h-8 border-4 rounded-full animate-spin" style="border-color:rgb(var(--surface-brand-rgb));border-top-color:rgb(var(--brand-primary-rgb));"></div>
        </div>
        <div>
          <p class="font-semibold m-0" style="color:rgb(var(--text-heading-rgb));">Đang tạo đơn thanh toán…</p>
          <p class="text-sm text-gray-400 mt-1 m-0">Vui lòng không đóng cửa sổ này</p>
        </div>
      `;
      document.getElementById("payment-step-1").style.display = "none";
      step2El.style.display = "flex";
      _pushQrStep();
      _setStep(2);

      // Task 9.1: Feature flag to toggle between fake and real payment
      if (!USE_REAL_PAYMENT) {
        // Old behavior: Fake payment with 1.5s delay
        setTimeout(() => {
          // Generate fake manage_id
          const manage_id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
            /[xy]/g,
            (c) => {
              const r = (Math.random() * 16) | 0;
              return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
            },
          );

          // Show success screen with fake data
          showSuccessScreen({
            manage_id,
            slug: null,
            transaction_id: "FAKE_" + Date.now(),
            payment_time: new Date().toISOString(),
          });
        }, 1500);
        return;
      }

      // Real payment flow with PayOS
      try {
        // Use existing manage_id from draft flow, or generate new one
        const manage_id = window._existingManageId || "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
          /[xy]/g,
          (c) => {
            const r = (Math.random() * 16) | 0;
            return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
          },
        );

        // Save pending order immediately
        const order = {
          id: "CX" + Date.now().toString().slice(-6),
          templateName,
          status: "pending",
          date: new Date().toISOString(),
          customerName: name,
          customerPhone: phone,
          customerEmail: email,
          manage_id,
        };

        const sessionUser = getCurrentUser();
        const sessionEmail = sessionUser?.email || "";
        const storageKey = buildCacheKey("orders", sessionEmail || email || "guest");

        const orders = getCache(storageKey, []);

        // Gộp theo manage_id trước (tránh tạo đơn trùng khi thanh toán cho một bản
        // nháp đã có sẵn trong danh sách), sau đó mới tới đơn pending cùng mẫu.
        // Đơn pending cùng mẫu chỉ được dùng lại khi nó CHƯA gắn thiệp nào — hai
        // thiệp cùng mẫu mà gộp theo tên mẫu là đơn của thiệp kia bị ghi đè.
        let existingIdx = manage_id
          ? orders.findIndex((o) => o.manage_id === manage_id)
          : -1;
        if (existingIdx < 0)
          existingIdx = orders.findIndex(
            (o) => !o.manage_id && o.templateName === templateName && o.status === "pending",
          );
        if (existingIdx >= 0) {
          orders[existingIdx] = { ...orders[existingIdx], ...order };
        } else {
          orders.push(order);
        }
        setCache(storageKey, orders);

        // Call createPayment API
        const paymentData = {
          manage_id,
          customer_name: name,
          customer_phone: phone,
          customer_email: email,
          template_name: templateName,
          theme: window._paymentTheme || "basic-gold",
          plan: window._paymentPlan,
          is_existing_draft: !!window._existingManageId,
          // SECURITY: Amount is determined by backend from database
        };
        if (window._appliedPromo) {
          paymentData.promo_code = window._appliedPromo.code;
        }

        const paymentResult = await createPayment(paymentData);

        // Mã giảm 100%: backend đã kích hoạt thiệp, không có QR để quét.
        if (paymentResult.free) {
          showSuccessScreen(paymentResult);
          return;
        }

        // Display QR code and start polling
        displayQRCode(
          paymentResult.qr_code,
          {
            ...paymentResult.payment_info,
            checkout_url: paymentResult.checkout_url,
          },
          paymentResult.order_id,
        );
      } catch (error) {
        // Task 6.1 & 6.2: Enhanced error handling with form state preservation
        console.error("Payment error:", error);

        // Return to step 1 and preserve form state
        document.getElementById("payment-step-2").style.display = "none";
        document.getElementById("payment-step-1").style.display = "block";
        _setStep(1);
        // Bỏ mốc QR vừa đẩy (bước 2 đã ẩn nên popstate không làm gì thêm) — không
        // thì khách phải bấm Back hai lần mới rời được trang.
        if (_onQrStep()) window.history.back();

        // Mã giảm giá hỏng giữa chừng (người khác vừa dùng hết lượt, mã hết hạn…)
        // → gỡ mã đang áp, trả tổng tiền về giá gốc và báo ngay tại ô mã.
        if (error.promoError) {
          window._appliedPromo = null;
          window._promoCandidate = null;
          // Ô mã có thể đang gấp lại → bung ra, không thì lời báo lỗi nằm trong
          // khối ẩn và khách chỉ thấy tổng tiền tự nhảy về giá cũ.
          window.cxPromoOpen();
          _promoMsg("err", error.message);
          _setPromoRow(null, 0);
          _renderPlans();
          _renderPrices();
          return;
        }

        // Display user-friendly error message
        const errEl = document.getElementById("payment-api-error");
        if (errEl) {
          let errorMessage = "❌ ";

          // Use the error message from our enhanced error handling
          if (error.message) {
            errorMessage += error.message;
          } else {
            errorMessage += "Đặt hàng thất bại, vui lòng thử lại";
          }

          errEl.textContent = errorMessage;
          errEl.style.display = "block";
        }

        // Form state is automatically preserved since we didn't clear the inputs
        // The values remain in the input fields
      }
    },

    // Task 5.8 & 6.2: Retry check payment status with error handling
    async retryCheck() {
      if (!currentOrderId) return;

      try {
        const result = await checkPaymentStatus(currentOrderId);

        if (result.status === "completed") {
          stopPolling();
          showSuccessScreen(result);
        } else if (result.status === "failed") {
          // Payment failed
          const timeoutEl = document.getElementById("payment-timeout");
          if (timeoutEl) {
            const msg = timeoutEl.querySelector("p:last-of-type");
            if (msg) {
              msg.textContent =
                "Thanh toán thất bại. Vui lòng tạo mã mới để thử lại.";
              msg.style.color = "rgb(var(--state-error-text-rgb))";
            }
          }
        } else {
          // Still pending
          const timeoutEl = document.getElementById("payment-timeout");
          if (timeoutEl) {
            const msg = timeoutEl.querySelector("p:last-of-type");
            if (msg) {
              msg.textContent =
                "Thanh toán vẫn chưa được xác nhận. Vui lòng liên hệ hỗ trợ nếu bạn đã thanh toán.";
              msg.style.color = "rgb(var(--state-error-text-rgb))";
            }
          }
        }
      } catch (error) {
        console.error("Retry check error:", error);
        const timeoutEl = document.getElementById("payment-timeout");
        if (timeoutEl) {
          const msg = timeoutEl.querySelector("p:last-of-type");
          if (msg) {
            msg.textContent =
              "Lỗi kết nối khi kiểm tra. Vui lòng thử lại hoặc liên hệ hỗ trợ.";
            msg.style.color = "rgb(var(--state-error-text-rgb))";
          }
        }
      }
    },

    // Task 5.8: Create new payment
    createNewPayment() {
      if (_onQrStep()) window.history.back(); // popstate → _backToStep1
      else _backToStep1();
    },

    /**
     * Sao chép nội dung ở data-copy của chính nút bấm (số tài khoản, nội dung
     * chuyển khoản). Đổi icon thành dấu tick 2 giây thay vì toast: hàm này chạy
     * ở cả hộp thoại lẫn trang /checkout/, không phải nơi nào cũng có showToast.
     */
    copyField(btn) {
      const text = btn?.getAttribute("data-copy");
      if (!text) return;
      navigator.clipboard?.writeText(text).then(() => {
        const icon = btn.querySelector("i, svg");
        if (!icon) return;
        btn.innerHTML = '<i data-lucide="check" style="width:14px;height:14px"></i>';
        window.lucide?.createIcons({ root: btn });
        setTimeout(() => {
          btn.innerHTML = '<i data-lucide="copy" style="width:14px;height:14px"></i>';
          window.lucide?.createIcons({ root: btn });
        }, 2000);
      });
    },

    // Cancel payment
    cancelPayment() {
      stopPolling();
      PaymentModal.close();
    },
  };

  // Inject ngay khi script load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectPaymentModal);
  } else {
    injectPaymentModal();
  }
})();
