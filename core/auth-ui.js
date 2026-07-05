// ============================================================================
// auth-ui.js — UI + logic đăng nhập / tạo tài khoản DÙNG CHUNG
// Dùng cho: trang account (nhúng vào #auth-form-container) và popup ở invitation-setup.
// Yêu cầu nạp sau: supabase-js, core/config.js. (showToast tuỳ chọn.)
//   AuthUI.supabase              → client dùng chung (account/index.js tái sử dụng)
//   AuthUI.renderForm(el, opts)  → đổ form vào 1 container, opts.onAuth(user) khi login OK
//   AuthUI.openModal(opts)       → mở popup chứa form; opts.onAuth(user), opts.oauthRedirect
//   AuthUI.closeModal()
// ============================================================================
(function () {
  const { createClient } = window.supabase;
  const sb = createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);

  const _toast = (m, t) =>
    (typeof showToast === "function" ? showToast(m, t) : console.log("[auth]", m));

  // Map lỗi Supabase Auth sang thông báo tiếng Việt THEO error code (ổn định hơn message).
  // Tham chiếu: https://supabase.com/docs/guides/auth/debugging/error-codes
  const _AUTH_ERR = {
    otp_expired: "Mã đã hết hạn hoặc không đúng. Vui lòng gửi lại mã.",
    otp_disabled: "Đăng nhập bằng mã OTP đang bị tắt.",
    invalid_credentials: "Mã xác thực không đúng.",
    email_not_confirmed: "Tài khoản chưa được xác nhận.",
    user_not_found: "Không tìm thấy tài khoản.",
    over_request_rate_limit: "Bạn thao tác quá nhanh, vui lòng thử lại sau.",
    over_email_send_rate_limit: "Gửi mã quá nhiều lần, vui lòng thử lại sau.",
    validation_failed: "Thông tin nhập chưa hợp lệ.",
    signup_disabled: "Chức năng đăng ký đang tạm khoá.",
    email_provider_disabled: "Đăng nhập bằng email đang bị tắt.",
  };
  function _friendlyError(err) {
    const code = (err && (err.code || err.error_code)) || "";
    if (_AUTH_ERR[code]) return _AUTH_ERR[code];
    // Code lạ → thông báo chung, kèm message gốc để còn debug
    return "Có lỗi xảy ra: " + ((err && err.message) || "Vui lòng thử lại.");
  }

  const _FB_SVG = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`;
  const _GG_SVG = `<svg class="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`;

  const _INPUT_CLS =
    "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-white outline-none focus:ring-2 focus:ring-rose-400/30 focus:border-rose-300 transition-all";

  const _BTN_CLS =
    "w-full h-11 rounded-lg text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60";

  function _formHtml() {
    return `
      <div data-auth-root>
        <!-- Bước 1: nhập email -->
        <div data-auth-step="email" class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input data-auth-email type="email" inputmode="email" autocomplete="email" required
              placeholder="email@example.com" class="${_INPUT_CLS}" />
          </div>
          <button type="button" data-auth-send class="${_BTN_CLS}">
            <span data-auth-send-label>Gửi mã xác thực</span>
          </button>

          <div class="flex items-center gap-3 my-1">
            <div class="flex-1 h-px bg-gray-200"></div>
            <span class="text-xs text-gray-400">hoặc</span>
            <div class="flex-1 h-px bg-gray-200"></div>
          </div>
          <div class="flex flex-col sm:flex-row gap-2.5">
            <button type="button" data-auth-oauth="facebook"
              class="flex-1 py-2.5 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all hover:opacity-90 text-sm"
              style="background-color:#1877f2;color:white">${_FB_SVG} Facebook</button>
            <button type="button" data-auth-oauth="google"
              class="flex-1 py-2.5 px-4 rounded-lg font-medium flex items-center justify-center gap-2 border-2 border-gray-300 transition-all hover:bg-gray-50 text-sm"
              style="color:#333">${_GG_SVG} Google</button>
          </div>
        </div>

        <!-- Bước 2: nhập mã 6 số -->
        <div data-auth-step="code" class="hidden space-y-4">
          <button type="button" data-auth-change
            class="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors -ml-1 px-1 py-1 rounded-lg">
            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Đổi email
          </button>

          <div class="text-center space-y-1">
            <p class="text-sm text-gray-600">Nhập mã gồm 6 số vừa gửi tới</p>
            <p data-auth-email-label class="text-sm font-semibold text-gray-800 break-all"></p>
          </div>

          <div data-auth-otp class="flex justify-center gap-2">
            ${[0, 1, 2, 3, 4, 5]
              .map(
                (i) =>
                  `<input data-auth-otp-box type="text" inputmode="numeric" autocomplete="${i === 0 ? "one-time-code" : "off"}" maxlength="1"
                    class="w-11 h-12 sm:w-12 text-center text-xl font-semibold text-gray-800 border border-gray-200 rounded-xl bg-white outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/30 transition-all" />`,
              )
              .join("")}
          </div>

          <button type="button" data-auth-verify class="${_BTN_CLS}">
            <span data-auth-verify-label>Xác nhận</span>
          </button>

          <p class="text-center text-xs text-gray-500">
            Không nhận được mã?
            <button type="button" data-auth-resend class="font-semibold text-color-secondary hover:underline">Gửi lại mã</button>
          </p>
        </div>
      </div>`;
  }

  const _EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  // Gắn handler cho form vừa render trong `root`. opts: { onAuth, oauthRedirect }
  function _wire(root, opts) {
    opts = opts || {};
    const oauthRedirect = opts.oauthRedirect || window.location.href;

    const stepEmail = root.querySelector('[data-auth-step="email"]');
    const stepCode = root.querySelector('[data-auth-step="code"]');
    const emailEl = root.querySelector("[data-auth-email]");
    const sendBtn = root.querySelector("[data-auth-send]");
    const sendLabel = root.querySelector("[data-auth-send-label]");
    const verifyBtn = root.querySelector("[data-auth-verify]");
    const emailLabel = root.querySelector("[data-auth-email-label]");
    const resendBtn = root.querySelector("[data-auth-resend]");
    const otpBoxes = Array.prototype.slice.call(root.querySelectorAll("[data-auth-otp-box]"));
    let email = "";
    let busy = false;

    // ── 6 ô OTP ──────────────────────────────────────────────────────────────
    const otpValue = () => otpBoxes.map((b) => b.value).join("");
    const clearOtp = () => otpBoxes.forEach((b) => (b.value = ""));
    const focusOtp = (i) => otpBoxes[Math.max(0, Math.min(i, 5))]?.focus();
    function fillOtp(str) {
      const d = String(str).replace(/\D/g, "").slice(0, 6).split("");
      otpBoxes.forEach((b, i) => (b.value = d[i] || ""));
      focusOtp(d.length >= 6 ? 5 : d.length);
    }

    // Cooldown gửi lại mã — khớp mặc định Supabase (60s giữa 2 lần gửi tới cùng email)
    const RESEND_COOLDOWN = 60;
    let _cdTimer = null;
    function startResendCooldown() {
      clearInterval(_cdTimer);
      let left = RESEND_COOLDOWN;
      const tick = () => {
        if (left <= 0) {
          clearInterval(_cdTimer);
          resendBtn.disabled = false;
          resendBtn.classList.remove("opacity-50", "cursor-not-allowed");
          resendBtn.textContent = "Gửi lại mã";
          return;
        }
        resendBtn.disabled = true;
        resendBtn.classList.add("opacity-50", "cursor-not-allowed");
        resendBtn.textContent = `Gửi lại sau ${left}s`;
        left--;
      };
      tick();
      _cdTimer = setInterval(tick, 1000);
    }

    // Gửi mã OTP 6 số tới email (tự tạo tài khoản nếu chưa có)
    async function sendCode() {
      const val = emailEl.value.trim();
      if (!_EMAIL_RE.test(val)) return _toast("Vui lòng nhập email hợp lệ", "error");
      if (busy) return;
      busy = true;
      sendBtn.disabled = true;
      sendLabel.textContent = "Đang gửi...";
      try {
        const { error } = await sb.auth.signInWithOtp({
          email: val,
          options: { shouldCreateUser: true },
        });
        if (error) throw error;
        email = val;
        emailLabel.textContent = val;
        stepEmail.classList.add("hidden");
        stepCode.classList.remove("hidden");
        clearOtp();
        focusOtp(0);
        startResendCooldown(); // khoá nút "Gửi lại mã" 60s tránh 429
        _toast("Đã gửi mã 6 số tới email của bạn", "success");
      } catch (err) {
        _toast(_friendlyError(err), "error");
      } finally {
        busy = false;
        sendBtn.disabled = false;
        sendLabel.textContent = "Gửi mã xác thực";
      }
    }

    // Xác thực mã → tạo phiên đăng nhập
    async function verifyCode() {
      const token = otpValue().replace(/\D/g, "");
      if (token.length !== 6) return _toast("Vui lòng nhập đủ 6 số", "error");
      if (busy) return;
      busy = true;
      verifyBtn.disabled = true;
      try {
        const { data, error } = await sb.auth.verifyOtp({
          email,
          token,
          type: "email",
        });
        if (error) throw error;
        _toast("Đăng nhập thành công", "success");
        opts.onAuth && opts.onAuth(data.user);
      } catch (err) {
        _toast(_friendlyError(err), "error");
        clearOtp();
        focusOtp(0);
      } finally {
        busy = false;
        verifyBtn.disabled = false;
      }
    }

    sendBtn.addEventListener("click", sendCode);
    emailEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); sendCode(); }
    });

    // 6 ô OTP: tự nhảy ô, xoá lùi, mũi tên, paste rải đều — đủ 6 số thì tự đăng nhập
    otpBoxes.forEach((box, idx) => {
      box.addEventListener("input", () => {
        box.value = box.value.replace(/\D/g, "").slice(-1); // chỉ giữ 1 chữ số cuối
        if (box.value && idx < 5) focusOtp(idx + 1);
        if (otpValue().length === 6) verifyCode();
      });
      box.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !box.value && idx > 0) focusOtp(idx - 1);
        else if (e.key === "ArrowLeft" && idx > 0) { e.preventDefault(); focusOtp(idx - 1); }
        else if (e.key === "ArrowRight" && idx < 5) { e.preventDefault(); focusOtp(idx + 1); }
        else if (e.key === "Enter") { e.preventDefault(); verifyCode(); }
      });
      box.addEventListener("paste", (e) => {
        e.preventDefault();
        const txt = ((e.clipboardData || window.clipboardData) || { getData: () => "" }).getData("text") || "";
        fillOtp(txt);
        if (otpValue().length === 6) verifyCode();
      });
    });
    verifyBtn.addEventListener("click", verifyCode);

    resendBtn.addEventListener("click", () => sendCode());
    root.querySelector("[data-auth-change]").addEventListener("click", () => {
      stepCode.classList.add("hidden");
      stepEmail.classList.remove("hidden");
      clearOtp();
      emailEl.focus();
    });

    root.querySelectorAll("[data-auth-oauth]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const provider = btn.getAttribute("data-auth-oauth");
        const { error } = await sb.auth.signInWithOAuth({
          provider,
          options: { redirectTo: oauthRedirect },
        });
        if (error) _toast("Lỗi đăng nhập: " + error.message, "error");
      });
    });
  }

  function renderForm(container, opts) {
    if (!container) return;
    container.innerHTML = _formHtml();
    _wire(container.querySelector("[data-auth-root]"), opts);
  }

  function closeModal() {
    const m = document.getElementById("auth-ui-modal");
    if (m) m.remove();
  }

  function openModal(opts) {
    opts = opts || {};
    closeModal();
    const modal = document.createElement("div");
    modal.id = "auth-ui-modal";
    modal.className =
      "fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/50";
    modal.innerHTML = `
      <div class="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 class="text-base font-semibold text-gray-800">${opts.title || "Đăng nhập để tiếp tục"}</h3>
            ${opts.subtitle ? `<p class="text-xs text-gray-400 mt-0.5">${opts.subtitle}</p>` : ""}
          </div>
          <button type="button" data-auth-close class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 text-gray-400 transition-colors">
            <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div class="p-5" data-auth-modal-body></div>
      </div>`;
    document.body.appendChild(modal);

    const wrappedOnAuth = (user) => {
      closeModal();
      opts.onAuth && opts.onAuth(user);
    };
    renderForm(modal.querySelector("[data-auth-modal-body]"), {
      onAuth: wrappedOnAuth,
      oauthRedirect: opts.oauthRedirect,
    });

    modal.querySelector("[data-auth-close]").addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }

  window.AuthUI = { supabase: sb, renderForm, openModal, closeModal };
})();
