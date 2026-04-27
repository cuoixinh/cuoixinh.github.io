// ============= PAYMENT MODULE =============
// Dùng chung cho index.html và account.html

(function () {
  // Inject modal HTML vào body
  function injectPaymentModal() {
    if (document.getElementById("paymentModal")) return; // Đã có rồi
    const el = document.createElement("div");
    el.innerHTML = `
      <div id="paymentModal" class="modal hidden" style="position:fixed;inset:0;z-index:100;display:none;align-items:center;justify-content:center;padding:1rem;">
        <div style="position:absolute;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);" onclick="PaymentModal.close()"></div>
        <div style="position:relative;background:white;border-radius:1.5rem;max-width:480px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 25px 50px rgba(0,0,0,0.25);z-index:10;">
          <button onclick="PaymentModal.close()" style="position:absolute;top:1rem;right:1rem;z-index:20;width:2rem;height:2rem;background:white;border-radius:9999px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
            <i class="fas fa-times" style="color:#9ca3af;font-size:0.875rem;"></i>
          </button>

          <!-- Step 1: Xác nhận đơn hàng -->
          <div id="payment-step-1">
            <div style="padding:1.5rem;border-bottom:1px solid #f3f4f6;">
              <h3 style="font-family:'Playfair Display',serif;font-size:1.5rem;font-weight:700;color:rgb(173 122 135);margin:0;">Xác nhận đơn hàng</h3>
              <p style="font-size:0.875rem;color:#9ca3af;margin-top:0.25rem;">Kiểm tra thông tin trước khi thanh toán</p>
            </div>
            <div style="padding:1.5rem;display:flex;flex-direction:column;gap:1rem;">
              <!-- Thông tin mẫu -->
              <div style="display:flex;align-items:center;gap:1rem;padding:1rem;border-radius:1rem;border:1px solid #fce7f3;background:#fff5f8;">
                <div style="width:3rem;height:3rem;border-radius:0.75rem;background:rgb(255 183 202);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                  <i class="fas fa-envelope-open-text" style="color:white;font-size:1.125rem;"></i>
                </div>
                <div>
                  <p style="font-weight:600;font-size:0.875rem;color:rgb(173 122 135);margin:0;" id="payment-template-name">-</p>
                  <p style="font-size:0.75rem;color:#9ca3af;margin:0;">Thiệp cưới online</p>
                </div>
                <div style="margin-left:auto;text-align:right;">
                  <p style="font-weight:700;font-size:1.125rem;color:rgb(173 122 135);margin:0;">299.000đ</p>
                  <p style="font-size:0.75rem;color:#d1d5db;text-decoration:line-through;margin:0;">499.000đ</p>
                </div>
              </div>

              <!-- User info nếu đã đăng nhập -->
              <div id="payment-user-info" style="display:none;align-items:center;gap:0.75rem;padding:0.75rem;border-radius:1rem;background:rgb(255 245 248);">
                <img id="payment-avatar" src="" alt="" style="width:2.5rem;height:2.5rem;border-radius:9999px;object-fit:cover;border:2px solid rgb(255 183 202);" />
                <div>
                  <p style="font-size:0.875rem;font-weight:500;color:rgb(173 122 135);margin:0;" id="payment-user-name-display"></p>
                  <p style="font-size:0.75rem;color:#9ca3af;margin:0;" id="payment-user-email-display"></p>
                </div>
                <i class="fas fa-check-circle" style="color:rgb(255 183 202);margin-left:auto;"></i>
              </div>

              <!-- Form -->
              <div style="display:flex;flex-direction:column;gap:0.75rem;">
                <div>
                  <label style="font-size:0.75rem;font-weight:500;color:#6b7280;display:block;margin-bottom:0.25rem;">Họ và tên <span style="color:#ef4444;">*</span></label>
                  <input id="payment-name" type="text" placeholder="Nguyễn Văn A"
                    style="width:100%;padding:0.625rem 1rem;border-radius:0.75rem;border:1px solid #e5e7eb;font-size:0.875rem;outline:none;box-sizing:border-box;transition:border-color 0.2s;"
                    onfocus="this.style.borderColor='rgb(255 183 202)'" onblur="this.style.borderColor=this.value?'#e5e7eb':''" />
                  <p id="payment-name-err" style="display:none;font-size:0.7rem;color:#ef4444;margin:0.25rem 0 0;">Vui lòng nhập họ và tên</p>
                </div>
                <div>
                  <label style="font-size:0.75rem;font-weight:500;color:#6b7280;display:block;margin-bottom:0.25rem;">Số điện thoại <span style="color:#ef4444;">*</span></label>
                  <input id="payment-phone" type="tel" placeholder="0912 345 678"
                    style="width:100%;padding:0.625rem 1rem;border-radius:0.75rem;border:1px solid #e5e7eb;font-size:0.875rem;outline:none;box-sizing:border-box;transition:border-color 0.2s;"
                    onfocus="this.style.borderColor='rgb(255 183 202)'" onblur="this.style.borderColor=this.value?'#e5e7eb':''" />
                  <p id="payment-phone-err" style="display:none;font-size:0.7rem;color:#ef4444;margin:0.25rem 0 0;">Vui lòng nhập số điện thoại</p>
                </div>
                <div>
                  <label style="font-size:0.75rem;font-weight:500;color:#6b7280;display:block;margin-bottom:0.25rem;">Email</label>
                  <input id="payment-email" type="email" placeholder="email@example.com"
                    style="width:100%;padding:0.625rem 1rem;border-radius:0.75rem;border:1px solid #e5e7eb;font-size:0.875rem;outline:none;box-sizing:border-box;transition:border-color 0.2s;"
                    onfocus="this.style.borderColor='rgb(255 183 202)'" onblur="this.style.borderColor='#e5e7eb'" />
                </div>
              </div>

              <!-- Tổng tiền -->
              <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 0;border-top:1px solid #f3f4f6;">
                <span style="font-size:0.875rem;color:#9ca3af;">Tổng thanh toán</span>
                <span style="font-weight:700;font-size:1.25rem;color:rgb(173 122 135);">299.000đ</span>
              </div>

              <button onclick="PaymentModal.process()"
                style="width:100%;padding:0.875rem;border-radius:9999px;background:rgb(255 183 202);color:white;font-weight:600;font-size:0.875rem;border:none;cursor:pointer;transition:background 0.2s;"
                onmouseover="this.style.background='rgb(255 200 215)'" onmouseout="this.style.background='rgb(255 183 202)'">
                <i class="fas fa-lock" style="margin-right:0.5rem;font-size:0.75rem;"></i>Thanh toán ngay
              </button>
              <p style="text-align:center;font-size:0.75rem;color:#9ca3af;margin:0;">
                <i class="fas fa-shield-alt" style="margin-right:0.25rem;"></i>Thanh toán an toàn & bảo mật
              </p>
              <p id="payment-api-error" style="display:none;font-size:0.8rem;color:#ef4444;text-align:center;padding:0.5rem;background:#fef2f2;border-radius:0.5rem;margin:0;"></p>
            </div>
          </div>

          <!-- Step 2: Processing -->
          <div id="payment-step-2" style="display:none;padding:3rem;flex-direction:column;align-items:center;gap:1.5rem;text-align:center;">
            <div style="width:4rem;height:4rem;border-radius:9999px;background:rgb(255 240 245);display:flex;align-items:center;justify-content:center;">
              <div style="width:2rem;height:2rem;border:4px solid #fce7f3;border-top-color:rgb(255 183 202);border-radius:9999px;animation:spin 1s linear infinite;"></div>
            </div>
            <div>
              <p style="font-weight:600;color:rgb(173 122 135);margin:0;">Đang xử lý thanh toán...</p>
              <p style="font-size:0.875rem;color:#9ca3af;margin-top:0.25rem;">Vui lòng không đóng cửa sổ này</p>
            </div>
          </div>

          <!-- Step 3: Success -->
          <div id="payment-step-3" style="display:none;padding:2.5rem;flex-direction:column;align-items:center;gap:1.25rem;text-align:center;">
            <div style="width:5rem;height:5rem;border-radius:9999px;background:linear-gradient(135deg,rgb(255 183 202),rgb(255 210 220));display:flex;align-items:center;justify-content:center;">
              <i class="fas fa-check" style="color:white;font-size:1.875rem;"></i>
            </div>
            <div>
              <h3 style="font-family:'Playfair Display',serif;font-size:1.5rem;font-weight:700;color:rgb(173 122 135);margin:0 0 0.5rem;">Thanh toán thành công!</h3>
              <p style="font-size:0.875rem;color:#6b7280;line-height:1.6;margin:0;">Nhấn vào link bên dưới để bắt đầu nhập thông tin thiệp cưới của bạn.</p>            </div>
            <div style="width:100%;padding:1rem;border-radius:1rem;background:#f9fafb;text-align:left;">
              <p style="font-size:0.75rem;color:#9ca3af;margin:0 0 0.5rem;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Thông tin đơn hàng</p>
              <p style="font-size:0.875rem;font-weight:500;color:rgb(173 122 135);margin:0;" id="success-name"></p>
              <p style="font-size:0.75rem;color:#9ca3af;margin:0.25rem 0 0;" id="success-phone"></p>
              <p style="font-size:0.75rem;color:#9ca3af;margin:0.5rem 0 0;">Mẫu: <span id="success-template" style="font-weight:500;color:rgb(173 122 135);"></span></p>
            </div>
            <!-- Link setup thiệp -->
            <div id="success-manage-block" style="width:100%;padding:1rem;border-radius:1rem;border:1px dashed rgb(255 183 202);background:rgb(255 245 248);text-align:left;">
              <p style="font-size:0.75rem;color:#9ca3af;margin:0 0 0.5rem;font-weight:500;">🎉 Link thiết lập thiệp cưới của bạn</p>
              <p style="font-size:0.7rem;color:#9ca3af;margin:0 0 0.75rem;line-height:1.5;">Dùng link này để nhập thông tin cô dâu, chú rể và tùy chỉnh thiệp.</p>
              <div style="display:flex;gap:0.5rem;align-items:center;">
                <input id="success-manage-link" readonly
                  style="flex:1;padding:0.5rem 0.75rem;border-radius:0.5rem;border:1px solid #e5e7eb;font-size:0.7rem;color:#6b7280;background:white;outline:none;min-width:0;" />
                <button onclick="copyManageLink()"
                  style="padding:0.5rem 0.75rem;border-radius:0.5rem;background:rgb(255 183 202);color:white;border:none;cursor:pointer;font-size:0.75rem;white-space:nowrap;flex-shrink:0;">
                  <i class="fas fa-copy"></i>
                </button>
              </div>
            </div>
            <div style="display:flex;gap:0.75rem;width:100%;">
              <button onclick="PaymentModal.close()"
                style="flex:1;padding:0.75rem;border-radius:9999px;border:2px solid rgb(255 183 202);background:white;color:rgb(173 122 135);font-weight:600;font-size:0.875rem;cursor:pointer;">
                Đóng
              </button>
              <a id="success-manage-btn" href="#"
                style="flex:1;padding:0.75rem;border-radius:9999px;background:rgb(255 183 202);color:white;font-weight:600;font-size:0.875rem;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:0.5rem;">
                <i class="fas fa-edit" style="font-size:0.75rem;"></i>Thiết lập ngay
              </a>
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
    open(templateName, theme) {
      injectPaymentModal();
      // Lưu theme để dùng khi tạo wedding record
      window._paymentTheme = theme || "template1";

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

      // Step 2: Processing
      document.getElementById("payment-step-1").style.display = "none";
      document.getElementById("payment-step-2").style.display = "flex";

      // Fake delay
      await new Promise((r) => setTimeout(r, 1500));

      // Lưu order
      const order = {
        id: "CX" + Date.now().toString().slice(-6),
        templateName,
        status: "completed",
        date: new Date().toISOString(),
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        slug: null,
      };

      // Update order pending → completed (hoặc push mới nếu chưa có)
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

      // Gen UUID ở client, gửi lên Edge Function để dùng làm manage_id
      const manage_id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
        },
      );

      const EDGE_URL =
        "https://lcobawmkywtxhpezndsh.supabase.co/functions/v1/wedding-admin";
      const ANON_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxjb2Jhd21reXd0eGhwZXpuZHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4OTA5ODMsImV4cCI6MjA5MTQ2Njk4M30.4BNmxnfixXdHOq0ovtaF_4wQZ9sap3IWbJNJK9H4Mg4";

      // Tạo slug từ tên + sdt, bỏ dấu tiếng Việt
      function toSlug(str) {
        return str
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/gi, "d")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
      }
      const nameSlug = toSlug(name);
      const phoneClean = phone.replace(/\s/g, "");
      const baseSlug = `${nameSlug}-${phoneClean}`;

      // Backend tự xử lý slug trùng, client chỉ gửi 1 request
      let finalSlug = baseSlug;
      try {
        const res = await fetch(EDGE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({
            id: manage_id,
            slug: baseSlug,
            contact: phone,
            theme: window._paymentTheme || "template1",
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Lỗi server (${res.status})`);
        }
        // Đọc slug thật từ response (backend tự append suffix nếu trùng)
        const resData = await res.json().catch(() => ({}));
        if (resData.slug) finalSlug = resData.slug;
      } catch (e) {
        document.getElementById("payment-step-2").style.display = "none";
        document.getElementById("payment-step-1").style.display = "block";
        const errEl = document.getElementById("payment-api-error");
        if (errEl) {
          errEl.textContent =
            "❌ " + (e.message || "Đặt hàng thất bại, vui lòng thử lại");
          errEl.style.display = "block";
        }
        return;
      }

      const existingIdx = orders.findIndex(
        (o) => o.templateName === templateName,
      );
      if (existingIdx >= 0) {
        orders[existingIdx] = {
          ...orders[existingIdx],
          status: "completed",
          customerName: name,
          customerPhone: phone,
          customerEmail: email,
          manage_id,
        };
      } else {
        orders.push({ ...order, manage_id });
      }
      localStorage.setItem(storageKey, JSON.stringify(orders));

      // Step 3: Success
      const manageLink = manage_id
        ? window.location.origin + "/manage-by-customer.html?id=" + manage_id
        : null;
      document.getElementById("success-name").textContent = name;
      document.getElementById("success-phone").textContent = phone;
      document.getElementById("success-template").textContent = templateName;
      if (manageLink) {
        document.getElementById("success-manage-link").value = manageLink;
        document.getElementById("success-manage-btn").href = manageLink;
        document.getElementById("success-manage-block").style.display = "block";
      } else {
        document.getElementById("success-manage-block").style.display = "none";
      }
      document.getElementById("payment-step-2").style.display = "none";
      document.getElementById("payment-step-3").style.display = "flex";
    },
  };

  // Inject ngay khi script load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectPaymentModal);
  } else {
    injectPaymentModal();
  }
})();
