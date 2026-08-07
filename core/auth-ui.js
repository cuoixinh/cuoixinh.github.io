// auth-ui.js — UI + logic đăng nhập / tạo tài khoản DÙNG CHUNG (trang chủ, mẫu
// thiệp, đơn hàng, invitation-setup). Nạp sau supabase-js và core/config.js.
//   AuthUI.supabase              client dùng chung
//   AuthUI.renderForm(el, opts)  đổ form vào 1 container; opts.onAuth(user)
//   AuthUI.openModal(opts)       mở popup chứa form; opts.oauthRedirect
//   AuthUI.closeModal()
(function () {
  const { createClient } = window.supabase;
  const sb = createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);

  const _toast = (m, t) =>
    (typeof showToast === "function" ? showToast(m, t) : console.log("[auth]", m));

  // Tên hiển thị của khách: ưu tiên tên đầy đủ (OAuth) → tên → phần trước @ của email → "bạn".
  function displayName(user) {
    const m = (user && user.user_metadata) || {};
    const n = (m.full_name || m.name || m.display_name || "").trim();
    if (n) return n;
    const email = (user && user.email) || "";
    return email ? email.split("@")[0] : "bạn";
  }

  // Cờ nhớ "vừa bấm đăng nhập OAuth" → sau khi redirect quay lại + có phiên thì toast.
  const _OAUTH_TOAST_KEY = "cx_oauth_login_toast";
  // Đánh dấu "vừa đăng nhập OAuth" để trang kế tiếp (có phiên) toast lời chào. Dùng ở nút
  // OAuth VÀ ở trang trung chuyển (account) trước khi điều hướng tiếp — nếu không, toast
  // chỉ chớp trên trang trung chuyển rồi bị redirect xoá mất.
  function armLoginToast() {
    try { sessionStorage.setItem(_OAUTH_TOAST_KEY, "1"); } catch {}
  }
  // Toast lời chào "Xin chào <tên>" — dùng chung cho OAuth (qua cờ) lẫn OTP (gọi trực tiếp).
  function greet(user) {
    _toast("Xin chào " + displayName(user), "success");
  }

  // ── Đưa OAuth về đúng màn đang đứng ───────────────────────────────────────
  // Supabase chỉ chấp redirectTo trong whitelist. auth-ui.js được nạp ở MỌI trang
  // nên: nhớ màn cần quay lại vào sessionStorage, OAuth hạ cánh ở trang nào thì
  // listener dưới đây tự bật về đúng màn đó.
  const _OAUTH_RETURN_KEY = "cx_oauth_return";
  // So khớp theo PATHNAME (bỏ origin/hash/query) để tránh lệch trailing-slash hay
  // query bị trang đích dọn (vd pendingPublish) gây bật đi bật lại.
  const _samePath = (a, b) => {
    try {
      const pa = new URL(a, location.href).pathname.replace(/\/+$/, "");
      const pb = new URL(b, location.href).pathname.replace(/\/+$/, "");
      return pa === pb;
    } catch { return false; }
  };
  sb.auth.onAuthStateChange((_event, session) => {
    if (!session?.user) return;
    // 1) Còn màn cần quay lại + đang đứng SAI màn → bật về đó (giữ cờ toast để chào ở đích).
    let ret = null;
    try { ret = sessionStorage.getItem(_OAUTH_RETURN_KEY); } catch {}
    if (ret) {
      try { sessionStorage.removeItem(_OAUTH_RETURN_KEY); } catch {}
      if (!_samePath(location.href, ret)) {
        window.location.replace(ret);
        return;
      }
    }
    // 2) Đã ở đúng màn → chào (nếu vừa đăng nhập OAuth).
    let pending = null;
    try { pending = sessionStorage.getItem(_OAUTH_TOAST_KEY); } catch {}
    if (pending) {
      try { sessionStorage.removeItem(_OAUTH_TOAST_KEY); } catch {}
      greet(session.user);
    }
  });

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
    provider_disabled: "Đăng nhập mạng xã hội đang bị tắt. Vui lòng dùng email.",
    oauth_provider_not_supported: "Nhà cung cấp đăng nhập này chưa được bật.",
  };
  function _friendlyError(err) {
    const code = (err && (err.code || err.error_code)) || "";
    if (_AUTH_ERR[code]) return _AUTH_ERR[code];
    // Code lạ → thông báo chung, kèm message gốc để còn debug
    return "Có lỗi xảy ra: " + ((err && err.message) || "Vui lòng thử lại.");
  }

  const _FB_SVG = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`;
  const _GG_SVG = `<svg class="w-4 h-4" viewBox="0 0 24 24"><path fill="rgb(var(--google-blue-rgb))" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="rgb(var(--google-green-rgb))" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="rgb(var(--google-yellow-rgb))" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="rgb(var(--google-red-rgb))" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`;

  const _HEART_SVG = `<svg viewBox="0 0 24 24" fill="rgb(var(--pink-deep-rgb))" class="w-5 h-5"><path d="M12 21s-6.716-4.297-9.428-7.01C.86 12.278.5 10.5 1.05 8.86A4.5 4.5 0 0 1 8.5 6.9l.5.5.5-.5a4.5 4.5 0 0 1 7.45 1.96c.55 1.64.19 3.42-1.52 5.13C18.716 16.703 12 21 12 21z"/></svg>`;
  const _MAIL_SVG = `<svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`;

  const _INPUT_CLS =
    "w-full h-11 px-3.5 border border-gray-200 rounded-xl text-sm text-gray-800 bg-white outline-none focus:ring-2 focus:ring-rose-400/30 focus:border-rose-300 transition-all placeholder:text-gray-400";

  const _BTN_CLS =
    "w-full h-11 rounded-xl text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60";

  // Nút OAuth kiểu "Tiếp tục với …" — viền nhạt, xếp dọc, full width
  const _OAUTH_CLS =
    "w-full h-11 rounded-xl border border-gray-200 bg-white flex items-center justify-center gap-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors";

  function _formHtml() {
    return `
      <div data-auth-root>
        <!-- Bước 1: OAuth (dọc) → hoặc → email -->
        <div data-auth-step="email" class="space-y-2.5">
          <button type="button" data-auth-oauth="google" class="${_OAUTH_CLS}">
            ${_GG_SVG} Tiếp tục với Google
          </button>
          <button type="button" data-auth-oauth="facebook" class="${_OAUTH_CLS}">
            <span style="color:rgb(var(--social-facebook-rgb));display:flex">${_FB_SVG}</span> Tiếp tục với Facebook
          </button>

          <div class="flex items-center gap-3 !my-4">
            <div class="flex-1 h-px bg-gray-200"></div>
            <span class="text-xs text-gray-400">hoặc</span>
            <div class="flex-1 h-px bg-gray-200"></div>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1.5">Email của bạn</label>
            <input data-auth-email type="email" inputmode="email" autocomplete="email" required
              placeholder="email@example.com" class="${_INPUT_CLS}" />
          </div>
          <button type="button" data-auth-send class="${_BTN_CLS} !mt-3">
            ${_MAIL_SVG}<span data-auth-send-label>Gửi mã đăng nhập</span>
          </button>
          <p class="text-center text-xs text-gray-400 leading-relaxed !mt-3">
            Một mã gồm 6 chữ số sẽ được gửi tới email của bạn — đăng nhập chỉ trong vài giây, khỏi cần nhớ mật khẩu.
          </p>
          <p class="text-center text-[11px] text-gray-400 leading-relaxed !mt-4 pt-3 border-t border-gray-100">
            Tiếp tục đồng nghĩa bạn đồng ý với
            <span class="text-color-secondary font-medium">Điều khoản</span> &amp;
            <span class="text-color-secondary font-medium">Chính sách bảo mật</span> của Cưới Xinh.
          </p>
        </div>

        <!-- Bước 2: nhập mã 6 số -->
        <div data-auth-step="code" class="hidden space-y-4">
          <button type="button" data-auth-change
            class="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors -ml-1 px-1 py-1 rounded-lg">
            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Đổi email
          </button>

          <div class="text-center space-y-1">
            <p class="text-sm text-gray-600">Nhập mã 6 số chúng mình vừa gửi tới</p>
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
        greet(data.user);
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
        // Đánh dấu để sau khi redirect OAuth quay lại thì toast lời chào.
        // (Luồng OTP toast ngay tại chỗ; OAuth rời trang nên phải nhớ qua sessionStorage.)
        armLoginToast();
        // Nhớ màn cần quay lại. redirectTo thử về thẳng màn đó; nếu URL chưa whitelist,
        // Supabase đá về Site URL (trang chủ) — nhưng auth-ui.js ở trang chủ sẽ đọc
        // cờ này và tự bật về đúng màn (xem onAuthStateChange ở trên).
        try { sessionStorage.setItem(_OAUTH_RETURN_KEY, oauthRedirect); } catch {}
        const { error } = await sb.auth.signInWithOAuth({
          provider,
          options: { redirectTo: oauthRedirect },
        });
        if (error) {
          try { sessionStorage.removeItem(_OAUTH_TOAST_KEY); } catch {}
          try { sessionStorage.removeItem(_OAUTH_RETURN_KEY); } catch {}
          _toast(_friendlyError(error), "error");
        }
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
      <div class="relative bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <!-- Thanh gradient trên đỉnh -->
        <div class="h-1.5 bg-gradient-to-r from-[rgb(var(--pink-deep-rgb))] via-[rgb(var(--pink-350-rgb))] to-[rgb(var(--pink-400-rgb))]"></div>

        <button type="button" data-auth-close
          class="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 text-gray-400 transition-colors">
          <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>

        <div class="px-6 pt-6 pb-6">
          <!-- Trái tim -->
          <div class="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3" style="background: rgb(var(--app-rose-pastel-100-rgb))">
            ${_HEART_SVG}
          </div>
          <h3 class="text-center text-xl font-bold text-gray-800">${opts.title || "Đăng nhập"}</h3>
          <p class="text-center text-sm text-gray-500 mt-1">${opts.subtitle || "Tiếp tục hành trình chuẩn bị đám cưới cùng Cưới Xinh"}</p>

          <!-- 2 chip tin cậy -->
          <div class="flex flex-wrap justify-center gap-2 mt-3.5 mb-5">
            <span class="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full" style="background:rgb(var(--app-rose-pastel-100-rgb));color:rgb(var(--mauve-rose-rgb))">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-6.716-4.297-9.428-7.01C.86 12.278.5 10.5 1.05 8.86A4.5 4.5 0 0 1 8.5 6.9l.5.5.5-.5a4.5 4.5 0 0 1 7.45 1.96c.55 1.64.19 3.42-1.52 5.13C18.716 16.703 12 21 12 21z"/></svg>
              Miễn phí
            </span>
            <span class="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full" style="background:rgb(var(--green-tint-rgb));color:rgb(var(--green-fg-rgb))">
              <svg class="w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
              Không cần mật khẩu
            </span>
          </div>

          <div data-auth-modal-body></div>
        </div>
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

  window.AuthUI = { supabase: sb, renderForm, openModal, closeModal, armLoginToast };
})();
