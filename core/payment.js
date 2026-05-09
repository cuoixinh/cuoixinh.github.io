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

  // Task 5.2 & 6.1 & 6.2: Create payment with PayOS - Enhanced error handling
  async function createPayment(orderData) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(`${PAYMENT_API_URL}/create-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify(orderData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Handle specific HTTP status codes
        if (response.status === 400) {
          throw new Error(
            errorData.error || "Thông tin không hợp lệ, vui lòng kiểm tra lại",
          );
        } else if (response.status === 401) {
          throw new Error("Xác thực thất bại, vui lòng thử lại");
        } else if (response.status === 404) {
          throw new Error("Không tìm thấy dịch vụ thanh toán");
        } else if (response.status >= 500) {
          throw new Error("Lỗi server, vui lòng thử lại sau");
        } else {
          throw new Error(errorData.error || `Lỗi server (${response.status})`);
        }
      }

      const data = await response.json();

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

  // Task 5.3: Display QR code
  function displayQRCode(qrDataString, paymentInfo, orderId) {
    const step2 = document.getElementById("payment-step-2");

    // Update QR code display
    step2.innerHTML = `
        <div class="flex flex-col items-center gap-2 p-6 text-center">
          <!-- Header -->
          <div class="text-center mb-1">
            <div class="w-14 h-14 rounded-full bg-gradient-to-br from-pink-300 to-pink-200 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-pink-200/50">
              <i class="fas fa-qrcode text-white text-xl"></i>
            </div>
            <h3 class="font-playfair text-xl font-bold mb-1" style="color:rgb(173 122 135);">Quét mã thanh toán</h3>
            <p class="text-xs text-gray-400">Sử dụng app ngân hàng để quét mã QR</p>
          </div>

          <!-- QR Code with decorative border -->
          <div class="from-pink-50 m-[8px] relative rounded-2xl to-white" style="border-color:rgb(255 240 245);">
            <div class="absolute -top-2 -left-2 w-5 h-5 border-t-[3px] border-l-[3px] rounded-tl" style="border-color:rgb(255 183 202);"></div>
            <div class="absolute -top-2 -right-2 w-5 h-5 border-t-[3px] border-r-[3px] rounded-tr" style="border-color:rgb(255 183 202);"></div>
            <div class="absolute -bottom-2 -left-2 w-5 h-5 border-b-[3px] border-l-[3px] rounded-bl" style="border-color:rgb(255 183 202);"></div>
            <div class="absolute -bottom-2 -right-2 w-5 h-5 border-b-[3px] border-r-[3px] rounded-br" style="border-color:rgb(255 183 202);"></div>
            
            <div id="qrcode-container" class="w-[220px] h-[220px] min-w-[220px] min-h-[220px] flex items-center justify-center bg-white rounded-xl p-2"></div>
          </div>

          <!-- Payment Info Card -->
          <div class="w-full p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 shadow-sm">
            <div class="flex items-center gap-3 mb-3 pb-3 border-b-2" style="border-color:rgb(255 240 245);">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background:rgb(255 240 245);">
                <i class="fas fa-university text-base" style="color:rgb(255 183 202);"></i>
              </div>
              <div class="text-left">
                <p class="text-[11px] text-gray-400 uppercase tracking-wide font-semibold m-0">Thông tin chuyển khoản</p>
                <p class="text-sm font-semibold m-0" style="color:rgb(173 122 135);">${paymentInfo.amount.toLocaleString("vi-VN")}đ</p>
              </div>
            </div>
            
            <div class="flex flex-col gap-2 mb-2">
              <div class="text-left">
                <p class="text-[11px] text-gray-400 mb-1 font-medium">Ngân hàng</p>
                <p class="text-xs text-gray-700 font-semibold m-0">${paymentInfo.bank_name}</p>
              </div>
              <div class="text-left">
                <p class="text-[11px] text-gray-400 mb-1 font-medium">Chủ tài khoản</p>
                <p class="text-xs text-gray-700 font-semibold m-0">${paymentInfo.account_name}</p>
              </div>
            </div>
            
            <div class="text-left mb-2">
              <p class="text-[11px] text-gray-400 mb-1 font-medium">Số tài khoản</p>
              <p class="text-sm text-gray-700 font-semibold font-mono m-0">${paymentInfo.account_number}</p>
            </div>
            
            <div class="p-3 rounded-xl border border-dashed text-left" style="background:rgb(255 245 248);border-color:rgb(255 183 202);">
              <p class="text-[11px] text-gray-400 mb-1 font-medium">Nội dung chuyển khoản</p>
              <p class="text-xs font-bold break-all m-0" style="color:rgb(173 122 135);">${paymentInfo.content}</p>
            </div>
          </div>

          <!-- Instructions -->
          <div class="w-full p-3.5 rounded-2xl border" style="background:rgb(255 250 252);border-color:rgb(255 240 245);">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgb(255 183 202);">
                <i class="fas fa-mobile-alt text-white text-[11px]"></i>
              </div>
              <p class="text-xs font-semibold m-0" style="color:rgb(173 122 135);">Hướng dẫn thanh toán</p>
            </div>
            <ol class="m-0 pl-6 text-xs text-gray-600 leading-relaxed text-left">
              <li>Mở ứng dụng ngân hàng của bạn</li>
              <li>Chọn chức năng quét mã QR</li>
              <li>Quét mã QR bên trên</li>
              <li>Kiểm tra thông tin và xác nhận thanh toán</li>
            </ol>
          </div>

          <!-- Status -->
          <div class="flex flex-col items-center gap-2 mt-1">
            <div class="w-11 h-11 rounded-full bg-gradient-to-br from-pink-100 to-pink-50 flex items-center justify-center shadow-lg shadow-pink-200/30">
              <div class="w-5 h-5 border-[3px] rounded-full animate-spin" style="border-color:rgb(255 240 245);border-top-color:rgb(255 183 202);"></div>
            </div>
            <div class="text-center">
              <p class="text-xs font-semibold m-0" style="color:rgb(173 122 135);">Đang chờ thanh toán...</p>
              <p id="payment-timer" class="text-[11px] text-gray-400 mt-1 font-mono">00:00</p>
            </div>
          </div>

          <!-- Timeout UI (hidden initially) -->
          <div id="payment-timeout" class="hidden w-full flex-col gap-2.5 p-4 rounded-2xl bg-gradient-to-br from-red-50 to-red-50/50 border-2 border-red-200">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <i class="fas fa-exclamation-triangle text-red-600 text-sm"></i>
              </div>
              <div class="text-left flex-1">
                <p class="text-xs text-red-600 font-semibold m-0">Chưa nhận được xác nhận</p>
                <p class="text-[11px] text-gray-600 mt-1 m-0">Nếu đã thanh toán, vui lòng kiểm tra lại</p>
              </div>
            </div>
            <div class="flex gap-2.5">
              <button onclick="PaymentModal.retryCheck()" class="flex-1 px-2.5 py-2.5 rounded-lg border-2 border-gray-200 bg-white text-gray-700 text-xs font-semibold cursor-pointer transition-all hover:border-pink-300 hover:text-pink-400">
                <i class="fas fa-sync-alt mr-2"></i>Kiểm tra lại
              </button>
              <button onclick="PaymentModal.createNewPayment()" class="flex-1 px-2.5 py-2.5 rounded-lg bg-gradient-to-r from-pink-300 to-pink-200 text-white text-xs font-semibold border-0 cursor-pointer shadow-lg shadow-pink-200/50 transition-transform hover:-translate-y-0.5">
                <i class="fas fa-redo mr-2"></i>Tạo mã mới
              </button>
            </div>
          </div>

          <button onclick="PaymentModal.cancelPayment()" class="px-7 py-2.5 rounded-full border-2 border-gray-200 bg-white text-gray-500 text-xs font-medium cursor-pointer transition-all mt-1 hover:border-gray-300 hover:text-gray-700">
            <i class="fas fa-times mr-2"></i>Hủy thanh toán
          </button>
        </div>
      `;

    // Generate QR code from string using QRCode.js
    setTimeout(() => {
      try {
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
            <div style="width:48px;height:48px;border-radius:9999px;background:#fee2e2;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
              <i class="fas fa-exclamation-triangle" style="color:#dc2626;font-size:20px;"></i>
            </div>
            <p style="color:#dc2626;font-size:14px;margin:0 0 8px;font-weight:600;">Không thể tạo mã QR</p>
            <p style="color:#6b7280;font-size:12px;margin:0;">Vui lòng sử dụng nút thanh toán bên dưới</p>
          </div>
        `;
        }
      } catch (error) {
        console.error("QR code generation error:", error);
        const qrcodeContainer = document.getElementById("qrcode-container");
        if (qrcodeContainer) {
          qrcodeContainer.innerHTML = `
            <div style="text-align:center;padding:32px;">
              <div style="width:48px;height:48px;border-radius:9999px;background:#fee2e2;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
                <i class="fas fa-times-circle" style="color:#dc2626;font-size:20px;"></i>
              </div>
              <p style="color:#dc2626;font-size:14px;margin:0 0 8px;font-weight:600;">Lỗi tạo mã QR</p>
              <p style="color:#6b7280;font-size:12px;margin:0;">Vui lòng sử dụng nút thanh toán bên dưới</p>
            </div>
          `;
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
    let pollCount = 0;
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
        pollCount++;

        // Exponential backoff: increase interval over time to save bandwidth
        // First 10 polls: 20s, next 10: 30s, after that: 40s
        let nextInterval = POLLING_INTERVAL;
        if (pollCount > 20) {
          nextInterval = 40000; // 40s after 20 polls
        } else if (pollCount > 10) {
          nextInterval = 30000; // 30s after 10 polls
        }

        pollingTimer = setTimeout(poll, nextInterval);
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

    const updateTimer = () => {
      if (!pollingStartTime) return;
      const elapsed = Math.floor((Date.now() - pollingStartTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      timerEl.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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

  // Task 5.11: Show success screen
  function showSuccessScreen(paymentResult) {
    const { manage_id, slug, transaction_id, payment_time } = paymentResult;

    // Update localStorage order
    updateOrderStatus(manage_id, transaction_id, payment_time);

    // Get order data from form
    const name = document.getElementById("payment-name").value.trim();
    const phone = document.getElementById("payment-phone").value.trim();
    const templateName = document.getElementById(
      "payment-template-name",
    ).textContent;

    // Update success screen
    document.getElementById("success-name").textContent = name;
    document.getElementById("success-phone").textContent = phone;
    document.getElementById("success-template").textContent = templateName;

    const manageLink = manage_id
      ? window.location.origin + "/customer/manage.html?id=" + manage_id
      : null;

    if (manageLink) {
      document.getElementById("success-manage-link").value = manageLink;
      document.getElementById("success-manage-btn").href = manageLink;
      document.getElementById("success-manage-block").style.display = "block";
    } else {
      document.getElementById("success-manage-block").style.display = "none";
    }

    // Show success screen
    document.getElementById("payment-step-2").style.display = "none";
    document.getElementById("payment-step-3").style.display = "flex";
  }

  // Task 5.11: Update localStorage order status
  function updateOrderStatus(manage_id, transaction_id, payment_time) {
    const sessionUser = getCurrentUser();
    const sessionEmail = sessionUser?.email || "";
    const email = document.getElementById("payment-email").value.trim();
    const storageKey = sessionEmail
      ? "orders_" + sessionEmail
      : email
        ? "orders_" + email
        : "guestOrders";

    let orders = [];
    try {
      orders = JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch (e) {}

    // Find and update the pending order
    const orderIdx = orders.findIndex(
      (o) => o.manage_id === manage_id || o.status === "pending",
    );
    if (orderIdx >= 0) {
      orders[orderIdx] = {
        ...orders[orderIdx],
        status: "completed",
        manage_id,
        transaction_id,
        payment_time,
      };
    }

    localStorage.setItem(storageKey, JSON.stringify(orders));
  }

  // Inject modal HTML vào body
  function injectPaymentModal() {
    if (document.getElementById("paymentModal")) return; // Đã có rồi
    const el = document.createElement("div");
    el.innerHTML = `
      <div id="paymentModal" class="modal hidden fixed inset-0 z-[100] items-center justify-center p-4" style="display:none;">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="PaymentModal.close()"></div>
        <div class="relative bg-white rounded-3xl max-w-[480px] w-full max-h-[90vh] shadow-2xl z-10 overflow-hidden">
          <div class="overflow-y-auto max-h-[90vh]">
          <button onclick="PaymentModal.close()" class="absolute top-4 right-4 z-20 w-8 h-8 bg-white rounded-full border-0 cursor-pointer flex items-center justify-center shadow-md hover:shadow-lg transition-shadow">
            <i class="fas fa-times text-gray-400 text-sm"></i>
          </button>

          <!-- Step 1: Xác nhận đơn hàng -->
          <div id="payment-step-1">
            <div class="p-6 border-b border-gray-100">
              <h3 class="font-playfair text-2xl font-bold m-0" style="color:rgb(173 122 135);">Xác nhận đơn hàng</h3>
              <p class="text-sm text-gray-400 mt-1">Kiểm tra thông tin trước khi thanh toán</p>
            </div>
            <div class="p-6 flex flex-col gap-4">
              <!-- Thông tin mẫu -->
              <div class="flex items-center gap-4 p-4 rounded-2xl border border-pink-200" style="background:#fff5f8;">
                <div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style="background:rgb(255 183 202);">
                  <i class="fas fa-envelope-open-text text-white text-lg"></i>
                </div>
                <div>
                  <p class="font-semibold text-sm m-0" style="color:rgb(173 122 135);" id="payment-template-name">-</p>
                  <p class="text-xs text-gray-400 m-0">Thiệp cưới online</p>
                </div>
                <div class="ml-auto text-right">
                  <p id="payment-price" class="font-bold text-lg m-0" style="color:rgb(173 122 135);">299.000đ</p>
                  <p id="payment-original-price" class="text-xs text-gray-300 line-through m-0">499.000đ</p>
                </div>
              </div>

              <!-- User info nếu đã đăng nhập -->
              <div id="payment-user-info" class="hidden items-center gap-3 p-3 rounded-2xl" style="background:rgb(255 245 248);">
                <img id="payment-avatar" src="" alt="" class="w-10 h-10 rounded-full object-cover border-2" style="border-color:rgb(255 183 202);" />
                <div>
                  <p class="text-sm font-medium m-0" style="color:rgb(173 122 135);" id="payment-user-name-display"></p>
                  <p class="text-xs text-gray-400 m-0" id="payment-user-email-display"></p>
                </div>
                <i class="fas fa-check-circle ml-auto" style="color:rgb(255 183 202);"></i>
              </div>

              <!-- Form -->
              <div class="flex flex-col gap-3">
                <div>
                  <label class="text-xs font-medium text-gray-600 block mb-1">Họ và tên <span class="text-red-500">*</span></label>
                  <input id="payment-name" type="text" placeholder="Nguyễn Văn A"
                    class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none box-border transition-colors focus:border-pink-300" />
                  <p id="payment-name-err" class="hidden text-[11px] text-red-500 mt-1">Vui lòng nhập họ và tên</p>
                </div>
                <div>
                  <label class="text-xs font-medium text-gray-600 block mb-1">Số điện thoại <span class="text-red-500">*</span></label>
                  <input id="payment-phone" type="tel" placeholder="0912 345 678"
                    class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none box-border transition-colors focus:border-pink-300" />
                  <p id="payment-phone-err" class="hidden text-[11px] text-red-500 mt-1">Vui lòng nhập số điện thoại</p>
                </div>
                <div>
                  <label class="text-xs font-medium text-gray-600 block mb-1">Email</label>
                  <input id="payment-email" type="email" placeholder="email@example.com"
                    class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none box-border transition-colors focus:border-pink-300" />
                </div>
              </div>

              <!-- Tổng tiền -->
              <div class="flex items-center justify-between py-3 border-t border-gray-100">
                <span class="text-sm text-gray-400">Tổng thanh toán</span>
                <span id="payment-total-price" class="font-bold text-xl" style="color:rgb(173 122 135);">299.000đ</span>
              </div>

              <button onclick="PaymentModal.process()"
                class="w-full py-3.5 rounded-full text-white font-semibold text-sm border-0 cursor-pointer transition-colors hover:opacity-90" style="background:rgb(255 183 202);">
                <i class="fas fa-lock mr-2 text-xs"></i>Thanh toán ngay
              </button>
              <p class="text-center text-xs text-gray-400 m-0">
                <i class="fas fa-shield-alt mr-1"></i>Thanh toán an toàn & bảo mật
              </p>
              <p id="payment-api-error" class="hidden text-xs text-red-500 text-center p-2 bg-red-50 rounded-lg m-0"></p>
            </div>
          </div>

          <!-- Step 2: Processing -->
          <div id="payment-step-2" class="hidden p-12 flex-col items-center gap-6 text-center">
            <div class="w-16 h-16 rounded-full flex items-center justify-center" style="background:rgb(255 240 245);">
              <div class="w-8 h-8 border-4 border-pink-100 rounded-full animate-spin" style="border-top-color:rgb(255 183 202);"></div>
            </div>
            <div>
              <p class="font-semibold m-0" style="color:rgb(173 122 135);">Đang xử lý thanh toán...</p>
              <p class="text-sm text-gray-400 mt-1">Vui lòng không đóng cửa sổ này</p>
            </div>
          </div>

          <!-- Step 3: Success -->
          <div id="payment-step-3" class="hidden p-10 flex-col items-center gap-5 text-center">
            <div class="w-20 h-20 rounded-full bg-gradient-to-br from-pink-300 to-pink-200 flex items-center justify-center">
              <i class="fas fa-check text-white text-3xl"></i>
            </div>
            <div>
              <h3 class="font-playfair text-2xl font-bold mb-2 m-0" style="color:rgb(173 122 135);">Thanh toán thành công!</h3>
              <p class="text-sm text-gray-600 leading-relaxed m-0">Nhấn vào link bên dưới để bắt đầu nhập thông tin thiệp cưới của bạn.</p>
            </div>
            <div class="w-full p-4 rounded-2xl bg-gray-50 text-left">
              <p class="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Thông tin đơn hàng</p>
              <p class="text-sm font-medium m-0" style="color:rgb(173 122 135);" id="success-name"></p>
              <p class="text-xs text-gray-400 mt-1 m-0" id="success-phone"></p>
              <p class="text-xs text-gray-400 mt-2 m-0">Mẫu: <span id="success-template" class="font-medium" style="color:rgb(173 122 135);"></span></p>
            </div>
            <!-- Link setup thiệp -->
            <div id="success-manage-block" class="w-full p-4 rounded-2xl border border-dashed text-left" style="border-color:rgb(255 183 202);background:rgb(255 245 248);">
              <p class="text-xs text-gray-400 mb-2 font-medium">🎉 Link thiết lập thiệp cưới của bạn</p>
              <p class="text-[11px] text-gray-400 mb-3 leading-relaxed">Dùng link này để nhập thông tin cô dâu, chú rể và tùy chỉnh thiệp.</p>
              <div class="flex gap-2 items-center">
                <input id="success-manage-link" readonly
                  class="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-[11px] text-gray-600 bg-white outline-none min-w-0" />
                <button onclick="copyManageLink()"
                  class="px-3 py-2 rounded-lg text-white border-0 cursor-pointer text-xs whitespace-nowrap flex-shrink-0" style="background:rgb(255 183 202);">
                  <i class="fas fa-copy"></i>
                </button>
              </div>
            </div>
            <div class="flex gap-3 w-full">
              <button onclick="PaymentModal.close()"
                class="flex-1 py-3 rounded-full border-2 bg-white font-semibold text-sm cursor-pointer" style="border-color:rgb(255 183 202);color:rgb(173 122 135);">
                Đóng
              </button>
              <a id="success-manage-btn" href="#"
                class="flex-1 py-3 rounded-full text-white font-semibold text-sm no-underline flex items-center justify-center gap-2" style="background:rgb(255 183 202);">
                <i class="fas fa-edit text-xs"></i>Thiết lập ngay
              </a>
            </div>
          </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(el.firstElementChild);
  }

  // Đọc user từ localStorage (Supabase session)
  function getCurrentUser() {
    try {
      const keys = Object.keys(localStorage);
      const sessionKey = keys.find(
        (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
      );
      if (!sessionKey) return null;
      const session = JSON.parse(localStorage.getItem(sessionKey));
      return session?.user ?? null;
    } catch (e) {
      return null;
    }
  }

  window.copyManageLink = function () {
    const input = document.getElementById("success-manage-link");
    if (!input) return;
    navigator.clipboard.writeText(input.value).then(() => {
      const btn = input.nextElementSibling;
      btn.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => {
        btn.innerHTML = '<i class="fas fa-copy"></i>';
      }, 2000);
    });
  };

  // Public API
  window.PaymentModal = {
    open(templateName, theme, pricing = {}) {
      injectPaymentModal();
      // Lưu theme để dùng khi tạo wedding record
      window._paymentTheme = theme || "template1";

      // Lưu pricing để dùng trong modal
      window._paymentPricing = pricing;

      // Lưu order pending ngay khi mở modal (nếu chưa có)
      const sessionUser = getCurrentUser();
      const sessionEmail = sessionUser?.email || "";
      const storageKey = sessionEmail
        ? "orders_" + sessionEmail
        : "guestOrders";
      let orders = [];
      try {
        orders = JSON.parse(localStorage.getItem(storageKey) || "[]");
      } catch (e) {}
      const alreadyExists = orders.some((o) => o.templateName === templateName);
      if (!alreadyExists) {
        orders.push({
          id: "CX" + Date.now().toString().slice(-6),
          templateName,
          status: "pending",
          date: new Date().toISOString(),
          slug: null,
        });
        localStorage.setItem(storageKey, JSON.stringify(orders));
      }

      // Reset steps
      document.getElementById("payment-step-1").style.display = "block";
      document.getElementById("payment-step-2").style.display = "none";
      document.getElementById("payment-step-3").style.display = "none";
      document.getElementById("payment-template-name").textContent =
        templateName || "-";

      // Update pricing display
      const price = pricing.price || 299000;
      const originalPrice = pricing.originalPrice || 499000;
      const priceEl = document.getElementById("payment-price");
      const originalPriceEl = document.getElementById("payment-original-price");
      const totalPriceEl = document.getElementById("payment-total-price");

      if (priceEl) priceEl.textContent = `${price.toLocaleString("vi-VN")}đ`;
      if (originalPriceEl) {
        if (originalPrice && originalPrice > price) {
          originalPriceEl.textContent = `${originalPrice.toLocaleString("vi-VN")}đ`;
          originalPriceEl.style.display = "block";
        } else {
          originalPriceEl.style.display = "none";
        }
      }
      if (totalPriceEl)
        totalPriceEl.textContent = `${price.toLocaleString("vi-VN")}đ`;

      // Reset inputs
      ["payment-name", "payment-phone", "payment-email"].forEach((id) => {
        document.getElementById(id).value = "";
        document.getElementById(id).style.borderColor = "#e5e7eb";
      });
      ["payment-name-err", "payment-phone-err"].forEach((id) => {
        document.getElementById(id).style.display = "none";
      });
      const apiErr = document.getElementById("payment-api-error");
      if (apiErr) apiErr.style.display = "none";

      // Bind user info nếu đã đăng nhập
      const user = getCurrentUser();
      const userInfoEl = document.getElementById("payment-user-info");
      if (user) {
        const meta = user.user_metadata || {};
        const name = meta.full_name || meta.name || "";
        const email = user.email || "";
        const phone = meta.phone || "";
        const avatar = meta.avatar_url || meta.picture || "";

        userInfoEl.style.display = "flex";
        document.getElementById("payment-avatar").src = avatar;
        document.getElementById("payment-avatar").style.display = avatar
          ? "block"
          : "none";
        document.getElementById("payment-user-name-display").textContent = name;
        document.getElementById("payment-user-email-display").textContent =
          email;

        if (name) document.getElementById("payment-name").value = name;
        if (phone) document.getElementById("payment-phone").value = phone;
        if (email) document.getElementById("payment-email").value = email;
      } else {
        userInfoEl.style.display = "none";
      }

      // Show modal
      const modal = document.getElementById("paymentModal");
      modal.style.display = "flex";
      document.body.style.overflow = "hidden";
    },

    close() {
      // Stop polling when modal is closed
      stopPolling();

      const modal = document.getElementById("paymentModal");
      if (modal) modal.style.display = "none";
      document.body.style.overflow = "auto";
    },

    async process() {
      const name = document.getElementById("payment-name").value.trim();
      const phone = document.getElementById("payment-phone").value.trim();
      const email = document.getElementById("payment-email").value.trim();
      const templateName = document.getElementById(
        "payment-template-name",
      ).textContent;

      // Validate
      let hasError = false;

      const nameInput = document.getElementById("payment-name");
      const nameErr = document.getElementById("payment-name-err");
      if (!name) {
        nameInput.style.borderColor = "#ef4444";
        nameErr.style.display = "block";
        hasError = true;
      } else {
        nameInput.style.borderColor = "#e5e7eb";
        nameErr.style.display = "none";
      }

      const phoneInput = document.getElementById("payment-phone");
      const phoneErr = document.getElementById("payment-phone-err");
      if (!phone) {
        phoneInput.style.borderColor = "#ef4444";
        phoneErr.style.display = "block";
        hasError = true;
      } else {
        phoneInput.style.borderColor = "#e5e7eb";
        phoneErr.style.display = "none";
      }

      if (hasError) return;

      // Hide error message
      const apiErr = document.getElementById("payment-api-error");
      if (apiErr) apiErr.style.display = "none";

      // Step 2: Show processing - reset về loading state trước khi show
      const step2El = document.getElementById("payment-step-2");
      step2El.innerHTML = `
        <div class="w-16 h-16 rounded-full flex items-center justify-center" style="background:rgb(255 240 245);">
          <div class="w-8 h-8 border-4 border-pink-100 rounded-full animate-spin" style="border-top-color:rgb(255 183 202);"></div>
        </div>
        <div>
          <p class="font-semibold m-0" style="color:rgb(173 122 135);">Đang xử lý thanh toán...</p>
          <p class="text-sm text-gray-400 mt-1">Vui lòng không đóng cửa sổ này</p>
        </div>
      `;
      document.getElementById("payment-step-1").style.display = "none";
      step2El.style.display = "flex";

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

      // Task 5.10: Real payment flow with PayOS
      try {
        // Generate manage_id on client
        const manage_id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
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
        const storageKey = sessionEmail
          ? "orders_" + sessionEmail
          : email
            ? "orders_" + email
            : "guestOrders";

        let orders = [];
        try {
          orders = JSON.parse(localStorage.getItem(storageKey) || "[]");
        } catch (e) {}

        const existingIdx = orders.findIndex(
          (o) => o.templateName === templateName && o.status === "pending",
        );
        if (existingIdx >= 0) {
          orders[existingIdx] = order;
        } else {
          orders.push(order);
        }
        localStorage.setItem(storageKey, JSON.stringify(orders));

        // Call createPayment API
        const paymentData = {
          manage_id,
          customer_name: name,
          customer_phone: phone,
          customer_email: email,
          template_name: templateName,
          theme: window._paymentTheme || "template1",
          // SECURITY: Amount is determined by backend from database
        };

        const paymentResult = await createPayment(paymentData);

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
              msg.style.color = "#dc2626";
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
              msg.style.color = "#dc2626";
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
            msg.style.color = "#dc2626";
          }
        }
      }
    },

    // Task 5.8: Create new payment
    createNewPayment() {
      // Reset and restart payment process
      stopPolling();
      document.getElementById("payment-step-2").style.display = "none";
      document.getElementById("payment-step-1").style.display = "block";

      // Clear timeout UI
      const timeoutEl = document.getElementById("payment-timeout");
      if (timeoutEl) timeoutEl.style.display = "none";
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
